/**
 * ElementHider Background Service Worker
 * Minimal service worker — storage is accessed directly from content/sidepanel.
 */

chrome.runtime.onInstalled.addListener(() => {
  console.log("[ElementHider] Extension installed.");
});

// 拡張アイコンクリック → サイドパネルを開く
chrome.action.onClicked.addListener((tab) => {
  if (tab.id != null) {
    chrome.sidePanel.open({ tabId: tab.id });
  }
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
      return true;
    }
  }
);
