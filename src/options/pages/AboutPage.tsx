export function AboutPage() {
  const { version } = chrome.runtime.getManifest();

  return (
    <div className="max-w-2xl">
      <h2 className="text-xl font-semibold mb-1">バージョン情報</h2>
      <p className="text-sm text-base-content/50 mb-6">ElementHider について</p>

      {/* メインカード */}
      <div className="card bg-base-200 mb-4">
        <div className="card-body gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
              </svg>
            </div>
            <div>
              <h3 className="text-2xl font-bold tracking-tight">
                <span className="text-primary">Element</span>Hider
              </h3>
              <p className="text-sm text-base-content/50">バージョン {version}</p>
            </div>
          </div>

          <p className="text-sm text-base-content/70 leading-relaxed">
            DevTools ライクなピッカーでページ上の要素を選択し、非表示にする Chrome 拡張機能です。
            選択した要素はサイトごとに保存され、次回訪問時にも自動的に非表示が適用されます。
          </p>
        </div>
      </div>

      {/* 詳細情報 */}
      <div className="card bg-base-200">
        <div className="card-body p-0 overflow-hidden">
          <table className="table">
            <tbody>
              <tr>
                <td className="text-sm text-base-content/60 w-40">バージョン</td>
                <td className="text-sm font-mono">{version}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}