import { useState, useEffect, useCallback, useMemo } from "react";
import { IconTrash, IconSortAsc, IconSortDesc, IconEmpty, IconSearch } from "../icons";
import { EH_SETTINGS_KEY, buildOriginPattern } from "../../shared/config";
import { BG_MSG, type ManagedElement, type SiteStorage, type BackgroundMessage } from "../../shared/messages";

type SortKey = "hostname" | "lastVisited" | "elementCount";

interface SiteData {
  hostname: string;
  elements: ManagedElement[];
  lastVisited: number;
}

function formatLastVisited(ts: number): string {
  return new Date(ts).toLocaleDateString(chrome.i18n.getUILanguage(), {
    year: "numeric",
    month: "numeric",
    day: "numeric",
  });
}

const QUOTA_BYTES = chrome.storage.local.QUOTA_BYTES ?? 10_485_760;

function stripWww(hostname: string): string {
  return hostname.replace(/^www\./, "");
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function DataPage() {
  const [sites, setSites] = useState<SiteData[]>([]);
  const [clearAllStatus, setClearAllStatus] = useState<"idle" | "done">("idle");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [bytesInUse, setBytesInUse] = useState<number | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("hostname");
  const [sortAsc, setSortAsc] = useState(true);
  const [query, setQuery] = useState("");

  const loadData = useCallback(() => {
    chrome.storage.local.get(null).then((all) => {
      const result: SiteData[] = [];
      for (const [key, value] of Object.entries(all)) {
        if (key === EH_SETTINGS_KEY) continue;
        const stored = value as SiteStorage;
        result.push({
          hostname: key,
          elements: stored.elements ?? [],
          lastVisited: stored.lastVisited,
        });
      }
      setSites(result);
    });
    chrome.storage.local.getBytesInUse(null).then(setBytesInUse);
  }, []);

  const sortedSites = useMemo(() => {
    const arr = [...sites];
    const dir = sortAsc ? 1 : -1;
    arr.sort((a, b) => {
      switch (sortKey) {
        case "hostname":
          return dir * stripWww(a.hostname).localeCompare(stripWww(b.hostname));
        case "lastVisited":
          return dir * (a.lastVisited - b.lastVisited);
        case "elementCount":
          return dir * (a.elements.length - b.elements.length);
      }
    });
    return arr;
  }, [sites, sortKey, sortAsc]);

  const filteredSites = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sortedSites;
    return sortedSites.filter((s) => s.hostname.toLowerCase().includes(q));
  }, [sortedSites, query]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const deleteSite = async (hostname: string) => {
    await chrome.storage.local.remove(hostname);
    // 動的スクリプト登録解除 + ホスト権限取り消し
    await chrome.runtime.sendMessage({ type: BG_MSG.PERMISSION_REVOKED, hostname } satisfies BackgroundMessage);
    await chrome.permissions.remove({ origins: [buildOriginPattern(hostname)] }).catch(() => {});
    loadData();
  };

  const clearAll = async () => {
    const all = await chrome.storage.local.get(null);
    const keys = Object.keys(all).filter((k) => k !== EH_SETTINGS_KEY);
    // 全ホストのスクリプト登録解除 + 権限取り消し
    for (const hostname of keys) {
      if (hostname.startsWith("__")) continue;
      await chrome.runtime.sendMessage({ type: BG_MSG.PERMISSION_REVOKED, hostname } satisfies BackgroundMessage);
      await chrome.permissions.remove({ origins: [buildOriginPattern(hostname)] }).catch(() => {});
    }
    if (keys.length > 0) await chrome.storage.local.remove(keys);
    setSites([]);
    setClearAllStatus("done");
    setTimeout(() => setClearAllStatus("idle"), 2000);
  };

  const totalElements = sites.reduce((sum, s) => sum + s.elements.length, 0);
  const extensionDetailsUrl = `chrome://extensions/?id=${chrome.runtime.id}`;

  return (
    <div className="max-w-2xl mx-auto">
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
            onClick={() => setConfirmOpen(true)}
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

      {/* ストレージ使用量 */}
      {bytesInUse !== null && (() => {
        const pct = bytesInUse / QUOTA_BYTES;
        const barColor = pct >= 0.9 ? "progress-error" : pct >= 0.7 ? "progress-warning" : "progress-success";
        return (
          <div className="bg-base-200 rounded-xl px-4 py-3 mb-6">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-base-content/60">ストレージ使用量</span>
              <span className="text-xs font-mono text-base-content/70">
                {formatBytes(bytesInUse)} / {formatBytes(QUOTA_BYTES)}
              </span>
            </div>
            <progress
              className={`progress w-full h-2 ${barColor}`}
              value={bytesInUse}
              max={QUOTA_BYTES}
            />
            <p className="text-xs text-base-content/40 mt-1 text-right">
              {(pct * 100).toFixed(2)}% 使用中
            </p>
          </div>
        );
      })()}

      {/* 権限管理リンク */}
      <div className="bg-base-200 rounded-xl px-4 py-3 mb-6 flex items-center justify-between">
        <span className="text-xs text-base-content/60">
          サイトごとに付与した権限は Chrome の拡張機能管理ページから確認・削除できます
        </span>
        <a
          className="link link-sm link-primary shrink-0 ml-3 no-underline hover:underline cursor-pointer"
          title={extensionDetailsUrl}
          onClick={(e) => { e.preventDefault(); chrome.tabs.create({ url: extensionDetailsUrl }); }}
        >
          権限を管理
        </a>
      </div>

      {/* サイト一覧 */}
      {sites.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-base-content/30 gap-2">
          <IconEmpty className="h-12 w-12" />
          <p className="text-sm">管理中のデータはありません</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {/* 検索・ソート */}
          <div className="flex items-center gap-2 mb-1">
            <label className="input input-xs input-bordered flex items-center gap-1.5 flex-1">
              <IconSearch className="h-3.5 w-3.5 text-base-content/40 shrink-0" />
              <input
                type="text"
                className="grow"
                placeholder="サイトを検索..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {query && (
                <button className="text-base-content/40 hover:text-base-content" onClick={() => setQuery("")}>
                  ✕
                </button>
              )}
            </label>
            <select
              className="select select-xs select-bordered"
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
            >
              <option value="hostname">ホスト名順</option>
              <option value="lastVisited">最終訪問順</option>
              <option value="elementCount">要素数順</option>
            </select>
            <button
              className="btn btn-xs btn-ghost"
              onClick={() => setSortAsc((v) => !v)}
              title={sortAsc ? "昇順" : "降順"}
            >
              {sortAsc ? <IconSortAsc className="h-3.5 w-3.5" /> : <IconSortDesc className="h-3.5 w-3.5" />}
            </button>
          </div>
          {filteredSites.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-base-content/30 gap-2">
              <IconSearch className="h-10 w-10" />
              <p className="text-sm">「{query}」に一致するサイトはありません</p>
            </div>
          ) : filteredSites.map((site) => {
            const isOpen = expanded === site.hostname;
            const hiddenCount = site.elements.filter((e) => e.isHidden).length;

            return (
              <div key={site.hostname} className="card bg-base-200 overflow-hidden">
                {/* サイト行 */}
                <div
                  className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-base-300 transition-colors"
                  onClick={() => setExpanded(isOpen ? null : site.hostname)}
                >
                  <a
                    className="font-medium text-sm truncate hover:underline hover:text-primary min-w-0"
                    href={`https://${site.hostname}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    title={`https://${site.hostname} を開く`}
                  >{stripWww(site.hostname)}</a>
                  <span className="text-xs text-base-content/50 shrink-0">
                    {site.elements.length} 要素
                    {hiddenCount > 0 && (
                      <span className="text-error ml-1">({hiddenCount} 非表示)</span>
                    )}
                  </span>
                  <span className="text-xs text-base-content/40 shrink-0">
                    {formatLastVisited(site.lastVisited)}
                  </span>
                  <div className="flex-1" />
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
      {/* 全削除確認モーダル */}
      {confirmOpen && (
        <div className="modal modal-open">
          <div className="modal-box max-w-sm">
            <h3 className="font-semibold text-lg">全データを削除しますか？</h3>
            <p className="text-sm text-base-content/60 mt-2">
              全 {sites.length} サイト・{totalElements} 要素のデータが削除されます。この操作は元に戻せません。
            </p>
            <div className="modal-action">
              <button className="btn btn-sm" onClick={() => setConfirmOpen(false)}>
                キャンセル
              </button>
              <button
                className="btn btn-sm btn-error"
                onClick={() => { setConfirmOpen(false); clearAll(); }}
              >
                <IconTrash className="h-3.5 w-3.5" />
                削除する
              </button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => setConfirmOpen(false)} />
        </div>
      )}
    </div>
  );
}