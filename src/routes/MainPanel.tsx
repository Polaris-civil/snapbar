import React, { memo, useCallback, useDeferredValue, useMemo, useState, type CSSProperties } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { confirm as confirmDialog } from "@tauri-apps/plugin-dialog";
import { exit } from "@tauri-apps/plugin-process";
import { Edit2, GripVertical, Minus, Plus, Settings, Trash2, X } from "lucide-react";
import PromptModal from "../components/PromptModal";
import SettingsModal from "../components/SettingsModal";
import { usePromptLibrary } from "../hooks/usePromptLibrary";
import { canonicalizeShortcut } from "../lib/shortcut";
import {
  ALL_CATEGORIES_FILTER,
  DEFAULT_CATEGORY,
  getCategoryLabel,
  type AppSettings,
  type PromptDraft,
  type PromptItem,
} from "../store";

interface DeleteDialogState {
  id: string;
  title: string;
}

function getDefaultCategory(categories: string[]) {
  return categories.find((item) => item !== ALL_CATEGORIES_FILTER && item.trim()) ?? DEFAULT_CATEGORY;
}

interface PromptTileProps {
  prompt: PromptItem;
  buttonClassName: string;
  buttonStyle: CSSProperties;
  onPaste: (text: string, event: React.MouseEvent) => Promise<void>;
  onEdit: (item: PromptItem, event: React.MouseEvent) => Promise<void>;
  onDelete: (item: PromptItem, event: React.MouseEvent) => Promise<void>;
}

const PromptTile = memo(function PromptTile({
  prompt,
  buttonClassName,
  buttonStyle,
  onPaste,
  onEdit,
  onDelete,
}: PromptTileProps) {
  return (
    <div onClick={(event) => void onPaste(prompt.content, event)} className="group relative flex-shrink-0">
      <button className={buttonClassName} style={buttonStyle} title={prompt.content}>
        {prompt.title}
      </button>
      <div className="absolute -right-2 -top-2 flex gap-1 rounded-full border border-white/10 bg-black/80 p-0.5 opacity-0 transition-opacity group-hover:opacity-100">
        <button onClick={(event) => void onEdit(prompt, event)} className="p-1 hover:text-blue-400">
          <Edit2 size={10} />
        </button>
        <button onClick={(event) => void onDelete(prompt, event)} className="p-1 hover:text-red-400">
          <Trash2 size={10} />
        </button>
      </div>
    </div>
  );
});

