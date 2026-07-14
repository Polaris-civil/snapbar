import { describe, expect, it } from "vitest";
import { exportPromptsToTxtContent, parseTxtPrompts } from "./promptCodec";
import type { PromptItem } from "./promptTypes";

describe("prompt TXT codec", () => {
  it("round-trips separators, backslashes and metadata-looking content", () => {
    const prompts: PromptItem[] = [
      {
        id: "1",
        title: "复杂内容",
        category: "代码",
        shortcut: "Meta+K",
        content: "  title: 这不是标题\n---\n\\server\\path\n内容: 仍然属于正文  \n",
        createdAt: 1,
        updatedAt: 2,
      },
      {
        id: "2",
        title: "第二条",
        category: "通用",
        content: "plain text",
        createdAt: 3,
        updatedAt: 4,
      },
    ];

    const parsed = parseTxtPrompts(exportPromptsToTxtContent(prompts));
    expect(parsed.map(({ title, category, shortcut, content }) => ({ title, category, shortcut, content }))).toEqual([
      { title: "复杂内容", category: "代码", shortcut: "Command+K", content: prompts[0].content },
      { title: "第二条", category: "通用", shortcut: undefined, content: "plain text" },
    ]);
  });

  it("keeps compatibility with legacy brace imports", () => {
    expect(parseTxtPrompts("{name:示例, content:旧格式正文}")[0]).toMatchObject({
      title: "示例",
      content: "旧格式正文",
      category: "通用",
    });
  });

  it("keeps compatibility with version 2 structured exports", () => {
    const text = [
      "格式: SnapBar-TXT-v2",
      "标题: 旧版导出",
      "分类: 通用",
      "快捷键:",
      "内容:",
      "\\---",
      "\\\\server\\path",
    ].join("\n");

    expect(parseTxtPrompts(text)[0]).toMatchObject({
      title: "旧版导出",
      content: "---\n\\server\\path",
    });
  });
});
