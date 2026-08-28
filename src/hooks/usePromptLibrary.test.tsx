import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePromptLibrary } from "./usePromptLibrary";

describe("usePromptLibrary persistence", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.mocked(invoke).mockResolvedValue({ registered: [], failed: [] });
    vi.mocked(listen).mockResolvedValue(vi.fn());
  });

  it("does not update in-memory prompts when localStorage rejects a save", async () => {
    const { result } = renderHook(() => usePromptLibrary());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementationOnce(() => {
      throw new DOMException("quota", "QuotaExceededError");
    });

    let saved = true;
    await act(async () => {
      saved = await result.current.saveDraft({ title: "不会保存", content: "正文", category: "通用" }, null);
    });

    expect(saved).toBe(false);
    expect(result.current.prompts).toEqual([]);
    expect(result.current.error).toContain("空间不足");
    expect(result.current.pendingAction).toBeNull();
    setItem.mockRestore();
  });

  it("shows native errors raised by global shortcut input", async () => {
    const { result } = renderHook(() => usePromptLibrary());
    await waitFor(() => expect(listen).toHaveBeenCalledWith("input-error", expect.any(Function)));
    const handler = vi.mocked(listen).mock.calls.find(([event]) => event === "input-error")?.[1];

    act(() => {
      handler?.({ payload: "缺少辅助功能权限" } as never);
    });

    expect(result.current.error).toBe("缺少辅助功能权限");
  });
});
