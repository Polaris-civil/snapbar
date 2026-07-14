import { DEFAULT_SETTINGS, type AppSettings } from "./promptTypes";

export const SETTINGS_KEY = "app_settings";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isValidThemeColor(value: string) {
  return /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(value);
}

export function normalizeSettings(value: unknown): AppSettings {
  if (!isRecord(value)) return { ...DEFAULT_SETTINGS };

  const rawSize = value.buttonSize;
  const buttonSize =
    typeof rawSize === "number" && Number.isFinite(rawSize)
      ? Math.min(150, Math.max(50, rawSize))
      : rawSize === "small" || rawSize === "medium" || rawSize === "large"
        ? rawSize
        : DEFAULT_SETTINGS.buttonSize;
  const themeColor =
    typeof value.themeColor === "string" && isValidThemeColor(value.themeColor)
      ? value.themeColor
      : DEFAULT_SETTINGS.themeColor;
  const showShortcutHints =
    typeof value.showShortcutHints === "boolean"
      ? value.showShortcutHints
      : DEFAULT_SETTINGS.showShortcutHints;

  return { buttonSize, themeColor, showShortcutHints };
}

export function validateSettings(settings: AppSettings): string | null {
  if (
    typeof settings.buttonSize === "number" &&
    (!Number.isFinite(settings.buttonSize) || settings.buttonSize < 50 || settings.buttonSize > 150)
  ) {
    return "按钮大小必须在 50% 到 150% 之间。";
  }
  if (
    typeof settings.buttonSize === "string" &&
    !["small", "medium", "large"].includes(settings.buttonSize)
  ) {
    return "按钮大小设置无效。";
  }
  if (!isValidThemeColor(settings.themeColor)) {
    return "主题颜色必须是有效的 Hex 颜色，例如 #0f172a88。";
  }
  if (typeof settings.showShortcutHints !== "boolean") {
    return "快捷键提示设置无效。";
  }
  return null;
}

export async function loadSettings(): Promise<AppSettings> {
  const raw = localStorage.getItem(SETTINGS_KEY);
  if (!raw) return { ...DEFAULT_SETTINGS };

  try {
    return normalizeSettings(JSON.parse(raw));
  } catch (error) {
    throw new Error(`设置数据无法解析：${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function saveSettings(settings: AppSettings) {
  const validationError = validateSettings(settings);
  if (validationError) throw new Error(validationError);
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}
