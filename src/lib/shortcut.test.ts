import { describe, expect, it } from "vitest";
import { analyzeShortcuts, canonicalizeShortcut, validateShortcut } from "./shortcut";
import type { PromptItem } from "./promptTypes";

function prompt(id: string, shortcut?: string): PromptItem {
  return { id, title: id, content: `content-${id}`, category: "通用", shortcut, createdAt: 1, updatedAt: 1 };
}

describe("shortcut safety", () => {
  it("normalizes legacy Meta shortcuts for macOS", () => {
    expect(canonicalizeShortcut("Meta+Shift+k")).toBe("Command+Shift+k");
    expect(canonicalizeShortcut("Control+K")).toBe("Ctrl+K");
  });

  it("rejects global shortcuts that can hijack normal typing", () => {
    expect(validateShortcut("A")).not.toBeNull();
    expect(validateShortcut("Shift+A")).not.toBeNull();
    expect(validateShortcut("Delete")).not.toBeNull();
    expect(validateShortcut("Ctrl+Control+A")).not.toBeNull();
    expect(validateShortcut("Ctrl+Shift+A")).toBeNull();
    expect(validateShortcut("Command+K")).toBeNull();
  });

  it("does not register either side of a duplicate shortcut", () => {
    const analysis = analyzeShortcuts([prompt("one", "Ctrl+K"), prompt("two", "ctrl+k")]);
    expect(analysis.bindings).toEqual([]);
    expect(analysis.unavailable).toEqual(["Ctrl+K", "Ctrl+k"]);
  });
});
