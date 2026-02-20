import { useState, useEffect } from "react";
import { EH_SETTINGS_KEY, type EhSettings } from "../../popup/components/SettingsView";

const DEFAULT_THEME = "luxury";

const THEMES: { id: string; label: string; desc: string; dark: boolean }[] = [
  { id: "luxury",    label: "Luxury",    desc: "ダーク・ゴールド",   dark: true  },
  { id: "dark",      label: "Dark",      desc: "ダーク",             dark: true  },
  { id: "night",     label: "Night",     desc: "ダーク・ブルー",     dark: true  },
  { id: "light",     label: "Light",     desc: "ライト",             dark: false },
  { id: "corporate", label: "Corporate", desc: "ライト・ビジネス",   dark: false },
  { id: "cupcake",   label: "Cupcake",   desc: "ライト・パステル",   dark: false },
];

export function AppearancePage() {
  const [theme, setTheme] = useState(DEFAULT_THEME);

  useEffect(() => {
    chrome.storage.local.get(EH_SETTINGS_KEY).then((result) => {
      const saved = result[EH_SETTINGS_KEY] as EhSettings | undefined;
      if (saved?.theme) setTheme(saved.theme);
    });
  }, []);

  const changeTheme = (newTheme: string) => {
    setTheme(newTheme);
    document.documentElement.setAttribute("data-theme", newTheme);
    chrome.storage.local.set({ [EH_SETTINGS_KEY]: { theme: newTheme } satisfies EhSettings });
  };

  return (
    <div className="max-w-2xl">
      <h2 className="text-xl font-semibold mb-1">外観</h2>
      <p className="text-sm text-base-content/50 mb-6">パネルと設定ページのテーマを選択します</p>

      <div className="grid grid-cols-3 gap-3">
        {THEMES.map((t) => (
          <button
            key={t.id}
            className={`card cursor-pointer border-2 transition-all text-left ${
              theme === t.id
                ? "border-primary"
                : "border-base-300 hover:border-primary/40"
            }`}
            onClick={() => changeTheme(t.id)}
            data-theme={t.id}
          >
            <div className="card-body p-3 gap-2 bg-base-100 rounded-xl">
              {/* ミニプレビュー */}
              <div className="w-full h-14 rounded-lg overflow-hidden flex bg-base-200">
                <div className="w-8 bg-base-300 flex flex-col gap-1 p-1 shrink-0">
                  <div className="h-1.5 bg-primary/60 rounded-sm" />
                  <div className="h-1 bg-base-content/20 rounded-sm" />
                  <div className="h-1 bg-base-content/20 rounded-sm" />
                  <div className="h-1 bg-base-content/20 rounded-sm" />
                </div>
                <div className="flex-1 flex flex-col gap-1 p-1.5">
                  <div className="h-2 bg-primary rounded-sm w-3/4" />
                  <div className="h-1.5 bg-base-content/20 rounded-sm w-1/2" />
                  <div className="h-1.5 bg-base-content/20 rounded-sm w-2/3" />
                  <div className="h-1.5 bg-base-content/20 rounded-sm w-1/3" />
                </div>
              </div>

              <div>
                <p className="text-sm font-semibold leading-tight">{t.label}</p>
                <p className="text-xs opacity-50 mt-0.5">{t.desc}</p>
              </div>

              {theme === t.id && (
                <span className="badge badge-primary badge-sm self-start">使用中</span>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}