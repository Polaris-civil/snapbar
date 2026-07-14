import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  backupData,
  hasRestoreSnapshot,
  importPromptsTxt,
  loadPrompts,
  parseBackupContent,
  RESTORE_SNAPSHOT_KEY,
  restoreData,
  savePrompts,
  STORAGE_KEY,
  undoLastRestore,
} from "./promptStorage";
import { SETTINGS_KEY } from "./settingsStorage";
import type { PromptItem } from "./promptTypes";

const prompt: PromptItem = {
  id: "1",
  title: "示例",
  content: "正文",
  category: "通用",
  shortcut: "Ctrl+K",
  createdAt: 1,
  updatedAt: 2,
};

describe("prompt storage", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("rejects permissive or future backup objects", () => {
    expect(() => parseBackupContent('{"version":2}')).toThrow("prompts");
    expect(() => parseBackupContent('{"version":99,"prompts":[]}')).toThrow("不支持");
  });

  it("rejects future local storage versions without changing their raw data", async () => {
    const raw = '{"version":99,"prompts":[]}';
    localStorage.setItem(STORAGE_KEY, raw);
    await expect(loadPrompts()).rejects.toThrow("不支持");
    expect(localStorage.getItem(STORAGE_KEY)).toBe(raw);
  });

  it("never overwrites current data when validation fails", async () => {
    localStorage.setItem(STORAGE_KEY, "original");
    expect(await restoreData('{"version":2}')).toBe(false);
    expect(localStorage.getItem(STORAGE_KEY)).toBe("original");
    expect(localStorage.getItem(RESTORE_SNAPSHOT_KEY)).toBeNull();
  });

  it("restores settings and can exactly undo the replacement", async () => {
    const originalPrompts = JSON.stringify({ version: 2, timestamp: 1, prompts: [prompt] });
    const originalSettings = JSON.stringify({ buttonSize: 100, themeColor: "#00000080", showShortcutHints: true });
    localStorage.setItem(STORAGE_KEY, originalPrompts);
    localStorage.setItem(SETTINGS_KEY, originalSettings);

    const backup = JSON.stringify({
      version: 2,
      timestamp: 3,
      prompts: [{ ...prompt, id: "2", title: "恢复后" }],
      settings: { buttonSize: 125, themeColor: "#0f766e88", showShortcutHints: false },
    });
    expect(await restoreData(backup)).toBe(true);
    expect(hasRestoreSnapshot()).toBe(true);
    expect((await loadPrompts())[0].title).toBe("恢复后");
    expect(JSON.parse(localStorage.getItem(SETTINGS_KEY)!)).toMatchObject({ buttonSize: 125 });

    expect(await undoLastRestore()).toBe(true);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(originalPrompts);
    expect(localStorage.getItem(SETTINGS_KEY)).toBe(originalSettings);
    expect(hasRestoreSnapshot()).toBe(false);
  });

  it("rolls back an interrupted undo and keeps the snapshot retryable", async () => {
    const originalPrompts = JSON.stringify({ version: 2, timestamp: 1, prompts: [prompt] });
    const originalSettings = JSON.stringify({ buttonSize: 100, themeColor: "#00000080", showShortcutHints: true });
    localStorage.setItem(STORAGE_KEY, originalPrompts);
    localStorage.setItem(SETTINGS_KEY, originalSettings);
    await restoreData(
      JSON.stringify({
        version: 2,
        prompts: [{ ...prompt, id: "restored", title: "恢复后" }],
        settings: { buttonSize: 125, themeColor: "#0f766e88", showShortcutHints: false },
      }),
    );
    const restoredPrompts = localStorage.getItem(STORAGE_KEY);
    const restoredSettings = localStorage.getItem(SETTINGS_KEY);

    const originalSetItem = Storage.prototype.setItem;
    let failed = false;
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (
      this: Storage,
      key: string,
      value: string,
    ) {
      if (!failed && key === SETTINGS_KEY && value === originalSettings) {
        failed = true;
        throw new DOMException("quota", "QuotaExceededError");
      }
      return originalSetItem.call(this, key, value);
    });

    expect(await undoLastRestore()).toBe(false);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(restoredPrompts);
    expect(localStorage.getItem(SETTINGS_KEY)).toBe(restoredSettings);
    expect(hasRestoreSnapshot()).toBe(true);
    setItem.mockRestore();
  });

  it("propagates quota failures instead of reporting success", async () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementationOnce(() => {
      throw new DOMException("quota", "QuotaExceededError");
    });
    await expect(savePrompts([prompt])).rejects.toThrow("空间不足");
    setItem.mockRestore();
  });

  it("includes settings in a complete JSON backup", async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 2, timestamp: 1, prompts: [prompt] }));
    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({ buttonSize: 120, themeColor: "#0f766e88", showShortcutHints: false }),
    );
    vi.mocked(save).mockResolvedValue("/tmp/snapbar.json");

    expect(await backupData()).toMatchObject({ ok: true });
    const written = vi.mocked(writeTextFile).mock.calls[0][1] as string;
    expect(JSON.parse(written)).toMatchObject({
      version: 2,
      prompts: [{ title: "示例" }],
      settings: { buttonSize: 120, showShortcutHints: false },
    });
  });

  it("surfaces a malformed stored item without deleting raw data", async () => {
    const raw = JSON.stringify({ version: 2, prompts: [{ title: 42, content: "bad" }] });
    localStorage.setItem(STORAGE_KEY, raw);
    await expect(loadPrompts()).rejects.toThrow("第 1 条");
    expect(localStorage.getItem(STORAGE_KEY)).toBe(raw);
  });

  it("repairs imported ids even when generated suffixes already exist", async () => {
    const now = vi.spyOn(Date, "now").mockReturnValue(100);
    const random = vi.spyOn(Math, "random").mockReturnValue(0.5);
    const baseId = "100-i";
    await savePrompts([
      { ...prompt, id: baseId },
      { ...prompt, id: `${baseId}-import-1`, title: "已有副本" },
    ]);

    expect(await importPromptsTxt("标题: 导入项\n内容:\n导入正文")).toMatchObject({ ok: true });
    const ids = (await loadPrompts()).map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain(`${baseId}-import-2`);
    now.mockRestore();
    random.mockRestore();
  });
});
