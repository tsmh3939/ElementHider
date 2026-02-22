import { BG_MSG, type BackgroundMessage } from "../shared/messages";
import { buildOriginPattern, CONTENT_SCRIPT_PATHS } from "../shared/config";

/** 指定ホストの早期注入 + メインコンテンツスクリプトを動的登録する */
async function registerScriptsForHost(hostname: string): Promise<void> {
  const pattern = buildOriginPattern(hostname);
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
    const pattern = buildOriginPattern(hostname);
    if (!origins.some((o) => o === pattern || o === "<all_urls>")) continue;

    const earlyId = `eh-early-${hostname}`;
    if (!existingIds.has(earlyId)) {
      await registerScriptsForHost(hostname);
    }
  }
}

// Service Worker 起動時に同期
syncRegisteredScripts();

chrome.action.onClicked.addListener(async (tab) => {
  if (tab.id == null) return;
  chrome.sidePanel.open({ tabId: tab.id });
});

chrome.runtime.onMessage.addListener(
  (message: BackgroundMessage, _sender, sendResponse: (response?: unknown) => void) => {
    if (message.type === BG_MSG.PERMISSION_GRANTED) {
      registerScriptsForHost(message.hostname).then(() => sendResponse());
      return true; // async response
    }
    if (message.type === BG_MSG.PERMISSION_REVOKED) {
      unregisterScriptsForHost(message.hostname).then(() => sendResponse());
      return true;
    }
  }
);
