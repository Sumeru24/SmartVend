import { ArrowDownRight, ArrowUpRight } from "lucide-react";

export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  trend,
  tone = "default",
  loading = false,
}) {
  const tones = {
    default: "bg-ink-100 text-ink-700 dark:bg-white/[0.06] dark:text-ink-200",
    lime: "bg-lime-100 text-lime-700 dark:bg-volt/10 dark:text-volt",
    emerald: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
    amber: "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
    rose: "bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400",
    sky: "bg-sky-100 text-sky-700 dark:bg-sky-500/10 dark:text-sky-400",
  };

  if (loading) {
    return (
      <div className="stat-card">
        <div className="skeleton h-4 w-24" />
        <div className="skeleton mt-4 h-8 w-32" />
        <div className="skeleton mt-3 h-3 w-20" />
      </div>
    );
  }

  return (
    <div className="stat-card group">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] font-semibold text-ink-500 dark:text-ink-400">{label}</p>
        {Icon && (
          <span
            className={`grid h-9 w-9 place-items-center rounded-xl transition-transform duration-300 group-hover:-translate-y-0.5 ${tones[tone] || tones.default}`}
          >
            <Icon className="h-4 w-4" />
          </span>
        )}
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <p className="font-display text-[27px] font-extrabold tracking-[-0.045em] text-ink-950 dark:text-white">
          {value}
        </p>
        {trend !== undefined && trend !== null && (
          <span
            className={`inline-flex items-center gap-0.5 text-[11px] font-bold ${trend >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}
          >
            {trend >= 0 ? (
              <ArrowUpRight className="h-3.5 w-3.5" />
            ) : (
              <ArrowDownRight className="h-3.5 w-3.5" />
            )}
            {Math.abs(trend)}%
          </span>
        )}
      </div>
      {hint && <p className="mt-2 text-xs text-ink-400 dark:text-ink-500">{hint}</p>}
    </div>
  );
}
