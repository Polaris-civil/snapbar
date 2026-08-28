import {
  Archive,
  Database,
  Download,
  FileJson,
  FileText,
  LoaderCircle,
  RotateCcw,
  ShieldAlert,
  Upload,
} from "lucide-react";
import { useRef, type ChangeEvent, type FormEvent } from "react";
import { isValidThemeColor } from "../lib/settingsStorage";
import type { AppSettings } from "../store";
import type { PendingAction } from "../lib/uiState";
import type { UiThemeMode } from "../lib/uiPreferences";
import Dialog from "./ui/Dialog";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (event: FormEvent) => void;
  onBackup: () => Promise<boolean>;
  onExportTxt: () => Promise<boolean>;
  onUndoRestore: () => Promise<boolean>;
  canUndoRestore: boolean;
  settings: AppSettings;
  setSettings: (settings: AppSettings) => void;
  themeMode: UiThemeMode;
  setThemeMode: (mode: UiThemeMode) => void;
  storageUsage: string;
  handleRestore: (event: ChangeEvent<HTMLInputElement>) => void;
  handleImportTxt: (event: ChangeEvent<HTMLInputElement>) => void;
  pendingAction: PendingAction;
  error: string | null;
  statusMessage: string | null;
}

const txtExample = `标题: 示例提示词
分类: 通用
快捷键: Alt+1
内容:
这里填写提示词内容，可以换行。
---

标题: 代码示例
分类: 代码
快捷键:
内容:
console.log("Hello SnapBar");`;

const COLOR_PRESETS = [
  { name: "石板蓝", value: "#5f6b76" },
  { name: "青绿色", value: "#147d78" },
  { name: "海蓝色", value: "#356fc4" },
  { name: "琥珀色", value: "#986600" },
  { name: "玫红色", value: "#c5424f" },
];

const THEME_OPTIONS: Array<{ label: string; value: UiThemeMode }> = [
  { label: "系统", value: "system" },
  { label: "浅色", value: "light" },
  { label: "深色", value: "dark" },
];

