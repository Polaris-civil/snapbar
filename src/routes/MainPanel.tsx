import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { confirm as confirmDialog } from "@tauri-apps/plugin-dialog";
import { exit } from "@tauri-apps/plugin-process";
import { Edit2, GripVertical, LoaderCircle, Minus, Plus, Power, Settings, Trash2 } from "lucide-react";
import { memo, useCallback, useDeferredValue, useMemo, useState, type CSSProperties } from "react";
import PromptModal from "../components/PromptModal";
import SettingsModal from "../components/SettingsModal";
import Dialog from "../components/ui/Dialog";
import IconButton from "../components/ui/IconButton";
import ShortcutKey from "../components/ui/ShortcutKey";
import StatusNotice from "../components/ui/StatusNotice";
import { usePromptLibrary } from "../hooks/usePromptLibrary";
import { useUiTheme } from "../hooks/useUiTheme";
import { detectDesktopPlatform } from "../lib/platform";
import { canonicalizeShortcut } from "../lib/shortcut";
import type { UiThemeMode } from "../lib/uiPreferences";
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

interface AppFrameStyle extends CSSProperties {
  "--prompt-scale": number;
  "--user-tint": string;
}

function getDefaultCategory(categories: string[]) {
  return categories.find((item) => item !== ALL_CATEGORIES_FILTER && item.trim()) ?? DEFAULT_CATEGORY;
}

interface PromptTileProps {
  prompt: PromptItem;
  showShortcutHints: boolean;
  shortcutUnavailable: boolean;
  disabled: boolean;
  onInput: (text: string) => Promise<void>;
  onEdit: (item: PromptItem, event: React.MouseEvent) => Promise<void>;
  onDelete: (item: PromptItem, event: React.MouseEvent) => Promise<void>;
}

