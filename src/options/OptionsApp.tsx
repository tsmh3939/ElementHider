import { useState, useEffect } from "react";
import { IconPalette, IconKeyboard, IconDatabase, IconSliders } from "./icons";
import { EH_SETTINGS_KEY, type EhSettings, DEFAULT_THEME, APP_NAME_PRIMARY, APP_NAME_SECONDARY } from "../shared/config";
import { AppearancePage } from "./pages/AppearancePage";
import { ShortcutsPage } from "./pages/ShortcutsPage";
import { BehaviorPage } from "./pages/BehaviorPage";
import { DataPage } from "./pages/DataPage";

type PageId = "appearance" | "shortcuts" | "behavior" | "data";

const NAV_ITEMS: {
  id: PageId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: "data",       label: "データ管理",        icon: IconDatabase },
  { id: "appearance", label: "外観",             icon: IconPalette  },
  { id: "shortcuts",  label: "ショートカット",    icon: IconKeyboard },
  { id: "behavior",   label: "動作設定",          icon: IconSliders  },
];

export function OptionsApp() {
  const [activePage, setActivePage] = useState<PageId>("appearance");

  // 起動時にテーマを復元・言語を Chrome i18n から設定
  useEffect(() => {
    chrome.storage.sync.get(EH_SETTINGS_KEY).then((result) => {
      const saved = result[EH_SETTINGS_KEY] as EhSettings | undefined;
      document.documentElement.setAttribute("data-theme", saved?.theme ?? DEFAULT_THEME);
    });
    document.documentElement.lang = chrome.i18n.getUILanguage();
  }, []);

  const renderPage = () => {
    switch (activePage) {
      case "appearance": return <AppearancePage />;
      case "shortcuts":  return <ShortcutsPage />;
      case "behavior":   return <BehaviorPage />;
      case "data":       return <DataPage />;
    }
  };

  return (
    <div className="flex h-screen bg-base-100 text-base-content overflow-hidden">
      <div className="flex flex-1 overflow-hidden">
        {/* サイドバー */}
        <aside className="w-52 bg-base-200 border-r border-base-300 shrink-0 flex flex-col overflow-y-auto">
          {/* タイトル */}
          <div className="px-4 py-3 border-b border-base-300">
            <p className="text-lg font-bold tracking-tight">
              <span className="text-primary">{APP_NAME_PRIMARY}</span>{APP_NAME_SECONDARY}
            </p>
            <p className="text-sm text-base-content/30">v{chrome.runtime.getManifest().version}</p>
          </div>
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