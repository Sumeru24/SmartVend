import { AlertTriangle } from "lucide-react";
import { Modal } from "./Modal";
import { Spinner } from "./Spinner";

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title = "Are you sure?",
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "danger",
  loading = false,
}) {
  return (
    <Modal
      open={open}
      onClose={loading ? () => {} : onClose}
      size="sm"
      title={title}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </button>
          <button
            className={tone === "danger" ? "btn-danger" : "btn-primary"}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading && <Spinner className="h-4 w-4" />}
            {confirmLabel}
          </button>
        </>
      }
    >
      <div className="flex gap-4">
        <div
          className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${
            tone === "danger"
              ? "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400"
              : "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400"
          }`}
        >
          <AlertTriangle className="h-5 w-5" />
        </div>
        <p className="pt-1 text-sm leading-relaxed text-ink-600 dark:text-ink-300">
          {description}
        </p>
      </div>
    </Modal>
  );
}
