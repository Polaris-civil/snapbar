import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  backupData,
  exportPromptsTxt,
  getPromptsUpdatedEventName,
  getStorageUsage,
  hasRestoreSnapshot,
  importPromptsTxt,
  loadPrompts,
  restoreData,
  savePrompts,
  undoLastRestore,
} from "../lib/promptStorage";
import { loadSettings, saveSettings, SETTINGS_KEY } from "../lib/settingsStorage";
import { analyzeShortcuts, canonicalizeShortcut, validateShortcut } from "../lib/shortcut";
import {
  ALL_CATEGORIES_FILTER,
  DEFAULT_CATEGORY,
  DEFAULT_SETTINGS,
  type AppSettings,
  type PromptDraft,
  type PromptItem,
} from "../lib/promptTypes";

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

function getShortcutSignature(promptList: PromptItem[]) {
  return promptList
    .filter((prompt) => prompt.shortcut)
    .map((prompt) => `${prompt.id}:${canonicalizeShortcut(prompt.shortcut)}:${prompt.content}`)
    .join("|");
}

function errorMessage(error: unknown, fallback: string) {
  if (typeof error === "string" && error.trim()) return error;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
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
  const [canUndoRestore, setCanUndoRestore] = useState(false);
  const eventSourceIdRef = useRef(`prompt-library-${Math.random().toString(36).slice(2)}`);
  const lastShortcutSignatureRef = useRef<string | null>(null);
  const lastShortcutResultRef = useRef<ShortcutSyncResult>({ registered: [], failed: [] });

  const syncShortcuts = useCallback(async (promptList: PromptItem[], force = false) => {
    const signature = getShortcutSignature(promptList);
    if (!force && signature === lastShortcutSignatureRef.current) {
      return lastShortcutResultRef.current;
    }

    const analysis = analyzeShortcuts(promptList);
    try {
      const result = await invoke<ShortcutSyncResult>("update_prompt_shortcuts", {
        bindings: analysis.bindings,
      });
      const failed = [...new Set([...analysis.unavailable, ...result.failed.map(canonicalizeShortcut)])];
      const combinedResult = { ...result, failed };
      lastShortcutSignatureRef.current = signature;
      lastShortcutResultRef.current = combinedResult;
      setUnavailableShortcuts(failed);
      return combinedResult;
    } catch (syncError) {
      console.error(syncError);
      lastShortcutSignatureRef.current = null;
      const failed = [...new Set([...analysis.unavailable, ...analysis.bindings.map((item) => item.shortcut)])];
      lastShortcutResultRef.current = { registered: [], failed };
      setUnavailableShortcuts(failed);
      setError("快捷键同步失败，请稍后重试。");
      return { registered: [], failed };
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
          setCanUndoRestore(hasRestoreSnapshot());
        });
      } catch (loadError) {
        console.error(loadError);
        setError(errorMessage(loadError, "加载提示词失败，请稍后重试。"));
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
      if (event.key === "app_prompts_data" || event.key === SETTINGS_KEY || event.key === null) {
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

  useEffect(() => {
    if (!statusMessage) return undefined;
    const timer = window.setTimeout(() => setStatusMessage(null), 4000);
    return () => window.clearTimeout(timer);
  }, [statusMessage]);

  useEffect(() => {
    let active = true;
    let unlisten: (() => void) | undefined;
    void listen<string>("input-error", (event) => {
      setError(event.payload || "全局快捷键输入失败，请检查目标应用和系统权限。");
    })
      .then((removeListener) => {
        if (active) unlisten = removeListener;
        else removeListener();
      })
      .catch((listenError) => console.error("Failed to listen for shortcut input errors:", listenError));

    return () => {
      active = false;
      unlisten?.();
    };
  }, []);

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
      const normalizedShortcut = canonicalizeShortcut(draft.shortcut) || undefined;
      const shortcutError = validateShortcut(normalizedShortcut);
      if (shortcutError) {
        setError(shortcutError);
        return false;
      }
      if (!draft.title.trim() || !draft.content.trim()) {
        setError("标题和内容不能为空。");
        return false;
      }
      const conflictingPrompt = prompts.find(
        (prompt) =>
          prompt.id !== editingId &&
          canonicalizeShortcut(prompt.shortcut).toLowerCase() === normalizedShortcut?.toLowerCase(),
      );

      if (conflictingPrompt) {
        setError(`快捷键已被“${conflictingPrompt.title}”占用。`);
        return false;
      }

      const now = Date.now();
      const nextPrompts = editingId
        ? prompts.map((prompt) =>
            prompt.id === editingId
              ? {
                  ...prompt,
                  ...draft,
                  title: draft.title.trim(),
                  category: normalizedCategory,
                  shortcut: normalizedShortcut,
                  updatedAt: now,
                }
              : prompt,
          )
        : [
            ...prompts,
            {
              id: `${now}-${Math.random().toString(36).slice(2, 8)}`,
              ...draft,
              title: draft.title.trim(),
              category: normalizedCategory,
              shortcut: normalizedShortcut,
              createdAt: now,
              updatedAt: now,
            },
          ];

      setError(null);
      try {
        await savePrompts(nextPrompts, eventSourceIdRef.current);
        setPrompts(nextPrompts);
        const result = await syncShortcuts(nextPrompts);
        setStorageUsage(getStorageUsage());
        setStatusMessage(
          result.failed.length > 0
            ? "提示词已保存，但部分快捷键不可用。"
            : editingId
              ? "提示词已更新。"
              : "提示词已新增。",
        );
        return true;
      } catch (saveError) {
        setError(errorMessage(saveError, "保存提示词失败。"));
        return false;
      }
    },
    [prompts, syncShortcuts],
  );

  const deletePrompt = useCallback(
    async (id: string) => {
      const nextPrompts = prompts.filter((prompt) => prompt.id !== id);
      setError(null);
      try {
        await savePrompts(nextPrompts, eventSourceIdRef.current);
        setPrompts(nextPrompts);
        await syncShortcuts(nextPrompts);
        setStorageUsage(getStorageUsage());
        setStatusMessage("提示词已删除。");
        return true;
      } catch (deleteError) {
        setError(errorMessage(deleteError, "删除提示词失败。"));
        return false;
      }
    },
    [prompts, syncShortcuts],
  );

  const persistSettings = useCallback(async (nextSettings: AppSettings) => {
    setError(null);
    try {
      await saveSettings(nextSettings);
      setSettings(nextSettings);
      setStorageUsage(getStorageUsage());
      setStatusMessage("设置已保存。");
      return true;
    } catch (settingsError) {
      setError(errorMessage(settingsError, "保存设置失败。"));
      return false;
    }
  }, []);

  const restoreFromFileContent = useCallback(
    async (content: string) => {
      const ok = await restoreData(content, eventSourceIdRef.current);
      if (ok) {
        setStatusMessage("备份已恢复，可在设置中撤销本次恢复。");
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
      const result = await importPromptsTxt(content, eventSourceIdRef.current);
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

  const undoRestore = useCallback(async () => {
    const ok = await undoLastRestore(eventSourceIdRef.current);
    if (ok) {
      setStatusMessage("已撤销上次备份恢复。");
      await refresh({ forceShortcutSync: true });
    } else {
      setError("没有可撤销的恢复记录，或恢复记录已损坏。");
    }
    return ok;
  }, [refresh]);

  const typePromptText = useCallback(async (text: string) => {
    setError(null);
    try {
      await invoke("type_text", { text });
      setStatusMessage("文本已输入到目标应用。");
      return true;
    } catch (inputError) {
      setError(errorMessage(inputError, "文本输入失败，请检查目标应用和系统权限。"));
      return false;
    }
  }, []);

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
    canUndoRestore,
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
    typePromptText,
    undoRestore,
    unavailableShortcuts,
  };
}
