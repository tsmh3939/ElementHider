import { useEffect, useState, useCallback } from "react";

import { IconStop, IconPicker, IconEyeOff } from "./icons";
import type { ContentMessage, Message } from "./types";
import { getActiveTabHostname, sendToActiveTab } from "./api";
import { useManagedElements } from "./hooks";
import { ElementItem } from "./components/ElementItem";

export default function App() {
  const [isPickerActive, setIsPickerActive] = useState(false);
  const [hostname, setHostname] = useState<string | null>(null);
  const { managedElements, addElement, toggleElement, deleteElement } =
    useManagedElements(hostname);

  // 初期化: hostname 取得 + ピッカー状態確認
  useEffect(() => {
    let mounted = true;
    (async () => {
      const host = await getActiveTabHostname();
      if (!mounted) return;
      setHostname(host);

      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.id != null) {
          const response = (await chrome.tabs.sendMessage(tab.id, {
            type: "GET_STATUS",
          } satisfies Message)) as ContentMessage | undefined;
          if (!mounted) return;
          if (response?.type === "STATUS") {
            setIsPickerActive(response.isPickerActive);
          }
        }
      } catch {
        // コンテンツスクリプト未準備の場合は無視
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

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
        setIsPickerActive(false);
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

  return (
    <div className="flex flex-col h-full bg-base-100 text-base-content">
      {/* Navbar */}
      <div className="navbar bg-base-200 px-3 py-2 min-h-0">
        <div className="navbar-start">
          <span className="text-lg font-bold tracking-tight">
            <span className="text-primary">Element</span>Hider
          </span>
        </div>
        <div className="navbar-end">
          {hostname && (
            <span className="badge badge-ghost badge-sm truncate max-w-[140px]">
              {hostname}
            </span>
          )}
        </div>
      </div>

      {/* ピッカーボタン */}
      <div className="px-3 py-3 border-b border-base-300">
        <div className="flex items-center gap-3">
          <button
            className={`btn flex-1 gap-2 ${isPickerActive ? "btn-warning" : "btn-primary"}`}
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
        {isPickerActive && (
          <p className="text-xs text-base-content/60 mt-2 text-center">
            非表示にしたい要素をクリック / Esc でキャンセル
          </p>
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
            {managedElements.map((el) => (
              <ElementItem
                key={el.selector}
                element={el}
                onToggle={toggleElement}
                onDelete={deleteElement}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
