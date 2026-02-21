/**
 * ElementHider Content Script
 * Uses React for the picker UI (tooltip). Picker state is managed via hooks.
 * Mounted into a fixed host div with inline styles for style isolation.
 */

import { createRoot } from "react-dom/client";
import { useState, useEffect, useRef, useCallback } from "react";
import type { ManagedElement, Message, SiteStorage } from "../shared/messages";
import {
  EH_ROOT_ID,
  EH_HIDE_STYLE_ID,
  EH_INITIAL_HIDE_STYLE_ID,
  EH_HIGHLIGHT_CLASS,
  EH_TOOLTIP_ID,
  EH_CLASS_PREFIX,
  LABEL_MAX_LENGTH,
  HIGHLIGHT_DURATION_MS,
} from "../shared/config";

// ─── CSS Selector Generation ──────────────────────────────────────────────────

/** 単一要素の最適なセレクタ部品を返す（祖先は含まない）。
 *  優先順位: #id（ユニーク確認済み）→ tag.class → a[href] → tag
 */
function buildSelectorForElement(el: Element): string {
  const tag = el.tagName.toLowerCase();

  // 優先1: id（ページ内でユニークな場合のみ）
  if (el.id) {
    const idSel = `#${CSS.escape(el.id)}`;
    try {
      if (document.querySelectorAll(idSel).length === 1) return idSel;
    } catch { /* 無効なセレクタは無視 */ }
  }

  // 優先2: クラス（拡張機能独自クラスは除外）
  const classes = Array.from(el.classList)
    .filter((c) => !c.startsWith(EH_CLASS_PREFIX))
    .map((c) => `.${CSS.escape(c)}`)
    .join("");

  // 優先3: <a> タグの href（id・class の次に有力）
  if (tag === "a") {
    const href = el.getAttribute("href");
    if (href) {
      const escapedHref = href.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
      return `${tag}${classes}[href="${escapedHref}"]`;
    }
  }

  return classes ? `${tag}${classes}` : tag;
}

/** セレクタがページ内でちょうど 1 件にマッチするか確認する。 */
function isUniqueSelector(sel: string): boolean {
  try {
    return document.querySelectorAll(sel).length === 1;
  } catch {
    return false;
  }
}

/**
 * parent の子孫を BFS で探索し、ページ内でユニークなセレクタを持つ
 * 最初の子孫要素のセレクタを返す。見つからなければ null。
 */
function findUniqueDescendantSelector(parent: Element): string | null {
  const queue: Element[] = Array.from(parent.children);
  while (queue.length > 0) {
    const child = queue.shift()!;
    const sel = buildSelectorForElement(child);
    if (isUniqueSelector(sel)) return sel;
    queue.push(...Array.from(child.children));
  }
  return null;
}

/**
 * el をページ内でユニークに特定できる CSS セレクタを返す。
 * 1. el 自身のセレクタで試す。
 * 2. ユニークでなければ子孫にユニークな要素を探し :has() で特定する。
 * 3. それでも非ユニークなら、祖先チェーンを辿りながら
 *    「祖先パス el_selector」と「祖先パス el_selector:has(descSel)」を試す。
 * 4. いずれの方法でもユニークにできなければ最終パスを返す。
 */
function getUniqueCssSelector(el: Element): string {
  const ownSel = buildSelectorForElement(el);

  // Step 1: 自身のセレクタがユニークか確認
  if (isUniqueSelector(ownSel)) return ownSel;

  // Step 2: 子孫にユニークな要素を探し :has() で特定
  const descSel = findUniqueDescendantSelector(el);
  if (descSel && isUniqueSelector(`${ownSel}:has(${descSel})`)) {
    return `${ownSel}:has(${descSel})`;
  }

  // Step 3: 祖先チェーンを辿り、セレクタパスを構築
  const parts: string[] = [ownSel];
  let current: Element | null = el.parentElement;
  while (current && current !== document.documentElement && current !== document.body) {
    const parentSel = buildSelectorForElement(current);
    parts.unshift(parentSel);

    // 祖先パスのみで試す
    if (isUniqueSelector(parts.join(" "))) return parts.join(" ");

    // 祖先パス + :has() で試す
    if (descSel) {
      const hasSel = [...parts.slice(0, -1), `${ownSel}:has(${descSel})`].join(" ");
      if (isUniqueSelector(hasSel)) return hasSel;
    }

    // ユニークな id に到達したらそれ以上辿っても意味がない
    if (parentSel.startsWith("#")) break;
    current = current.parentElement;
  }

  // Step 4: フォールバック（:has() があれば優先）
  if (descSel) return `${ownSel}:has(${descSel})`;
  return parts.join(" ");
}

