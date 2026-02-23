/** Types shared between the sidepanel and the content script. */

export type HideMode = "hidden" | "invisible";

/** 非表示モードごとの CSS ルール */
export const HIDE_MODE_CSS: Record<HideMode, string> = {
  hidden: "display: none !important",
  invisible: "visibility: hidden !important",
};

/** 非表示モードの表示ラベル */
export const HIDE_MODE_LABELS: Record<HideMode, string> = {
  hidden: "非表示",
  invisible: "不可視",
};

export interface ManagedElement {
  selector: string;
  label: string;
  timestamp: number;
  isHidden: boolean;
  hideMode: HideMode;
}

/** chrome.storage.local に保存されるホスト名単位のデータ */
export interface SiteStorage {
  elements: ManagedElement[];
  lastVisited: number;
}

/** sidepanel → content スクリプトへ送るメッセージ定数 */
export const MSG = {
  START_PICKER: "START_PICKER",
  STOP_PICKER: "STOP_PICKER",
  SHOW_ELEMENT: "SHOW_ELEMENT",
  HIDE_ELEMENT: "HIDE_ELEMENT",
  SET_HIDE_MODE: "SET_HIDE_MODE",
  GET_STATUS: "GET_STATUS",
} as const;

export type Message =
  | { type: typeof MSG.START_PICKER; multiSelect: boolean }
  | { type: typeof MSG.STOP_PICKER }
  | { type: typeof MSG.SHOW_ELEMENT; selector: string }
  | { type: typeof MSG.HIDE_ELEMENT; selector: string; mode: HideMode }
  | { type: typeof MSG.SET_HIDE_MODE; selector: string; mode: HideMode }
  | { type: typeof MSG.GET_STATUS };

/** background スクリプトへ送るメッセージ定数 */
export const BG_MSG = {
  PERMISSION_GRANTED: "HOST_PERMISSION_GRANTED",
  PERMISSION_REVOKED: "HOST_PERMISSION_REVOKED",
} as const;

export type BackgroundMessage =
  | { type: typeof BG_MSG.PERMISSION_GRANTED; hostname: string }
  | { type: typeof BG_MSG.PERMISSION_REVOKED; hostname: string };

/** content → sidepanel/background へ送るメッセージ定数 */
export const CONTENT_MSG = {
  ELEMENT_HIDDEN: "ELEMENT_HIDDEN",
  STATUS: "STATUS",
} as const;

export type ContentMessage =
  | { type: typeof CONTENT_MSG.ELEMENT_HIDDEN; selector: string; label: string }
  | { type: typeof CONTENT_MSG.STATUS; isPickerActive: boolean; hostname: string };
