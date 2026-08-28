export type UiThemeMode = "system" | "light" | "dark";

export const UI_THEME_KEY = "snapbar_ui_theme";

export function isUiThemeMode(value: unknown): value is UiThemeMode {
  return value === "system" || value === "light" || value === "dark";
}

export function loadUiThemeMode(): UiThemeMode {
  const stored = localStorage.getItem(UI_THEME_KEY);
  return isUiThemeMode(stored) ? stored : "system";
}

export function saveUiThemeMode(mode: UiThemeMode) {
  if (mode === "system") localStorage.removeItem(UI_THEME_KEY);
  else localStorage.setItem(UI_THEME_KEY, mode);
}

export function applyUiThemeMode(mode: UiThemeMode) {
  const root = document.documentElement;
  if (mode === "system") {
    delete root.dataset.theme;
    root.style.colorScheme = "light dark";
  } else {
    root.dataset.theme = mode;
    root.style.colorScheme = mode;
  }
}
