/**
 * ElementHider Background Service Worker
 * Minimal service worker — storage is accessed directly from content/popup.
 */

chrome.runtime.onInstalled.addListener(() => {
  console.log("[ElementHider] Extension installed.");
});

// 要素が非表示にされたらポップアップを自動で再表示する
chrome.runtime.onMessage.addListener(
  (message: { type: string }, sender) => {
    if (message.type !== "ELEMENT_HIDDEN") return;
    // sender.tab が存在する場合のみ（コンテンツスクリプトからのメッセージ）
    if (!sender.tab) return;

    chrome.action.openPopup().catch(() => {
      // ユーザーがタブを切り替えた場合など、開けないケースは無視
    });
  }
);
