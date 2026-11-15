export function Progress({ value = 0, className = "", tone = "bg-ink-950 dark:bg-volt" }) {
  const safe = Math.min(Math.max(value, 0), 100);
  return (
    <div
      className={`h-1.5 overflow-hidden rounded-full bg-ink-100 dark:bg-white/10 ${className}`}
      role="progressbar"
      aria-valuenow={Math.round(safe)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={`h-full rounded-full transition-all duration-500 ${tone}`}
        style={{ width: `${safe}%` }}
      />
    </div>
  );
}
