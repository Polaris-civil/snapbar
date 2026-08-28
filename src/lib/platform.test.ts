import { describe, expect, it } from "vitest";
import { detectDesktopPlatform, formatShortcutForPlatform, shortcutExample } from "./platform";

describe("platform UI formatting", () => {
  it("detects desktop platforms from navigator metadata", () => {
    expect(detectDesktopPlatform({ platform: "MacIntel" })).toBe("macos");
    expect(detectDesktopPlatform({ userAgentData: { platform: "Windows" } })).toBe("windows");
    expect(detectDesktopPlatform({ platform: "Linux x86_64" })).toBe("other");
  });

  it("formats shortcuts with native platform semantics", () => {
    expect(formatShortcutForPlatform("CmdOrCtrl+Shift+A", "macos")).toBe("⌘⇧A");
    expect(formatShortcutForPlatform("Command+Alt+K", "windows")).toBe("Win+Alt+K");
    expect(formatShortcutForPlatform("CmdOrCtrl+Shift+A", "windows")).toBe("Ctrl+Shift+A");
    expect(shortcutExample("macos")).toBe("⌘⇧A");
  });
});
