import { useState, useEffect, useCallback, useRef } from "react";
import { MSG, type ManagedElement, type SiteStorage } from "../shared/messages";
import { sendToActiveTab } from "./api";

export function useManagedElements(hostname: string | null) {
  const [managedElements, setManagedElements] = useState<ManagedElement[]>([]);
  const lastVisitedRef = useRef<number>(0);

  useEffect(() => {
    if (!hostname) return;
    let mounted = true;
    chrome.storage.local.get(hostname).then((result) => {
      if (!mounted) return;
      const stored = result[hostname] as SiteStorage | undefined;
      lastVisitedRef.current = stored?.lastVisited ?? 0;
      setManagedElements(
        (stored?.elements ?? []).map((e) => ({ ...e, isHidden: e.isHidden ?? true }))
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
      const stored = changes[hostname].newValue as SiteStorage | undefined;
      lastVisitedRef.current = stored?.lastVisited ?? 0;
      setManagedElements(
        (stored?.elements ?? []).map((e) => ({ ...e, isHidden: e.isHidden ?? true }))
      );
    };
    chrome.storage.local.onChanged.addListener(handler);
    return () => chrome.storage.local.onChanged.removeListener(handler);
  }, [hostname]);

  const saveToStorage = useCallback(
    async (elements: ManagedElement[]) => {
      if (!hostname) return;
      if (elements.length > 0) {
        const storage: SiteStorage = {
          elements,
          lastVisited: lastVisitedRef.current,
        };
        await chrome.storage.local.set({ [hostname]: storage });
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
          nextHidden ? { type: MSG.HIDE_ELEMENT, selector } : { type: MSG.SHOW_ELEMENT, selector }
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
          sendToActiveTab({ type: MSG.SHOW_ELEMENT, selector });
        }
        const updated = prev.filter((e) => e.selector !== selector);
        saveToStorage(updated);
        return updated;
      });
    },
    [saveToStorage]
  );

  // ラベルをリネーム
  const renameElement = useCallback(
    (selector: string, newLabel: string) => {
      setManagedElements((prev) => {
        const updated = prev.map((e) =>
          e.selector === selector ? { ...e, label: newLabel } : e
        );
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
            ? { type: MSG.HIDE_ELEMENT, selector: e.selector }
            : { type: MSG.SHOW_ELEMENT, selector: e.selector }
        );
      });
      const updated = prev.map((e) => ({ ...e, isHidden: nextHidden }));
      saveToStorage(updated);
      return updated;
    });
  }, [saveToStorage]);

  const reorderElements = useCallback(
    (fromIndex: number, toIndex: number) => {
      if (fromIndex === toIndex) return;
      setManagedElements((prev) => {
        const updated = [...prev];
        const [moved] = updated.splice(fromIndex, 1);
        updated.splice(toIndex, 0, moved);
        saveToStorage(updated);
        return updated;
      });
    },
    [saveToStorage]
  );

  return { managedElements, addElement, toggleElement, deleteElement, toggleAll, renameElement, reorderElements };
}
