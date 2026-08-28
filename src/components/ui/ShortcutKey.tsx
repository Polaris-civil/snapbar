import { AlertTriangle } from "lucide-react";
import { formatShortcutForPlatform } from "../../lib/platform";

interface ShortcutKeyProps {
  shortcut?: string;
  unavailable?: boolean;
}

export default function ShortcutKey({ shortcut, unavailable = false }: ShortcutKeyProps) {
  const displayShortcut = formatShortcutForPlatform(shortcut);
  if (!displayShortcut) return null;

  return (
    <kbd
      className={`shortcut-key ${unavailable ? "shortcut-key-unavailable" : ""}`}
      title={unavailable ? "快捷键当前不可用" : undefined}
    >
      {unavailable && <AlertTriangle size={12} aria-hidden="true" />}
      {displayShortcut}
    </kbd>
  );
}
