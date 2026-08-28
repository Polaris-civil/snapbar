import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Dialog from "./Dialog";

describe("Dialog", () => {
  it("exposes modal semantics and closes with Escape", () => {
    const onClose = vi.fn();
    render(
      <Dialog open onClose={onClose} title="编辑提示词">
        <button type="button">正文操作</button>
      </Dialog>,
    );

    const dialog = screen.getByRole("dialog", { name: "编辑提示词" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not close while an operation is pending", () => {
    const onClose = vi.fn();
    render(
      <Dialog open onClose={onClose} title="设置" closeDisabled>
        <span>正在保存</span>
      </Dialog>,
    );

    fireEvent.keyDown(screen.getByRole("dialog", { name: "设置" }), { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "关闭" })).toBeDisabled();
  });
});
