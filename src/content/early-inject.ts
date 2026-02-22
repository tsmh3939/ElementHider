/**
 * ElementHider Early Inject
 * document_start で実行され、前回セッションで非表示にした要素を
 * ストレージから読み込み、コンテンツスクリプトより先に CSS で隠す。
 * → ページロード時のちらつきを防ぐ。
 *
 * メインのコンテンツスクリプト (content.tsx) がインラインスタイルで
 * 管理を引き継いだ後、このスタイルタグ (#eh-initial-hide) を削除する。
 */

import { EH_INITIAL_HIDE_STYLE_ID, HIDE_MODE_CSS } from "../shared/config";
import type { HideMode } from "../shared/messages";

(async () => {
  const hostname = window.location.hostname;
  if (!hostname) return;

  const result = await chrome.storage.local.get(hostname);
  const stored = result[hostname] as { elements?: unknown } | undefined;
  const rawElements = stored?.elements;
  const elements: Array<{ selector: string; isHidden?: boolean; hideMode?: HideMode }> = Array.isArray(rawElements) ? rawElements : [];

  // モードごとにセレクタをグループ化
  const groups = new Map<HideMode, string[]>();
  for (const el of elements) {
    if (el.isHidden === false) continue;
    if (!el.selector) continue;
    try { document.querySelectorAll(el.selector); } catch { continue; }
    const mode: HideMode = el.hideMode === "invisible" ? "invisible" : "hidden";
    const arr = groups.get(mode) ?? [];
    arr.push(el.selector);
    groups.set(mode, arr);
  }

  if (groups.size === 0) return;

  const rules: string[] = [];
  for (const [mode, selectors] of groups) {
    rules.push(`${selectors.join(",\n")} { ${HIDE_MODE_CSS[mode]} }`);
  }

  const style = document.createElement("style");
  style.id = EH_INITIAL_HIDE_STYLE_ID;
  style.textContent = rules.join("\n");
  document.documentElement.appendChild(style);
})();