const PromptTile = memo(function PromptTile({
  prompt,
  showShortcutHints,
  shortcutUnavailable,
  disabled,
  onInput,
  onEdit,
  onDelete,
}: PromptTileProps) {
  return (
    <div className="prompt-item">
      <button
        type="button"
        className="prompt-primary"
        title={prompt.content}
        onClick={() => void onInput(prompt.content)}
        disabled={disabled}
      >
        <span className="prompt-title">{prompt.title}</span>
        {showShortcutHints && <ShortcutKey shortcut={prompt.shortcut} unavailable={shortcutUnavailable} />}
      </button>
      <div className="prompt-actions">
        <IconButton
          icon={<Edit2 size={14} aria-hidden="true" />}
          label={`编辑“${prompt.title}”`}
          onClick={(event) => void onEdit(prompt, event)}
          disabled={disabled}
        />
        <IconButton
          icon={<Trash2 size={14} aria-hidden="true" />}
          label={`删除“${prompt.title}”`}
          tone="danger"
          onClick={(event) => void onDelete(prompt, event)}
          disabled={disabled}
        />
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
  const [themeModeDraft, setThemeModeDraft] = useState<UiThemeMode | null>(null);
  const platform = detectDesktopPlatform();
  const { persistThemeMode, themeMode } = useUiTheme();

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
    pendingAction,
    persistSettings,
    restoreFromFileContent,
    saveDraft,
    setActiveCategory,
    setError,
    setStatusMessage,
    settings,
    statusMessage,
    storageUsage,
    typePromptText,
    undoRestore,
    unavailableShortcuts,
  } = usePromptLibrary();

  const deferredPrompts = useDeferredValue(filteredPrompts);
  const isBusy = pendingAction !== null;
  const promptScale =
    typeof settings.buttonSize === "number"
      ? Math.max(0.78, settings.buttonSize / 100)
      : settings.buttonSize === "small"
        ? 0.85
        : settings.buttonSize === "large"
          ? 1.15
          : 1;
  const frameStyle: AppFrameStyle = {
    "--prompt-scale": promptScale,
    "--user-tint": settings.themeColor,
  };

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

  const handlePromptInput = useCallback(
    async (text: string) => {
      await typePromptText(text);
    },
    [typePromptText],
  );

  const handleDeleteRequest = useCallback(
    async (item: PromptItem, event: React.MouseEvent) => {
      event.stopPropagation();
      setError(null);
      setStatusMessage(null);
      await resizePanel(true);
      setDeleteDialog({ id: item.id, title: item.title });
    },
    [resizePanel, setError, setStatusMessage],
  );

  const handleDeleteCancel = useCallback(async () => {
    if (pendingAction === "delete-prompt") return;
    setDeleteDialog(null);
    await collapsePanelIfIdle();
  }, [collapsePanelIfIdle, pendingAction]);

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
      setError(null);
      setStatusMessage(null);
      setEditingId(item.id);
      setTitle(item.title);
      setContent(item.content);
      setCategory(item.category);
      setShortcut(item.shortcut ?? "");
      await resizePanel(true);
      setShowModal(true);
    },
    [resizePanel, setError, setStatusMessage],
  );

  const openAddModal = useCallback(async () => {
    setError(null);
    setStatusMessage(null);
    resetForm();
    await resizePanel(true);
    setShowModal(true);
  }, [resetForm, resizePanel, setError, setStatusMessage]);

  const closePromptModal = useCallback(async () => {
    if (pendingAction === "save-prompt") return;
    setShowModal(false);
    resetForm();
    await resizePanel(false);
  }, [pendingAction, resetForm, resizePanel]);

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
    setError(null);
    setStatusMessage(null);
    setSettingsDraft({ ...settings });
    setThemeModeDraft(themeMode);
    await resizePanel(true);
    setShowSettings(true);
  }, [resizePanel, setError, setStatusMessage, settings, themeMode]);

  const closeSettings = useCallback(async () => {
    if (pendingAction) return;
    setShowSettings(false);
    setSettingsDraft(null);
    setThemeModeDraft(null);
    await resizePanel(false);
  }, [pendingAction, resizePanel]);

  const handleSettingsSave = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      if (!settingsDraft || !themeModeDraft) return;
      const saved = await persistSettings(settingsDraft);
      if (!saved) return;
      try {
        await persistThemeMode(themeModeDraft);
      } catch (themeError) {
        reportCommandError(themeError, "保存界面主题失败。");
        return;
      }
      setShowSettings(false);
      setSettingsDraft(null);
      setThemeModeDraft(null);
      await resizePanel(false);
    },
    [persistSettings, persistThemeMode, reportCommandError, resizePanel, settingsDraft, themeModeDraft],
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

  const unavailableShortcutSet = useMemo(
    () => new Set(unavailableShortcuts.map((item) => item.toLowerCase())),
    [unavailableShortcuts],
  );

  const emptyStateText = isLoading
    ? "正在加载提示词…"
    : deferredPrompts.length === 0 && activeCategory !== ALL_CATEGORIES_FILTER
      ? "当前分类还没有提示词。"
      : "还没有提示词，点击新增按钮创建一个。";
  const statusKind = isLoading || pendingAction === "type-text" ? "loading" : error ? "error" : statusMessage ? "success" : "idle";
  const statusText = isLoading
    ? "正在加载提示词…"
    : pendingAction === "type-text"
      ? "正在输入文本…"
      : error ?? statusMessage;

  return (
    <div className={`app-frame platform-${platform}`} style={frameStyle}>
      <div className="drag-handle" onMouseDown={() => void startDragging()} aria-hidden="true">
        <GripVertical size={15} />
      </div>

      <main className="main-content">
        <div className="toolbar-row">
          <label className="sr-only" htmlFor="category-filter">
            提示词分类
          </label>
          <select
            id="category-filter"
            value={activeCategory}
            onChange={(event) => setActiveCategory(event.target.value)}
            className="category-filter"
            disabled={isLoading || isBusy}
          >
            {categories.map((item) => (
              <option key={item} value={item}>
                {getCategoryLabel(item)}
              </option>
            ))}
          </select>

          <div className="prompt-scroller" aria-label="提示词列表">
            {deferredPrompts.length === 0 ? (
              <span className="empty-state">{emptyStateText}</span>
            ) : (
              deferredPrompts.map((prompt) => {
                const shortcutUnavailable =
                  Boolean(prompt.shortcut) &&
                  unavailableShortcutSet.has(canonicalizeShortcut(prompt.shortcut).toLowerCase());
                return (
                  <PromptTile
                    key={prompt.id}
                    prompt={prompt}
                    showShortcutHints={settings.showShortcutHints}
                    shortcutUnavailable={shortcutUnavailable}
                    disabled={isBusy}
                    onInput={handlePromptInput}
                    onEdit={handleEdit}
                    onDelete={handleDeleteRequest}
                  />
                );
              })
            )}
          </div>
        </div>

        <StatusNotice
          kind={statusKind}
          message={showModal || showSettings || deleteDialog ? null : statusText}
          onDismiss={
            error || statusMessage
              ? () => {
                  setError(null);
                  setStatusMessage(null);
                }
              : undefined
          }
        />
      </main>

      <aside className="window-actions" aria-label="窗口操作">
        <div className="window-actions-primary">
          <IconButton
            icon={<Settings size={17} aria-hidden="true" />}
            label="设置"
            onClick={() => void openSettings()}
            disabled={isLoading || isBusy}
          />
          <IconButton
            icon={<Plus size={18} aria-hidden="true" />}
            label="新增提示词"
            onClick={() => void openAddModal()}
            disabled={isLoading || isBusy}
          />
        </div>
        <div className="window-actions-system">
          <IconButton
            icon={<Minus size={17} aria-hidden="true" />}
            label="最小化"
            onClick={() => void minimizeWindow()}
            disabled={isBusy}
          />
          <IconButton
            icon={<Power size={16} aria-hidden="true" />}
            label="退出 SnapBar"
            tone="danger"
            onClick={() => void exitApp()}
            disabled={isBusy}
          />
        </div>
      </aside>

      <Dialog
        open={Boolean(deleteDialog)}
        onClose={() => void handleDeleteCancel()}
        closeDisabled={pendingAction === "delete-prompt"}
        title="删除提示词"
        size="small"
        footer={
          <>
            <button
              type="button"
              className="button"
              onClick={() => void handleDeleteCancel()}
              disabled={pendingAction === "delete-prompt"}
            >
              取消
            </button>
            <button
              type="button"
              className="button button-danger"
              onClick={() => void handleDeleteConfirm()}
              disabled={pendingAction === "delete-prompt"}
            >
              {pendingAction === "delete-prompt" && (
                <LoaderCircle size={14} className="button-spinner" aria-hidden="true" />
              )}
              {pendingAction === "delete-prompt" ? "正在删除" : "确认删除"}
            </button>
          </>
        }
      >
        {error && (
          <div className="dialog-inline-status dialog-inline-error" role="alert">
            {error}
          </div>
        )}
        <p className="delete-copy">
          确认删除 <strong>{deleteDialog?.title}</strong>？删除后无法恢复。
        </p>
      </Dialog>

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
        themeMode={themeModeDraft ?? themeMode}
        setThemeMode={setThemeModeDraft}
        storageUsage={storageUsage}
        handleRestore={handleRestore}
        handleImportTxt={handleImportTxt}
        pendingAction={pendingAction}
        error={error}
        statusMessage={statusMessage}
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
        isSaving={pendingAction === "save-prompt"}
        error={error}
      />
    </div>
  );
}
