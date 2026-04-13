import { invoke } from "@tauri-apps/api/core";
import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  backupData,
  exportPromptsTxt,
  getPromptsUpdatedEventName,
  getStorageUsage,
  importPromptsTxt,
  loadPrompts,
  restoreData,
  savePrompts,
} from "../lib/promptStorage";
import { loadSettings, saveSettings } from "../lib/settingsStorage";
import {
  ALL_CATEGORIES_FILTER,
  DEFAULT_CATEGORY,
  DEFAULT_SETTINGS,
  type AppSettings,
  type PromptDraft,
  type PromptItem,
} from "../lib/promptTypes";

interface ShortcutBinding {
  shortcut: string;
  text: string;
}

interface ShortcutSyncResult {
  registered: string[];
  failed: string[];
}

interface PromptsUpdatedDetail {
  sourceId?: string;
}

interface RefreshOptions {
  showLoading?: boolean;
  forceShortcutSync?: boolean;
}

function buildShortcutBindings(promptList: PromptItem[]): ShortcutBinding[] {
  return promptList
    .filter((prompt) => prompt.shortcut)
    .map((prompt) => ({
      shortcut: prompt.shortcut!.trim(),
      text: prompt.content,
    }));
}

function getShortcutSignature(promptList: PromptItem[]) {
  return promptList
    .filter((prompt) => prompt.shortcut)
    .map((prompt) => `${prompt.id}:${prompt.shortcut?.trim() ?? ""}:${prompt.content}`)
    .join("|");
}

