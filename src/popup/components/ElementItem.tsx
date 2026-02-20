import { IconTrash } from "../icons";
import type { ManagedElement } from "../types";

interface Props {
  element: ManagedElement;
  onToggle: (selector: string) => void;
  onDelete: (selector: string) => void;
}

export function ElementItem({ element, onToggle, onDelete }: Props) {
  return (
    <li>
      <div
        className={`flex items-center gap-1 rounded-lg overflow-hidden cursor-pointer transition-colors ${
          element.isHidden
            ? "bg-base-200 hover:bg-base-300 opacity-40"
            : "bg-base-200 hover:bg-base-300"
        }`}
      >
        <div
          className="flex-1 min-w-0 px-2 py-3"
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