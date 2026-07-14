import { beforeEach, describe, expect, it } from "vitest";
import { loadSettings, normalizeSettings, saveSettings, SETTINGS_KEY } from "./settingsStorage";

describe("settings storage", () => {
  beforeEach(() => localStorage.clear());

  it("normalizes legacy values and rejects invalid colors", () => {
    expect(normalizeSettings({ buttonSize: "large", themeColor: "not-a-color", showShortcutHints: false })).toEqual({
      buttonSize: "large",
      themeColor: "#00000080",
      showShortcutHints: false,
    });
  });

  it("does not silently replace malformed JSON", async () => {
    localStorage.setItem(SETTINGS_KEY, "{");
    await expect(loadSettings()).rejects.toThrow("设置数据无法解析");
  });

  it("does not persist invalid settings", async () => {
    await expect(
      saveSettings({ buttonSize: 100, themeColor: "invalid", showShortcutHints: true }),
    ).rejects.toThrow("主题颜色");
    expect(localStorage.getItem(SETTINGS_KEY)).toBeNull();
  });
});
