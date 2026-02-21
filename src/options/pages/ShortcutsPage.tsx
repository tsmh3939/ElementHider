export function ShortcutsPage() {
  const openShortcutsPage = () => {
    chrome.tabs.create({ url: "chrome://extensions/shortcuts" });
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-xl font-semibold mb-1">キーボードショートカット</h2>
      <p className="text-sm text-base-content/50 mb-6">利用可能なショートカット一覧</p>

      <div className="card bg-base-200 mb-4">
        <div className="card-body p-0 overflow-hidden">
          <table className="table">
            <thead>
              <tr>
                <th className="text-base-content/60 font-medium text-xs uppercase tracking-wider">操作</th>
                <th className="text-base-content/60 font-medium text-xs uppercase tracking-wider">ショートカット</th>
                <th className="text-base-content/60 font-medium text-xs uppercase tracking-wider">場所</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="text-sm">サイドパネルを開く</td>
                <td>
                  <div className="flex items-center gap-1">
                    <kbd className="kbd kbd-sm">Alt</kbd>
                    <span className="text-base-content/40 text-xs">+</span>
                    <kbd className="kbd kbd-sm">Shift</kbd>
                    <span className="text-base-content/40 text-xs">+</span>
                    <kbd className="kbd kbd-sm">H</kbd>
                  </div>
                </td>
                <td><span className="badge badge-ghost badge-sm">グローバル</span></td>
              </tr>
              <tr>
                <td className="text-sm">ピッカーをキャンセル</td>
                <td>
                  <kbd className="kbd kbd-sm">Esc</kbd>
                </td>
                <td><span className="badge badge-ghost badge-sm">ページ上</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="alert alert-info">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-5 h-5">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div>
          <p className="text-sm">
            ショートカットは Chrome の拡張機能ショートカット設定ページで変更できます。
          </p>
          <button className="btn btn-xs btn-ghost mt-1 px-0 underline" onClick={openShortcutsPage}>
            chrome://extensions/shortcuts を開く
          </button>
        </div>
      </div>
    </div>
  );
}