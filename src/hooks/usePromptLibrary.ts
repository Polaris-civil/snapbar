import { invoke } from "@tauri-apps/api/core";
import { startTransition, useCallback, useEffect, useMemo, useState } from "react";
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

export function usePromptLibrary() {
  const [prompts, setPrompts] = useState<PromptItem[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [storageUsage, setStorageUsage] = useState("0 KB");
  const [activeCategory, setActiveCategory] = useState<string>(ALL_CATEGORIES_FILTER);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [unavailableShortcuts, setUnavailableShortcuts] = useState<string[]>([]);

  const syncShortcuts = useCallback(async (promptList: PromptItem[]) => {
    const bindings: ShortcutBinding[] = promptList
      .filter((prompt) => prompt.shortcut)
      .map((prompt) => ({
        shortcut: prompt.shortcut!.trim(),
        text: prompt.content,
      }));

    try {
      const result = await invoke<ShortcutSyncResult>("update_prompt_shortcuts", { bindings });
      setUnavailableShortcuts(result.failed);
      return result;
    } catch (syncError) {
      console.error(syncError);
      setUnavailableShortcuts([]);
      setError("快捷键同步失败，请检查桌面端权限。");
      return { registered: [], failed: [] };
    }
  }, []);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [loadedPrompts, loadedSettings] = await Promise.all([loadPrompts(), loadSettings()]);
      await syncShortcuts(loadedPrompts);
      startTransition(() => {
        setPrompts(loadedPrompts);
        setSettings(loadedSettings);
        setStorageUsage(getStorageUsage());
      });
    } catch (loadError) {
      console.error(loadError);
      setError("提示词库加载失败。");
    } finally {
      setIsLoading(false);
    }
  }, [syncShortcuts]);

  useEffect(() => {
    void refresh();

    const handleUpdate = () => {
      void refresh();
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === "app_prompts_data" || event.key === null) {
        void refresh();
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
              ? { ...prompt, ...draft, shortcut: normalizedShortcut, updatedAt: now }
              : prompt,
          )
        : [
            ...prompts,
            {
              id: now.toString(),
              ...draft,
              shortcut: normalizedShortcut,
              createdAt: now,
              updatedAt: now,
            },
          ];

      setPrompts(nextPrompts);
      await savePrompts(nextPrompts);
      const result = await syncShortcuts(nextPrompts);
      setStorageUsage(getStorageUsage());
      setError(null);
      setStatusMessage(
        result.failed.length > 0
          ? "部分快捷键未能注册，请查看对应按钮下方的快捷键索引。"
          : editingId
            ? "提示词已更新。"
            : "提示词已创建。",
      );
      return true;
    },
    [prompts, syncShortcuts],
  );

  const deletePrompt = useCallback(
    async (id: string) => {
      const nextPrompts = prompts.filter((prompt) => prompt.id !== id);
      setPrompts(nextPrompts);
      await savePrompts(nextPrompts);
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
        setStatusMessage("备份恢复成功。");
        await refresh();
      } else {
        setError("恢复失败，请检查备份文件格式。");
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
        await refresh();
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
    } else if (result.message !== "已取消备份。") {
      setError(result.message);
    }
    return result.ok;
  }, []);

  const handleExportTxt = useCallback(async () => {
    const result = await exportPromptsTxt();
    if (result.ok) {
      setStatusMessage(result.message);
      setError(null);
    } else if (result.message !== "已取消导出。") {
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
