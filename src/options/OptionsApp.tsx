import { useState, useEffect } from "react";
import { IconPalette, IconKeyboard, IconDatabase, IconInfo } from "../popup/icons";
import { EH_SETTINGS_KEY, type EhSettings, DEFAULT_THEME } from "../shared/config";
import { AppearancePage } from "./pages/AppearancePage";
import { ShortcutsPage } from "./pages/ShortcutsPage";
import { DataPage } from "./pages/DataPage";
import { AboutPage } from "./pages/AboutPage";

type PageId = "appearance" | "shortcuts" | "data" | "about";

const NAV_ITEMS: {
  id: PageId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: "appearance", label: "外観",             icon: IconPalette  },
  { id: "shortcuts",  label: "ショートカット",    icon: IconKeyboard },
  { id: "data",       label: "データ管理",        icon: IconDatabase },
  { id: "about",      label: "バージョン情報",    icon: IconInfo     },
];

export function OptionsApp() {
  const [activePage, setActivePage] = useState<PageId>("appearance");

  // 起動時にテーマを復元
  useEffect(() => {
    chrome.storage.local.get(EH_SETTINGS_KEY).then((result) => {
      const saved = result[EH_SETTINGS_KEY] as EhSettings | undefined;
      const t = saved?.theme ?? DEFAULT_THEME;
      document.documentElement.setAttribute("data-theme", t);
    });
  }, []);

  const renderPage = () => {
    switch (activePage) {
      case "appearance": return <AppearancePage />;
      case "shortcuts":  return <ShortcutsPage />;
      case "data":       return <DataPage />;
      case "about":      return <AboutPage />;
    }
  };

  return (
    <div className="flex flex-col h-screen bg-base-100 text-base-content overflow-hidden">
      {/* ヘッダー */}
      <header className="flex items-center gap-3 px-6 h-14 bg-base-200 border-b border-base-300 shrink-0">
        <span className="text-lg font-bold tracking-tight">
          <span className="text-primary">Element</span>Hider
        </span>
        <span className="text-base-content/30">|</span>
        <span className="text-sm text-base-content/50">設定</span>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* サイドバー */}
        <aside className="w-52 bg-base-200 border-r border-base-300 shrink-0 flex flex-col overflow-y-auto">
          <nav className="p-3 flex-1">
            <ul className="flex flex-col gap-0.5">
              {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
                <li key={id}>
                  <button
                    className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm transition-colors text-left ${
                      activePage === id
                        ? "bg-primary text-primary-content font-medium"
                        : "text-base-content/70 hover:bg-base-300 hover:text-base-content"
                    }`}
                    onClick={() => setActivePage(id)}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {label}
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          {/* サイドバーフッター */}
          <div className="p-3 border-t border-base-300">
            <p className="text-xs text-base-content/30 text-center">v1.0.0</p>
          </div>
        </aside>

        {/* メインコンテンツ */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-8">
            {renderPage()}
          </div>
        </main>
      </div>
    </div>
  );
}