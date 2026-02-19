/**
 * ElementHider Content Script
 * Uses React for the picker UI (tooltip). Picker state is managed via hooks.
 * Mounted into a fixed host div with inline styles for style isolation.
 */

import { createRoot } from "react-dom/client";
import { useState, useEffect, useRef, useCallback } from "react";
import type { ManagedElement, Message } from "../shared/messages";

// ─── CSS Selector Generation ──────────────────────────────────────────────────

function getUniqueCssSelector(el: Element): string {
  const path: string[] = [];
  let current: Element | null = el;

  while (current && current !== document.body) {
    let segment = current.tagName.toLowerCase();

    if (current.id) {
      path.unshift(`#${CSS.escape(current.id)}`);
      break;
    }

    const classes = Array.from(current.classList)
      .filter((c) => !c.startsWith("eh-"))
      .slice(0, 2)
      .map((c) => `.${CSS.escape(c)}`)
      .join("");

    if (classes) segment += classes;

    const parent = current.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter(
        (c) => c.tagName === current!.tagName
      );
      if (siblings.length > 1) {
        segment += `:nth-of-type(${siblings.indexOf(current) + 1})`;
      }
    }

    path.unshift(segment);
    current = current.parentElement;
  }

  if (current === document.body) path.unshift("body");

  for (let i = path.length - 1; i >= 0; i--) {
    const selector = path.slice(i).join(" > ");
    try {
      if (document.querySelectorAll(selector).length === 1) return selector;
    } catch {
      // ignore invalid selectors
    }
  }

  return path.join(" > ");
}

function buildLabel(el: Element): string {
  const text = el.textContent?.trim().slice(0, 60) ?? "";
  if (text) return text;
  const tooltip =
    el.getAttribute("title") ||
    el.getAttribute("aria-label") ||
    el.getAttribute("alt") ||
    (el as HTMLInputElement).placeholder ||
    "";
  if (tooltip) return tooltip.slice(0, 60);
  const tag = el.tagName.toLowerCase();
  const id = el.id ? `#${el.id}` : "";
  const cls = el.classList[0] ? `.${el.classList[0]}` : "";
  return `<${tag}${id}${cls}>`;
}

// ─── Storage helpers ──────────────────────────────────────────────────────────

const getHostname = () => window.location.hostname;

async function loadManagedElements(): Promise<ManagedElement[]> {
  const host = getHostname();
  const result = await chrome.storage.local.get(host);
  const raw = (result[host] ?? []) as Array<Partial<ManagedElement>>;
  // Backward-compat: old entries without isHidden are treated as hidden
  return raw.map((e) => ({ ...e, isHidden: e.isHidden ?? true } as ManagedElement));
}

async function saveManagedElements(elements: ManagedElement[]): Promise<void> {
  await chrome.storage.local.set({ [getHostname()]: elements });
}

async function addManagedElement(el: ManagedElement): Promise<void> {
  const existing = await loadManagedElements();
  if (!existing.some((e) => e.selector === el.selector)) {
    await saveManagedElements([...existing, el]);
  }
}

function hideElementBySelector(selector: string) {
  try {
    document.querySelectorAll(selector).forEach(hideElement);
  } catch {
    // invalid selector
  }
}

function hideElement(el: Element) {
  (el as HTMLElement).style.setProperty("display", "none", "important");
}

function showElementBySelector(selector: string) {
  try {
    document.querySelectorAll(selector).forEach((el) => {
      (el as HTMLElement).style.removeProperty("display");
      (el as HTMLElement).scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("eh-highlight");
      setTimeout(() => el.classList.remove("eh-highlight"), 2500);
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
    .filter((c) => !c.startsWith("eh-"))
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
    <div id="eh-tooltip" style={{ left: tx, top: ty }}>
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
    if (
      target &&
      target !== document.documentElement &&
      target !== document.body
    ) {
      target.classList.add("eh-highlight");
      highlightedRef.current = target;
      setTooltipState({ x: e.clientX, y: e.clientY, element: target });
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

    const selector = getUniqueCssSelector(target);
    const label = buildLabel(target);

    target.classList.remove("eh-highlight");
    highlightedRef.current = null;

    hideElement(target);
    await addManagedElement({ selector, label, timestamp: Date.now(), isHidden: true });
    chrome.runtime.sendMessage({ type: "ELEMENT_HIDDEN", selector, label });

    setIsPickerActive(false);
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
  host.id = "eh-root";
  host.style.cssText =
    "position:fixed;top:0;left:0;width:0;height:0;overflow:visible;z-index:2147483647;pointer-events:none;";
  document.documentElement.appendChild(host);
  createRoot(host).render(<PickerApp />);
}

(async () => {
  mountPickerApp();

  // Restore hidden elements from previous session
  const elements = await loadManagedElements();
  elements.forEach((el) => {
    try {
      document.querySelectorAll(el.selector).forEach(hideElement);
    } catch {
      // invalid selector
    }
  });
})();
