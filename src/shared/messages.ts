/** Types shared between the popup (side panel) and the content script. */

export interface ManagedElement {
  selector: string;
  label: string;
  timestamp: number;
  isHidden: boolean;
}

export type Message =
  | { type: "START_PICKER" }
  | { type: "STOP_PICKER" }
  | { type: "SHOW_ELEMENT"; selector: string }
  | { type: "HIDE_ELEMENT"; selector: string }
  | { type: "GET_STATUS" };

export type ContentMessage =
  | { type: "ELEMENT_HIDDEN"; selector: string; label: string }
  | { type: "STATUS"; isPickerActive: boolean };
