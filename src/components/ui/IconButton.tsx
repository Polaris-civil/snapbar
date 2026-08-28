import { createPortal } from "react-dom";
import { useId, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from "react";

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  icon: ReactNode;
  label: string;
  tone?: "default" | "danger";
}

interface TooltipPosition {
  left: number;
  top: number;
  above: boolean;
}

export default function IconButton({
  icon,
  label,
  tone = "default",
  className = "",
  onMouseEnter,
  onMouseLeave,
  onFocus,
  onBlur,
  ...props
}: IconButtonProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const tooltipId = useId();
  const [tooltipPosition, setTooltipPosition] = useState<TooltipPosition | null>(null);

  const showTooltip = () => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const above = rect.bottom + 34 > window.innerHeight;
    const estimatedWidth = Math.min(180, Math.max(56, Array.from(label).length * 11 + 14));
    const halfWidth = estimatedWidth / 2;
    setTooltipPosition({
      left: Math.min(window.innerWidth - halfWidth - 8, Math.max(halfWidth + 8, rect.left + rect.width / 2)),
      top: above ? rect.top - 6 : rect.bottom + 6,
      above,
    });
  };

  const hideTooltip = () => setTooltipPosition(null);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label={label}
        aria-describedby={tooltipPosition ? tooltipId : undefined}
        className={`icon-button ${tone === "danger" ? "icon-button-danger" : ""} ${className}`.trim()}
        onMouseEnter={(event) => {
          showTooltip();
          onMouseEnter?.(event);
        }}
        onMouseLeave={(event) => {
          hideTooltip();
          onMouseLeave?.(event);
        }}
        onFocus={(event) => {
          showTooltip();
          onFocus?.(event);
        }}
        onBlur={(event) => {
          hideTooltip();
          onBlur?.(event);
        }}
        {...props}
      >
        {icon}
      </button>
      {tooltipPosition &&
        createPortal(
          <span
            id={tooltipId}
            role="tooltip"
            className={`ui-tooltip ${tooltipPosition.above ? "ui-tooltip-above" : ""}`}
            style={{ left: tooltipPosition.left, top: tooltipPosition.top }}
          >
            {label}
          </span>,
          document.body,
        )}
    </>
  );
}
