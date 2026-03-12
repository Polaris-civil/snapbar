import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { exportPromptsToTxtContent, parseTxtPrompts } from "./promptCodec";
import type { PromptItem, StorageData } from "./promptTypes";

const STORAGE_KEY = "app_prompts_data";
const PROMPTS_UPDATED_EVENT = "prompts-updated";

interface FileActionResult {
  ok: boolean;
  message: string;
}

function normalizePrompt(raw: Partial<PromptItem>, index: number): PromptItem {
  const now = Date.now();
  const createdAt = typeof raw.createdAt === "number" ? raw.createdAt : now + index;
  const updatedAt = typeof raw.updatedAt === "number" ? raw.updatedAt : createdAt;

  return {
    id: raw.id ?? `${createdAt}-${index}`,
    title: raw.title?.trim() ?? "",
    content: raw.content ?? "",
    category: raw.category ?? "通用",
    shortcut: raw.shortcut?.trim() || undefined,
    createdAt,
    updatedAt,
  };
}

function normalizePrompts(rawPrompts: unknown): PromptItem[] {
  if (!Array.isArray(rawPrompts)) return [];

  return rawPrompts
    .map((item, index) => normalizePrompt((item ?? {}) as Partial<PromptItem>, index))
    .filter((item) => item.title && item.content);
}

function emitPromptsUpdated() {
  window.dispatchEvent(new CustomEvent(PROMPTS_UPDATED_EVENT));
}

export function getPromptsUpdatedEventName() {
  return PROMPTS_UPDATED_EVENT;
}

export async function loadPrompts(): Promise<PromptItem[]> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const data = JSON.parse(raw);
    if (Array.isArray(data)) return normalizePrompts(data);
    return normalizePrompts(data.prompts);
  } catch (error) {
    console.error("Failed to load prompts:", error);
    return [];
  }
}

export async function savePrompts(prompts: PromptItem[]) {
  try {
    const estimatedSize = JSON.stringify(prompts).length;
    if (estimatedSize > 4 * 1024 * 1024) {
      window.alert("提示：本地存储空间接近上限，已超过 4MB。");
    }

    const storageData: StorageData = {
      version: 2,
      timestamp: Date.now(),
      prompts,
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(storageData));
    emitPromptsUpdated();
  } catch (error) {
    console.error("Failed to save prompts:", error);
    if (error instanceof DOMException && error.name === "QuotaExceededError") {
      window.alert("本地存储空间不足，无法继续保存。");
    }
  }
}

export async function backupData(): Promise<FileActionResult> {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return { ok: false, message: "当前没有可备份的数据。" };
  }

  try {
    const path = await save({
      filters: [{ name: "JSON 备份", extensions: ["json"] }],
      defaultPath: `snapbar-backup-${Date.now()}.json`,
    });

    if (!path) {
      return { ok: false, message: "已取消备份。" };
    }

    await writeTextFile(path, raw);
    return { ok: true, message: "备份成功，已保存为 JSON 文件。" };
  } catch (error) {
    console.error("Backup failed:", error);
    return {
      ok: false,
      message: `备份失败：${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

export async function restoreData(jsonContent: string) {
  try {
    const data = JSON.parse(jsonContent);
    const isValidObject = typeof data === "object" && data !== null;
    const isValidBackup =
      Array.isArray(data) || (isValidObject && ("prompts" in data || "version" in data || "timestamp" in data));

    if (!isValidBackup) {
      throw new Error("Invalid format");
    }

    localStorage.setItem(STORAGE_KEY, jsonContent);
    emitPromptsUpdated();
    return true;
  } catch (error) {
    console.error("Restore failed:", error);
    return false;
  }
}

export function getStorageUsage() {
  let total = 0;
  for (const key in localStorage) {
    if (!Object.prototype.hasOwnProperty.call(localStorage, key)) continue;
    total += (localStorage[key].length + key.length) * 2;
  }

  return `${(total / 1024).toFixed(2)} KB`;
}

export async function exportPromptsTxt(): Promise<FileActionResult> {
  try {
    const prompts = await loadPrompts();
    if (prompts.length === 0) {
      return { ok: false, message: "当前没有可导出的提示词。" };
    }

    const path = await save({
      filters: [{ name: "TXT 文本", extensions: ["txt"] }],
      defaultPath: `snapbar-prompts-${Date.now()}.txt`,
    });

    if (!path) {
      return { ok: false, message: "已取消导出。" };
    }

    await writeTextFile(path, exportPromptsToTxtContent(prompts));
    return { ok: true, message: "导出成功，已生成 TXT 文件。" };
  } catch (error) {
    console.error("Export TXT failed:", error);
    return {
      ok: false,
      message: `导出失败：${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

export async function importPromptsTxt(fileContent: string) {
  try {
    const newItems = parseTxtPrompts(fileContent);
    if (newItems.length === 0) {
      return {
        ok: false,
        importedCount: 0,
        message: "文件中没有识别到可导入的提示词，请检查 TXT 格式。",
      };
    }

    const currentPrompts = await loadPrompts();
    await savePrompts([...currentPrompts, ...newItems]);

    return {
      ok: true,
      importedCount: newItems.length,
      message: `已导入 ${newItems.length} 条提示词。`,
    };
  } catch (error) {
    console.error("Import TXT failed:", error);
    return {
      ok: false,
      importedCount: 0,
      message: `导入失败：${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
