import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import {
  applyUiThemeMode,
  isUiThemeMode,
  loadUiThemeMode,
  saveUiThemeMode,
  UI_THEME_KEY,
  type UiThemeMode,
} from "../lib/uiPreferences";

export function useUiTheme() {
  const [themeMode, setThemeMode] = useState<UiThemeMode>(() => loadUiThemeMode());

  useLayoutEffect(() => {
    applyUiThemeMode(themeMode);
  }, [themeMode]);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== UI_THEME_KEY) return;
      setThemeMode(isUiThemeMode(event.newValue) ? event.newValue : "system");
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const persistThemeMode = useCallback(async (nextMode: UiThemeMode) => {
    saveUiThemeMode(nextMode);
    setThemeMode(nextMode);
  }, []);

  return { persistThemeMode, themeMode };
}
