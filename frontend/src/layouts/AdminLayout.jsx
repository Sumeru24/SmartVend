import {
  Activity,
  ArrowUpRight,
  BarChart3,
  Boxes,
  ChevronsLeft,
  CircleHelp,
  Cpu,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  ReceiptText,
  ShoppingBag,
  Store,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { formatDate, initials } from "../utils/format";
import { Logo } from "../components/Logo";
import { ThemeToggle } from "../components/ui/ThemeToggle";

const NAV_GROUPS = [
  {
    label: "Workspace",
    links: [
      { to: "/admin", end: true, label: "Overview", icon: LayoutDashboard },
      { to: "/admin/analytics", label: "Analytics", icon: BarChart3 },
      { to: "/admin/transactions", label: "Transactions", icon: ReceiptText },
    ],
  },
  {
    label: "Operations",
    links: [
      { to: "/admin/products", label: "Products", icon: ShoppingBag },
      { to: "/admin/inventory", label: "Inventory", icon: Boxes },
      { to: "/admin/machines", label: "Machines", icon: Store },
    ],
  },
  {
    label: "Automata",
    links: [
      { to: "/simulator", label: "FSM Explorer", icon: Cpu, external: true },
    ],
  },
];

const PAGE_TITLES = {
  "/admin": "Overview",
  "/admin/products": "Products",
  "/admin/inventory": "Inventory",
  "/admin/transactions": "Transactions",
  "/admin/machines": "Machines",
  "/admin/analytics": "Analytics",
};

export function AdminLayout() {
  const { user, logout } = useAuth();
  const { isDark } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const currentTitle =
    Object.entries(PAGE_TITLES).find(
      ([path]) => location.pathname === path || (path !== "/admin" && location.pathname.startsWith(path)),
    )?.[1] || "Operations";

  const handleLogout = () => {
    logout();
    navigate("/admin/login");
  };

  const Sidebar = (
    <aside className="flex h-full flex-col bg-ink-950 text-white">
      <div className="flex h-[76px] items-center justify-between border-b border-white/[0.07] px-5">
        <Logo inverted />
        <button
          onClick={() => setMobileOpen(false)}
          className="grid h-8 w-8 place-items-center rounded-lg text-white/50 hover:bg-white/10 lg:hidden"
          aria-label="Close navigation"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <nav className="no-scrollbar flex-1 overflow-y-auto px-3 py-6">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="mb-6">
            <p className="mb-2 px-3 text-[9px] font-bold uppercase tracking-[0.22em] text-white/25">
              {group.label}
            </p>
            <div className="space-y-1">
              {group.links.map((link) =>
                link.external ? (
                  <Link
                    key={link.to}
                    to={link.to}
                    className="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-semibold text-white/55 transition hover:bg-white/[0.06] hover:text-white"
                  >
                    <link.icon className="h-[17px] w-[17px]" />
                    <span className="flex-1">{link.label}</span>
                    <ArrowUpRight className="h-3.5 w-3.5 opacity-0 transition group-hover:opacity-100" />
                  </Link>
                ) : (
                  <NavLink
                    key={link.to}
                    to={link.to}
                    end={link.end}
                    className={({ isActive }) =>
                      `group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-semibold transition ${
                        isActive
                          ? "bg-volt text-ink-950 shadow-[0_8px_24px_-12px_rgba(201,245,106,0.8)]"
                          : "text-white/55 hover:bg-white/[0.06] hover:text-white"
                      }`
                    }
                  >
                    <link.icon className="h-[17px] w-[17px]" />
                    {link.label}
                  </NavLink>
                ),
              )}
            </div>
          </div>
        ))}
      </nav>

      <div className="p-3">
        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <div className="absolute -right-5 -top-5 h-20 w-20 rounded-full bg-volt/10 blur-xl" />
          <div className="relative">
            <div className="flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-volt/15 text-volt">
                <Activity className="h-3.5 w-3.5" />
              </span>
              <p className="text-[11px] font-bold text-white">13-state EFSM</p>
            </div>
            <p className="mt-2 text-[10px] leading-relaxed text-white/35">
              Every purchase is validated through the persisted automaton engine.
            </p>
            <Link
              to="/simulator"
              className="mt-3 inline-flex items-center gap-1 text-[10px] font-bold text-volt hover:underline"
            >
              Open live explorer <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-volt text-[11px] font-extrabold text-ink-950">
            {initials(user?.full_name)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-bold text-white">{user?.full_name}</p>
            <p className="truncate text-[10px] capitalize text-white/35">{user?.role}</p>
          </div>
          <button
            onClick={handleLogout}
            className="grid h-8 w-8 place-items-center rounded-lg text-white/35 transition hover:bg-white/10 hover:text-white"
            title="Sign out"
            aria-label="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );

  return (
    <div className="min-h-screen bg-[#f5f6f2] dark:bg-[#0b0f0a]">
      <div className="fixed inset-y-0 left-0 z-40 hidden w-[252px] lg:block">{Sidebar}</div>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            className="absolute inset-0 bg-ink-950/60 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
          />
          <div className="relative h-full w-[276px] animate-slide-up">{Sidebar}</div>
        </div>
      )}

      <div className="lg:pl-[252px]">
        <header className="sticky top-0 z-30 border-b border-ink-200/70 bg-[#f5f6f2]/85 backdrop-blur-xl dark:border-white/[0.07] dark:bg-[#0b0f0a]/80">
          <div className="flex h-[76px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setMobileOpen(true)}
                className="btn-icon lg:hidden"
                aria-label="Open navigation"
              >
                <Menu className="h-4 w-4" />
              </button>
              <div>
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-ink-400 dark:text-ink-500">
                  <span>Console</span>
                  <span className="text-ink-200 dark:text-ink-700">/</span>
                  <span className="text-ink-700 dark:text-ink-200">{currentTitle}</span>
                </div>
                <p className="mt-0.5 hidden text-xs text-ink-400 dark:text-ink-500 sm:block">
                  {formatDate(new Date(), { weekday: "long", day: "numeric", month: "long" })}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="mr-1 hidden items-center gap-2 rounded-full border border-emerald-200/70 bg-emerald-50/70 px-3 py-1.5 text-[10px] font-bold text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/[0.08] dark:text-emerald-400 md:flex">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                </span>
                API online
              </div>
              <ThemeToggle />
              <Link to="/vending" className="btn-secondary hidden h-9 gap-2 px-3 text-xs sm:inline-flex">
                <Store className="h-3.5 w-3.5" />
                Vending screen
              </Link>
              <Link
                to="/simulator"
                className="btn-icon"
                title="FSM simulator"
                aria-label="FSM simulator"
              >
                <Cpu className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </header>

        <main className="admin-mesh min-h-[calc(100vh-76px)]">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export function AdminFooterNote() {
  return (
    <div className="mt-8 flex flex-col items-center justify-between gap-2 border-t border-ink-200/60 pt-5 text-[10px] text-ink-400 dark:border-white/[0.06] dark:text-ink-500 sm:flex-row">
      <span>SmartVend · Finite Automata Vending Management</span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-volt" />
        Dispensing is hardware-simulated
      </span>
    </div>
  );
}
