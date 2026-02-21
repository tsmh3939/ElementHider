/**
 * ElementHider Early Inject
 * document_start で実行され、前回セッションで非表示にした要素を
 * ストレージから読み込み、コンテンツスクリプトより先に CSS で隠す。
 * → ページロード時のちらつきを防ぐ。
 *
 * メインのコンテンツスクリプト (content.tsx) がインラインスタイルで
 * 管理を引き継いだ後、このスタイルタグ (#eh-initial-hide) を削除する。
 */

import { EH_INITIAL_HIDE_STYLE_ID } from "../shared/config";

(async () => {
  const hostname = window.location.hostname;
  if (!hostname) return;

  const result = await chrome.storage.local.get(hostname);
  const stored = result[hostname] as { elements?: unknown } | undefined;
  const rawElements = stored?.elements;
  const elements: Array<{ selector: string; isHidden?: boolean }> = Array.isArray(rawElements) ? rawElements : [];

  const hiddenSelectors = elements
    .filter((e) => e.isHidden !== false)
    .map((e) => e.selector)
    .filter(Boolean);

  if (hiddenSelectors.length === 0) return;

  const style = document.createElement("style");
  style.id = EH_INITIAL_HIDE_STYLE_ID;
  style.textContent = `${hiddenSelectors.join(",\n")} { display: none !important; }`;
  document.documentElement.appendChild(style);
})();
