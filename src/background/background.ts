/**
 * ElementHider Background Service Worker
 */

import type { ManagedElement } from "../shared/messages";
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
  if (info.menuItemId !== CONTEXT_MENU_ID || !tab?.id || !tab.url) return;

  let hostname: string;
  try {
    hostname = new URL(tab.url).hostname;
  } catch {
    return;
  }

  const result = await chrome.storage.local.get(hostname);
  const raw = (result[hostname] ?? []) as Array<Partial<ManagedElement>>;
  if (raw.length === 0) return;

  const elements = raw.map((e) => ({ ...e, isHidden: e.isHidden ?? true })) as ManagedElement[];
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
    [hostname]: elements.map((e) => ({ ...e, isHidden: nextHidden })),
  });
});

// ─── Side panel ───────────────────────────────────────────────────────────────

chrome.action.onClicked.addListener((tab) => {
  if (tab.id != null) {
    chrome.sidePanel.open({ tabId: tab.id });
  }
});
