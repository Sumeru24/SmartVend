import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { CheckCircle2, Info, TriangleAlert, X, XCircle } from "lucide-react";

const ToastContext = createContext(null);

const icons = {
  success: CheckCircle2,
  error: XCircle,
  warning: TriangleAlert,
  info: Info,
};

const styles = {
  success: "border-emerald-200 bg-white text-emerald-950 dark:border-emerald-500/20 dark:bg-[#132019] dark:text-emerald-50",
  error: "border-rose-200 bg-white text-rose-950 dark:border-rose-500/20 dark:bg-[#211316] dark:text-rose-50",
  warning: "border-amber-200 bg-white text-amber-950 dark:border-amber-500/20 dark:bg-[#211c10] dark:text-amber-50",
  info: "border-ink-200 bg-white text-ink-900 dark:border-white/10 dark:bg-[#151b13] dark:text-ink-50",
};

const iconStyles = {
  success: "text-emerald-600 dark:text-emerald-400",
  error: "text-rose-600 dark:text-rose-400",
  warning: "text-amber-600 dark:text-amber-400",
  info: "text-ink-500 dark:text-ink-300",
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const toast = useCallback(
    (message, type = "info", options = {}) => {
      const id = crypto.randomUUID();
      setToasts((current) => [
        ...current.slice(-3),
        { id, message, type, title: options.title },
      ]);
      setTimeout(() => dismiss(id), options.duration || 4200);
      return id;
    },
    [dismiss],
  );

  const value = useMemo(
    () => ({
      toast,
      success: (message, options) => toast(message, "success", options),
      error: (message, options) => toast(message, "error", options),
      warning: (message, options) => toast(message, "warning", options),
      info: (message, options) => toast(message, "info", options),
    }),
    [toast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-4 z-[100] flex flex-col items-center gap-2 px-4 sm:items-end sm:pr-6">
        {toasts.map((item) => {
          const Icon = icons[item.type] || Info;
          return (
            <div
              key={item.id}
              role="status"
              className={`pointer-events-auto flex w-full max-w-sm animate-slide-up items-start gap-3 rounded-2xl border p-4 shadow-lift backdrop-blur ${styles[item.type]}`}
            >
              <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${iconStyles[item.type]}`} />
              <div className="min-w-0 flex-1">
                {item.title && <p className="text-sm font-bold">{item.title}</p>}
                <p className="text-sm leading-relaxed opacity-85">{item.message}</p>
              </div>
              <button
                onClick={() => dismiss(item.id)}
                aria-label="Dismiss notification"
                className="rounded-lg p-1 opacity-50 transition hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/10"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside ToastProvider");
  return context;
}