export default function MainPanel() {
  const [showModal, setShowModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState<string>(DEFAULT_CATEGORY);
  const [shortcut, setShortcut] = useState("");
  const [deleteDialog, setDeleteDialog] = useState<DeleteDialogState | null>(null);
  const [settingsDraft, setSettingsDraft] = useState<AppSettings | null>(null);

  const {
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
    restoreFromFileContent,
    saveDraft,
    setActiveCategory,
    setError,
    settings,
    statusMessage,
    storageUsage,
    typePromptText,
    undoRestore,
    unavailableShortcuts,
  } = usePromptLibrary();

  const deferredPrompts = useDeferredValue(filteredPrompts);

  const resetForm = useCallback(() => {
    setEditingId(null);
    setTitle("");
    setContent("");
    setCategory(getDefaultCategory(categories));
    setShortcut("");
  }, [categories]);

  const reportCommandError = useCallback(
    (commandError: unknown, fallback: string) => {
      if (typeof commandError === "string" && commandError.trim()) setError(commandError);
      else if (commandError instanceof Error && commandError.message) setError(commandError.message);
      else setError(fallback);
    },
    [setError],
  );

  const resizePanel = useCallback(
    async (expanded: boolean) => {
      try {
        await invoke("set_panel_expanded", { expanded });
        return true;
      } catch (resizeError) {
        reportCommandError(resizeError, "调整窗口大小失败。");
        return false;
      }
    },
    [reportCommandError],
  );

  const collapsePanelIfIdle = useCallback(async () => {
    if (showModal || showSettings) return;
    await resizePanel(false);
  }, [resizePanel, showModal, showSettings]);

  const handleRestore = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const input = event.currentTarget;
      const file = input.files?.[0];
      if (!file) return;
      try {
        const approved = await confirmDialog("恢复备份会替换当前提示词及备份中包含的设置。系统会保留一次可撤销快照。", {
          title: "恢复 SnapBar 备份",
          kind: "warning",
        });
        if (!approved) return;
        const fileContent = await file.text();
        if (!fileContent.trim()) throw new Error("所选备份文件为空。");
        const restored = await restoreFromFileContent(fileContent);
        if (restored) setSettingsDraft(null);
      } catch (restoreError) {
        reportCommandError(restoreError, "读取或恢复备份失败。");
      } finally {
        input.value = "";
      }
    },
    [reportCommandError, restoreFromFileContent],
  );

  const handleImportTxt = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const input = event.currentTarget;
      const file = input.files?.[0];
      if (!file) return;
      try {
        const fileContent = await file.text();
        if (!fileContent.trim()) throw new Error("所选 TXT 文件为空。");
        await importFromTxtContent(fileContent);
      } catch (importError) {
        reportCommandError(importError, "读取或导入 TXT 失败。");
      } finally {
        input.value = "";
      }
    },
    [importFromTxtContent, reportCommandError],
  );

  const handlePaste = useCallback(
    async (text: string, _event: React.MouseEvent) => {
      await typePromptText(text);
    },
    [typePromptText],
  );

  const handleDeleteRequest = useCallback(
    async (item: PromptItem, event: React.MouseEvent) => {
      event.stopPropagation();
      await resizePanel(true);
      setDeleteDialog({ id: item.id, title: item.title });
    },
    [resizePanel],
  );

  const handleDeleteCancel = useCallback(async () => {
    setDeleteDialog(null);
    await collapsePanelIfIdle();
  }, [collapsePanelIfIdle]);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteDialog) return;
    const deleted = await deletePrompt(deleteDialog.id);
    if (!deleted) return;
    setDeleteDialog(null);
    await collapsePanelIfIdle();
  }, [collapsePanelIfIdle, deleteDialog, deletePrompt]);

  const handleEdit = useCallback(
    async (item: PromptItem, event: React.MouseEvent) => {
      event.stopPropagation();
      setEditingId(item.id);
      setTitle(item.title);
      setContent(item.content);
      setCategory(item.category);
      setShortcut(item.shortcut ?? "");
      await resizePanel(true);
      setShowModal(true);
    },
    [resizePanel],
  );

  const openAddModal = useCallback(async () => {
    resetForm();
    await resizePanel(true);
    setShowModal(true);
  }, [resetForm, resizePanel]);

  const closePromptModal = useCallback(async () => {
    setShowModal(false);
    resetForm();
    await resizePanel(false);
  }, [resetForm, resizePanel]);

  const handleSave = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      const normalizedCategory = category.trim() || getDefaultCategory(categories);
      const draft: PromptDraft = { title, content, category: normalizedCategory, shortcut };
      const saved = await saveDraft(draft, editingId);
      if (!saved) return;

      setShowModal(false);
      resetForm();
      await resizePanel(false);
    },
    [categories, category, content, editingId, resetForm, resizePanel, saveDraft, shortcut, title],
  );

  const openSettings = useCallback(async () => {
    setSettingsDraft({ ...settings });
    await resizePanel(true);
    setShowSettings(true);
  }, [resizePanel, settings]);

  const closeSettings = useCallback(async () => {
    setShowSettings(false);
    setSettingsDraft(null);
    await resizePanel(false);
  }, [resizePanel]);

  const handleSettingsSave = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      if (!settingsDraft) return;
      const saved = await persistSettings(settingsDraft);
      if (!saved) return;
      setShowSettings(false);
      setSettingsDraft(null);
      await resizePanel(false);
    },
    [persistSettings, resizePanel, settingsDraft],
  );

  const handleUndoRestore = useCallback(async () => {
    const restored = await undoRestore();
    if (restored) setSettingsDraft(null);
    return restored;
  }, [undoRestore]);

  const startDragging = useCallback(async () => {
    try {
      await getCurrentWindow().startDragging();
    } catch (dragError) {
      reportCommandError(dragError, "拖动窗口失败。");
    }
  }, [reportCommandError]);

  const minimizeWindow = useCallback(async () => {
    try {
      await invoke("minimize_main");
    } catch (minimizeError) {
      reportCommandError(minimizeError, "最小化窗口失败。");
    }
  }, [reportCommandError]);

  const exitApp = useCallback(async () => {
    try {
      await exit(0);
    } catch (exitError) {
      reportCommandError(exitError, "退出 SnapBar 失败。");
    }
  }, [reportCommandError]);

  const buttonClassName = useMemo(() => {
    const base =
      "bg-white/10 hover:bg-white/20 active:scale-95 rounded-lg whitespace-nowrap transition-all border border-white/5 truncate shadow-sm";

    if (typeof settings.buttonSize === "string") {
      switch (settings.buttonSize) {
        case "small":
          return `${base} px-3 py-1.5 text-xs max-w-[120px]`;
        case "large":
          return `${base} px-5 py-2.5 text-base max-w-[180px]`;
        default:
          return `${base} px-4 py-2 text-sm max-w-[150px]`;
      }
    }

    return base;
  }, [settings.buttonSize]);

  const buttonStyle = useMemo<CSSProperties>(() => {
    if (typeof settings.buttonSize === "string") return {};

    const scale = settings.buttonSize / 100;
    return {
      fontSize: `${Math.max(10, 14 * scale)}px`,
      padding: `${Math.max(4, 8 * scale)}px ${Math.max(8, 16 * scale)}px`,
      maxWidth: `${Math.max(100, 150 * scale)}px`,
    };
  }, [settings.buttonSize]);

  const unavailableShortcutSet = useMemo(() => {
    return new Set(unavailableShortcuts.map((item) => item.toLowerCase()));
  }, [unavailableShortcuts]);

  const emptyStateText = isLoading
    ? "\u6b63\u5728\u52a0\u8f7d\u63d0\u793a\u8bcd..."
    : deferredPrompts.length === 0 && activeCategory !== "\u5168\u90e8"
      ? "\u5f53\u524d\u5206\u7c7b\u4e0b\u8fd8\u6ca1\u6709\u63d0\u793a\u8bcd\u3002"
      : "\u8fd8\u6ca1\u6709\u4efb\u4f55\u63d0\u793a\u8bcd\uff0c\u70b9\u51fb\u53f3\u4fa7\u52a0\u53f7\u65b0\u5efa\u4e00\u4e2a\u3002";

  return (
    <div
      className="flex h-screen items-center overflow-hidden rounded-xl border border-white/10 text-white shadow-xl backdrop-blur-md transition-opacity duration-200"
      style={{ backgroundColor: settings.themeColor }}
    >
      <div
        className="flex h-full w-8 cursor-move items-center justify-center transition-colors hover:bg-white/10"
        onMouseDown={() => void startDragging()}
      >
        <GripVertical size={16} className="text-white/50" />
      </div>

      <div className="relative flex h-full min-w-0 flex-1 flex-col px-2 py-2">
        <div className="absolute right-2 top-2 z-10 flex items-center justify-end gap-2">
          <select
            value={activeCategory}
            onChange={(event) => setActiveCategory(event.target.value)}
            className="rounded-lg border border-white/10 bg-black/20 px-2 py-1.5 text-xs outline-none"
          >
            {categories.map((item) => (
              <option key={item} value={item} className="bg-slate-900">
                {getCategoryLabel(item)}
              </option>
            ))}
          </select>
        </div>

        <div className="flex min-h-0 flex-1 items-center gap-2 overflow-x-auto pr-18 no-scrollbar">
          {deferredPrompts.length === 0 ? (
            <span className="px-2 text-xs text-white/55">{emptyStateText}</span>
          ) : (
            deferredPrompts.map((prompt) => (
              <PromptTile
                key={prompt.id}
                prompt={prompt}
                buttonClassName={buttonClassName}
                buttonStyle={buttonStyle}
                onPaste={handlePaste}
                onEdit={handleEdit}
                onDelete={handleDeleteRequest}
              />
            ))
          )}
        </div>

        {settings.showShortcutHints && (
          <div className="flex min-h-[16px] items-center gap-3 px-1 pt-1 text-[11px] leading-none">
            {deferredPrompts.length > 0 && (
              <div className="flex min-w-0 flex-1 gap-3 overflow-x-auto no-scrollbar text-white/60">
                {deferredPrompts.map((prompt, index) => {
                  const shortcutUnavailable =
                    Boolean(prompt.shortcut) &&
                    unavailableShortcutSet.has(canonicalizeShortcut(prompt.shortcut).toLowerCase());

                  return (
                    <span
                      key={`${prompt.id}-shortcut-index`}
                      className={`shrink-0 ${shortcutUnavailable ? "text-rose-300" : "text-white/60"}`}
                      title={`${prompt.title}: ${prompt.shortcut || "\u672a\u8bbe\u7f6e\u5feb\u6377\u952e"}`}
                    >
                      {index + 1}. {prompt.shortcut || "\u672a\u8bbe\u7f6e\u5feb\u6377\u952e"}
                    </span>
                  );
                })}
              </div>
            )}
            {(statusMessage || error) && (
              <div className={`truncate ${error ? "text-rose-300" : "text-emerald-300"}`}>
                {error ?? statusMessage}
              </div>
            )}
          </div>
        )}

        {!settings.showShortcutHints && (statusMessage || error) && (
          <div className={`px-1 pt-1 text-[11px] leading-none ${error ? "text-rose-300" : "text-emerald-300"}`}>
            <div className="truncate">{error ?? statusMessage}</div>
          </div>
        )}
      </div>

      <div className="flex h-full items-center gap-2 border-l border-white/10 px-3">
        <button
          onClick={openSettings}
          className="rounded-lg p-2 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          title={"\u8bbe\u7f6e"}
        >
          <Settings size={18} />
        </button>
        <button
          onClick={openAddModal}
          className="rounded-lg p-2 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          title={"\u65b0\u589e"}
        >
          <Plus size={18} />
        </button>
        <div className="flex flex-col gap-1">
          <button
            onClick={() => void minimizeWindow()}
            className="rounded-lg p-2 text-white/55 transition-colors hover:bg-white/10 hover:text-white"
            title={"\u6700\u5c0f\u5316"}
          >
            <Minus size={18} />
          </button>
          <button
            onClick={() => void exitApp()}
            className="rounded-lg p-2 text-white/50 transition-colors hover:bg-red-500/20 hover:text-red-400"
            title={"\u9000\u51fa"}
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {deleteDialog && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/40 px-4 py-6 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-[22px] border border-slate-200/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(246,248,252,0.98))] p-5 text-slate-900 shadow-[0_24px_70px_rgba(15,23,42,0.18)]">
            <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-rose-600/80">{"\u5220\u9664\u786e\u8ba4"}</div>
            <h3 className="mt-1.5 text-lg font-semibold">{"\u786e\u8ba4\u5220\u9664\u8fd9\u6761\u63d0\u793a\u8bcd"}</h3>
            <p className="mt-2 text-sm text-slate-500">
              <span className="font-medium text-slate-700">{deleteDialog.title}</span>
              {" "}
              {"\u5220\u9664\u540e\u65e0\u6cd5\u6062\u590d\u3002"}
            </p>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => void handleDeleteCancel()}
                className="flex-1 rounded-2xl border border-slate-200 bg-white py-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
              >
                {"\u53d6\u6d88"}
              </button>
              <button
                type="button"
                onClick={() => void handleDeleteConfirm()}
                className="flex-1 rounded-2xl bg-rose-500 py-3 text-sm font-semibold text-white transition-colors hover:bg-rose-600"
              >
                {"\u786e\u8ba4\u5220\u9664"}
              </button>
            </div>
          </div>
        </div>
      )}

      <SettingsModal
        isOpen={showSettings}
        onClose={() => void closeSettings()}
        onSave={handleSettingsSave}
        onBackup={handleBackup}
        onExportTxt={handleExportTxt}
        onUndoRestore={handleUndoRestore}
        canUndoRestore={canUndoRestore}
        settings={settingsDraft ?? settings}
        setSettings={setSettingsDraft}
        storageUsage={storageUsage}
        handleRestore={handleRestore}
        handleImportTxt={handleImportTxt}
      />

      <PromptModal
        isOpen={showModal}
        onClose={() => void closePromptModal()}
        onSave={handleSave}
        editingId={editingId}
        title={title}
        setTitle={setTitle}
        content={content}
        setContent={setContent}
        category={category}
        setCategory={setCategory}
        categories={categories.filter((item) => item !== ALL_CATEGORIES_FILTER)}
        shortcut={shortcut}
        setShortcut={setShortcut}
      />
    </div>
  );
}
