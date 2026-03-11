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
}

export interface StorageData {
  version: number;
  timestamp: number;
  prompts?: PromptItem[];
  encrypted: boolean;
  cipher?: string;
  salt?: string;
  iv?: string;
}

export const CATEGORIES = ["通用", "代码", "邮件", "个人"] as const;
export const ALL_CATEGORIES_FILTER = "全部";

const CATEGORY_LABELS: Record<string, string> = {
  All: "全部",
  General: "通用",
  Code: "代码",
  Email: "邮件",
  Personal: "个人",
  "全部": "全部",
  "通用": "通用",
  "代码": "代码",
  "邮件": "邮件",
  "个人": "个人",
};

export function getCategoryLabel(category: string) {
  return CATEGORY_LABELS[category] ?? category;
}

export const DEFAULT_SETTINGS: AppSettings = {
  buttonSize: 100,
  themeColor: "#00000080",
};
