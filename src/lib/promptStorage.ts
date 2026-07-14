import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { exportPromptsToTxtContent, parseTxtPrompts } from "./promptCodec";
import {
  isValidThemeColor,
  loadSettings,
  normalizeSettings,
  SETTINGS_KEY,
} from "./settingsStorage";
import { canonicalizeShortcut } from "./shortcut";
import type { AppSettings, PromptItem, StorageData } from "./promptTypes";

export const STORAGE_KEY = "app_prompts_data";
export const RESTORE_SNAPSHOT_KEY = "app_restore_snapshot";
const PROMPTS_UPDATED_EVENT = "prompts-updated";
const STORAGE_VERSION = 2;
const STORAGE_WARNING_BYTES = 4 * 1024 * 1024;

interface FileActionResult {
  ok: boolean;
  message: string;
}

interface PromptsUpdatedDetail {
  sourceId?: string;
}

interface ParsedBackup {
  prompts: PromptItem[];
  settings?: AppSettings;
}

interface RestoreSnapshot {
  version: 1;
  timestamp: number;
  prompts: string | null;
  settings: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizePrompt(raw: unknown, index: number): PromptItem | null {
  if (!isRecord(raw) || typeof raw.title !== "string" || typeof raw.content !== "string") {
    return null;
  }
  const title = raw.title.trim();
  if (!title || !raw.content.trim()) return null;
  if (raw.category !== undefined && typeof raw.category !== "string") return null;
  if (raw.shortcut !== undefined && typeof raw.shortcut !== "string") return null;
  if (raw.id !== undefined && typeof raw.id !== "string" && typeof raw.id !== "number") return null;
  if (raw.createdAt !== undefined && (typeof raw.createdAt !== "number" || !Number.isFinite(raw.createdAt))) {
    return null;
  }
  if (raw.updatedAt !== undefined && (typeof raw.updatedAt !== "number" || !Number.isFinite(raw.updatedAt))) {
    return null;
  }

  const now = Date.now();
  const createdAt = typeof raw.createdAt === "number" ? raw.createdAt : now + index;
  const updatedAt = typeof raw.updatedAt === "number" ? raw.updatedAt : createdAt;
  return {
    id: raw.id === undefined ? `${createdAt}-${index}` : String(raw.id),
    title,
    content: raw.content,
    category: raw.category?.trim() || "通用",
    shortcut: canonicalizeShortcut(raw.shortcut) || undefined,
    createdAt,
    updatedAt,
  };
}

function normalizePrompts(rawPrompts: unknown): PromptItem[] {
  if (!Array.isArray(rawPrompts)) throw new Error("提示词列表不是数组。请选择有效的 SnapBar 备份文件。");

  const prompts = rawPrompts.map((item, index) => {
    const prompt = normalizePrompt(item, index);
    if (!prompt) throw new Error(`第 ${index + 1} 条提示词格式无效。`);
    return prompt;
  });

  const usedIds = new Set<string>();
  return prompts.map((prompt, index) => {
    if (!usedIds.has(prompt.id)) {
      usedIds.add(prompt.id);
      return prompt;
    }
    let nextId = `${prompt.id}-${index}`;
    while (usedIds.has(nextId)) nextId = `${nextId}-copy`;
    usedIds.add(nextId);
    return { ...prompt, id: nextId };
  });
}

function parseBackupSettings(value: unknown): AppSettings {
  if (!isRecord(value)) throw new Error("备份中的设置格式无效。");
  if (
    value.buttonSize !== undefined &&
    !(
      (typeof value.buttonSize === "number" &&
        Number.isFinite(value.buttonSize) &&
        value.buttonSize >= 50 &&
        value.buttonSize <= 150) ||
      value.buttonSize === "small" ||
      value.buttonSize === "medium" ||
      value.buttonSize === "large"
    )
  ) {
    throw new Error("备份中的按钮大小设置无效。");
  }
  if (
    value.themeColor !== undefined &&
    (typeof value.themeColor !== "string" || !isValidThemeColor(value.themeColor))
  ) {
    throw new Error("备份中的主题颜色设置无效。");
  }
  if (value.showShortcutHints !== undefined && typeof value.showShortcutHints !== "boolean") {
    throw new Error("备份中的快捷键提示设置无效。");
  }
  return normalizeSettings(value);
}

export function parseBackupContent(jsonContent: string): ParsedBackup {
  const data: unknown = JSON.parse(jsonContent);
  if (Array.isArray(data)) return { prompts: normalizePrompts(data) };
  if (!isRecord(data) || !Array.isArray(data.prompts)) {
    throw new Error("备份必须包含 prompts 数组。");
  }
  if (
    data.version !== undefined &&
    (typeof data.version !== "number" || !Number.isInteger(data.version) || data.version < 1 || data.version > STORAGE_VERSION)
  ) {
    throw new Error(`不支持的备份版本：${String(data.version)}`);
  }
  if (data.timestamp !== undefined && (typeof data.timestamp !== "number" || !Number.isFinite(data.timestamp))) {
    throw new Error("备份时间戳无效。");
  }

  return {
    prompts: normalizePrompts(data.prompts),
    settings: data.settings === undefined ? undefined : parseBackupSettings(data.settings),
  };
}

function emitPromptsUpdated(detail?: PromptsUpdatedDetail) {
  window.dispatchEvent(new CustomEvent<PromptsUpdatedDetail>(PROMPTS_UPDATED_EVENT, { detail }));
}

function restoreRawValue(key: string, value: string | null) {
  if (value === null) localStorage.removeItem(key);
  else localStorage.setItem(key, value);
}

function readRestoreSnapshot(): RestoreSnapshot | null {
  const raw = localStorage.getItem(RESTORE_SNAPSHOT_KEY);
  if (!raw) return null;
  try {
    const snapshot: unknown = JSON.parse(raw);
    if (
      !isRecord(snapshot) ||
      snapshot.version !== 1 ||
      typeof snapshot.timestamp !== "number" ||
      (snapshot.prompts !== null && typeof snapshot.prompts !== "string") ||
      (snapshot.settings !== null && typeof snapshot.settings !== "string")
    ) {
      return null;
    }
    return snapshot as unknown as RestoreSnapshot;
  } catch {
    return null;
  }
}

export function getPromptsUpdatedEventName() {
  return PROMPTS_UPDATED_EVENT;
}

export async function loadPrompts(): Promise<PromptItem[]> {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];

