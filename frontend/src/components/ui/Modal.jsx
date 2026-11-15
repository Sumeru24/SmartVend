import { X } from "lucide-react";
import { useEffect } from "react";
import { createPortal } from "react-dom";

const sizes = {
  sm: "max-w-md",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
  full: "max-w-6xl",
};

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  hideClose = false,
  className = "",
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center p-0 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <button
        type="button"
        aria-label="Close dialog"
        className="absolute inset-0 cursor-default bg-ink-950/55 backdrop-blur-[3px] animate-fade-in"
        onClick={onClose}
      />
      <div
        className={`relative z-10 flex max-h-[92vh] w-full flex-col animate-slide-up overflow-hidden rounded-t-[28px] border border-ink-200 bg-white shadow-lift dark:border-white/10 dark:bg-[#121710] sm:rounded-3xl ${sizes[size]} ${className}`}
      >
        {(title || !hideClose) && (
          <div className="flex items-start justify-between gap-4 border-b border-ink-100 px-5 py-4 dark:border-white/[0.07] sm:px-6 sm:py-5">
            <div>
              {title && (
                <h2 className="font-display text-lg font-extrabold tracking-[-0.025em] text-ink-950 dark:text-white">
                  {title}
                </h2>
              )}
              {description && (
                <p className="mt-1 text-sm leading-relaxed text-ink-500 dark:text-ink-400">
                  {description}
                </p>
              )}
            </div>
            {!hideClose && (
              <button
                onClick={onClose}
                className="btn-icon -mr-1 -mt-1 h-8 w-8 shrink-0 border-transparent bg-transparent shadow-none"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
        {footer && (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-ink-100 bg-ink-50/50 px-5 py-4 dark:border-white/[0.07] dark:bg-white/[0.02] sm:px-6">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
