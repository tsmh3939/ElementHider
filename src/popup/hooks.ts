import { useState, useEffect, useCallback } from "react";
import type { ManagedElement } from "./types";
import { sendToActiveTab } from "./api";

export function useManagedElements(hostname: string | null) {
  const [managedElements, setManagedElements] = useState<ManagedElement[]>([]);

  useEffect(() => {
    if (!hostname) return;
    let mounted = true;
    chrome.storage.local.get(hostname).then((result) => {
      if (!mounted) return;
      const raw = (result[hostname] ?? []) as Array<Partial<ManagedElement>>;
      // 後方互換: isHidden フィールドがない古いデータは非表示扱い
      setManagedElements(
        raw.map((e) => ({ ...e, isHidden: e.isHidden ?? true } as ManagedElement))
      );
    });
    return () => {
      mounted = false;
    };
  }, [hostname]);

  const saveToStorage = useCallback(
    async (elements: ManagedElement[]) => {
      if (!hostname) return;
      if (elements.length > 0) {
        await chrome.storage.local.set({ [hostname]: elements });
      } else {
        await chrome.storage.local.remove(hostname);
      }
    },
    [hostname]
  );

  // コンテンツスクリプトがストレージ保存済みのため、state 更新のみ
  const addElement = useCallback((el: ManagedElement) => {
    setManagedElements((prev) => {
      if (prev.some((e) => e.selector === el.selector)) return prev;
      return [...prev, el];
    });
  }, []);

  // 表示/非表示をトグル（リストには残す）
  const toggleElement = useCallback(
    async (selector: string) => {
      setManagedElements((prev) => {
        const el = prev.find((e) => e.selector === selector);
        if (!el) return prev;
        const nextHidden = !el.isHidden;
        sendToActiveTab(
          nextHidden ? { type: "HIDE_ELEMENT", selector } : { type: "SHOW_ELEMENT", selector }
        );
        const updated = prev.map((e) =>
          e.selector === selector ? { ...e, isHidden: nextHidden } : e
        );
        saveToStorage(updated);
        return updated;
      });
    },
    [saveToStorage]
  );

  // リストから完全削除（非表示中なら先に表示に戻す）
  const deleteElement = useCallback(
    async (selector: string) => {
      setManagedElements((prev) => {
        const el = prev.find((e) => e.selector === selector);
        if (el?.isHidden) {
          sendToActiveTab({ type: "SHOW_ELEMENT", selector });
        }
        const updated = prev.filter((e) => e.selector !== selector);
        saveToStorage(updated);
        return updated;
      });
    },
    [saveToStorage]
  );

  return { managedElements, addElement, toggleElement, deleteElement };
}
