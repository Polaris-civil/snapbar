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
  handleBackup: vi.fn(),
  handleExportTxt: vi.fn(),
  importFromTxtContent: vi.fn(),
  isLoading: false,
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
  unavailableShortcuts: [],
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

    fireEvent.click(await screen.findByText("确认删除"));

    await waitFor(() => {
      expect(libraryState.deletePrompt).toHaveBeenCalledWith("1");
    });
  });
});
