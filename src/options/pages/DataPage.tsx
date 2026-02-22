import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { IconTrash, IconSortAsc, IconSortDesc, IconEmpty, IconSearch, IconDownload, IconUpload } from "../icons";
import { EH_SETTINGS_KEY, APP_VERSION, LABEL_MAX_LENGTH, buildOriginPattern } from "../../shared/config";
import { BG_MSG, type HideMode, type ManagedElement, type SiteStorage, type BackgroundMessage } from "../../shared/messages";

type SortKey = "hostname" | "lastVisited" | "elementCount";

interface SiteData {
  hostname: string;
  elements: ManagedElement[];
  lastVisited: number;
}

interface ExportData {
  version: string;
  exportedAt: string;
  sites: Record<string, SiteStorage>;
}

function isValidExportData(data: unknown): data is ExportData {
  if (typeof data !== "object" || data === null) return false;
  const d = data as Record<string, unknown>;
  if (typeof d.version !== "string") return false;
  if (typeof d.exportedAt !== "string") return false;
  if (typeof d.sites !== "object" || d.sites === null) return false;
  for (const [, val] of Object.entries(d.sites as Record<string, unknown>)) {
    if (typeof val !== "object" || val === null) return false;
    const v = val as Record<string, unknown>;
    if (!Array.isArray(v.elements)) return false;
    if (typeof v.lastVisited !== "number") return false;
  }
  return true;
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

  // エクスポート
  const [exportStatus, setExportStatus] = useState<"idle" | "done">("idle");

  // インポート
  const [importModalState, setImportModalState] = useState<"idle" | "preview" | "done" | "error">("idle");
  const [importData, setImportData] = useState<ExportData | null>(null);
  const [importMode, setImportMode] = useState<"merge" | "overwrite">("merge");
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // ── エクスポート ──────────────────────────────────────────────────────────

  const handleExport = async () => {
    const all = await chrome.storage.local.get(null);
    const exportSites: Record<string, SiteStorage> = {};
    for (const [key, value] of Object.entries(all)) {
      if (key === EH_SETTINGS_KEY) continue;
      exportSites[key] = value as SiteStorage;
    }
    const data: ExportData = {
      version: APP_VERSION,
      exportedAt: new Date().toISOString(),
      sites: exportSites,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `elementhider-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setExportStatus("done");
    setTimeout(() => setExportStatus("idle"), 2000);
  };

  // ── インポート ────────────────────────────────────────────────────────────

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // ファイル入力をリセット（同じファイルを再選択できるように）
    e.target.value = "";

    // 10 MB を超えるファイルは拒否
    if (file.size > 10 * 1024 * 1024) {
      setImportError("ファイルサイズが大きすぎます（上限: 10 MB）。");
      setImportModalState("error");
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string);
        if (!isValidExportData(parsed)) {
          setImportError("ファイルの形式が正しくありません。ElementHider のエクスポートファイルを選択してください。");
          setImportModalState("error");
          return;
        }
        setImportData(parsed);
        setImportMode("merge");
        setImportError(null);
        setImportModalState("preview");
      } catch {
        setImportError("JSON の解析に失敗しました。ファイルが破損しているか、形式が正しくありません。");
        setImportModalState("error");
      }
    };
    reader.readAsText(file);
  };

  const applyImport = async () => {
    if (!importData) return;
    const existing = await chrome.storage.local.get(null);

    const updates: Record<string, SiteStorage> = {};

    for (const [hostname, importedSite] of Object.entries(importData.sites)) {
      // 設定キーを誤って上書きしないよう除外
      if (hostname === EH_SETTINGS_KEY) continue;
      // 不正なホスト名を除外（ドメイン形式のみ許可）
      if (!/^([a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/.test(hostname)) continue;
      // 不正な要素データを除外・サニタイズ
      const safeElements: ManagedElement[] = importedSite.elements
        .filter((el): el is ManagedElement => {
          if (!el.selector || typeof el.selector !== "string") return false;
          if (typeof el.label !== "string") return false;
          if (typeof el.timestamp !== "number" || el.timestamp < 0) return false;
          if (typeof el.isHidden !== "boolean") return false;
          if (el.hideMode !== "hidden" && el.hideMode !== "invisible") return false;
          try { document.querySelectorAll(el.selector); return true; } catch { return false; }
        })
        .map((el) => ({
          selector: el.selector,
          label: el.label.slice(0, LABEL_MAX_LENGTH),
          timestamp: el.timestamp,
          isHidden: el.isHidden,
          hideMode: el.hideMode as HideMode,
        }));
      const safeSite: SiteStorage = { elements: safeElements, lastVisited: importedSite.lastVisited };
      if (importMode === "overwrite" || !(hostname in existing)) {
        updates[hostname] = safeSite;
      } else {
        // マージ: セレクタで重複排除（既存を優先、新規のみ追加）
        const existingSite = existing[hostname] as SiteStorage;
        const existingSelectors = new Set(existingSite.elements.map((el) => el.selector));
        const newElements = safeSite.elements.filter((el) => !existingSelectors.has(el.selector));
        updates[hostname] = {
          elements: [...existingSite.elements, ...newElements],
          lastVisited: Math.max(existingSite.lastVisited, importedSite.lastVisited),
        };
      }
    }

    await chrome.storage.local.set(updates);
    loadData();
    setImportModalState("done");
    setTimeout(() => setImportModalState("idle"), 2000);
  };

  // インポートプレビュー用の統計計算
  const importStats = useMemo(() => {
    if (!importData) return null;
    const existing = new Set(sites.map((s) => s.hostname));
    let newSites = 0;
    let updatedSites = 0;
    let totalElements = 0;
    for (const [hostname, site] of Object.entries(importData.sites)) {
      if (existing.has(hostname)) {
        updatedSites++;
      } else {
        newSites++;
      }
      totalElements += site.elements.length;
    }
    return { newSites, updatedSites, totalElements };
  }, [importData, sites]);

  const totalElements = sites.reduce((sum, s) => sum + s.elements.length, 0);
  const extensionDetailsUrl = `chrome://extensions/?id=${chrome.runtime.id}`;

  return (
    <div className="max-w-2xl mx-auto">
      {/* 隠しファイル入力 */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={handleFileSelect}
      />

      {/* ページヘッダー */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold mb-1">データ管理</h2>
          <p className="text-sm text-base-content/50">
            {sites.length} サイト / {totalElements} 要素を管理中
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            className="btn btn-sm btn-ghost gap-2"
            onClick={() => fileInputRef.current?.click()}
            title="JSON ファイルからデータをインポート"
          >
            <IconUpload className="h-3.5 w-3.5" />
            インポート
          </button>
          {sites.length > 0 && (
            <>
              <button
                className={`btn btn-sm gap-2 ${exportStatus === "done" ? "btn-success" : "btn-ghost"}`}
                onClick={handleExport}
                disabled={exportStatus === "done"}
                title="データを JSON ファイルにエクスポート"
              >
                <IconDownload className="h-3.5 w-3.5" />
                {exportStatus === "done" ? "保存しました" : "エクスポート"}
              </button>
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
            </>
          )}
        </div>
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

      {/* インポート確認モーダル */}
      {importModalState === "preview" && importData && importStats && (
        <div className="modal modal-open">
          <div className="modal-box max-w-sm">
            <h3 className="font-semibold text-lg">データをインポートしますか？</h3>
            <p className="text-xs text-base-content/40 mt-1 mb-4">
              エクスポート日時: {new Date(importData.exportedAt).toLocaleString(chrome.i18n.getUILanguage())}
            </p>

            {/* インポート統計 */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="bg-base-200 rounded-lg p-2 text-center">
                <div className="text-lg font-semibold">{importStats.newSites}</div>
                <div className="text-xs text-base-content/50">新規サイト</div>
              </div>
              <div className="bg-base-200 rounded-lg p-2 text-center">
                <div className="text-lg font-semibold">{importStats.updatedSites}</div>
                <div className="text-xs text-base-content/50">既存サイト</div>
              </div>
              <div className="bg-base-200 rounded-lg p-2 text-center">
                <div className="text-lg font-semibold">{importStats.totalElements}</div>
                <div className="text-xs text-base-content/50">総要素数</div>
              </div>
            </div>

            {/* マージ / 上書き 選択 */}
            {importStats.updatedSites > 0 && (
              <div className="mb-4">
                <p className="text-xs text-base-content/60 mb-2">既存サイトの処理方法:</p>
                <div className="flex flex-col gap-1.5">
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="radio"
                      className="radio radio-sm radio-primary mt-0.5"
                      checked={importMode === "merge"}
                      onChange={() => setImportMode("merge")}
                    />
                    <span className="text-sm">
                      <span className="font-medium">マージ</span>
                      <span className="text-base-content/50 text-xs block">
                        既存のデータを保持しつつ、新しい要素のみ追加します
                      </span>
                    </span>
                  </label>
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="radio"
                      className="radio radio-sm radio-primary mt-0.5"
                      checked={importMode === "overwrite"}
                      onChange={() => setImportMode("overwrite")}
                    />
                    <span className="text-sm">
                      <span className="font-medium">上書き</span>
                      <span className="text-base-content/50 text-xs block">
                        既存のサイトデータをインポートデータで置き換えます
                      </span>
                    </span>
                  </label>
                </div>
              </div>
            )}

            <div className="modal-action">
              <button className="btn btn-sm" onClick={() => setImportModalState("idle")}>
                キャンセル
              </button>
              <button className="btn btn-sm btn-primary" onClick={applyImport}>
                <IconUpload className="h-3.5 w-3.5" />
                インポートする
              </button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => setImportModalState("idle")} />
        </div>
      )}

      {/* インポートエラーモーダル */}
      {importModalState === "error" && (
        <div className="modal modal-open">
          <div className="modal-box max-w-sm">
            <h3 className="font-semibold text-lg">インポートに失敗しました</h3>
            <p className="text-sm text-base-content/60 mt-2">{importError}</p>
            <div className="modal-action">
              <button className="btn btn-sm" onClick={() => setImportModalState("idle")}>
                閉じる
              </button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => setImportModalState("idle")} />
        </div>
      )}
    </div>
  );
}