  try {
    return parseBackupContent(raw).prompts;
  } catch (error) {
    console.error("Failed to load prompts:", error);
    throw new Error(`本地提示词数据无法解析：${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function savePrompts(prompts: PromptItem[], sourceId?: string) {
  const storageData: StorageData = {
    version: STORAGE_VERSION,
    timestamp: Date.now(),
    prompts,
  };
  const serialized = JSON.stringify(storageData);
  if (serialized.length * 2 > STORAGE_WARNING_BYTES) {
    window.alert("提示词数据已接近 4MB 的本地存储限制，请及时导出备份。");
  }

  try {
    localStorage.setItem(STORAGE_KEY, serialized);
  } catch (error) {
    console.error("Failed to save prompts:", error);
    if (error instanceof DOMException && error.name === "QuotaExceededError") {
      throw new Error("本地存储空间不足，保存失败，请删除部分内容或导出备份。");
    }
    throw new Error(`保存提示词失败：${error instanceof Error ? error.message : String(error)}`);
  }
  emitPromptsUpdated({ sourceId });
}

export async function backupData(): Promise<FileActionResult> {
  try {
    const [prompts, settings] = await Promise.all([loadPrompts(), loadSettings()]);
    const backup: StorageData = {
      version: STORAGE_VERSION,
      timestamp: Date.now(),
      prompts,
      settings,
    };
    const path = await save({
      filters: [{ name: "JSON 备份", extensions: ["json"] }],
      defaultPath: `snapbar-backup-${Date.now()}.json`,
    });
    if (!path) return { ok: false, message: "用户已取消保存" };

    await writeTextFile(path, JSON.stringify(backup, null, 2));
    return { ok: true, message: "提示词和设置已导出为 JSON 备份。" };
  } catch (error) {
    console.error("Backup failed:", error);
    return { ok: false, message: `备份失败：${error instanceof Error ? error.message : String(error)}` };
  }
}

export async function restoreData(jsonContent: string, sourceId?: string) {
  try {
    const backup = parseBackupContent(jsonContent);
    const previousPrompts = localStorage.getItem(STORAGE_KEY);
    const previousSettings = localStorage.getItem(SETTINGS_KEY);
    const snapshot: RestoreSnapshot = {
      version: 1,
      timestamp: Date.now(),
      prompts: previousPrompts,
      settings: previousSettings,
    };

    localStorage.setItem(RESTORE_SNAPSHOT_KEY, JSON.stringify(snapshot));
    try {
      const data: StorageData = {
        version: STORAGE_VERSION,
        timestamp: Date.now(),
        prompts: backup.prompts,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      if (backup.settings) localStorage.setItem(SETTINGS_KEY, JSON.stringify(backup.settings));
    } catch (error) {
      restoreRawValue(STORAGE_KEY, previousPrompts);
      restoreRawValue(SETTINGS_KEY, previousSettings);
      localStorage.removeItem(RESTORE_SNAPSHOT_KEY);
      throw error;
    }

    emitPromptsUpdated({ sourceId });
    return true;
  } catch (error) {
    console.error("Restore failed:", error);
    return false;
  }
}

export function hasRestoreSnapshot() {
  return readRestoreSnapshot() !== null;
}

export async function undoLastRestore(sourceId?: string) {
  const snapshot = readRestoreSnapshot();
  if (!snapshot) return false;

  const currentPrompts = localStorage.getItem(STORAGE_KEY);
  const currentSettings = localStorage.getItem(SETTINGS_KEY);
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(SETTINGS_KEY);
    restoreRawValue(STORAGE_KEY, snapshot.prompts);
    restoreRawValue(SETTINGS_KEY, snapshot.settings);
    localStorage.removeItem(RESTORE_SNAPSHOT_KEY);
    emitPromptsUpdated({ sourceId });
    return true;
  } catch (error) {
    console.error("Undo restore failed:", error);
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(SETTINGS_KEY);
      restoreRawValue(STORAGE_KEY, currentPrompts);
      restoreRawValue(SETTINGS_KEY, currentSettings);
    } catch (rollbackError) {
      console.error("Undo restore rollback failed:", rollbackError);
    }
    return false;
  }
}

export function getStorageUsage() {
  let total = 0;
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key) continue;
    const value = localStorage.getItem(key) ?? "";
    total += (value.length + key.length) * 2;
  }
  return `${(total / 1024).toFixed(2)} KB`;
}

export async function exportPromptsTxt(): Promise<FileActionResult> {
  try {
    const prompts = await loadPrompts();
    if (prompts.length === 0) return { ok: false, message: "当前没有可导出的提示词。" };

    const path = await save({
      filters: [{ name: "TXT 文本", extensions: ["txt"] }],
      defaultPath: `snapbar-prompts-${Date.now()}.txt`,
    });
    if (!path) return { ok: false, message: "用户已取消保存" };

    await writeTextFile(path, exportPromptsToTxtContent(prompts));
    return { ok: true, message: "提示词已导出为 TXT 文件。" };
  } catch (error) {
    console.error("Export TXT failed:", error);
    return { ok: false, message: `导出 TXT 失败：${error instanceof Error ? error.message : String(error)}` };
  }
}

export async function importPromptsTxt(fileContent: string, sourceId?: string) {
  try {
    const newItems = parseTxtPrompts(fileContent);
    if (newItems.length === 0) {
      return { ok: false, importedCount: 0, message: "未在 TXT 中解析到有效提示词，请检查格式。" };
    }

    const currentPrompts = await loadPrompts();
    const usedIds = new Set(currentPrompts.map((prompt) => prompt.id));
    const importedPrompts = newItems.map((prompt) => {
      if (!usedIds.has(prompt.id)) {
        usedIds.add(prompt.id);
        return prompt;
      }
      let suffix = 1;
      let id = `${prompt.id}-import-${suffix}`;
      while (usedIds.has(id)) {
        suffix += 1;
        id = `${prompt.id}-import-${suffix}`;
      }
      usedIds.add(id);
      return { ...prompt, id };
    });
    await savePrompts([...currentPrompts, ...importedPrompts], sourceId);

    return { ok: true, importedCount: importedPrompts.length, message: `已导入 ${importedPrompts.length} 条提示词。` };
  } catch (error) {
    console.error("Import TXT failed:", error);
    return {
      ok: false,
      importedCount: 0,
      message: `导入 TXT 失败：${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
