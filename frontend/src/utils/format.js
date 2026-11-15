export function formatCurrency(paise, { compact = false } = {}) {
  const value = Number(paise || 0) / 100;
  if (compact && Math.abs(value) >= 100000) {
    return `₹${new Intl.NumberFormat("en-IN", {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value)}`;
  }
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
  }).format(value);
}

export function formatNumber(value) {
  return new Intl.NumberFormat("en-IN").format(Number(value || 0));
}

export function formatDate(value, options = {}) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...options,
  }).format(new Date(value));
}

export function formatDateTime(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function formatTime(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function relativeTime(value) {
  if (!value) return "";
  const seconds = Math.floor((Date.now() - new Date(value).getTime()) / 1000);
  if (seconds < 45) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return formatDate(value);
}

export function titleCase(value) {
  return String(value || "")
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function initials(name) {
  const parts = String(name || "")
    .trim()
    .split(" ")
    .filter(Boolean);
  if (!parts.length) return "SV";
  return parts
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export const STATE_META = {
  IDLE: { label: "Idle", color: "slate", tone: "bg-slate-100 text-slate-700" },
  PRODUCT_SELECTED: {
    label: "Product selected",
    color: "indigo",
    tone: "bg-indigo-50 text-indigo-700",
  },
  INVENTORY_CHECK: {
    label: "Checking stock",
    color: "amber",
    tone: "bg-amber-50 text-amber-700",
  },
  OUT_OF_STOCK: {
    label: "Out of stock",
    color: "orange",
    tone: "bg-orange-50 text-orange-700",
  },
  PAYMENT_PENDING: {
    label: "Payment pending",
    color: "cyan",
    tone: "bg-cyan-50 text-cyan-700",
  },
  PAYMENT_ACCEPTED: {
    label: "Payment accepted",
    color: "emerald",
    tone: "bg-emerald-50 text-emerald-700",
  },
  DISPENSING: {
    label: "Dispensing",
    color: "violet",
    tone: "bg-violet-50 text-violet-700",
  },
  CHANGE_RETURN: {
    label: "Returning change",
    color: "sky",
    tone: "bg-sky-50 text-sky-700",
  },
  COMPLETED: {
    label: "Completed",
    color: "emerald",
    tone: "bg-emerald-100 text-emerald-800",
  },
  CANCELLED: {
    label: "Cancelled",
    color: "rose",
    tone: "bg-rose-50 text-rose-700",
  },
  REFUNDING: {
    label: "Refunding",
    color: "fuchsia",
    tone: "bg-fuchsia-50 text-fuchsia-700",
  },
  ERROR: { label: "Error", color: "red", tone: "bg-red-100 text-red-700" },
  MAINTENANCE: {
    label: "Maintenance",
    color: "stone",
    tone: "bg-stone-100 text-stone-700",
  },
};

export function stateLabel(state) {
  return STATE_META[state]?.label || titleCase(state);
}

export const FS_STATE_COLORS = {
  IDLE: "#64748b",
  PRODUCT_SELECTED: "#6366f1",
  INVENTORY_CHECK: "#f59e0b",
  OUT_OF_STOCK: "#f97316",
  PAYMENT_PENDING: "#06b6d4",
  PAYMENT_ACCEPTED: "#10b981",
  DISPENSING: "#8b5cf6",
  CHANGE_RETURN: "#0ea5e9",
  COMPLETED: "#22c55e",
  CANCELLED: "#f43f5e",
  REFUNDING: "#d946ef",
  ERROR: "#ef4444",
  MAINTENANCE: "#78716c",
};