export function usePromptLibrary() {
  const [prompts, setPrompts] = useState<PromptItem[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [storageUsage, setStorageUsage] = useState("0 KB");
  const [activeCategory, setActiveCategory] = useState<string>(ALL_CATEGORIES_FILTER);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [unavailableShortcuts, setUnavailableShortcuts] = useState<string[]>([]);
  const eventSourceIdRef = useRef(`prompt-library-${Math.random().toString(36).slice(2)}`);
  const lastShortcutSignatureRef = useRef<string | null>(null);
  const lastShortcutResultRef = useRef<ShortcutSyncResult>({ registered: [], failed: [] });

  const syncShortcuts = useCallback(async (promptList: PromptItem[], force = false) => {
    const signature = getShortcutSignature(promptList);
    if (!force && signature === lastShortcutSignatureRef.current) {
      return lastShortcutResultRef.current;
    }

    try {
      const result = await invoke<ShortcutSyncResult>("update_prompt_shortcuts", {
        bindings: buildShortcutBindings(promptList),
      });
      lastShortcutSignatureRef.current = signature;
      lastShortcutResultRef.current = result;
      setUnavailableShortcuts(result.failed);
      return result;
    } catch (syncError) {
      console.error(syncError);
      lastShortcutSignatureRef.current = null;
      lastShortcutResultRef.current = { registered: [], failed: [] };
      setUnavailableShortcuts([]);
      setError("快捷键同步失败，请稍后重试。");
      return { registered: [], failed: [] };
    }
  }, []);

  const refresh = useCallback(
    async ({ showLoading = true, forceShortcutSync = false }: RefreshOptions = {}) => {
      if (showLoading) {
        setIsLoading(true);
      }
      setError(null);

      try {
        const [loadedPrompts, loadedSettings] = await Promise.all([loadPrompts(), loadSettings()]);
        await syncShortcuts(loadedPrompts, forceShortcutSync);
        startTransition(() => {
          setPrompts(loadedPrompts);
          setSettings(loadedSettings);
          setStorageUsage(getStorageUsage());
        });
      } catch (loadError) {
        console.error(loadError);
        setError("加载提示词失败，请稍后重试。");
      } finally {
        if (showLoading) {
          setIsLoading(false);
        }
      }
    },
    [syncShortcuts],
  );

  useEffect(() => {
    void refresh({ forceShortcutSync: true });

    const handleUpdate = (event: Event) => {
      const detail = (event as CustomEvent<PromptsUpdatedDetail>).detail;
      if (detail?.sourceId === eventSourceIdRef.current) {
        return;
      }
      void refresh({ showLoading: false });
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === "app_prompts_data" || event.key === null) {
        void refresh({ showLoading: false });
      }
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener(getPromptsUpdatedEventName(), handleUpdate);

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(getPromptsUpdatedEventName(), handleUpdate);
    };
  }, [refresh]);

  const categories = useMemo(() => {
    const values = new Set(prompts.map((prompt) => prompt.category));
    return [ALL_CATEGORIES_FILTER, ...values];
  }, [prompts]);

  const filteredPrompts = useMemo(() => {
    return [...prompts]
      .filter((prompt) => activeCategory === ALL_CATEGORIES_FILTER || prompt.category === activeCategory)
      .sort((left, right) => {
        if (right.updatedAt !== left.updatedAt) return right.updatedAt - left.updatedAt;
        return left.title.localeCompare(right.title);
      });
  }, [activeCategory, prompts]);

  const saveDraft = useCallback(
    async (draft: PromptDraft, editingId: string | null) => {
      const normalizedCategory = draft.category.trim() || DEFAULT_CATEGORY;
      const normalizedShortcut = draft.shortcut?.trim() || undefined;
      const conflictingPrompt = prompts.find(
        (prompt) =>
          prompt.id !== editingId &&
          prompt.shortcut?.toLowerCase() === normalizedShortcut?.toLowerCase(),
      );

      if (conflictingPrompt) {
        setError(`快捷键已被“${conflictingPrompt.title}”占用。`);
        return false;
      }

      const now = Date.now();
      const nextPrompts = editingId
        ? prompts.map((prompt) =>
            prompt.id === editingId
              ? { ...prompt, ...draft, category: normalizedCategory, shortcut: normalizedShortcut, updatedAt: now }
              : prompt,
          )
        : [
            ...prompts,
            {
              id: now.toString(),
              ...draft,
              category: normalizedCategory,
              shortcut: normalizedShortcut,
              createdAt: now,
              updatedAt: now,
            },
          ];

      setPrompts(nextPrompts);
      await savePrompts(nextPrompts, eventSourceIdRef.current);
      const result = await syncShortcuts(nextPrompts);
      setStorageUsage(getStorageUsage());
      setError(null);
      setStatusMessage(
        result.failed.length > 0
          ? "提示词已保存，但部分快捷键注册失败。"
          : editingId
            ? "提示词已更新。"
            : "提示词已新增。",
      );
      return true;
    },
    [prompts, syncShortcuts],
  );

  const deletePrompt = useCallback(
    async (id: string) => {
      const nextPrompts = prompts.filter((prompt) => prompt.id !== id);
      setPrompts(nextPrompts);
      await savePrompts(nextPrompts, eventSourceIdRef.current);
      await syncShortcuts(nextPrompts);
      setStorageUsage(getStorageUsage());
      setStatusMessage("提示词已删除。");
    },
    [prompts, syncShortcuts],
  );

  const persistSettings = useCallback(async (nextSettings: AppSettings) => {
    setSettings(nextSettings);
    await saveSettings(nextSettings);
    setStatusMessage("设置已保存。");
  }, []);

  const restoreFromFileContent = useCallback(
    async (content: string) => {
      const ok = await restoreData(content);
      if (ok) {
        setStatusMessage("备份已恢复。");
        await refresh({ forceShortcutSync: true });
      } else {
        setError("恢复备份失败，请检查文件内容。");
      }
      return ok;
    },
    [refresh],
  );

  const importFromTxtContent = useCallback(
    async (content: string) => {
      const result = await importPromptsTxt(content);
      if (result.ok) {
        setStatusMessage(result.message);
        await refresh({ forceShortcutSync: true });
      } else {
        setError(result.message);
      }
      return result.ok;
    },
    [refresh],
  );

  const handleBackup = useCallback(async () => {
    const result = await backupData();
    if (result.ok) {
      setStatusMessage(result.message);
      setError(null);
    } else if (result.message !== "用户已取消保存") {
      setError(result.message);
    }
    return result.ok;
  }, []);

  const handleExportTxt = useCallback(async () => {
    const result = await exportPromptsTxt();
    if (result.ok) {
      setStatusMessage(result.message);
      setError(null);
    } else if (result.message !== "用户已取消保存") {
      setError(result.message);
    }
    return result.ok;
  }, []);

  return {
    activeCategory,
    categories,
    deletePrompt,
    error,
    filteredPrompts,
    handleBackup,
    handleExportTxt,
    importFromTxtContent,
    isLoading,
    persistSettings,
    prompts,
    restoreFromFileContent,
    saveDraft,
    setActiveCategory,
    setError,
    setSettings,
    setStatusMessage,
    settings,
    statusMessage,
    storageUsage,
    unavailableShortcuts,
  };
}
