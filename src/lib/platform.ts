import { canonicalizeShortcut } from "./shortcut";

export type DesktopPlatform = "macos" | "windows" | "other";

interface NavigatorLike {
  platform?: string;
  userAgent?: string;
  userAgentData?: { platform?: string };
}

export function detectDesktopPlatform(navigatorLike: NavigatorLike = navigator): DesktopPlatform {
  const platform = `${navigatorLike.userAgentData?.platform ?? ""} ${navigatorLike.platform ?? ""} ${
    navigatorLike.userAgent ?? ""
  }`;
  if (/mac/i.test(platform)) return "macos";
  if (/win/i.test(platform)) return "windows";
  return "other";
}

const MAC_KEYS: Record<string, string> = {
  Alt: "⌥",
  Command: "⌘",
  CmdOrCtrl: "⌘",
  Ctrl: "⌃",
  Shift: "⇧",
  Enter: "↩",
  Escape: "⎋",
  Backspace: "⌫",
  Delete: "⌦",
  Up: "↑",
  Down: "↓",
  Left: "←",
  Right: "→",
};

export function formatShortcutForPlatform(
  shortcut?: string,
  platform: DesktopPlatform = detectDesktopPlatform(),
) {
  const normalized = canonicalizeShortcut(shortcut);
  if (!normalized) return "";
  const parts = normalized.split("+");
  if (platform === "macos") return parts.map((part) => MAC_KEYS[part] ?? part).join("");
  return parts.map((part) => (part === "Command" ? "Win" : part === "CmdOrCtrl" ? "Ctrl" : part)).join("+");
}

export function shortcutExample(platform: DesktopPlatform = detectDesktopPlatform()) {
  return platform === "macos" ? "⌘⇧A" : "Ctrl+Shift+A";
}
