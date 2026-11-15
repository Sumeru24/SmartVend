export function Toggle({ checked, onChange, label, description, disabled = false, id }) {
  return (
    <label
      htmlFor={id}
      className={`flex items-start justify-between gap-4 ${disabled ? "opacity-60" : "cursor-pointer"}`}
    >
      <span>
        <span className="block text-sm font-semibold text-ink-800 dark:text-ink-100">{label}</span>
        {description && (
          <span className="mt-0.5 block text-xs leading-relaxed text-ink-400 dark:text-ink-500">
            {description}
          </span>
        )}
      </span>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
          checked ? "bg-ink-950 dark:bg-volt" : "bg-ink-200 dark:bg-white/15"
        }`}
      >
        <span
          className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-all dark:bg-ink-950 ${
            checked ? "left-6" : "left-1"
          }`}
        />
      </button>
    </label>
  );
}
