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

