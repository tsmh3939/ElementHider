/**
 * 拡張機能全体の定数・設定
 * アプリケーション全体で共有される設定値をここで一元管理する。
 */

// ── バージョン ──────────────────────────────────────────────────────────────

/** アプリ名の強調表示部分（UI でプライマリカラーで表示） */
export const APP_NAME_PRIMARY = "Element";
/** アプリ名の通常表示部分 */
export const APP_NAME_SECONDARY = "Hider";
/** 拡張機能の名前 */
export const APP_NAME = APP_NAME_PRIMARY + APP_NAME_SECONDARY;

/** 拡張機能のバージョン番号 */
export const APP_VERSION = "1.0.0";

// ── ストレージキー ───────────────────────────────────────────────────────────

/** 拡張機能の設定（テーマなど）を保存するストレージキー（chrome.storage.sync に保存） */
export const EH_SETTINGS_KEY = "__eh_settings__";

// ── 設定の型定義 ─────────────────────────────────────────────────────────────

/** 拡張機能の永続化設定 */
export interface EhSettings {
  theme: string;
  multiSelect: boolean;
}

/** 複数選択のデフォルト有効状態 */
export const DEFAULT_MULTI_SELECT = false;

// ── テーマ ──────────────────────────────────────────────────────────────────

/** デフォルトテーマ */
export const DEFAULT_THEME = "dark";

/** 設定ページで選択可能な全テーマ一覧 */
export const ALL_THEMES: { id: string; label: string }[] = [
  "light", "dark", "cupcake", "bumblebee", "emerald", "corporate",
  "synthwave", "retro", "cyberpunk", "valentine", "halloween", "garden",
  "forest", "aqua", "lofi", "pastel", "fantasy", "wireframe", "black",
  "luxury", "dracula", "cmyk", "autumn", "business", "acid", "lemonade",
  "night", "coffee", "winter", "dim", "nord", "sunset",
].map((id) => ({ id, label: id.charAt(0).toUpperCase() + id.slice(1) }));

// ── DOM ID / クラス名 ────────────────────────────────────────────────────────

/** ピッカー UI のルートホスト要素 ID */
export const EH_ROOT_ID = "eh-root";

/** 非表示スタイルタグの ID（メインコンテンツスクリプトが管理） */
export const EH_HIDE_STYLE_ID = "eh-hide";

/** 早期インジェクト用スタイルタグの ID（フリッカー防止用） */
export const EH_INITIAL_HIDE_STYLE_ID = "eh-initial-hide";

/** ハイライト用クラス名 */
export const EH_HIGHLIGHT_CLASS = "eh-highlight";

/** ツールチップ要素の ID */
export const EH_TOOLTIP_ID = "eh-tooltip";

/** 拡張機能独自クラスのプレフィックス（セレクタ生成時に除外） */
export const EH_CLASS_PREFIX = "eh-";

// ── コンテンツスクリプトのビルド後パス ──────────────────────────────────────

/** chrome.scripting API で参照するビルド後のファイルパス */
export const CONTENT_SCRIPT_PATHS = {
  earlyInject: "src/content/early-inject.js",
  content: "src/content/content.js",
  pickerCss: "src/content/picker.css",
} as const;

// ── UI パラメータ ────────────────────────────────────────────────────────────

/** 要素ラベルの最大文字数 */
export const LABEL_MAX_LENGTH = 60;

/** 要素表示時のハイライト持続時間（ミリ秒） */
export const HIGHLIGHT_DURATION_MS = 2000;
