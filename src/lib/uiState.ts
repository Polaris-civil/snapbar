export type PendingAction =
  | "save-prompt"
  | "delete-prompt"
  | "save-settings"
  | "type-text"
  | "backup"
  | "restore"
  | "export-txt"
  | "import-txt"
  | "undo-restore"
  | null;
