/** Types shared between the popup (side panel) and the content script. */

export interface ManagedElement {
  selector: string;
  label: string;
  timestamp: number;
  isHidden: boolean;
}

/** chrome.storage.local に保存されるホスト名単位のデータ */
export interface SiteStorage {
  elements: ManagedElement[];
  lastVisited: number;
}

export type Message =
  | { type: "START_PICKER"; multiSelect: boolean }
  | { type: "STOP_PICKER" }
  | { type: "SHOW_ELEMENT"; selector: string }
  | { type: "HIDE_ELEMENT"; selector: string }
  | { type: "GET_STATUS" };

/** background スクリプトへ送るメッセージ */
export type BackgroundMessage =
  | { type: "HOST_PERMISSION_GRANTED"; hostname: string }
  | { type: "HOST_PERMISSION_REVOKED"; hostname: string };

export type ContentMessage =
  | { type: "ELEMENT_HIDDEN"; selector: string; label: string }
  | { type: "STATUS"; isPickerActive: boolean; hostname: string };
