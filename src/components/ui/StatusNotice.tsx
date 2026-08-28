import { AlertCircle, CheckCircle2, LoaderCircle, X } from "lucide-react";
import IconButton from "./IconButton";

interface StatusNoticeProps {
  kind: "idle" | "loading" | "success" | "error";
  message?: string | null;
  onDismiss?: () => void;
}

export default function StatusNotice({ kind, message, onDismiss }: StatusNoticeProps) {
  if (!message) return <div className="status-notice status-notice-idle" aria-hidden="true" />;

  const Icon = kind === "error" ? AlertCircle : kind === "loading" ? LoaderCircle : CheckCircle2;
  return (
    <div
      className={`status-notice status-notice-${kind}`}
      role={kind === "error" ? "alert" : "status"}
      aria-live={kind === "error" ? "assertive" : "polite"}
    >
      <Icon size={14} className={kind === "loading" ? "status-spinner" : ""} aria-hidden="true" />
      <span>{message}</span>
      {onDismiss && kind !== "loading" && (
        <IconButton icon={<X size={13} aria-hidden="true" />} label="关闭提示" className="status-dismiss" onClick={onDismiss} />
      )}
    </div>
  );
}
