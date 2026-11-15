import { ChevronLeft, ChevronRight } from "lucide-react";

export function Pagination({ page, pages = 1, total, pageSize, onPage }) {
  if (!total) return null;
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-1 py-4">
      <p className="text-xs font-medium text-ink-400 dark:text-ink-500">
        Showing <span className="font-bold text-ink-600 dark:text-ink-300">{start}–{end}</span> of{" "}
        <span className="font-bold text-ink-600 dark:text-ink-300">{total}</span>
      </p>
      <div className="flex items-center gap-1.5">
        <button
          className="btn-icon h-8 w-8 disabled:opacity-40"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        {Array.from({ length: Math.min(pages, 5) }).map((_, index) => {
          const value =
            pages <= 5
              ? index + 1
              : Math.min(Math.max(page - 2, 1), Math.max(pages - 4, 1)) + index;
          return (
            <button
              key={value}
              onClick={() => onPage(value)}
              className={`grid h-8 min-w-8 place-items-center rounded-lg px-2 text-xs font-bold transition ${
                value === page
                  ? "bg-ink-950 text-white dark:bg-volt dark:text-ink-950"
                  : "text-ink-500 hover:bg-ink-100 dark:text-ink-400 dark:hover:bg-white/10"
              }`}
            >
              {value}
            </button>
          );
        })}
        <button
          className="btn-icon h-8 w-8 disabled:opacity-40"
          disabled={page >= pages}
          onClick={() => onPage(page + 1)}
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
