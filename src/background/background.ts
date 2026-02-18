/**
 * ElementHider Background Service Worker
 * Minimal service worker — storage is accessed directly from content/popup.
 */

chrome.runtime.onInstalled.addListener(() => {
  console.log("[ElementHider] Extension installed.");
});

chrome.runtime.onMessage.addListener(
  (
    message: { type: string },
    sender: chrome.runtime.MessageSender,
    sendResponse: (r?: unknown) => void
  ): boolean | undefined => {
    // コンテンツスクリプトからのスクリーンショット要求
    if (message.type === "CAPTURE_VISIBLE_TAB") {
      const windowId = sender.tab?.windowId ?? chrome.windows.WINDOW_ID_CURRENT;
      chrome.tabs.captureVisibleTab(
        windowId,
        { format: "png" },
        (dataUrl) => sendResponse({ dataUrl })
      );
      return true; // 非同期 sendResponse のためチャンネルを開いたままにする
    }

    // 要素が非表示にされたらポップアップを自動で再表示する
    if (message.type === "ELEMENT_HIDDEN" && sender.tab) {
      chrome.action.openPopup().catch(() => {
        // ユーザーがタブを切り替えた場合など、開けないケースは無視
      });
    }
  }
);
