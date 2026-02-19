import { IconEyeOff, IconEye, IconTrash } from "../icons";
import type { ManagedElement } from "../types";

interface Props {
  element: ManagedElement;
  onToggle: (selector: string) => void;
  onDelete: (selector: string) => void;
}

export function ElementItem({ element, onToggle, onDelete }: Props) {
  return (
    <li>
      <div className="flex items-center gap-1 rounded-lg bg-base-200 overflow-hidden hover:bg-base-300">
        <div className="flex-1 min-w-0 px-2 py-3" title={element.selector}>
          <p className="text-xs text-base-content/70 truncate">{element.label}</p>
        </div>

        <button
          className={`btn btn-xs btn-ghost shrink-0 ${
            element.isHidden ? "text-base-content/30" : "text-success"
          }`}
          onClick={() => onToggle(element.selector)}
          title={element.isHidden ? "表示する" : "非表示にする"}
        >
          {element.isHidden ? (
            <IconEyeOff className="h-3.5 w-3.5" />
          ) : (
            <IconEye className="h-3.5 w-3.5" />
          )}
        </button>

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
