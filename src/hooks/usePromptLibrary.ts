import { invoke } from "@tauri-apps/api/core";
import { startTransition, useCallback, useEffect, useMemo, useState } from "react";
import { setSessionPassword } from "../lib/crypto";
import {
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
  const [unlockPassword, setUnlockPasswordState] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>(ALL_CATEGORIES_FILTER);
  const [isLoading, setIsLoading] = useState(true);
  const [isLocked, setIsLocked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const syncShortcuts = useCallback(async (promptList: PromptItem[]) => {
    const bindings: ShortcutBinding[] = promptList
      .filter((prompt) => prompt.shortcut)
      .map((prompt) => ({
        shortcut: prompt.shortcut!.trim(),
        text: prompt.content,
      }));

    try {
      const result = await invoke<ShortcutSyncResult>("update_prompt_shortcuts", { bindings });
      if (result.failed.length > 0) {
        setError(`以下快捷键不可用：${result.failed.join("、")}`);
      }
      return result;
    } catch (syncError) {
      console.error(syncError);
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
        setIsLocked(false);
      });
    } catch (loadError) {
      if (loadError instanceof Error && loadError.message === "LOCKED") {
        setIsLocked(true);
      } else {
        console.error(loadError);
        setError("提示词库加载失败。");
      }
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
      setError(result.failed.length > 0 ? `以下快捷键不可用：${result.failed.join("、")}` : null);
      setStatusMessage(editingId ? "提示词已更新。" : "提示词已创建。");
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

  const persistSettings = useCallback(
    async (nextSettings: AppSettings, password?: string) => {
      setSettings(nextSettings);
      await saveSettings(nextSettings);

      if (password) {
        setSessionPassword(password);
        setUnlockPasswordState("");
        await savePrompts(prompts);
        setStatusMessage("设置已保存，本次会话已启用加密。");
      } else {
        setStatusMessage("设置已保存。");
      }
    },
    [prompts],
  );

  const unlock = useCallback(async () => {
    setSessionPassword(unlockPassword);
    try {
      const loaded = await loadPrompts();
      setPrompts(loaded);
      await syncShortcuts(loaded);
      setStorageUsage(getStorageUsage());
      setIsLocked(false);
      setUnlockPasswordState("");
      setError(null);
      setStatusMessage("提示词库已解锁。");
      return true;
    } catch {
      setError("密码不正确。");
      return false;
    }
  }, [syncShortcuts, unlockPassword]);

  const restoreFromFileContent = useCallback(
    async (content: string) => {
      const ok = await restoreData(content);
      if (ok) {
        setStatusMessage("提示词库恢复成功。");
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

  return {
    activeCategory,
    categories,
    deletePrompt,
    error,
    filteredPrompts,
    importFromTxtContent,
    isLoading,
    isLocked,
    persistSettings,
    prompts,
    restoreFromFileContent,
    saveDraft,
    setActiveCategory,
    setError,
    setSettings,
    setStatusMessage,
    setUnlockPassword: setUnlockPasswordState,
    settings,
    statusMessage,
    storageUsage,
    unlock,
    unlockPassword,
  };
}
