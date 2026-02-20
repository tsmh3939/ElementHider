import type { Message } from "./types";

export async function sendToActiveTab(message: Message): Promise<void> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id != null) {
    try {
      await chrome.tabs.sendMessage(tab.id, message);
    } catch {
      // コンテンツスクリプト未準備（chrome:// や新しいタブなど）
    }
  }
}

export async function getActiveTabInfo(): Promise<{ hostname: string | null; isExtensionPage: boolean }> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url) return { hostname: null, isExtensionPage: false };
  try {
    const url = new URL(tab.url);
    if (url.protocol === "chrome-extension:") return { hostname: null, isExtensionPage: true };
    if (url.protocol !== "http:" && url.protocol !== "https:") return { hostname: null, isExtensionPage: false };
    return { hostname: url.hostname, isExtensionPage: false };
  } catch {
    return { hostname: null, isExtensionPage: false };
  }
}
