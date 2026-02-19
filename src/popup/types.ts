export interface ManagedElement {
  selector: string;
  preview: string;
  timestamp: number;
  isHidden: boolean;
  thumbnail?: string;
}

export type Message =
  | { type: "START_PICKER" }
  | { type: "STOP_PICKER" }
  | { type: "SHOW_ELEMENT"; selector: string }
  | { type: "HIDE_ELEMENT"; selector: string }
  | { type: "GET_STATUS" };

export type ContentMessage =
  | { type: "ELEMENT_HIDDEN"; selector: string; preview: string; thumbnail?: string }
  | { type: "STATUS"; isPickerActive: boolean };
