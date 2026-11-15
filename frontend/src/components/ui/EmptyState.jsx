import { PackageOpen } from "lucide-react";

export function EmptyState({
  icon: Icon = PackageOpen,
  title = "Nothing here yet",
  description = "New items will appear here once they are created.",
  action,
  className = "",
}) {
  return (
    <div className={`flex flex-col items-center justify-center px-6 py-16 text-center ${className}`}>
      <div className="relative grid h-16 w-16 place-items-center rounded-[22px] border border-dashed border-ink-200 bg-ink-50 dark:border-white/15 dark:bg-white/[0.03]">
        <Icon className="h-6 w-6 text-ink-400" />
        <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-white bg-volt dark:border-[#121710]" />
      </div>
      <h3 className="mt-5 font-display text-base font-bold text-ink-900 dark:text-white">
        {title}
      </h3>
      <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-ink-500 dark:text-ink-400">
        {description}
      </p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
