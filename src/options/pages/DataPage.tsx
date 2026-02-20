import { useState, useEffect, useCallback } from "react";
import { IconTrash } from "../../popup/icons";
import { EH_SETTINGS_KEY } from "../../popup/components/SettingsView";
import type { ManagedElement } from "../../shared/messages";

interface SiteData {
  hostname: string;
  elements: ManagedElement[];
}

export function DataPage() {
  const [sites, setSites] = useState<SiteData[]>([]);
  const [clearAllStatus, setClearAllStatus] = useState<"idle" | "done">("idle");
  const [expanded, setExpanded] = useState<string | null>(null);

  const loadData = useCallback(() => {
    chrome.storage.local.get(null).then((all) => {
      const result: SiteData[] = [];
      for (const [key, value] of Object.entries(all)) {
        if (key === EH_SETTINGS_KEY) continue;
        result.push({
          hostname: key,
          elements: (value as ManagedElement[]) ?? [],
        });
      }
      result.sort((a, b) => a.hostname.localeCompare(b.hostname));
      setSites(result);
    });
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const deleteSite = async (hostname: string) => {
    await chrome.storage.local.remove(hostname);
    loadData();
  };

  const clearAll = async () => {
    const all = await chrome.storage.local.get(null);
    const keys = Object.keys(all).filter((k) => k !== EH_SETTINGS_KEY);
    if (keys.length > 0) await chrome.storage.local.remove(keys);
    setSites([]);
    setClearAllStatus("done");
    setTimeout(() => setClearAllStatus("idle"), 2000);
  };

  const totalElements = sites.reduce((sum, s) => sum + s.elements.length, 0);

  return (
    <div className="max-w-2xl">
      {/* ページヘッダー */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold mb-1">データ管理</h2>
          <p className="text-sm text-base-content/50">
            {sites.length} サイト / {totalElements} 要素を管理中
          </p>
        </div>
        {sites.length > 0 && (
          <button
            className={`btn btn-sm gap-2 ${
              clearAllStatus === "done" ? "btn-success" : "btn-error btn-outline"
            }`}
            onClick={clearAll}
            disabled={clearAllStatus === "done"}
          >
            <IconTrash className="h-3.5 w-3.5" />
            {clearAllStatus === "done" ? "削除しました" : "全て削除"}
          </button>
        )}
      </div>

      {/* サマリーカード */}
      {sites.length > 0 && (
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="stat bg-base-200 rounded-xl py-3 px-4">
            <div className="stat-title text-xs">管理中のサイト</div>
            <div className="stat-value text-2xl">{sites.length}</div>
          </div>
          <div className="stat bg-base-200 rounded-xl py-3 px-4">
            <div className="stat-title text-xs">管理中の要素</div>
            <div className="stat-value text-2xl">{totalElements}</div>
          </div>
        </div>
      )}

      {/* サイト一覧 */}
      {sites.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-base-content/30 gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1">
            <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
          <p className="text-sm">管理中のデータはありません</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {sites.map((site) => {
            const isOpen = expanded === site.hostname;
            const hiddenCount = site.elements.filter((e) => e.isHidden).length;

            return (
              <div key={site.hostname} className="card bg-base-200 overflow-hidden">
                {/* サイト行 */}
                <div
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-base-300 transition-colors"
                  onClick={() => setExpanded(isOpen ? null : site.hostname)}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{site.hostname}</p>
                    <p className="text-xs text-base-content/50 mt-0.5">
                      {site.elements.length} 要素
                      {hiddenCount > 0 && (
                        <span className="ml-1.5">
                          (<span className="text-error">{hiddenCount} 非表示</span>)
                        </span>
                      )}
                    </p>
                  </div>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className={`h-4 w-4 text-base-content/40 transition-transform shrink-0 ${isOpen ? "rotate-180" : ""}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                  <button
                    className="btn btn-xs btn-ghost text-error shrink-0"
                    onClick={(e) => { e.stopPropagation(); deleteSite(site.hostname); }}
                    title="このサイトのデータを削除"
                  >
                    <IconTrash className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* 展開: 要素一覧 */}
                {isOpen && (
                  <div className="border-t border-base-300">
                    <ul className="divide-y divide-base-300">
                      {site.elements.map((el) => (
                        <li key={el.selector} className="flex items-center gap-3 px-4 py-2.5">
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              el.isHidden ? "bg-error" : "bg-success"
                            }`}
                            title={el.isHidden ? "非表示" : "表示中"}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm truncate">{el.label}</p>
                            <p className="text-xs text-base-content/40 font-mono truncate">{el.selector}</p>
                          </div>
                          <span className={`badge badge-sm shrink-0 ${el.isHidden ? "badge-error" : "badge-success"}`}>
                            {el.isHidden ? "非表示" : "表示中"}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}