import { useState, useEffect } from "react";
import { IconTrash } from "../icons";

export const EH_SETTINGS_KEY = "__eh_settings__";

export interface EhSettings {
  theme: string;
}

const DEFAULT_THEME = "luxury";

const THEMES: { id: string; label: string }[] = [
  { id: "luxury", label: "Luxury" },
  { id: "dark", label: "Dark" },
  { id: "night", label: "Night" },
  { id: "light", label: "Light" },
  { id: "corporate", label: "Corporate" },
  { id: "cupcake", label: "Cupcake" },
];

export function SettingsView() {
  const [theme, setTheme] = useState(DEFAULT_THEME);
  const [clearStatus, setClearStatus] = useState<"idle" | "done">("idle");
  const [totalSites, setTotalSites] = useState(0);

  useEffect(() => {
    chrome.storage.local.get(null).then((all) => {
      const saved = all[EH_SETTINGS_KEY] as EhSettings | undefined;
      const t = saved?.theme ?? DEFAULT_THEME;
      setTheme(t);
      document.documentElement.setAttribute("data-theme", t);

      const count = Object.keys(all).filter((k) => k !== EH_SETTINGS_KEY).length;
      setTotalSites(count);
    });
  }, []);

  const changeTheme = (newTheme: string) => {
    setTheme(newTheme);
    document.documentElement.setAttribute("data-theme", newTheme);
    chrome.storage.local.set({ [EH_SETTINGS_KEY]: { theme: newTheme } satisfies EhSettings });
  };

  const clearAllData = async () => {
    const all = await chrome.storage.local.get(null);
    const keys = Object.keys(all).filter((k) => k !== EH_SETTINGS_KEY);
    if (keys.length > 0) {
      await chrome.storage.local.remove(keys);
    }
    setTotalSites(0);
    setClearStatus("done");
    setTimeout(() => setClearStatus("idle"), 2000);
  };

  return (
    <div className="p-4 flex flex-col gap-5">
      {/* テーマ */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-base-content/50 mb-2">
          テーマ
        </h2>
        <div className="grid grid-cols-2 gap-1.5">
          {THEMES.map((t) => (
            <button
              key={t.id}
              className={`btn btn-sm justify-start gap-2 ${
                theme === t.id ? "btn-primary" : "btn-ghost"
              }`}
              onClick={() => changeTheme(t.id)}
            >
              <span
                className="w-3 h-3 rounded-full border border-base-content/20 shrink-0"
                data-theme={t.id}
                style={{ backgroundColor: "oklch(var(--p))" }}
              />
              {t.label}
            </button>
          ))}
        </div>
      </section>

      {/* キーボードショートカット */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-base-content/50 mb-2">
          キーボードショートカット
        </h2>
        <div className="flex items-center justify-between py-1.5">
          <span className="text-sm">パネルを開く</span>
          <kbd className="kbd kbd-sm">Alt + Shift + H</kbd>
        </div>
        <p className="text-xs text-base-content/40 mt-1">
          chrome://extensions/shortcuts で変更できます
        </p>
      </section>

      {/* データ管理 */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-base-content/50 mb-2">
          データ管理
        </h2>
        <div className="flex items-center justify-between py-1.5">
          <span className="text-sm text-base-content/70">管理中のサイト数</span>
          <span className="badge badge-ghost badge-sm font-mono">{totalSites}</span>
        </div>
        <button
          className={`btn btn-sm w-full mt-2 gap-2 ${
            clearStatus === "done" ? "btn-success" : "btn-error btn-outline"
          }`}
          onClick={clearAllData}
          disabled={clearStatus === "done" || totalSites === 0}
        >
          <IconTrash className="h-3.5 w-3.5" />
          {clearStatus === "done" ? "削除しました" : "全データを削除"}
        </button>
        <p className="text-xs text-base-content/40 mt-1">
          全サイトの管理要素データを削除します
        </p>
      </section>
    </div>
  );
}