function buildLabel(el: Element): string {
  // 可視テキスト（innerText は子要素の表示テキストを含む）
  const inner = el instanceof HTMLElement ? el.innerText?.trim() : "";
  // フォールバック: SVG の <title> や非表示テキストも含む textContent
  const raw = inner || (el.textContent?.trim() ?? "");
  const normalized = raw.replace(/\s+/g, " ");
  const text = normalized.length > LABEL_MAX_LENGTH
    ? normalized.slice(0, normalized.lastIndexOf(" ", LABEL_MAX_LENGTH) || LABEL_MAX_LENGTH) + "…"
    : normalized;
  if (text) return text;

  // 属性チェック: 要素本体 + すべての子孫要素（aria-label / title / alt / placeholder）
  const candidates = [el, ...Array.from(el.querySelectorAll("*"))];
  for (const node of candidates) {
    const attr =
      node.getAttribute("aria-label") ||
      node.getAttribute("title") ||
      node.getAttribute("alt") ||
      (node as HTMLInputElement).placeholder ||
      "";
    if (attr.trim()) return attr.trim().slice(0, LABEL_MAX_LENGTH);
  }

  const tag = el.tagName.toLowerCase();
  const id = el.id ? `#${el.id}` : "";
  const cls = el.classList[0] ? `.${el.classList[0]}` : "";
  return `<${tag}${id}${cls}>`;
}

/** 拡張機能自身のルート以外はすべて選択可能とする。 */
function isSelectableTarget(el: Element): boolean {
  return !el.closest(`#${EH_ROOT_ID}`);
}

// ─── Storage helpers ──────────────────────────────────────────────────────────

const getHostname = () => window.location.hostname;

/** ページ訪問時刻（コンテンツスクリプト初期化時に確定） */
const _currentLastVisited = Date.now();

async function loadManagedElements(): Promise<ManagedElement[]> {
  const host = getHostname();
  const result = await chrome.storage.local.get(host);
  const stored = result[host] as { elements?: unknown } | undefined;
  const rawElements = stored?.elements;
  const elements: ManagedElement[] = Array.isArray(rawElements) ? rawElements : [];
  return elements.map((e) => ({ ...e, isHidden: e.isHidden ?? true }));
}

async function saveManagedElements(elements: ManagedElement[]): Promise<void> {
  const storage: SiteStorage = { elements, lastVisited: _currentLastVisited };
  await chrome.storage.local.set({ [getHostname()]: storage });
}

async function addManagedElement(el: ManagedElement): Promise<void> {
  const existing = await loadManagedElements();
  if (!existing.some((e) => e.selector === el.selector)) {
    await saveManagedElements([...existing, el]);
  }
}

const EH_TIMER_KEY = "__ehHighlightTimer";

function clearHighlight(el: Element) {
  const timer = (el as Element & { [EH_TIMER_KEY]?: ReturnType<typeof setTimeout> })[EH_TIMER_KEY];
  if (timer !== undefined) {
    clearTimeout(timer);
    delete (el as Element & { [EH_TIMER_KEY]?: ReturnType<typeof setTimeout> })[EH_TIMER_KEY];
  }
  el.classList.remove(EH_HIGHLIGHT_CLASS);
}

// ─── CSS-based hide management ────────────────────────────────────────────────
// <style id="eh-hide"> で非表示セレクタを一元管理する。
// CSS はページに常に適用されるため、遅延ロードされた要素にも自動で効く。

const hiddenSelectors = new Set<string>();

/** early-inject.ts が用意した #eh-initial-hide を引き継ぐか、新規作成する。 */
function getHideStyle(): HTMLStyleElement {
  const existing =
    (document.getElementById(EH_HIDE_STYLE_ID) ??
      document.getElementById(EH_INITIAL_HIDE_STYLE_ID)) as HTMLStyleElement | null;
  if (existing) {
    existing.id = EH_HIDE_STYLE_ID;
    return existing;
  }
  const style = document.createElement("style");
  style.id = EH_HIDE_STYLE_ID;
  document.documentElement.appendChild(style);
  return style;
}

