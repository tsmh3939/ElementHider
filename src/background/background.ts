/**
 * ElementHider Background Service Worker
 *
 * 動的コンテンツスクリプト登録とプログラム的注入を管理する。
 * - activeTab: ユーザーがアイコンをクリックした時に一時的な注入権限を付与
 * - scripting: executeScript / registerContentScripts を使用
 * - optional_host_permissions: サイトごとに永続権限を個別に取得
 */

import type { BackgroundMessage } from "../shared/messages";
import { CONTENT_SCRIPT_PATHS, EH_SETTINGS_KEY } from "../shared/config";

// ─── Dynamic content script registration ──────────────────────────────────────

/** 指定ホストの早期注入 + メインコンテンツスクリプトを動的登録する */
async function registerScriptsForHost(hostname: string): Promise<void> {
  const pattern = `*://${hostname}/*`;
  try {
    await chrome.scripting.registerContentScripts([
      {
        id: `eh-early-${hostname}`,
        matches: [pattern],
        js: [CONTENT_SCRIPT_PATHS.earlyInject],
        runAt: "document_start",
      },
      {
        id: `eh-main-${hostname}`,
        matches: [pattern],
        js: [CONTENT_SCRIPT_PATHS.content],
        css: [CONTENT_SCRIPT_PATHS.pickerCss],
        runAt: "document_idle",
      },
    ]);
  } catch {
    // 既に登録済みの場合はエラーになる — 無視
  }
}

/** 指定ホストのコンテンツスクリプト登録を解除する */
async function unregisterScriptsForHost(hostname: string): Promise<void> {
  try {
    await chrome.scripting.unregisterContentScripts({
      ids: [`eh-early-${hostname}`, `eh-main-${hostname}`],
    });
  } catch {
    // 未登録の場合は無視
  }
}

/**
 * Service Worker 起動時に、権限付与済みかつデータがあるホストの
 * コンテンツスクリプト登録を復元する。
 */
async function syncRegisteredScripts(): Promise<void> {
  const granted = await chrome.permissions.getAll();
  const origins = granted.origins ?? [];

  const existing = await chrome.scripting.getRegisteredContentScripts();
  const existingIds = new Set(existing.map((s) => s.id));

  const allData = await chrome.storage.local.get(null);

  for (const hostname of Object.keys(allData)) {
    if (hostname.startsWith("__")) continue; // 設定キーを除外
    const pattern = `*://${hostname}/*`;
    if (!origins.some((o) => o === pattern || o === "<all_urls>")) continue;

    const earlyId = `eh-early-${hostname}`;
    if (!existingIds.has(earlyId)) {
      await registerScriptsForHost(hostname);
    }
  }
}

// Service Worker 起動時に同期
syncRegisteredScripts();

// ─── Programmatic injection on action click ───────────────────────────────────

chrome.action.onClicked.addListener(async (tab) => {
  if (tab.id == null) return;

  // サイドパネルを開く
  chrome.sidePanel.open({ tabId: tab.id });

  // コンテンツスクリプトが既に注入済みか確認
  try {
    await chrome.tabs.sendMessage(tab.id, { type: "GET_STATUS" });
    // 応答があれば既に注入済み
  } catch {
    // 未注入 → activeTab 権限を使ってプログラム的に注入
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: [CONTENT_SCRIPT_PATHS.content],
      });
      await chrome.scripting.insertCSS({
        target: { tabId: tab.id },
        files: [CONTENT_SCRIPT_PATHS.pickerCss],
      });
    } catch {
      // chrome:// ページなどでは注入不可 — 無視
    }
  }
});

// ─── Message handler ──────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener(
  (message: BackgroundMessage, _sender, sendResponse: (response?: unknown) => void) => {
    if (message.type === "HOST_PERMISSION_GRANTED") {
      registerScriptsForHost(message.hostname).then(() => sendResponse());
      return true; // async response
    }
    if (message.type === "HOST_PERMISSION_REVOKED") {
      unregisterScriptsForHost(message.hostname).then(() => sendResponse());
      return true;
    }
  }
);

// ─── Storage cleanup: unregister scripts when site data is removed ────────────

chrome.storage.local.onChanged.addListener((changes) => {
  for (const [key, change] of Object.entries(changes)) {
    if (key === EH_SETTINGS_KEY || key.startsWith("__")) continue;
    // データが削除された場合（newValue が undefined）
    if (change.newValue === undefined) {
      unregisterScriptsForHost(key);
    }
  }
});
