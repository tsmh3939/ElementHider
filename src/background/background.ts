/**
 * ElementHider Background Service Worker
 * Minimal service worker — storage is accessed directly from content/popup.
 */

// Keep service worker alive for message routing
chrome.runtime.onInstalled.addListener(() => {
  console.log("[ElementHider] Extension installed.");
});
