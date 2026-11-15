import { Check, Circle, Clock3, X } from "lucide-react";
import { STATE_META, stateLabel } from "../../utils/format";

const icons = {
  COMPLETED: Check,
  CANCELLED: X,
  ERROR: X,
  PAYMENT_ACCEPTED: Check,
};

const darkTones = {
  COMPLETED: "bg-emerald-500/10 text-emerald-400 ring-emerald-400/20",
  CANCELLED: "bg-rose-500/10 text-rose-400 ring-rose-400/20",
  ERROR: "bg-red-500/10 text-red-400 ring-red-400/20",
  PAYMENT_ACCEPTED: "bg-emerald-500/10 text-emerald-400 ring-emerald-400/20",
  PAYMENT_PENDING: "bg-cyan-500/10 text-cyan-400 ring-cyan-400/20",
  OUT_OF_STOCK: "bg-orange-500/10 text-orange-400 ring-orange-400/20",
  REFUNDING: "bg-fuchsia-500/10 text-fuchsia-400 ring-fuchsia-400/20",
  MAINTENANCE: "bg-stone-500/10 text-stone-300 ring-stone-400/20",
  IDLE: "bg-white/5 text-ink-300 ring-white/10",
};

export function StatusBadge({ state, dot = true, className = "" }) {
  const meta = STATE_META[state] || { tone: "bg-ink-100 text-ink-600" };
  const Icon = icons[state] || (dot ? Circle : null);
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ring-inset ring-transparent ${
        darkTones[state] || meta.tone
      } ${className}`}
    >
      {Icon && (
        <Icon
          className={`h-3 w-3 ${state === "PAYMENT_PENDING" || state === "REFUNDING" ? "animate-pulse" : ""}`}
        />
      )}
      {stateLabel(state)}
    </span>
  );
}

export function MachineStatusBadge({ status }) {
  const config = {
    online: {
      label: "Online",
      className: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-400/20",
    },
    offline: {
      label: "Offline",
      className: "bg-ink-100 text-ink-500 ring-ink-200 dark:bg-white/5 dark:text-ink-400 dark:ring-white/10",
    },
    maintenance: {
      label: "Maintenance",
      className: "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-400/20",
    },
    error: {
      label: "Error",
      className: "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:ring-rose-400/20",
    },
  }[status] || {
    label: status,
    className: "bg-ink-100 text-ink-600",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ring-inset ${config.className}`}
    >
      <span
        className={`relative h-1.5 w-1.5 rounded-full ${
          status === "online"
            ? "bg-emerald-500"
            : status === "error"
              ? "bg-rose-500"
              : status === "maintenance"
                ? "bg-amber-500"
                : "bg-ink-400"
        }`}
      >
        {status === "online" && (
          <span className="absolute inset-0 animate-ping rounded-full bg-emerald-500 opacity-50" />
        )}
      </span>
      {config.label}
    </span>
  );
}

export function StatePulse({ state = "online" }) {
  return (
    <span className="inline-flex items-center gap-2 text-xs font-semibold text-ink-500 dark:text-ink-400">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
      </span>
      {state === "online" ? "All systems nominal" : state}
    </span>
  );
}

export function PendingBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
      <Clock3 className="h-3 w-3" /> Pending
    </span>
  );
}
