import { Loader2 } from "lucide-react";

export function Spinner({ className = "h-5 w-5", label = "Loading" }) {
  return (
    <span className="inline-flex items-center gap-2" role="status" aria-label={label}>
      <Loader2 className={`animate-spin ${className}`} />
      <span className="sr-only">{label}</span>
    </span>
  );
}

export function PageLoader({ label = "Loading workspace" }) {
  return (
    <div className="grid min-h-[55vh] place-items-center">
      <div className="flex flex-col items-center gap-4">
        <div className="relative grid h-12 w-12 place-items-center rounded-2xl bg-ink-950 dark:bg-volt">
          <Loader2 className="h-5 w-5 animate-spin text-volt dark:text-ink-950" />
        </div>
        <p className="text-sm font-medium text-ink-500 dark:text-ink-400">{label}…</p>
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 6, columns = 5 }) {
  return (
    <div className="table-shell animate-pulse">
      <div className="border-b border-ink-100 p-4 dark:border-white/10">
        <div className="h-4 w-40 rounded bg-ink-100 dark:bg-white/10" />
      </div>
      {Array.from({ length: rows }).map((_, row) => (
        <div
          key={row}
          className="flex items-center gap-5 border-b border-ink-100 px-5 py-4 last:border-0 dark:border-white/[0.06]"
        >
          {Array.from({ length: columns }).map((__, column) => (
            <div
              key={column}
              className="h-4 rounded bg-ink-100 dark:bg-white/[0.08]"
              style={{ width: `${12 + ((row + column) % 4) * 9}%` }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
