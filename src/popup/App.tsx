import { useEffect, useState, useCallback, useRef } from "react";

import { IconStop, IconPicker, IconEyeOff, IconEye, IconRefresh, IconSettings } from "./icons";
import type { ContentMessage, Message } from "./types";
import { getActiveTabInfo, sendToActiveTab } from "./api";
import { useManagedElements } from "./hooks";
import { ElementItem } from "./components/ElementItem";
import { EH_SETTINGS_KEY, type EhSettings, DEFAULT_THEME, APP_NAME_PRIMARY, APP_NAME_SECONDARY } from "../shared/config";

export default function App() {
  const [isPickerActive, setIsPickerActive] = useState(false);
  const [hostname, setHostname] = useState<string | null>(null);
  const [needsReload, setNeedsReload] = useState(false);
  const [isExtensionPage, setIsExtensionPage] = useState(false);
  const { managedElements, addElement, toggleElement, deleteElement, toggleAll, renameElement, reorderElements } =
    useManagedElements(hostname);

  const dragIndexRef = useRef(-1);
  const [dragOverIndex, setDragOverIndex] = useState(-1);

  const handleDragStart = useCallback((index: number) => {
    dragIndexRef.current = index;
  }, []);

  const handleDragEnter = useCallback((index: number) => {
    setDragOverIndex(index);
  }, []);

  const handleDrop = useCallback(() => {
    reorderElements(dragIndexRef.current, dragOverIndex);
    dragIndexRef.current = -1;
    setDragOverIndex(-1);
  }, [dragOverIndex, reorderElements]);

  const handleDragEnd = useCallback(() => {
    dragIndexRef.current = -1;
    setDragOverIndex(-1);
  }, []);

  // 起動時にテーマを復元・言語を Chrome i18n から設定 + 設定ページからの変更をリアルタイムで反映
  useEffect(() => {
    chrome.storage.sync.get(EH_SETTINGS_KEY).then((result) => {
      const saved = result[EH_SETTINGS_KEY] as EhSettings | undefined;
      document.documentElement.setAttribute("data-theme", saved?.theme ?? DEFAULT_THEME);
    });
    document.documentElement.lang = chrome.i18n.getUILanguage();

    const handler = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (!(EH_SETTINGS_KEY in changes)) return;
      const saved = changes[EH_SETTINGS_KEY].newValue as EhSettings | undefined;
      document.documentElement.setAttribute("data-theme", saved?.theme ?? DEFAULT_THEME);
    };
    chrome.storage.sync.onChanged.addListener(handler);
    return () => chrome.storage.sync.onChanged.removeListener(handler);
  }, []);

  // hostname 取得 + ピッカー状態確認（初期化・タブ切り替え時に呼ぶ）
  const refreshTab = useCallback(async () => {
    const { hostname: host, isExtensionPage: extPage } = await getActiveTabInfo();
    setHostname(host);
    setIsExtensionPage(extPage);
    setIsPickerActive(false);

    if (!host) {
      setNeedsReload(false);
      return;
    }

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id != null) {
        const response = (await chrome.tabs.sendMessage(tab.id, {
          type: "GET_STATUS",
        } satisfies Message)) as ContentMessage | undefined;
        if (response?.type === "STATUS") {
          setIsPickerActive(response.isPickerActive);
        }
      }
      setNeedsReload(false);
    } catch {
      // コンテンツスクリプト未準備 → リロードが必要
      setNeedsReload(true);
    }
  }, []);

  // 初期化
  useEffect(() => {
    refreshTab();
  }, [refreshTab]);

  // タブ切り替え・ナビゲーション完了を検知してサイドパネルを更新
  useEffect(() => {
    const onActivated = () => refreshTab();
    const onUpdated = (
      _tabId: number,
      changeInfo: chrome.tabs.TabChangeInfo,
      tab: chrome.tabs.Tab
    ) => {
      if (tab.active && changeInfo.status === "complete") refreshTab();
    };

    chrome.tabs.onActivated.addListener(onActivated);
    chrome.tabs.onUpdated.addListener(onUpdated);
    return () => {
      chrome.tabs.onActivated.removeListener(onActivated);
      chrome.tabs.onUpdated.removeListener(onUpdated);
    };
  }, [refreshTab]);

  // コンテンツスクリプトからのメッセージを受信
  useEffect(() => {
    const handler = (message: ContentMessage) => {
      if (message.type === "ELEMENT_HIDDEN") {
        addElement({
          selector: message.selector,
          label: message.label,
          timestamp: Date.now(),
          isHidden: true,
        });
      } else if (message.type === "STATUS") {
        setIsPickerActive(message.isPickerActive);
      }
    };
    chrome.runtime.onMessage.addListener(handler);
    return () => chrome.runtime.onMessage.removeListener(handler);
  }, [addElement]);

  const togglePicker = useCallback(async () => {
    const next = !isPickerActive;
    setIsPickerActive(next);
    await sendToActiveTab(next ? { type: "START_PICKER" } : { type: "STOP_PICKER" });
  }, [isPickerActive]);

  const reloadTab = useCallback(async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id != null) {
      await chrome.tabs.reload(tab.id);
    }
  }, []);

  return (
    <div className="flex flex-col h-full bg-base-100 text-base-content">
      {/* Navbar */}
      <div className="navbar bg-base-200 px-3 py-2 min-h-0">
        <div className="navbar-start">
          <span className="text-lg font-bold tracking-tight">
            <span className="text-primary">{APP_NAME_PRIMARY}</span>{APP_NAME_SECONDARY}
          </span>
        </div>
        <div className="navbar-end">
          {hostname && (
            <span
              className="badge badge-ghost badge-sm truncate overflow-visible pb-0.5"
              title={hostname}
            >
              {hostname.replace(/^www\./, "")}
            </span>
          )}
          <button
            className="btn btn-xs btn-ghost text-base-content/50"
            onClick={() => chrome.runtime.openOptionsPage()}
            title="設定"
          >
            <IconSettings className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* リロードバナー */}
      {needsReload && (
        <div className="flex items-center gap-2 px-3 py-2 bg-warning/20 border-b border-warning/40">
          <p className="text-xs text-warning-content flex-1">
            ページをリロードすると使用できます
          </p>
          <button
            className="btn btn-xs btn-warning gap-1 shrink-0"
            onClick={reloadTab}
          >
            <IconRefresh className="h-3 w-3" />
            リロード
          </button>
        </div>
      )}

      {/* 設定ページ専用表示 */}
      {isExtensionPage && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-base-content/40 px-6 text-center">
          <IconSettings className="h-10 w-10" />
          <p className="text-sm font-medium">{chrome.runtime.getManifest().name} 設定ページ</p>
          <p className="text-xs">このページでは要素の選択はできません</p>
        </div>
      )}

      {/* 非対応ページ表示 */}
      {!hostname && !isExtensionPage && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-base-content/40 px-6 text-center">
          <IconStop className="h-10 w-10" />
          <p className="text-sm font-medium">対応していないページです</p>
          <p className="text-xs">http / https のページで使用できます</p>
        </div>
      )}

      {hostname && !isExtensionPage && (
        <>
          {/* ピッカーボタン */}
          <div className="px-3 py-3 border-b border-base-300">
            <div className="flex items-center gap-3">
              <button
                className={`btn flex-1 gap-2 ${isPickerActive ? "btn-warning" : "btn-primary"}`}
                onClick={togglePicker}
                disabled={needsReload}
              >
                {isPickerActive ? (
                  <>
                    <IconStop className="h-4 w-4" />
                    ピッカーを停止
                  </>
                ) : (
                  <>
                    <IconPicker className="h-4 w-4" />
                    要素を選択して非表示
                  </>
                )}
              </button>
              {managedElements.length > 0 && (
                <div className="badge badge-primary badge-lg font-mono">
                  {managedElements.length}
                </div>
              )}
            </div>
            {isPickerActive && (
              <p className="text-xs text-base-content/60 mt-2 text-center">
                非表示にしたい要素をクリック（連続選択可） / Esc で終了
              </p>
            )}
            {managedElements.length > 0 && (
              <button
                className="btn btn-ghost btn-sm w-full mt-2 gap-2"
                onClick={toggleAll}
                disabled={needsReload}
              >
                {managedElements.every((e) => e.isHidden) ? (
                  <>
                    <IconEye className="h-4 w-4" />
                    全て表示
                  </>
                ) : (
                  <>
                    <IconEyeOff className="h-4 w-4" />
                    全て非表示
                  </>
                )}
              </button>
            )}
          </div>

          {/* 管理要素リスト */}
          <div className="flex-1 overflow-y-auto">
            {managedElements.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-base-content/40">
                <IconEyeOff className="h-10 w-10 mb-2" />
                <p className="text-sm">管理中の要素はありません</p>
              </div>
            ) : (
              <ul className="p-2 flex flex-col gap-1 list-none">
                {managedElements.map((el, i) => (
                  <ElementItem
                    key={el.selector}
                    element={el}
                    index={i}
                    isDragOver={dragOverIndex === i}
                    onToggle={toggleElement}
                    onDelete={deleteElement}
                    onRename={renameElement}
                    onDragStart={handleDragStart}
                    onDragEnter={handleDragEnter}
                    onDrop={handleDrop}
                    onDragEnd={handleDragEnd}
                  />
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}