function refreshHideStyle() {
  const style = getHideStyle();
  style.textContent =
    hiddenSelectors.size > 0
      ? [...hiddenSelectors].join(",\n") + " { display: none !important; }"
      : "";
}

function hideElementBySelector(selector: string) {
  try {
    document.querySelectorAll(selector); // セレクタの有効性を検証
  } catch {
    return; // invalid selector
  }
  // 現在表示されているマッチ要素のハイライトを解除
  try {
    document.querySelectorAll(selector).forEach(clearHighlight);
  } catch { /* ignore */ }
  hiddenSelectors.add(selector);
  refreshHideStyle();
}

function showElementBySelector(selector: string) {
  hiddenSelectors.delete(selector);
  refreshHideStyle();
  try {
    document.querySelectorAll(selector).forEach((el) => {
      (el as HTMLElement).scrollIntoView({ behavior: "smooth", block: "center" });
      clearHighlight(el);
      el.classList.add(EH_HIGHLIGHT_CLASS);
      const timer = setTimeout(() => {
        el.classList.remove(EH_HIGHLIGHT_CLASS);
        delete (el as Element & { [EH_TIMER_KEY]?: ReturnType<typeof setTimeout> })[EH_TIMER_KEY];
      }, HIGHLIGHT_DURATION_MS);
      (el as Element & { [EH_TIMER_KEY]?: ReturnType<typeof setTimeout> })[EH_TIMER_KEY] = timer;
    });
  } catch {
    // invalid selector
  }
}

// ─── Tooltip Component ────────────────────────────────────────────────────────

interface TooltipProps {
  x: number;
  y: number;
  element: Element;
}

function Tooltip({ x, y, element }: TooltipProps) {
  const tag = element.tagName.toLowerCase();
  const id = element.id ? `#${element.id}` : "";
  const classes = Array.from(element.classList)
    .filter((c) => !c.startsWith(EH_CLASS_PREFIX))
    .slice(0, 3)
    .map((c) => `.${c}`)
    .join("");

  // Keep tooltip within viewport
  const GAP = 14;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const estW = (tag.length + id.length + classes.length) * 7 + 20;
  const estH = 28;
  const tx = x + GAP + estW > vw ? x - estW - GAP : x + GAP;
  const ty = y + GAP + estH > vh ? y - estH - GAP : y + GAP;

  return (
    <div id={EH_TOOLTIP_ID} style={{ left: tx, top: ty }}>
      <span className="eh-tag">{tag}</span>
      <span className="eh-id">{id}</span>
      <span className="eh-class">{classes}</span>
    </div>
  );
}

// ─── Main Picker App ──────────────────────────────────────────────────────────

interface TooltipState {
  x: number;
  y: number;
  element: Element;
}

