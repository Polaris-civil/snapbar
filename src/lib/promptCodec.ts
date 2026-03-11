import type { PromptItem } from "./promptTypes";

export function parseTxtPrompts(text: string): PromptItem[] {
  const items: PromptItem[] = [];
  const regex = /\{name[：:?\-]?\s*(.*?)\s*[,，;；]?\s*content[：:?\-]?\s*([\s\S]*?)\}(?=\s*\{|$)/gi;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const now = Date.now();
    const title = match[1].trim();
    const content = match[2].trim();

    if (title && content) {
      items.push({
        id: `${now}-${Math.random().toString(36).slice(2, 7)}`,
        title,
        content,
        category: "General",
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  return items;
}

export function exportPromptsToTxtContent(prompts: PromptItem[]) {
  return prompts
    .map((prompt) => `{name:${prompt.title}, content:${prompt.content}}`)
    .join("\n\n");
}
