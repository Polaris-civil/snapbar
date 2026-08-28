import { LoaderCircle, Trash2 } from "lucide-react";
import type { FormEvent } from "react";
import { CATEGORIES, getCategoryLabel } from "../store";
import { detectDesktopPlatform, formatShortcutForPlatform, shortcutExample } from "../lib/platform";
import { validateShortcut } from "../lib/shortcut";
import Dialog from "./ui/Dialog";

interface PromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (event: FormEvent) => void;
  editingId: string | null;
  title: string;
  setTitle: (title: string) => void;
  content: string;
  setContent: (content: string) => void;
  category: string;
  setCategory: (category: string) => void;
  categories: string[];
  shortcut: string;
  setShortcut: (shortcut: string) => void;
  isSaving: boolean;
  error: string | null;
}

function normalizeShortcutKey(key: string) {
  if (key === " ") return "Space";
  if (key.length === 1) return key.toUpperCase();

  const aliases: Record<string, string> = {
    ArrowUp: "Up",
    ArrowDown: "Down",
    ArrowLeft: "Left",
    ArrowRight: "Right",
    Enter: "Enter",
    Escape: "Escape",
    Tab: "Tab",
    Backspace: "Backspace",
    Delete: "Delete",
    Insert: "Insert",
    Home: "Home",
    End: "End",
    PageUp: "PageUp",
    PageDown: "PageDown",
  };

  return aliases[key] ?? key;
}

export default function PromptModal({
  isOpen,
  onClose,
  onSave,
  editingId,
  title,
  setTitle,
  content,
  setContent,
  category,
  setCategory,
  categories,
  shortcut,
  setShortcut,
  isSaving,
  error,
}: PromptModalProps) {
  const categoryOptions = Array.from(new Set([...CATEGORIES, ...categories.filter(Boolean)]));
  const shortcutError = validateShortcut(shortcut);
  const platform = detectDesktopPlatform();
  const formId = "prompt-editor-form";

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      closeDisabled={isSaving}
      title={editingId ? "编辑提示词" : "新建提示词"}
      footer={
        <>
          <button type="button" className="button" onClick={onClose} disabled={isSaving}>
            取消
          </button>
          <button
            type="submit"
            form={formId}
            className="button button-primary"
            disabled={isSaving || Boolean(shortcutError) || !title.trim() || !content.trim()}
          >
            {isSaving && <LoaderCircle size={14} className="button-spinner" aria-hidden="true" />}
            {isSaving ? "正在保存" : "保存提示词"}
          </button>
        </>
      }
    >
      {error && (
        <div className="dialog-inline-status dialog-inline-error" role="alert">
          {error}
        </div>
      )}
      <form id={formId} onSubmit={onSave} className="form-stack">
        <div className="field-grid">
          <label className="form-field" htmlFor="prompt-title">
            <span className="form-label">标题</span>
            <input
              id="prompt-title"
              required
              autoFocus
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="form-control"
              disabled={isSaving}
            />
          </label>

          <label className="form-field" htmlFor="prompt-category">
            <span className="form-label">分类</span>
            <input
              id="prompt-category"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              list="category-suggestions"
              className="form-control"
              disabled={isSaving}
            />
            <datalist id="category-suggestions">
              {categoryOptions.map((item) => (
                <option key={item} value={item}>
                  {getCategoryLabel(item)}
                </option>
              ))}
            </datalist>
          </label>
        </div>

        <div className="form-field">
          <label className="form-label" htmlFor="prompt-shortcut">
            快捷键
          </label>
          <div className="shortcut-editor">
            <input
              id="prompt-shortcut"
              value={formatShortcutForPlatform(shortcut, platform)}
              placeholder={shortcutExample(platform)}
              readOnly
              className="form-control"
              disabled={isSaving}
              aria-invalid={Boolean(shortcutError)}
              aria-describedby="prompt-shortcut-help"
              onKeyDown={(event) => {
                event.preventDefault();
                event.stopPropagation();

                if (
                  (event.key === "Backspace" || event.key === "Delete") &&
                  !event.ctrlKey &&
                  !event.altKey &&
                  !event.metaKey &&
                  !event.shiftKey
                ) {
                  setShortcut("");
                  return;
                }

                if (["Control", "Shift", "Alt", "Meta"].includes(event.key)) return;

                const parts: string[] = [];
                if (event.ctrlKey) parts.push("Ctrl");
                if (event.altKey) parts.push("Alt");
                if (event.shiftKey) parts.push("Shift");
                if (event.metaKey) parts.push("Command");
                setShortcut([...parts, normalizeShortcutKey(event.key)].join("+"));
              }}
            />
            <button
              type="button"
              className="button button-subtle"
              onClick={() => setShortcut("")}
              disabled={isSaving || !shortcut}
            >
              <Trash2 size={14} aria-hidden="true" />
              清除
            </button>
          </div>
          <p id="prompt-shortcut-help" className={shortcutError ? "field-error" : "field-help"}>
            {shortcutError ?? `按下组合键，例如 ${shortcutExample(platform)}`}
          </p>
        </div>

        <label className="form-field" htmlFor="prompt-content">
          <span className="form-label">内容</span>
          <textarea
            id="prompt-content"
            required
            value={content}
            onChange={(event) => setContent(event.target.value)}
            className="form-control"
            disabled={isSaving}
          />
        </label>
      </form>
    </Dialog>
  );
}
