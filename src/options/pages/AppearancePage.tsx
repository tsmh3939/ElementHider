import { useState, useEffect } from "react";
import { EH_SETTINGS_KEY, type EhSettings, DEFAULT_THEME, DEFAULT_MULTI_SELECT, ALL_THEMES } from "../../shared/config";

export function AppearancePage() {
  const [settings, setSettings] = useState<EhSettings>({ theme: DEFAULT_THEME, multiSelect: DEFAULT_MULTI_SELECT });

  useEffect(() => {
    chrome.storage.sync.get(EH_SETTINGS_KEY).then((result) => {
      const saved = result[EH_SETTINGS_KEY] as EhSettings | undefined;
      if (saved) setSettings((s) => ({ ...s, ...saved }));
    });
  }, []);

  const changeTheme = (newTheme: string) => {
    const next = { ...settings, theme: newTheme };
    setSettings(next);
    document.documentElement.setAttribute("data-theme", newTheme);
    chrome.storage.sync.set({ [EH_SETTINGS_KEY]: next });
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-xl font-semibold mb-1">外観</h2>
      <p className="text-sm text-base-content/50 mb-6">パネルと設定ページのテーマを選択します</p>

      <div className="grid grid-cols-3 gap-3">
        {ALL_THEMES.map((t) => (
          <button
            key={t.id}
            className={`card cursor-pointer border-2 transition-all text-left ${
              settings.theme === t.id
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
              </div>

              {settings.theme === t.id && (
                <span className="badge badge-primary badge-sm self-start">使用中</span>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}