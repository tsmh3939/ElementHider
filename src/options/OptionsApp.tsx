import { useState, useEffect } from "react";
import { IconPalette, IconDatabase } from "./icons";
import { EH_SETTINGS_KEY, type EhSettings, DEFAULT_THEME, APP_NAME_PRIMARY, APP_NAME_SECONDARY } from "../shared/config";
import { AppearancePage } from "./pages/AppearancePage";
import { DataPage } from "./pages/DataPage";

type PageId = "appearance" | "data";

const NAV_ITEMS: {
  id: PageId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: "data",       label: "データ管理",  icon: IconDatabase },
  { id: "appearance", label: "外観",       icon: IconPalette  },
];

export function OptionsApp() {
  const [activePage, setActivePage] = useState<PageId>("data");
  const [themeReady, setThemeReady] = useState(false);

  // 起動時にテーマを復元・言語を Chrome i18n から設定
  useEffect(() => {
    chrome.storage.sync.get(EH_SETTINGS_KEY).then((result) => {
      const saved = result[EH_SETTINGS_KEY] as EhSettings | undefined;
      document.documentElement.setAttribute("data-theme", saved?.theme ?? DEFAULT_THEME);
      setThemeReady(true);
    });
    document.documentElement.lang = chrome.i18n.getUILanguage();
  }, []);

  if (!themeReady) return null;

  const renderPage = () => {
    switch (activePage) {
      case "appearance": return <AppearancePage />;
      case "data":       return <DataPage />;
    }
  };

  return (
    <div className="flex h-screen bg-base-100 text-base-content overflow-hidden">
      {/* サイドバー: 狭い時はアイコンのみ(w-14)、広い時はラベル付き(lg:w-48) */}
      <aside className="w-14 lg:w-48 bg-base-200 border-r border-base-300 shrink-0 flex flex-col overflow-visible transition-all duration-200">
        {/* ヘッダー */}
        <div className="py-3 border-b border-base-300 w-full text-center lg:text-left lg:px-4 overflow-hidden">
          <p
            className="text-sm lg:text-lg font-bold tracking-tight cursor-pointer leading-tight"
            onClick={() => location.reload()}
          >
            {/* 狭い時: 頭文字、広い時: フルネーム */}
            <span className="lg:hidden">
              <span className="text-primary">{APP_NAME_PRIMARY[0]}</span>{APP_NAME_SECONDARY[0]}
            </span>
            <span className="hidden lg:inline">
              <span className="text-primary">{APP_NAME_PRIMARY}</span>{APP_NAME_SECONDARY}
            </span>
          </p>
          <p className="text-[10px] lg:text-sm text-base-content/30 whitespace-nowrap">v{chrome.runtime.getManifest().version}</p>
        </div>

        {/* ナビゲーション */}
        <nav className="py-3 lg:p-3 flex-1">
          <ul className="flex flex-col items-center lg:items-stretch gap-3 lg:gap-0.5">
            {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
              <li key={id}>
                {/* 狭い時: tooltip付きアイコンボタン */}
                <div className="tooltip tooltip-right lg:hidden" data-tip={label}>
                  <button
                    className={`btn btn-ghost btn-square btn-sm ${
                      activePage === id
                        ? "bg-primary text-primary-content hover:bg-primary/80"
                        : "text-base-content/70 hover:bg-base-300 hover:text-base-content"
                    }`}
                    onClick={() => setActivePage(id)}
                  >
                    <Icon className="h-5 w-5" />
                  </button>
                </div>
                {/* 広い時: アイコン+ラベルボタン */}
                <button
                  className={`hidden lg:flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm whitespace-nowrap transition-colors text-left ${
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
  );
}
