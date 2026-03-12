import type { PromptItem } from "./promptTypes";

const BLOCK_SEPARATOR = /\n\s*---+\s*\n/g;

function createPrompt(
  title: string,
  content: string,
  category = "通用",
  shortcut?: string,
): PromptItem | null {
  const normalizedTitle = title.trim();
  const normalizedContent = content.trim();
  if (!normalizedTitle || !normalizedContent) return null;

  const now = Date.now();
  return {
    id: `${now}-${Math.random().toString(36).slice(2, 8)}`,
    title: normalizedTitle,
    content: normalizedContent,
    category: category.trim() || "通用",
    shortcut: shortcut?.trim() || undefined,
    createdAt: now,
    updatedAt: now,
  };
}

function parseStructuredBlocks(text: string): PromptItem[] {
  const blocks = text
    .replace(/\r\n/g, "\n")
    .trim()
    .split(BLOCK_SEPARATOR)
    .map((block) => block.trim())
    .filter(Boolean);

  return blocks
    .map((block) => {
      const lines = block.split("\n");
      let title = "";
      let category = "通用";
      let shortcut = "";
      let content = "";
      let readingContent = false;

      for (const rawLine of lines) {
        const line = rawLine.trimEnd();
        if (!line.trim()) {
          if (readingContent) {
            content += `${content ? "\n" : ""}`;
          }
          continue;
        }

        const match = line.match(/^(标题|title|name|分类|category|快捷键|shortcut|内容|content)\s*[:：]\s*(.*)$/i);
        if (match) {
          const [, rawKey, rawValue] = match;
          const key = rawKey.toLowerCase();
          const value = rawValue ?? "";

          if (key === "标题" || key === "title" || key === "name") {
            title = value.trim();
            readingContent = false;
            continue;
          }

          if (key === "分类" || key === "category") {
            category = value.trim() || "通用";
            readingContent = false;
            continue;
          }

          if (key === "快捷键" || key === "shortcut") {
            shortcut = value.trim();
            readingContent = false;
            continue;
          }

          if (key === "内容" || key === "content") {
            content = value;
            readingContent = true;
            continue;
          }
        }

        if (readingContent) {
          content += `${content ? "\n" : ""}${line}`;
        }
      }

      return createPrompt(title, content, category, shortcut);
    })
    .filter((item): item is PromptItem => Boolean(item));
}

function parseLegacyBraceFormat(text: string): PromptItem[] {
  const items: PromptItem[] = [];
  const regex = /\{\s*(?:name|title)\s*[:：]\s*(.*?)\s*[,，]\s*(?:content|内容)\s*[:：]\s*([\s\S]*?)\s*\}(?=\s*\{|$)/gi;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const item = createPrompt(match[1], match[2]);
    if (item) items.push(item);
  }

  return items;
}

export function parseTxtPrompts(text: string): PromptItem[] {
  const normalized = text.trim();
  if (!normalized) return [];

  const structured = parseStructuredBlocks(normalized);
  if (structured.length > 0) return structured;

  return parseLegacyBraceFormat(normalized);
}

export function exportPromptsToTxtContent(prompts: PromptItem[]) {
  return prompts
    .map((prompt) =>
      [
        `标题: ${prompt.title}`,
        `分类: ${prompt.category || "通用"}`,
        `快捷键: ${prompt.shortcut ?? ""}`,
        "内容:",
        prompt.content,
      ].join("\n"),
    )
    .join("\n\n---\n\n");
}
