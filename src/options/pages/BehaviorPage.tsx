import { useState, useEffect } from "react";
import { EH_SETTINGS_KEY, type EhSettings, DEFAULT_THEME, DEFAULT_CONTEXT_MENU, DEFAULT_MULTI_SELECT } from "../../shared/config";

export function BehaviorPage() {
  const [settings, setSettings] = useState<EhSettings>({ theme: DEFAULT_THEME, contextMenu: DEFAULT_CONTEXT_MENU, multiSelect: DEFAULT_MULTI_SELECT });

  useEffect(() => {
    chrome.storage.sync.get(EH_SETTINGS_KEY).then((result) => {
      const saved = result[EH_SETTINGS_KEY] as EhSettings | undefined;
      if (saved) setSettings((s) => ({ ...s, ...saved }));
    });
  }, []);

  const toggle = (key: keyof EhSettings, value: boolean) => {
    const next = { ...settings, [key]: value };
    setSettings(next);
    chrome.storage.sync.set({ [EH_SETTINGS_KEY]: next });
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-xl font-semibold mb-1">動作設定</h2>
      <p className="text-sm text-base-content/50 mb-6">拡張機能の動作をカスタマイズします</p>

      <div className="flex flex-col gap-3">
        {/* コンテキストメニュー */}
        <div className="bg-base-200 rounded-xl px-4 py-3 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium">コンテキストメニュー</p>
            <p className="text-xs text-base-content/50 mt-0.5">
              右クリックメニューに「全て表示/非表示を切り替え」を表示します
            </p>
          </div>
          <input
            type="checkbox"
            className="toggle toggle-primary shrink-0"
            checked={settings.contextMenu}
            onChange={(e) => toggle("contextMenu", e.target.checked)}
          />
        </div>
      </div>
    </div>
  );
}
