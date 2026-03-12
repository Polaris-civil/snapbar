import React, { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { exit } from "@tauri-apps/plugin-process";
import { Edit2, GripVertical, Minus, Plus, Settings, Trash2, X } from "lucide-react";
import PromptModal from "../components/PromptModal";
import SettingsModal from "../components/SettingsModal";
import { usePromptLibrary } from "../hooks/usePromptLibrary";
import { CATEGORIES, getCategoryLabel, type PromptDraft, type PromptItem } from "../store";

interface DeleteDialogState {
  id: string;
  title: string;
}

export default function MainPanel() {
  const [showModal, setShowModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState<string>(CATEGORIES[0]);
  const [shortcut, setShortcut] = useState("");
  const [deleteDialog, setDeleteDialog] = useState<DeleteDialogState | null>(null);

  const {
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
    restoreFromFileContent,
    saveDraft,
    setActiveCategory,
    setSettings,
    settings,
    statusMessage,
    storageUsage,
    unavailableShortcuts,
  } = usePromptLibrary();

  const resetForm = () => {
    setEditingId(null);
    setTitle("");
    setContent("");
    setCategory(CATEGORIES[0]);
    setShortcut("");
  };

  const collapsePanelIfIdle = async () => {
    if (showModal || showSettings) return;
    await invoke("set_panel_expanded", { expanded: false });
  };

  const handleRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const fileContent = event.target?.result as string;
      if (fileContent) {
        await restoreFromFileContent(fileContent);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleImportTxt = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const fileContent = event.target?.result as string;
      if (fileContent) {
        await importFromTxtContent(fileContent);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handlePaste = async (text: string, e: React.MouseEvent) => {
    if (!e.shiftKey) {
      // Reserved for future alternate paste strategies.
    }

    await invoke("type_text", { text });
  };

  const handleDeleteRequest = async (item: PromptItem, e: React.MouseEvent) => {
    e.stopPropagation();
    await invoke("set_panel_expanded", { expanded: true });
    setDeleteDialog({ id: item.id, title: item.title });
  };

  const handleDeleteCancel = async () => {
    setDeleteDialog(null);
    await collapsePanelIfIdle();
  };

  const handleDeleteConfirm = async () => {
    if (!deleteDialog) return;
    await deletePrompt(deleteDialog.id);
    setDeleteDialog(null);
    await collapsePanelIfIdle();
  };

  const handleEdit = async (item: PromptItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(item.id);
    setTitle(item.title);
    setContent(item.content);
    setCategory(item.category);
    setShortcut(item.shortcut ?? "");
    await invoke("set_panel_expanded", { expanded: true });
    await invoke("set_input_mode", { enable: true });
    setShowModal(true);
  };

  const openAddModal = async () => {
    resetForm();
    await invoke("set_panel_expanded", { expanded: true });
    await invoke("set_input_mode", { enable: true });
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const draft: PromptDraft = { title, content, category, shortcut };
    const saved = await saveDraft(draft, editingId);
    if (!saved) return;
    setShowModal(false);
    await invoke("set_input_mode", { enable: false });
    await invoke("set_panel_expanded", { expanded: false });
    resetForm();
  };

  const openSettings = async () => {
    await invoke("set_panel_expanded", { expanded: true });
    await invoke("set_input_mode", { enable: true });
    setShowSettings(true);
  };

  const handleSettingsSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await persistSettings(settings);
    setShowSettings(false);
    await invoke("set_input_mode", { enable: false });
    await invoke("set_panel_expanded", { expanded: false });
  };

  const getButtonClass = () => {
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
  };

  const getButtonStyle = () => {
    if (typeof settings.buttonSize === "string") return {};

    const scale = settings.buttonSize / 100;
    return {
      fontSize: `${Math.max(10, 14 * scale)}px`,
      padding: `${Math.max(4, 8 * scale)}px ${Math.max(8, 16 * scale)}px`,
      maxWidth: `${Math.max(100, 150 * scale)}px`,
    };
  };

  const emptyStateText = isLoading
    ? "正在加载提示词库..."
    : filteredPrompts.length === 0 && activeCategory !== "全部"
      ? "这个分类下还没有提示词。"
      : "还没有提示词，先添加一条常用内容吧。";

  return (
    <div
      className="flex h-screen items-center overflow-hidden rounded-xl border border-white/10 text-white shadow-xl backdrop-blur-md transition-opacity duration-200"
      style={{ backgroundColor: settings.themeColor }}
    >
      <div
        className="flex h-full w-8 cursor-move items-center justify-center transition-colors hover:bg-white/10"
        onMouseDown={() => getCurrentWindow().startDragging()}
      >
        <GripVertical size={16} className="text-white/50" />
      </div>

      <div className="relative flex h-full min-w-0 flex-1 flex-col px-2 py-2">
        <div className="absolute right-2 top-2 z-10 flex items-center justify-end gap-2">
          <select
            value={activeCategory}
            onChange={(e) => setActiveCategory(e.target.value)}
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
          {filteredPrompts.length === 0 ? (
            <span className="px-2 text-xs text-white/55">{emptyStateText}</span>
          ) : (
            filteredPrompts.map((prompt) => (
              <div
                key={prompt.id}
                onClick={(e) => handlePaste(prompt.content, e)}
                className="group relative flex-shrink-0"
              >
                <button className={getButtonClass()} style={getButtonStyle()} title={prompt.content}>
                  {prompt.title}
                </button>
                <div className="absolute -right-2 -top-2 flex gap-1 rounded-full border border-white/10 bg-black/80 p-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                  <button onClick={(e) => handleEdit(prompt, e)} className="p-1 hover:text-blue-400">
                    <Edit2 size={10} />
                  </button>
                  <button onClick={(e) => void handleDeleteRequest(prompt, e)} className="p-1 hover:text-red-400">
                    <Trash2 size={10} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="flex min-h-[16px] items-center gap-3 px-1 pt-1 text-[11px] leading-none">
          {filteredPrompts.length > 0 && (
            <div className="flex min-w-0 flex-1 gap-3 overflow-x-auto no-scrollbar text-white/60">
              {filteredPrompts.map((prompt, index) => {
                const shortcutUnavailable =
                  Boolean(prompt.shortcut) &&
                  unavailableShortcuts.some((item) => item.toLowerCase() === prompt.shortcut?.toLowerCase());

                return (
                  <span
                    key={`${prompt.id}-shortcut-index`}
                    className={`shrink-0 ${shortcutUnavailable ? "text-rose-300" : "text-white/60"}`}
                    title={`${prompt.title}：${prompt.shortcut || "未设置"}`}
                  >
                    {index + 1}. {prompt.shortcut || "未设置"}
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
      </div>

      <div className="flex h-full items-center gap-2 border-l border-white/10 px-3">
        <button
          onClick={openSettings}
          className="rounded-lg p-2 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          title="设置"
        >
          <Settings size={18} />
        </button>
        <button
          onClick={openAddModal}
          className="rounded-lg p-2 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          title="新增"
        >
          <Plus size={18} />
        </button>
        <div className="flex flex-col gap-1">
          <button
            onClick={() => invoke("minimize_main")}
            className="rounded-lg p-2 text-white/55 transition-colors hover:bg-white/10 hover:text-white"
            title="最小化"
          >
            <Minus size={18} />
          </button>
          <button
            onClick={() => exit(0)}
            className="rounded-lg p-2 text-white/50 transition-colors hover:bg-red-500/20 hover:text-red-400"
            title="退出"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {deleteDialog && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/40 px-4 py-6 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-[22px] border border-slate-200/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(246,248,252,0.98))] p-5 text-slate-900 shadow-[0_24px_70px_rgba(15,23,42,0.18)]">
            <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-rose-600/80">删除确认</div>
            <h3 className="mt-1.5 text-lg font-semibold">删除这条提示词？</h3>
            <p className="mt-2 text-sm text-slate-500">
              <span className="font-medium text-slate-700">{deleteDialog.title}</span>
              {" "}删除后将无法恢复。
            </p>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => void handleDeleteCancel()}
                className="flex-1 rounded-2xl border border-slate-200 bg-white py-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => void handleDeleteConfirm()}
                className="flex-1 rounded-2xl bg-rose-500 py-3 text-sm font-semibold text-white transition-colors hover:bg-rose-600"
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}

      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        onSave={handleSettingsSave}
        onBackup={handleBackup}
        onExportTxt={handleExportTxt}
        settings={settings}
        setSettings={setSettings}
        storageUsage={storageUsage}
        handleRestore={handleRestore}
        handleImportTxt={handleImportTxt}
      />

      <PromptModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          resetForm();
        }}
        onSave={handleSave}
        editingId={editingId}
        title={title}
        setTitle={setTitle}
        content={content}
        setContent={setContent}
        category={category}
        setCategory={setCategory}
        shortcut={shortcut}
        setShortcut={setShortcut}
      />
    </div>
  );
}
