import { beforeEach, describe, expect, it } from "vitest";
import {
  applyUiThemeMode,
  loadUiThemeMode,
  saveUiThemeMode,
  UI_THEME_KEY,
} from "./uiPreferences";

describe("UI theme preferences", () => {
  beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset.theme;
    document.documentElement.style.colorScheme = "";
  });

  it("defaults invalid or missing preferences to the system theme", () => {
    expect(loadUiThemeMode()).toBe("system");
    localStorage.setItem(UI_THEME_KEY, "sepia");
    expect(loadUiThemeMode()).toBe("system");
  });

  it("stores explicit modes without changing existing app settings", () => {
    localStorage.setItem("app_settings", "unchanged");
    saveUiThemeMode("dark");
    expect(localStorage.getItem(UI_THEME_KEY)).toBe("dark");
    expect(localStorage.getItem("app_settings")).toBe("unchanged");
    saveUiThemeMode("system");
    expect(localStorage.getItem(UI_THEME_KEY)).toBeNull();
  });

  it("applies explicit and system modes to the document root", () => {
    applyUiThemeMode("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(document.documentElement.style.colorScheme).toBe("dark");
    applyUiThemeMode("system");
    expect(document.documentElement.dataset.theme).toBeUndefined();
    expect(document.documentElement.style.colorScheme).toBe("light dark");
  });
});
