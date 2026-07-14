import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MainPanel from "./MainPanel";

const libraryState = {
  activeCategory: "全部",
  canUndoRestore: false,
  categories: ["全部", "通用", "代码"],
  deletePrompt: vi.fn(),
  error: null as string | null,
  filteredPrompts: [
    { id: "1", title: "欢迎语", content: "Hello World", category: "通用", shortcut: "Ctrl+1", createdAt: 1, updatedAt: 2 },
    { id: "2", title: "查询 SQL", content: "SELECT * FROM prompts;", category: "代码", createdAt: 3, updatedAt: 4 },
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
    showShortcutHints: true,
  },
  statusMessage: null as string | null,
  storageUsage: "10 KB",
  unavailableShortcuts: [],
  typePromptText: vi.fn().mockResolvedValue(true),
  undoRestore: vi.fn().mockResolvedValue(true),
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
      { id: "1", title: "欢迎语", content: "Hello World", category: "通用", shortcut: "Ctrl+1", createdAt: 1, updatedAt: 2 },
      { id: "2", title: "查询 SQL", content: "SELECT * FROM prompts;", category: "代码", createdAt: 3, updatedAt: 4 },
    ];
    libraryState.error = null;
    libraryState.canUndoRestore = false;
    libraryState.statusMessage = null;
    libraryState.saveDraft = vi.fn().mockResolvedValue(true);
    libraryState.deletePrompt = vi.fn().mockResolvedValue(true);
    libraryState.persistSettings = vi.fn().mockResolvedValue(true);
    libraryState.typePromptText = vi.fn().mockResolvedValue(true);
    libraryState.restoreFromFileContent = vi.fn().mockResolvedValue(true);
    libraryState.undoRestore = vi.fn().mockResolvedValue(true);
  });

  it("renders prompt list correctly", async () => {
    render(<MainPanel />);

    await waitFor(() => {
      expect(screen.getByText("欢迎语")).toBeInTheDocument();
      expect(screen.getByTitle("Hello World")).toBeInTheDocument();
    });
  });

  it("delegates prompt input and reports through the library hook", async () => {
    render(<MainPanel />);
    await waitFor(() => screen.getByText("欢迎语"));

    fireEvent.click(screen.getByText("欢迎语"));

    expect(libraryState.typePromptText).toHaveBeenCalledWith("Hello World");
  });

  it("opens the delete dialog and confirms deletion", async () => {
    render(<MainPanel />);
    await waitFor(() => screen.getByText("欢迎语"));

    fireEvent.click(screen.getAllByRole("button").find((button) => button.querySelector("svg.lucide-trash2"))!);

    fireEvent.click(await screen.findByText("确认删除"));

    await waitFor(() => {
      expect(libraryState.deletePrompt).toHaveBeenCalledWith("1");
    });
  });

  it("discards settings draft changes when the modal is cancelled", async () => {
    render(<MainPanel />);
    fireEvent.click(screen.getByTitle("设置"));
    fireEvent.click(await screen.findByTitle("青绿色"));
    fireEvent.click(screen.getByText("取消"));

    fireEvent.click(screen.getByTitle("设置"));
    expect(await screen.findByDisplayValue("#00000080")).toBeInTheDocument();
    expect(libraryState.persistSettings).not.toHaveBeenCalled();
  });

  it("drops stale settings drafts after restoring a backup", async () => {
    render(<MainPanel />);
    fireEvent.click(screen.getByTitle("设置"));
    fireEvent.click(await screen.findByTitle("青绿色"));

    const restoreInput = document.querySelector<HTMLInputElement>('input[type="file"][accept*="json"]')!;
    const file = { text: vi.fn().mockResolvedValue('{"version":2,"prompts":[]}') };
    fireEvent.change(restoreInput, { target: { files: [file] } });

    await waitFor(() => expect(libraryState.restoreFromFileContent).toHaveBeenCalled());
    expect(await screen.findByDisplayValue("#00000080")).toBeInTheDocument();
  });

  it("drops stale settings drafts after undoing a restore", async () => {
    libraryState.canUndoRestore = true;
    render(<MainPanel />);
    fireEvent.click(screen.getByTitle("设置"));
    fireEvent.click(await screen.findByTitle("青绿色"));
    fireEvent.click(screen.getByText("撤销上次恢复"));

    await waitFor(() => expect(libraryState.undoRestore).toHaveBeenCalled());
    expect(await screen.findByDisplayValue("#00000080")).toBeInTheDocument();
  });
});
