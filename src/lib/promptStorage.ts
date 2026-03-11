import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { decryptData, encryptData, getSessionPassword } from "./crypto";
import { exportPromptsToTxtContent, parseTxtPrompts } from "./promptCodec";
import type { PromptItem, StorageData } from "./promptTypes";

const STORAGE_KEY = "app_prompts_data";
const PROMPTS_UPDATED_EVENT = "prompts-updated";

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
    if (data.encrypted) {
      const password = getSessionPassword();
      if (!password) throw new Error("LOCKED");

      try {
        const decryptedJson = await decryptData(data.cipher, data.salt, data.iv, password);
        const decrypted = JSON.parse(decryptedJson);
        return normalizePrompts(decrypted.prompts);
      } catch {
        throw new Error("INVALID_PASSWORD");
      }
    }

    if (Array.isArray(data)) return normalizePrompts(data);
    return normalizePrompts(data.prompts);
  } catch (error) {
    if (error instanceof Error && (error.message === "LOCKED" || error.message === "INVALID_PASSWORD")) {
      throw error;
    }

    console.error("Failed to load prompts:", error);
    return [];
  }
}

export async function savePrompts(prompts: PromptItem[]) {
  try {
    const estimatedSize = JSON.stringify(prompts).length;
    if (estimatedSize > 4 * 1024 * 1024) {
      alert("提示：本地存储空间不足，已使用超过 4MB。");
    }

    const password = getSessionPassword();
    let storageData: StorageData = {
      version: 2,
      timestamp: Date.now(),
      prompts,
      encrypted: false,
    };

    if (password) {
      const encrypted = await encryptData(JSON.stringify({ prompts }), password);
      storageData = {
        version: 2,
        timestamp: Date.now(),
        encrypted: true,
        ...encrypted,
      };
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(storageData));
    emitPromptsUpdated();
  } catch (error) {
    console.error("Failed to save prompts:", error);
    if (error instanceof DOMException && error.name === "QuotaExceededError") {
      alert("Storage Quota Exceeded! Cannot save changes.");
    }
  }
}

export async function backupData() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    alert("没有可备份的数据。");
    return;
  }

  try {
    const path = await save({
      filters: [{ name: "JSON", extensions: ["json"] }],
      defaultPath: `backup_prompts_${Date.now()}.json`,
    });

    if (path) {
      await writeTextFile(path, raw);
      alert("备份成功。");
    }
  } catch (error) {
    console.error("Backup failed:", error);
    alert("备份失败。");
  }
}

export async function restoreData(jsonContent: string) {
  try {
    const data = JSON.parse(jsonContent);
    if (!data.version && !Array.isArray(data) && !data.prompts && !data.encrypted) {
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

export async function exportPromptsTxt() {
  try {
    const prompts = await loadPrompts();
    if (prompts.length === 0) {
      alert("没有可导出的提示词。");
      return;
    }

    const path = await save({
      filters: [{ name: "Text File", extensions: ["txt"] }],
      defaultPath: `prompts_export_${Date.now()}.txt`,
    });

    if (path) {
      await writeTextFile(path, exportPromptsToTxtContent(prompts));
      alert("导出成功。");
    }
  } catch (error) {
    console.error("Export TXT failed:", error);
    alert(`导出失败：${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function importPromptsTxt(fileContent: string) {
  try {
    const newItems = parseTxtPrompts(fileContent);
    if (newItems.length === 0) {
      return { ok: false, importedCount: 0, message: "文件中没有可导入的有效提示词。" };
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
    return { ok: false, importedCount: 0, message: "导入失败。" };
  }
}
