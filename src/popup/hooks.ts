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

  // バックグラウンド（右クリックメニューなど）によるストレージ変更を検知して同期
  useEffect(() => {
    if (!hostname) return;
    const handler = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (!(hostname in changes)) return;
      const raw = (changes[hostname].newValue ?? []) as Array<Partial<ManagedElement>>;
      setManagedElements(
        raw.map((e) => ({ ...e, isHidden: e.isHidden ?? true } as ManagedElement))
      );
    };
    chrome.storage.local.onChanged.addListener(handler);
    return () => chrome.storage.local.onChanged.removeListener(handler);
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

  // 全要素の一括表示/非表示トグル
  // 全て非表示なら全て表示、それ以外（一部でも表示中）なら全て非表示にする
  const toggleAll = useCallback(() => {
    setManagedElements((prev) => {
      if (prev.length === 0) return prev;
      const nextHidden = !prev.every((e) => e.isHidden);
      prev.forEach((e) => {
        sendToActiveTab(
          nextHidden
            ? { type: "HIDE_ELEMENT", selector: e.selector }
            : { type: "SHOW_ELEMENT", selector: e.selector }
        );
      });
      const updated = prev.map((e) => ({ ...e, isHidden: nextHidden }));
      saveToStorage(updated);
      return updated;
    });
  }, [saveToStorage]);

  return { managedElements, addElement, toggleElement, deleteElement, toggleAll };
}
