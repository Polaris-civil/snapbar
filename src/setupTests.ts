import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock Tauri APIs
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({
    hide: vi.fn(),
    show: vi.fn(),
    setAlwaysOnTop: vi.fn(),
    minimize: vi.fn(),
    startDragging: vi.fn(),
  }),
}));

vi.mock('@tauri-apps/plugin-fs', () => ({
    readTextFile: vi.fn(),
    writeTextFile: vi.fn(),
    exists: vi.fn().mockResolvedValue(true),
    BaseDirectory: { AppConfig: 'AppConfig' },
}));

vi.mock('@tauri-apps/plugin-process', () => ({
  exit: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-dialog', () => ({
  save: vi.fn(),
  confirm: vi.fn().mockResolvedValue(true),
}));
