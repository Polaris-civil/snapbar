import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { invoke } from "@tauri-apps/api/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MainPanel from "./MainPanel";

const libraryState = {
  activeCategory: "全部",
  categories: ["全部", "通用", "代码"],
  deletePrompt: vi.fn(),
  error: null as string | null,
  filteredPrompts: [
    { id: "1", title: "测试提示词", content: "Hello World", category: "通用", shortcut: "Ctrl+1", createdAt: 1, updatedAt: 2 },
    { id: "2", title: "部署 SQL", content: "SELECT * FROM prompts;", category: "代码", createdAt: 3, updatedAt: 4 },
  ],
  importFromTxtContent: vi.fn(),
  isLoading: false,
  isLocked: false,
  persistSettings: vi.fn(),
  prompts: [],
  restoreFromFileContent: vi.fn(),
  saveDraft: vi.fn().mockResolvedValue(true),
  setActiveCategory: vi.fn(),
  setError: vi.fn(),
  setSettings: vi.fn(),
  setStatusMessage: vi.fn(),
  settings: {
    buttonSize: 100,
    themeColor: "#00000080",
  },
  statusMessage: null as string | null,
  storageUsage: "10 KB",
  unlock: vi.fn(),
  unlockPassword: "",
  setUnlockPassword: vi.fn(),
};

vi.mock("../hooks/usePromptLibrary", () => ({
  usePromptLibrary: () => libraryState,
}));

describe("MainPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    libraryState.activeCategory = "全部";
    libraryState.categories = ["全部", "通用", "代码"];
    libraryState.filteredPrompts = [
      { id: "1", title: "测试提示词", content: "Hello World", category: "通用", shortcut: "Ctrl+1", createdAt: 1, updatedAt: 2 },
      { id: "2", title: "部署 SQL", content: "SELECT * FROM prompts;", category: "代码", createdAt: 3, updatedAt: 4 },
    ];
    libraryState.error = null;
    libraryState.statusMessage = null;
    libraryState.saveDraft = vi.fn().mockResolvedValue(true);
    libraryState.deletePrompt = vi.fn();
  });

  it("renders prompt list correctly", async () => {
    render(<MainPanel />);

    await waitFor(() => {
      expect(screen.getByText("测试提示词")).toBeInTheDocument();
      expect(screen.getByTitle("Hello World")).toBeInTheDocument();
    });
  });

  it("opens add modal when clicking add button", async () => {
    render(<MainPanel />);

    fireEvent.click(screen.getByTitle("新增"));

    await waitFor(() => {
      expect(screen.getByText("新建提示词")).toBeInTheDocument();
    });
    expect(screen.getByLabelText("标题")).toBeInTheDocument();
    expect(screen.getByLabelText("内容")).toBeInTheDocument();
  });

  it("calls invoke type_text on item click", async () => {
    render(<MainPanel />);
    await waitFor(() => screen.getByText("测试提示词"));

    fireEvent.click(screen.getByText("测试提示词"));

    expect(invoke).toHaveBeenCalledWith("type_text", { text: "Hello World" });
  });

  it("opens the delete dialog and confirms deletion", async () => {
    render(<MainPanel />);
    await waitFor(() => screen.getByText("测试提示词"));

    fireEvent.click(screen.getAllByRole("button").find((button) => button.querySelector("svg.lucide-trash2"))!);

    await waitFor(() => {
      expect(screen.getByText("删除这条提示词？")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("确认删除"));

    await waitFor(() => {
      expect(libraryState.deletePrompt).toHaveBeenCalledWith("1");
    });
  });
});
