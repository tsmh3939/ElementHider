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
