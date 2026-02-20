import { useState, useEffect, useRef } from "react";
import { IconTrash, IconPencil } from "../icons";
import type { ManagedElement } from "../types";

interface Props {
  element: ManagedElement;
  onToggle: (selector: string) => void;
  onDelete: (selector: string) => void;
  onRename: (selector: string, newLabel: string) => void;
}

export function ElementItem({ element, onToggle, onDelete, onRename }: Props) {
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
    <li>
      <div
        className={`flex items-center gap-1 rounded-lg overflow-hidden transition-colors ${
          element.isHidden
            ? "bg-base-200 hover:bg-base-300 opacity-40"
            : "bg-base-200 hover:bg-base-300"
        }`}
      >
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
          <button
            className="btn btn-xs btn-ghost shrink-0 text-base-content/30 hover:text-base-content"
            onClick={startEdit}
            title="名前を編集"
          >
            <IconPencil className="h-3.5 w-3.5" />
          </button>
        )}

        <button
          className="btn btn-xs btn-ghost text-error shrink-0"
          onClick={() => onDelete(element.selector)}
          title="管理から削除"
        >
          <IconTrash className="h-3.5 w-3.5" />
        </button>
      </div>
    </li>
  );
}