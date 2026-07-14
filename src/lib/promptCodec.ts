import type { PromptItem } from "./promptTypes";
import { canonicalizeShortcut } from "./shortcut";

const BLOCK_SEPARATOR = /\n\s*---+\s*\n/g;
const FORMAT_HEADER_V2 = "格式: SnapBar-TXT-v2";
const FORMAT_HEADER = "格式: SnapBar-TXT-v3";

function createPrompt(
  title: string,
  content: string,
  category = "通用",
  shortcut?: string,
  preserveContentWhitespace = false,
): PromptItem | null {
  const normalizedTitle = title.trim();
  if (!normalizedTitle || !content.trim()) return null;
  const normalizedContent = preserveContentWhitespace ? content : content.trim();

  const now = Date.now();
  return {
    id: `${now}-${Math.random().toString(36).slice(2, 8)}`,
    title: normalizedTitle,
    content: normalizedContent,
    category: category.trim() || "通用",
    shortcut: canonicalizeShortcut(shortcut) || undefined,
    createdAt: now,
    updatedAt: now,
  };
}

function parseStructuredBlocks(text: string): PromptItem[] {
  const normalizedText = text.replace(/\r\n/g, "\n");
  const isVersionThree = normalizedText.includes(FORMAT_HEADER);
  const blocks = (isVersionThree
    ? normalizedText.split("\n---\n")
    : normalizedText.trim().split(BLOCK_SEPARATOR).map((block) => block.trim())
  ).filter((block) => block.trim());

  return blocks
    .map((block) => {
      const lines = block.split("\n");
      const isEscapedFormat = lines.some(
        (line) => line.trim() === FORMAT_HEADER_V2 || line.trim() === FORMAT_HEADER,
      );
      const preserveContentWhitespace = lines.some((line) => line.trim() === FORMAT_HEADER);
      let title = "";
      let category = "通用";
      let shortcut = "";
      const contentLines: string[] = [];
      let readingContent = false;

      for (const rawLine of lines) {
        const line = rawLine.trimEnd();
        if (line.trim() === FORMAT_HEADER_V2 || line.trim() === FORMAT_HEADER) continue;
        if (readingContent) {
          const contentLine = isEscapedFormat && rawLine.startsWith("\\") ? rawLine.slice(1) : rawLine;
          contentLines.push(contentLine);
          continue;
        }
        if (!line.trim()) {
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
            if (value) contentLines.push(value);
            readingContent = true;
            continue;
          }
        }

      }

      return createPrompt(
        title,
        contentLines.join("\n"),
        category,
        shortcut,
        preserveContentWhitespace,
      );
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
    .map((prompt) => {
      const escapedContent = prompt.content
        .split("\n")
        .map((line) => (line.startsWith("\\") || /^\s*---+\s*$/.test(line) ? `\\${line}` : line))
        .join("\n");
      return [
        FORMAT_HEADER,
        `标题: ${prompt.title}`,
        `分类: ${prompt.category || "通用"}`,
        `快捷键: ${canonicalizeShortcut(prompt.shortcut)}`,
        "内容:",
        escapedContent,
      ].join("\n");
    })
    .join("\n---\n");
}
