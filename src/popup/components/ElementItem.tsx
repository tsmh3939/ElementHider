import { useState, useEffect, useRef } from "react";
import { IconTrash, IconPencil, IconGrip } from "../icons";
import type { ManagedElement, HideMode } from "../../shared/messages";
import { HIDE_MODE_LABELS } from "../../shared/config";

interface Props {
  element: ManagedElement;
  index: number;
  isDragOver: boolean;
  onToggle: (selector: string) => void;
  onDelete: (selector: string) => void;
  onRename: (selector: string, newLabel: string) => void;
  onSetHideMode: (selector: string, mode: HideMode) => void;
  onDragStart: (index: number) => void;
  onDragEnter: (index: number) => void;
  onDrop: () => void;
  onDragEnd: () => void;
}

export function ElementItem({
  element, index, isDragOver,
  onToggle, onDelete, onRename, onSetHideMode,
  onDragStart, onDragEnter, onDrop, onDragEnd,
}: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(element.label);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing) inputRef.current?.select();
  }, [isEditing]);

  const startEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditValue(element.label);
    setIsEditing(true);
  };

  const commitEdit = () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== element.label) {
      onRename(element.selector, trimmed);
    }
    setIsEditing(false);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setEditValue(element.label);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") commitEdit();
    if (e.key === "Escape") cancelEdit();
  };

  return (
    <li
      draggable
      onDragStart={() => onDragStart(index)}
      onDragEnter={(e) => { e.preventDefault(); onDragEnter(index); }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => { e.preventDefault(); onDrop(); }}
      onDragEnd={onDragEnd}
      className={`border-t-2 transition-colors ${isDragOver ? "border-primary" : "border-transparent"}`}
    >
      <div
        className="group flex items-center gap-1 rounded-lg overflow-hidden transition-colors bg-base-200 hover:bg-base-300"
      >
        <span
          className="btn btn-xs btn-ghost shrink-0 cursor-grab text-base-content/20 hover:text-base-content/50 px-1"
          title="ドラッグして並べ替え"
        >
          <IconGrip className="h-3.5 w-3.5" />
        </span>

        {isEditing ? (
          <input
            ref={inputRef}
            className="flex-1 min-w-0 px-2 py-2.5 text-xs bg-transparent outline-none border-b border-primary"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={commitEdit}
          />
        ) : (
          <div
            className="flex-1 min-w-0 px-2 py-3 cursor-pointer"
            title={element.selector}
            onClick={() => onToggle(element.selector)}
          >
            <p
              className={`text-xs truncate ${
                element.isHidden
                  ? "text-base-content/50 line-through"
                  : "text-base-content/70"
              }`}
            >
              {element.label}
            </p>
          </div>
        )}

        {!isEditing && (
          <div className="flex items-center shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            <select
              className="select select-xs shrink-0 text-xs bg-transparent border-none focus:outline-none min-h-0 h-6 pl-1 pr-5"
              value={element.hideMode}
              onChange={(e) => onSetHideMode(element.selector, e.target.value as HideMode)}
              onClick={(e) => e.stopPropagation()}
              title="非表示モード"
            >
              {(Object.entries(HIDE_MODE_LABELS) as [HideMode, string][]).map(([mode, label]) => (
                <option key={mode} value={mode}>{label}</option>
              ))}
            </select>

            <button
              className="btn btn-xs btn-ghost shrink-0 text-base-content/30 hover:text-base-content"
              onClick={startEdit}
              title="名前を編集"
            >
              <IconPencil className="h-3.5 w-3.5" />
            </button>

            <button
              className="btn btn-xs btn-ghost text-error shrink-0"
              onClick={() => onDelete(element.selector)}
              title="管理から削除"
            >
              <IconTrash className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </li>
  );
}