function PickerApp() {
  const [isPickerActive, setIsPickerActive] = useState(false);
  const [tooltipState, setTooltipState] = useState<TooltipState | null>(null);
  const highlightedRef = useRef<Element | null>(null);
  // Ref to expose current picker state to the message handler synchronously
  const isPickerActiveRef = useRef(false);
  const multiSelectRef = useRef(false);

  // Keep ref in sync with state
  useEffect(() => {
    isPickerActiveRef.current = isPickerActive;
  }, [isPickerActive]);

  // ── Message handler (registered once) ────────────────────────────────────
  useEffect(() => {
    const handler = (
      message: Message,
      _sender: chrome.runtime.MessageSender,
      sendResponse: (response?: unknown) => void
    ): void => {
      switch (message.type) {
        case "START_PICKER":
          setIsPickerActive(true);
          multiSelectRef.current = message.multiSelect;
          sendResponse();
          break;

        case "STOP_PICKER":
          setIsPickerActive(false);
          sendResponse();
          break;

        case "GET_STATUS":
          sendResponse({
            type: "STATUS",
            isPickerActive: isPickerActiveRef.current,
          });
          break;

        case "SHOW_ELEMENT":
          showElementBySelector(message.selector);
          sendResponse();
          break;

        case "HIDE_ELEMENT":
          hideElementBySelector(message.selector);
          sendResponse();
          break;
      }
    };

    chrome.runtime.onMessage.addListener(handler);
    return () => chrome.runtime.onMessage.removeListener(handler);
  }, []);

  // ── Event handlers ────────────────────────────────────────────────────────

  const handleMouseMove = useCallback((e: MouseEvent) => {
    const target = e.target as Element;
    if (target === highlightedRef.current) {
      setTooltipState((t) => (t ? { ...t, x: e.clientX, y: e.clientY } : null));
      return;
    }
    highlightedRef.current?.classList.remove("eh-highlight");
    highlightedRef.current = null;
    if (
      target &&
      target !== document.documentElement &&
      target !== document.body &&
      isSelectableTarget(target)
    ) {
      target.classList.add("eh-highlight");
      highlightedRef.current = target;
      setTooltipState({ x: e.clientX, y: e.clientY, element: target });
    } else {
      setTooltipState(null);
    }
  }, []);

  const handleClick = useCallback(async (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const target = e.target as Element;
    if (
      !target ||
      target === document.documentElement ||
      target === document.body
    )
      return;

    // id がない、または id がページ内でユニークでない要素は選択不可
    if (!isSelectableTarget(target)) return;

    const selector = getUniqueCssSelector(target);
    const label = buildLabel(target);

    target.classList.remove("eh-highlight");
    highlightedRef.current = null;

    hideElementBySelector(selector);
    await addManagedElement({ selector, label, timestamp: Date.now(), isHidden: true });
    chrome.runtime.sendMessage({ type: "ELEMENT_HIDDEN", selector, label });

    if (!multiSelectRef.current) {
      setIsPickerActive(false);
      chrome.runtime.sendMessage({ type: "STATUS", isPickerActive: false });
    }
  }, []);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") {
      setIsPickerActive(false);
      chrome.runtime.sendMessage({ type: "STATUS", isPickerActive: false });
    }
  }, []);

  // ── Attach / detach listeners based on picker state ───────────────────────

  useEffect(() => {
    const cleanup = () => {
      document.documentElement.style.cursor = "";
      document.removeEventListener("mousemove", handleMouseMove, true);
      document.removeEventListener("click", handleClick, true);
      document.removeEventListener("keydown", handleKeyDown, true);
      highlightedRef.current?.classList.remove("eh-highlight");
      highlightedRef.current = null;
      setTooltipState(null);
    };

    if (isPickerActive) {
      document.documentElement.style.cursor = "crosshair";
      document.addEventListener("mousemove", handleMouseMove, true);
      document.addEventListener("click", handleClick, true);
      document.addEventListener("keydown", handleKeyDown, true);
    } else {
      cleanup();
    }

    return cleanup;
  }, [isPickerActive, handleMouseMove, handleClick, handleKeyDown]);

  // ── Render ────────────────────────────────────────────────────────────────

  if (!tooltipState) return null;

  return (
    <Tooltip
      x={tooltipState.x}
      y={tooltipState.y}
      element={tooltipState.element}
    />
  );
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────

function mountPickerApp() {
  // Host element: fixed, zero-size, pointer-events off — won't interfere with page
  const host = document.createElement("div");
  host.id = EH_ROOT_ID;
  host.style.cssText =
    "position:fixed;top:0;left:0;width:0;height:0;overflow:visible;z-index:2147483647;pointer-events:none;";
  document.documentElement.appendChild(host);
  createRoot(host).render(<PickerApp />);
}

(async () => {
  // 二重注入防止（マニフェスト自動注入 + executeScript 手動注入の衝突回避）
  if (document.getElementById(EH_ROOT_ID)) return;
  mountPickerApp();

  // ストレージから非表示要素を復元し、hiddenSelectors に登録して CSS を更新。
  // #eh-initial-hide（early-inject.ts 製）を #eh-hide として引き継ぐ。
  const elements = await loadManagedElements();
  // lastVisited を現在時刻に更新して保存
  if (elements.length > 0) {
    await saveManagedElements(elements);
  }
  elements.forEach((el) => {
    if (el.isHidden !== false) {
      try {
        document.querySelectorAll(el.selector); // セレクタ検証
        hiddenSelectors.add(el.selector);
      } catch {
        // invalid selector
      }
    }
  });
  refreshHideStyle();
})();
