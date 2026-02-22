import { useEffect, useState, useCallback, useRef } from "react";

import { IconStop, IconPicker, IconEyeOff, IconEye, IconSettings } from "./icons";
import { MSG, CONTENT_MSG, type ContentMessage, type Message } from "./types";
import { sendToActiveTab } from "./api";
import { useManagedElements } from "./hooks";
import { ElementItem } from "./components/ElementItem";
import { EH_SETTINGS_KEY, type EhSettings, DEFAULT_THEME, DEFAULT_MULTI_SELECT, APP_NAME_PRIMARY, APP_NAME_SECONDARY, buildOriginPattern, CONTENT_SCRIPT_PATHS } from "../shared/config";
import { BG_MSG, type BackgroundMessage } from "../shared/messages";

export default function App() {
  const [isPickerActive, setIsPickerActive] = useState(false);
  const [hostname, setHostname] = useState<string | null>(null);
  const [hasHostPermission, setHasHostPermission] = useState(false);
  const [multiSelect, setMultiSelect] = useState(DEFAULT_MULTI_SELECT);
  const { managedElements, addElement, toggleElement, deleteElement, toggleAll, renameElement, setHideMode, reorderElements } =
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
      if (saved?.multiSelect !== undefined) setMultiSelect(saved.multiSelect);
    });
    document.documentElement.lang = chrome.i18n.getUILanguage();

    const handler = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (!(EH_SETTINGS_KEY in changes)) return;
      const saved = changes[EH_SETTINGS_KEY].newValue as EhSettings | undefined;
      document.documentElement.setAttribute("data-theme", saved?.theme ?? DEFAULT_THEME);
      if (saved?.multiSelect !== undefined) setMultiSelect(saved.multiSelect);
    };
    chrome.storage.sync.onChanged.addListener(handler);
    return () => chrome.storage.sync.onChanged.removeListener(handler);
  }, []);

  // hostname 取得 + ピッカー状態確認（初期化・タブ切り替え時に呼ぶ）
  const refreshTab = useCallback(async () => {
    setIsPickerActive(false);

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id == null) {
      setHostname(null);
      setHasHostPermission(false);
      return;
    }

    // タブ URL からホスト名を取得
    if (!tab.url) {
      setHostname(null);
      setHasHostPermission(false);
      return;
    }

    let host: string;
    try {
      const url = new URL(tab.url);
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        setHostname(null);
        setHasHostPermission(false);
        return;
      }
      host = url.hostname;
    } catch {
      setHostname(null);
      setHasHostPermission(false);
      return;
    }

    setHostname(host);
    const granted = await chrome.permissions.contains({
      origins: [buildOriginPattern(host)],
    });
    setHasHostPermission(granted);

    // コンテンツスクリプトからピッカー状態を取得
    try {
      const response = (await chrome.tabs.sendMessage(tab.id, {
        type: MSG.GET_STATUS,
      } satisfies Message)) as ContentMessage | undefined;
      if (response?.type === CONTENT_MSG.STATUS) {
        setIsPickerActive(response.isPickerActive);
      }
    } catch {
      // コンテンツスクリプト未注入
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
      if (message.type === CONTENT_MSG.ELEMENT_HIDDEN) {
        addElement({
          selector: message.selector,
          label: message.label,
          timestamp: Date.now(),
          isHidden: true,
          hideMode: "hidden",
        });
      } else if (message.type === CONTENT_MSG.STATUS) {
        setIsPickerActive(message.isPickerActive);
      }
    };
    chrome.runtime.onMessage.addListener(handler);
    return () => chrome.runtime.onMessage.removeListener(handler);
  }, [addElement]);

  const togglePicker = useCallback(async () => {
    const next = !isPickerActive;
    setIsPickerActive(next);
    await sendToActiveTab(next ? { type: MSG.START_PICKER, multiSelect } : { type: MSG.STOP_PICKER });
  }, [isPickerActive, multiSelect]);

  const handleMultiSelectChange = useCallback(async (value: boolean) => {
    setMultiSelect(value);
    const result = await chrome.storage.sync.get(EH_SETTINGS_KEY);
    const saved = result[EH_SETTINGS_KEY] as EhSettings | undefined;
    await chrome.storage.sync.set({ [EH_SETTINGS_KEY]: { ...saved, multiSelect: value } });
  }, []);

  const requestHostPermission = useCallback(async () => {
    if (!hostname) return;
    const granted = await chrome.permissions.request({
      origins: [buildOriginPattern(hostname)],
    });
    if (granted) {
      setHasHostPermission(true);
      await chrome.runtime.sendMessage({
        type: BG_MSG.PERMISSION_GRANTED,
        hostname,
      } satisfies BackgroundMessage);

      // 現在のタブにコンテンツスクリプトを即時注入
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id != null) {
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
          // 注入失敗 — 無視
        }
      }
    }
  }, [hostname]);

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

      {/* コンテンツスクリプト未注入 */}
      {!hostname && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-base-content/40 px-6 text-center">
          <IconPicker className="h-10 w-10" />
          <p className="text-sm font-medium">
            ページをリロードしてから
            <br />
            サイドパネルを開き直してください
          </p>
          <p className="text-xs">chrome:// 等の特殊なページでは使用できません</p>
        </div>
      )}

      {hostname && (
        <>
          {/* 権限リクエストバナー */}
          {!hasHostPermission && (
            <div className="flex flex-col gap-1.5 px-3 py-2 bg-info/20 border-b border-info/40">
              <p className="text-xs text-info-content">
                このサイトで要素を非表示にするにはアクセスを許可してください
              </p>
              <button
                className="btn btn-xs btn-info w-full"
                onClick={requestHostPermission}
              >
                アクセスを許可
              </button>
            </div>
          )}

          {hasHostPermission && <>
          {/* ピッカーボタン */}
          <div className="px-3 py-3 border-b border-base-300">
            <div className="flex items-center gap-3">
              <button
                className={`btn flex-1 gap-2 ${isPickerActive ? "btn-warning" : "btn-neutral"}`}
                onClick={togglePicker}
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
            <label className="flex items-center gap-1.5 cursor-pointer w-fit mt-2">
              <input
                type="checkbox"
                className="checkbox checkbox-xs checkbox-primary"
                checked={multiSelect}
                onChange={(e) => handleMultiSelectChange(e.target.checked)}
              />
              <span className="text-xs text-base-content/60 select-none">複数選択</span>
            </label>
            {isPickerActive && (
              <p className="text-xs text-base-content/60 mt-1 text-center">
                {multiSelect
                  ? "非表示にしたい要素をクリック（連続選択可） / Esc で終了"
                  : "非表示にしたい要素をクリック / Esc で終了"}
              </p>
            )}
            {managedElements.length > 0 && (
              <button
                className="btn btn-ghost btn-sm w-full mt-2 gap-2"
                onClick={toggleAll}
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
                    onSetHideMode={setHideMode}
                    onDragStart={handleDragStart}
                    onDragEnter={handleDragEnter}
                    onDrop={handleDrop}
                    onDragEnd={handleDragEnd}
                  />
                ))}
              </ul>
            )}
          </div>
          </>}
        </>
      )}
    </div>
  );
}
