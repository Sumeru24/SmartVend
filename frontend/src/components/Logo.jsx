export function Logo({ compact = false, inverted = false, className = "" }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <div
        className={`relative grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-[11px] ${
          inverted ? "bg-white/10 ring-1 ring-white/15" : "bg-ink-950 shadow-sm"
        }`}
      >
        <div className="flex items-end gap-[3px]">
          <span className="h-4 w-[5px] rounded-[2px] bg-volt" />
          <span className="flex flex-col gap-[3px]">
            <span className="h-[5px] w-[5px] rounded-[1px] bg-volt/90" />
            <span className="h-[5px] w-[5px] rounded-[1px] bg-volt/60" />
          </span>
        </div>
        <span className="absolute right-[5px] top-[5px] h-1 w-1 rounded-full bg-volt/80" />
      </div>
      {!compact && (
        <div className="leading-none">
          <div
            className={`font-display text-[17px] font-extrabold tracking-[-0.035em] ${
              inverted ? "text-white" : "text-ink-950 dark:text-white"
            }`}
          >
            SmartVend
          </div>
          <div
            className={`mt-1 text-[8px] font-bold uppercase tracking-[0.22em] ${
              inverted ? "text-white/40" : "text-ink-400 dark:text-ink-500"
            }`}
          >
            Automata OS
          </div>
        </div>
      )}
    </div>
  );
}
