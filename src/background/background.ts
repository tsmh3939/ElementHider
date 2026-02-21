/**
 * ElementHider Background Service Worker
 */

import type { SiteStorage } from "../shared/messages";
import { CONTEXT_MENU_ID, EH_SETTINGS_KEY, type EhSettings } from "../shared/config";

// ─── Context menu ─────────────────────────────────────────────────────────────

async function applyContextMenuSetting() {
  const result = await chrome.storage.sync.get(EH_SETTINGS_KEY);
  const settings = result[EH_SETTINGS_KEY] as EhSettings | undefined;
  const enabled = settings?.contextMenu ?? true;

  chrome.contextMenus.removeAll(() => {
    if (enabled) {
      chrome.contextMenus.create({
        id: CONTEXT_MENU_ID,
        title: `${chrome.runtime.getManifest().name}: 全て表示/非表示を切り替え`,
        contexts: ["all"],
      });
    }
  });
}

chrome.runtime.onInstalled.addListener(() => {
  applyContextMenuSetting();
});

chrome.storage.sync.onChanged.addListener((changes) => {
  if (EH_SETTINGS_KEY in changes) {
    applyContextMenuSetting();
  }
});

chrome.contextMenus?.onClicked?.addListener(async (info, tab) => {
  if (info.menuItemId !== CONTEXT_MENU_ID || !tab?.id) return;

  let hostname: string;
  try {
    const response = await chrome.tabs.sendMessage(tab.id, { type: "GET_STATUS" });
    hostname = response?.hostname;
    if (!hostname) return;
  } catch {
    return;
  }

  const result = await chrome.storage.local.get(hostname);
  const stored = result[hostname] as SiteStorage | undefined;
  const elements = stored?.elements ?? [];
  if (elements.length === 0) return;

  const nextHidden = !elements.every((e) => e.isHidden);

  for (const el of elements) {
    try {
      await chrome.tabs.sendMessage(tab.id, nextHidden
        ? { type: "HIDE_ELEMENT", selector: el.selector }
        : { type: "SHOW_ELEMENT", selector: el.selector }
      );
    } catch { /* コンテンツスクリプト未準備 */ }
  }

  await chrome.storage.local.set({
    [hostname]: { ...stored, elements: elements.map((e) => ({ ...e, isHidden: nextHidden })) },
  });
});

// ─── Side panel ───────────────────────────────────────────────────────────────

chrome.action.onClicked.addListener((tab) => {
  if (tab.id != null) {
    chrome.sidePanel.open({ tabId: tab.id });
  }
});