export default function SettingsModal({
  isOpen,
  onClose,
  onSave,
  onBackup,
  onExportTxt,
  onUndoRestore,
  canUndoRestore,
  settings,
  setSettings,
  themeMode,
  setThemeMode,
  storageUsage,
  handleRestore,
  handleImportTxt,
  pendingAction,
  error,
  statusMessage,
}: SettingsModalProps) {
  const restoreInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const isBusy = pendingAction !== null;
  const formId = "settings-form";
  const previewScale =
    typeof settings.buttonSize === "number"
      ? settings.buttonSize / 100
      : settings.buttonSize === "small"
        ? 0.85
        : settings.buttonSize === "large"
          ? 1.15
          : 1;
  const previewStyle = {
    fontSize: `${Math.max(10, 13 * previewScale)}px`,
    padding: `${Math.max(5, 7 * previewScale)}px ${Math.max(10, 14 * previewScale)}px`,
    minWidth: `${Math.max(88, 112 * previewScale)}px`,
    borderInlineStart: `3px solid ${settings.themeColor}`,
  };

  const actionLabel = (action: Exclude<PendingAction, null>, idle: string, busy: string) =>
    pendingAction === action ? busy : idle;

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      closeDisabled={isBusy}
      title="设置"
      footer={
        <>
          <button type="button" className="button" onClick={onClose} disabled={isBusy}>
            取消
          </button>
          <button
            type="submit"
            form={formId}
            className="button button-primary"
            disabled={isBusy || !isValidThemeColor(settings.themeColor)}
          >
            {pendingAction === "save-settings" && (
              <LoaderCircle size={14} className="button-spinner" aria-hidden="true" />
            )}
            {actionLabel("save-settings", "保存设置", "正在保存")}
          </button>
        </>
      }
    >
      {(error || statusMessage) && (
        <div
          className={`dialog-inline-status ${error ? "dialog-inline-error" : "dialog-inline-success"}`}
          role={error ? "alert" : "status"}
          aria-live={error ? "assertive" : "polite"}
        >
          {error ?? statusMessage}
        </div>
      )}
      <form id={formId} onSubmit={onSave} className="settings-stack">
        <section className="settings-section" aria-labelledby="appearance-title">
          <h3 id="appearance-title" className="settings-section-title">
            外观
          </h3>

          <div className="setting-row">
            <div className="setting-copy">
              <div className="setting-title">界面主题</div>
              <div className="setting-description">系统模式会跟随操作系统外观。</div>
            </div>
            <div className="segmented-control" role="group" aria-label="界面主题">
              {THEME_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className="segment-button"
                  aria-pressed={themeMode === option.value}
                  onClick={() => setThemeMode(option.value)}
                  disabled={isBusy}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="appearance-grid">
            <div className="form-field">
              <label className="form-label" htmlFor="button-size">
                提示词按钮大小
              </label>
              <div className="range-row">
                <input
                  id="button-size"
                  type="range"
                  min="50"
                  max="150"
                  step="5"
                  value={typeof settings.buttonSize === "number" ? settings.buttonSize : 100}
                  onChange={(event) => setSettings({ ...settings, buttonSize: Number(event.target.value) })}
                  disabled={isBusy}
                />
                <output className="range-value" htmlFor="button-size">
                  {typeof settings.buttonSize === "number" ? settings.buttonSize : 100}%
                </output>
              </div>
            </div>
            <div className="preview-well" aria-label="提示词按钮预览">
              <button type="button" className="preview-prompt" style={previewStyle} tabIndex={-1}>
                示例按钮
              </button>
            </div>
          </div>

          <label className="setting-row" htmlFor="shortcut-hints">
            <span className="setting-copy">
              <span className="setting-title">显示快捷键提示</span>
              <span className="setting-description">在提示词按钮中显示平台对应的快捷键。</span>
            </span>
            <input
              id="shortcut-hints"
              type="checkbox"
              className="switch-control"
              checked={settings.showShortcutHints}
              onChange={(event) => setSettings({ ...settings, showShortcutHints: event.target.checked })}
              disabled={isBusy}
            />
          </label>

          <div className="form-field">
            <label className="form-label" htmlFor="theme-color">
              工具条强调色
            </label>
            <div className="color-swatches" role="group" aria-label="强调色预设">
              {COLOR_PRESETS.map((color) => (
                <button
                  key={color.name}
                  type="button"
                  className="color-swatch"
                  style={{ backgroundColor: color.value }}
                  aria-label={color.name}
                  aria-pressed={settings.themeColor.toLowerCase() === color.value}
                  title={color.name}
                  onClick={() => setSettings({ ...settings, themeColor: color.value })}
                  disabled={isBusy}
                />
              ))}
            </div>
            <input
              id="theme-color"
              value={settings.themeColor}
              onChange={(event) => setSettings({ ...settings, themeColor: event.target.value })}
              className="form-control"
              aria-invalid={!isValidThemeColor(settings.themeColor)}
              aria-describedby="theme-color-error"
              disabled={isBusy}
            />
            {!isValidThemeColor(settings.themeColor) && (
              <p id="theme-color-error" className="field-error">
                请输入有效的 Hex 颜色，例如 #147d78。
              </p>
            )}
          </div>
        </section>

        <section className="settings-section" aria-labelledby="data-title">
          <h3 id="data-title" className="settings-section-title">
            数据
          </h3>
          <div className="storage-summary">
            <div className="setting-copy">
              <div className="setting-title">本地存储</div>
              <div className="setting-description">提示词、设置和最近一次恢复快照。</div>
            </div>
            <div className="storage-value" aria-label={`已使用 ${storageUsage}`}>
              {storageUsage}
            </div>
          </div>

          <div className="inline-notice">
            <ShieldAlert size={16} aria-hidden="true" />
            <span>数据以明文保存在本机，请勿保存密码、私钥或长期有效的访问令牌。</span>
          </div>

          <div className="data-actions">
            <button type="button" className="button" onClick={() => void onBackup()} disabled={isBusy}>
              {pendingAction === "backup" ? (
                <LoaderCircle size={14} className="button-spinner" aria-hidden="true" />
              ) : (
                <Archive size={14} aria-hidden="true" />
              )}
              {actionLabel("backup", "备份全部", "正在备份")}
            </button>
            <button type="button" className="button" onClick={() => restoreInputRef.current?.click()} disabled={isBusy}>
              {pendingAction === "restore" ? (
                <LoaderCircle size={14} className="button-spinner" aria-hidden="true" />
              ) : (
                <Upload size={14} aria-hidden="true" />
              )}
              {actionLabel("restore", "恢复备份", "正在恢复")}
            </button>
            <button type="button" className="button" onClick={() => void onExportTxt()} disabled={isBusy}>
              {pendingAction === "export-txt" ? (
                <LoaderCircle size={14} className="button-spinner" aria-hidden="true" />
              ) : (
                <Download size={14} aria-hidden="true" />
              )}
              {actionLabel("export-txt", "导出 TXT", "正在导出")}
            </button>
            <button type="button" className="button" onClick={() => importInputRef.current?.click()} disabled={isBusy}>
              {pendingAction === "import-txt" ? (
                <LoaderCircle size={14} className="button-spinner" aria-hidden="true" />
              ) : (
                <FileText size={14} aria-hidden="true" />
              )}
              {actionLabel("import-txt", "导入 TXT", "正在导入")}
            </button>
            <button
              type="button"
              className="button"
              onClick={() => void onUndoRestore()}
              disabled={isBusy || !canUndoRestore}
            >
              {pendingAction === "undo-restore" ? (
                <LoaderCircle size={14} className="button-spinner" aria-hidden="true" />
              ) : (
                <RotateCcw size={14} aria-hidden="true" />
              )}
              {actionLabel("undo-restore", "撤销上次恢复", "正在撤销")}
            </button>
          </div>

          <input
            ref={restoreInputRef}
            type="file"
            accept=".json,application/json"
            className="sr-only"
            tabIndex={-1}
            onChange={handleRestore}
          />
          <input
            ref={importInputRef}
            type="file"
            accept=".txt,text/plain"
            className="sr-only"
            tabIndex={-1}
            onChange={handleImportTxt}
          />

          <details className="format-guide">
            <summary>TXT 格式参考</summary>
            <div className="format-guide-content">
              <p>
                <FileJson size={14} aria-hidden="true" /> JSON 用于完整备份和恢复。
              </p>
              <p>
                <Database size={14} aria-hidden="true" /> TXT 用于分享和批量编辑。
              </p>
              <pre>{txtExample}</pre>
            </div>
          </details>
        </section>
      </form>
    </Dialog>
  );
}
