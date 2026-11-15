export function PageHeader({ eyebrow, title, description, actions, children }) {
  return (
    <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div className="min-w-0">
        {eyebrow && <p className="section-kicker mb-2">{eyebrow}</p>}
        <h1 className="font-display text-[26px] font-extrabold tracking-[-0.04em] text-ink-950 dark:text-white sm:text-[30px]">
          {title}
        </h1>
        {description && (
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-ink-500 dark:text-ink-400">
            {description}
          </p>
        )}
        {children}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
