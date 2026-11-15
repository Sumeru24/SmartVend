import { ArrowLeft, Compass, Cpu, Home, Store } from "lucide-react";
import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Logo } from "../../components/Logo";
import { ThemeToggle } from "../../components/ui/ThemeToggle";

export function NotFoundPage() {
  const { pathname } = useLocation();

  useEffect(() => {
    document.title = "404 · SmartVend";
  }, []);

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-[#f5f6f2] dark:bg-[#0b0f0a]">
      <div className="pointer-events-none absolute inset-0">
        <div className="dot-grid absolute inset-0 opacity-[0.06] dark:opacity-[0.12]" />
        <div className="absolute left-1/2 top-0 h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-lime-300/20 blur-[110px] dark:bg-volt/[0.08]" />
      </div>

      <header className="relative z-10 flex items-center justify-between px-5 py-6 sm:px-8 lg:px-12">
        <Link to="/vending" aria-label="SmartVend home">
          <Logo />
        </Link>
        <div className="flex items-center gap-2">
          <Link to="/admin/login" className="btn-secondary hidden h-9 px-3 text-xs sm:inline-flex">
            Staff sign in
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <main className="relative z-10 flex flex-1 items-center justify-center px-5 py-10">
        <div className="w-full max-w-2xl text-center">
          <div className="mx-auto flex w-fit items-center gap-2 rounded-full border border-ink-200 bg-white/80 px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-ink-500 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/[0.04] dark:text-ink-300">
            <Compass className="h-3.5 w-3.5 text-lime-600 dark:text-volt" />
            State not found
          </div>

          <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.22em] text-ink-400">
            δ(q, ε) = ∅
          </p>
          <h1 className="mt-3 font-display text-[80px] font-extrabold leading-none tracking-[-0.06em] text-ink-950 dark:text-white sm:text-[112px]">
            4<span className="text-lime-500 dark:text-volt">0</span>4
          </h1>
          <h2 className="mt-3 font-display text-xl font-bold tracking-[-0.02em] text-ink-900 dark:text-white sm:text-2xl">
            No transition is defined from here.
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-ink-500 dark:text-ink-400">
            The automaton rejected this route, so no stock, balance or payment state was changed.
            Choose a valid state below to continue.
          </p>

          <div className="mx-auto mt-7 flex max-w-xl flex-col items-stretch justify-center gap-2 rounded-2xl border border-ink-200 bg-white/70 p-3 text-left shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/[0.03] sm:flex-row sm:items-center">
            <span className="hidden shrink-0 rounded-lg bg-ink-100 px-2.5 py-1.5 font-mono text-[10px] font-semibold text-ink-500 dark:bg-white/10 dark:text-ink-300 sm:inline">
              δ(404, OPEN_PAGE)
            </span>
            <span className="hidden h-4 w-px bg-ink-200 dark:bg-white/10 sm:block" />
            <code className="min-w-0 flex-1 truncate px-1 font-mono text-[11px] text-rose-600 dark:text-rose-400">
              rejected · {pathname}
            </code>
            <span className="shrink-0 rounded-lg bg-rose-50 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-rose-600 dark:bg-rose-500/10 dark:text-rose-400">
              Guard failed
            </span>
          </div>

          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            <Link to="/vending" className="btn-primary h-11 px-5">
              <Store className="h-4 w-4" />
              Back to the machine
            </Link>
            <Link to="/simulator" className="btn-secondary h-11 px-5">
              <Cpu className="h-4 w-4" />
              Explore the automaton
            </Link>
            <Link to="/" className="btn-ghost h-11 px-4">
              <Home className="h-4 w-4" />
              Home
            </Link>
          </div>

          <Link
            to="/admin"
            className="mt-8 inline-flex items-center gap-1.5 text-[11px] font-semibold text-ink-400 transition hover:text-ink-900 dark:text-ink-500 dark:hover:text-white"
          >
            <ArrowLeft className="h-3 w-3" />
            Or return to the operations console
          </Link>
        </div>
      </main>

      <footer className="relative z-10 flex flex-col items-center justify-between gap-2 px-5 py-6 text-[10px] text-ink-400 dark:text-ink-500 sm:flex-row sm:px-8 lg:px-12">
        <span>SmartVend · Finite Automata Vending Management</span>
        <span className="font-mono">13 states · 20 events · 29 transitions</span>
      </footer>
    </div>
  );
}

export default NotFoundPage;
