export interface PromptItem {
  id: string;
  title: string;
  content: string;
  category: string;
  shortcut?: string;
  createdAt: number;
  updatedAt: number;
}

export interface PromptDraft {
  title: string;
  content: string;
  category: string;
  shortcut?: string;
}

export interface AppSettings {
  buttonSize: "small" | "medium" | "large" | number;
  themeColor: string;
  showShortcutHints: boolean;
}

export interface StorageData {
  version: number;
  timestamp: number;
  prompts: PromptItem[];
}

export const DEFAULT_CATEGORY = "通用";
export const CATEGORIES = ["\u901a\u7528", "\u4ee3\u7801", "\u90ae\u4ef6", "\u4e2a\u4eba"] as const;
export const ALL_CATEGORIES_FILTER = "\u5168\u90e8";

const CATEGORY_LABELS: Record<string, string> = {
  All: "\u5168\u90e8",
  General: "\u901a\u7528",
  Code: "\u4ee3\u7801",
  Email: "\u90ae\u4ef6",
  Personal: "\u4e2a\u4eba",
  "\u5168\u90e8": "\u5168\u90e8",
  "\u901a\u7528": "\u901a\u7528",
  "\u4ee3\u7801": "\u4ee3\u7801",
  "\u90ae\u4ef6": "\u90ae\u4ef6",
  "\u4e2a\u4eba": "\u4e2a\u4eba",
};

export function getCategoryLabel(category: string) {
  return CATEGORY_LABELS[category] ?? category;
}

export const DEFAULT_SETTINGS: AppSettings = {
  buttonSize: 100,
  themeColor: "#00000080",
  showShortcutHints: true,
};
