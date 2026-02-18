import { useEffect, useState, useCallback } from "react";

interface ManagedElement {
  selector: string;
  preview: string;
  timestamp: number;
  isHidden: boolean;
}

type Message =
  | { type: "START_PICKER" }
  | { type: "STOP_PICKER" }
  | { type: "SHOW_ELEMENT"; selector: string }
  | { type: "HIDE_ELEMENT"; selector: string }
  | { type: "GET_STATUS" };

type ContentMessage =
  | { type: "ELEMENT_HIDDEN"; selector: string; preview: string }
  | { type: "STATUS"; isPickerActive: boolean };

async function sendToActiveTab(message: Message): Promise<void> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id != null) {
    await chrome.tabs.sendMessage(tab.id, message);
  }
}

async function getHostname(): Promise<string | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url) return null;
  try {
    return new URL(tab.url).hostname;
  } catch {
    return null;
  }
}

export default function App() {
  const [isPickerActive, setIsPickerActive] = useState(false);
  const [managedElements, setManagedElements] = useState<ManagedElement[]>([]);
  const [hostname, setHostname] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    (async () => {
      const host = await getHostname();
      if (!mounted) return;
      setHostname(host);

      if (host) {
        const result = await chrome.storage.local.get(host);
        if (!mounted) return;
        const raw = (result[host] ?? []) as Array<Partial<ManagedElement>>;
        // 後方互換: isHidden フィールドがない古いデータは非表示扱い
        setManagedElements(
          raw.map((e) => ({ ...e, isHidden: e.isHidden ?? true } as ManagedElement))
        );
      }

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
        const newEl: ManagedElement = {
          selector: message.selector,
          preview: message.preview,
          timestamp: Date.now(),
          isHidden: true,
        };
        setManagedElements((prev) => {
          if (prev.some((e) => e.selector === newEl.selector)) return prev;
          return [...prev, newEl];
        });
        setIsPickerActive(false);
      }
    };

    chrome.runtime.onMessage.addListener(handler);
    return () => chrome.runtime.onMessage.removeListener(handler);
  }, []);

  const togglePicker = useCallback(async () => {
    const next = !isPickerActive;
    setIsPickerActive(next);
    await sendToActiveTab(next ? { type: "START_PICKER" } : { type: "STOP_PICKER" });
  }, [isPickerActive]);

  // 表示/非表示をトグル（リストには残す）
  const toggleElement = useCallback(
    async (selector: string) => {
      const el = managedElements.find((e) => e.selector === selector);
      if (!el) return;

      const nextHidden = !el.isHidden;
      await sendToActiveTab(
        nextHidden
          ? { type: "HIDE_ELEMENT", selector }
          : { type: "SHOW_ELEMENT", selector }
      );

      const updated = managedElements.map((e) =>
        e.selector === selector ? { ...e, isHidden: nextHidden } : e
      );
      setManagedElements(updated);
      if (hostname) {
        await chrome.storage.local.set({ [hostname]: updated });
      }
    },
    [managedElements, hostname]
  );

  // リストから完全削除（非表示中なら先に表示に戻す）
  const deleteElement = useCallback(
    async (selector: string) => {
      const el = managedElements.find((e) => e.selector === selector);
      if (el?.isHidden) {
        await sendToActiveTab({ type: "SHOW_ELEMENT", selector });
      }

      const updated = managedElements.filter((e) => e.selector !== selector);
      setManagedElements(updated);
      if (hostname) {
        if (updated.length > 0) {
          await chrome.storage.local.set({ [hostname]: updated });
        } else {
          await chrome.storage.local.remove(hostname);
        }
      }
    },
    [managedElements, hostname]
  );

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
            className={`btn flex-1 gap-2 ${
              isPickerActive ? "btn-warning" : "btn-primary"
            }`}
            onClick={togglePicker}
          >
            {isPickerActive ? (
              <>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="15" y1="9" x2="9" y2="15" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                </svg>
                ピッカーを停止
              </>
            ) : (
              <>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
                  <path d="M13 13l6 6" />
                </svg>
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
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-10 w-10 mb-2"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
              <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
              <line x1="1" y1="1" x2="23" y2="23" />
            </svg>
            <p className="text-sm">管理中の要素はありません</p>
          </div>
        ) : (
          <ul className="menu menu-sm p-2 gap-1">
            {managedElements.map((el) => (
              <li key={el.selector}>
                <div className="flex items-center gap-2 rounded-lg bg-base-200 p-2 hover:bg-base-300">
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-xs text-primary truncate">
                      {el.selector}
                    </p>
                    {el.preview && (
                      <p className="text-xs text-base-content/60 truncate mt-0.5">
                        {el.preview}
                      </p>
                    )}
                  </div>

                  {/* 表示/非表示トグル */}
                  <button
                    className={`btn btn-xs btn-ghost shrink-0 ${
                      el.isHidden ? "text-base-content/30" : "text-success"
                    }`}
                    onClick={() => toggleElement(el.selector)}
                    title={el.isHidden ? "表示する" : "非表示にする"}
                  >
                    {el.isHidden ? (
                      // 目に斜線: 現在非表示
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-3.5 w-3.5"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    ) : (
                      // 目: 現在表示中
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-3.5 w-3.5"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>

                  {/* 管理から削除 */}
                  <button
                    className="btn btn-xs btn-ghost text-error shrink-0"
                    onClick={() => deleteElement(el.selector)}
                    title="管理から削除"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-3.5 w-3.5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                      <path d="M10 11v6" />
                      <path d="M14 11v6" />
                      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                    </svg>
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
