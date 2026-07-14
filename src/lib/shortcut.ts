import type { PromptItem } from "./promptTypes";

export interface ShortcutBinding {
  shortcut: string;
  text: string;
}

export interface ShortcutAnalysis {
  bindings: ShortcutBinding[];
  unavailable: string[];
}

const MODIFIER_ALIASES: Record<string, string> = {
  ALT: "Alt",
  OPTION: "Alt",
  CTRL: "Ctrl",
  CONTROL: "Ctrl",
  SHIFT: "Shift",
  CMD: "Command",
  COMMAND: "Command",
  META: "Command",
  SUPER: "Command",
  CMDORCTRL: "CmdOrCtrl",
  CMDORCONTROL: "CmdOrCtrl",
  COMMANDORCTRL: "CmdOrCtrl",
  COMMANDORCONTROL: "CmdOrCtrl",
};

const SAFE_MODIFIERS = new Set(["Alt", "Ctrl", "Command", "CmdOrCtrl"]);

export function canonicalizeShortcut(shortcut?: string) {
  if (!shortcut) return "";
  return shortcut
    .split("+")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => MODIFIER_ALIASES[part.toUpperCase()] ?? part)
    .join("+");
}

export function validateShortcut(shortcut?: string): string | null {
  const normalized = canonicalizeShortcut(shortcut);
  if (!normalized) return null;

  const parts = normalized.split("+");
  const modifiers = parts.filter((part) => Object.values(MODIFIER_ALIASES).includes(part));
  const mainKeys = parts.filter((part) => !Object.values(MODIFIER_ALIASES).includes(part));
  if (
    mainKeys.length !== 1 ||
    new Set(modifiers).size !== modifiers.length ||
    !modifiers.some((part) => SAFE_MODIFIERS.has(part))
  ) {
    return "快捷键必须包含 Ctrl、Alt、Command 或 CmdOrCtrl，并且只能包含一个主按键。";
  }
  return null;
}

export function analyzeShortcuts(prompts: PromptItem[]): ShortcutAnalysis {
  const shortcutCounts = new Map<string, number>();
  for (const prompt of prompts) {
    const shortcut = canonicalizeShortcut(prompt.shortcut);
    if (shortcut && !validateShortcut(shortcut)) {
      const key = shortcut.toLowerCase();
      shortcutCounts.set(key, (shortcutCounts.get(key) ?? 0) + 1);
    }
  }

  const bindings: ShortcutBinding[] = [];
  const unavailable = new Set<string>();
  for (const prompt of prompts) {
    const shortcut = canonicalizeShortcut(prompt.shortcut);
    if (!shortcut) continue;

    if (validateShortcut(shortcut) || (shortcutCounts.get(shortcut.toLowerCase()) ?? 0) > 1) {
      unavailable.add(shortcut);
      continue;
    }
    bindings.push({ shortcut, text: prompt.content });
  }

  return { bindings, unavailable: [...unavailable] };
}
