import {
  ArrowRight,
  ArrowUpRight,
  Boxes,
  CircleDollarSign,
  Cpu,
  Package,
  ReceiptText,
  RefreshCw,
  ShoppingBasket,
  Store,
  TriangleAlert,
  WalletCards,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ImageWithFallback } from "../../components/ImageWithFallback";
import { AdminFooterNote } from "../../layouts/AdminLayout";
import { PageHeader } from "../../components/ui/PageHeader";
import { StatCard } from "../../components/ui/StatCard";
import { StatusBadge, MachineStatusBadge } from "../../components/ui/StatusBadge";
import { EmptyState } from "../../components/ui/EmptyState";
import { TableSkeleton } from "../../components/ui/Spinner";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { useToast } from "../../context/ToastContext";
import { adminService } from "../../services/admin";
import { apiErrorMessage } from "../../services/client";
import {
  formatCurrency,
  formatDateTime,
  formatNumber,
  relativeTime,
} from "../../utils/format";

const PAYMENT_COLORS = ["#84cc16", "#0ea5e9", "#f59e0b", "#8b5cf6"];

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-ink-200 bg-white px-3.5 py-2.5 shadow-lift dark:border-white/10 dark:bg-[#181f15]">
      <p className="text-[10px] font-bold uppercase tracking-wider text-ink-400">{label}</p>
      {payload.map((item) => (
        <p key={item.dataKey} className="mt-1 text-sm font-extrabold text-ink-950 dark:text-white">
          {item.dataKey === "revenue_paise"
            ? formatCurrency(item.value)
            : `${formatNumber(item.value)} transactions`}
        </p>
      ))}
    </div>
  );
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function DashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [chartRange, setChartRange] = useState(14);
  const [refreshing, setRefreshing] = useState(false);
  const { user } = useAuth();
  const { isDark } = useTheme();
  const { error: toastError, success } = useToast();
  const navigate = useNavigate();

  const load = async (quiet = false) => {
    if (quiet) setRefreshing(true);
    try {
      const result = await adminService.dashboard();
      setData(result);
      setError("");
    } catch (err) {
      const message = apiErrorMessage(err);
      setError(message);
      if (!quiet) toastError(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    document.title = "Overview · SmartVend";
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stats = data?.stats;
  const chartData = useMemo(
    () => (data?.revenue_series || []).slice(-chartRange),
    [data, chartRange],
  );
  const axisColor = isDark ? "rgba(255,255,255,0.28)" : "#94a3b8";
  const gridColor = isDark ? "rgba(255,255,255,0.06)" : "#eef1ea";

  if (error && !data) {
    return (
      <div className="admin-page">
        <EmptyState
          icon={TriangleAlert}
          title="Couldn’t load the control room"
          description={error}
          action={
            <button className="btn-primary" onClick={() => load()}>
              <RefreshCw className="h-4 w-4" /> Retry
            </button>
          }
        />
      </div>
    );
  }

  return (
    <div className="admin-page">
      <PageHeader
        eyebrow="Live operations"
        title={`${greeting()}, ${user?.full_name?.split(" ")[0] || "there"}.`}
        description="The fleet is humming. Here’s what moved, what sold, and what needs a human eye."
        actions={
          <>
            <button
              className="btn-secondary"
              onClick={() => {
                load(true);
                success("Dashboard refreshed.");
              }}
              disabled={refreshing}
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} /> Refresh
            </button>
            <Link to="/admin/analytics" className="btn-primary">
              <ArrowUpRight className="h-4 w-4" />
              Deep analytics
            </Link>
          </>
        }
      />

      <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total revenue"
          value={formatCurrency(stats?.total_revenue_paise || 0, { compact: true })}
          icon={CircleDollarSign}
          hint={`${formatCurrency(stats?.today_revenue_paise || 0)} collected today`}
          trend={stats?.revenue_growth_percent}
          tone="emerald"
          loading={loading}
        />
        <StatCard
          label="Transactions"
          value={formatNumber(stats?.total_transactions)}
          icon={ReceiptText}
          hint={`${stats?.successful_transactions || 0} successful · ${stats?.cancelled_transactions || 0} cancelled`}
          tone="lime"
          loading={loading}
        />
        <StatCard
          label="Success rate"
          value={`${stats?.success_rate ?? 0}%`}
          icon={Cpu}
          hint={`${formatNumber(stats?.units_sold)} units sold through the EFSM`}
          tone="sky"
          loading={loading}
        />
        <StatCard
          label="Low stock alerts"
          value={formatNumber(stats?.low_stock_products)}
          icon={TriangleAlert}
          hint={`${stats?.active_machines || 0} of ${stats?.total_machines || 0} machines online`}
          tone="amber"
          loading={loading}
        />
      </div>

      {data?.low_stock?.length > 0 && (
        <div className="mt-3.5 flex flex-col items-start justify-between gap-3 rounded-2xl border border-amber-200/80 bg-gradient-to-r from-amber-50 to-[#fbf7e8] px-4 py-3 dark:border-amber-500/20 dark:from-amber-500/[0.08] dark:to-transparent sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">
              <TriangleAlert className="h-4 w-4" />
            </span>
            <p className="text-xs text-ink-700 dark:text-ink-300">
              <span className="font-bold">{data.low_stock.length} low-stock SKUs</span>{" "}
              need attention · top: {data.low_stock[0]?.product_name} in{" "}
              {data.low_stock[0]?.machine_name}
            </p>
          </div>
          <Link
            to="/admin/inventory?low=1"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-800 hover:underline dark:text-amber-400"
          >
            Review inventory <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}

      <div className="mt-3.5 grid gap-3.5 xl:grid-cols-[1.65fr_0.85fr]">
        <section className="panel overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 px-5 py-4 dark:border-white/[0.07]">
            <div>
              <p className="section-kicker">Revenue velocity</p>
              <h2 className="mt-1 font-display text-base font-bold text-ink-950 dark:text-white">
                Sales performance
              </h2>
            </div>
            <div className="flex rounded-lg bg-ink-50 p-1 dark:bg-white/[0.04]">
              {[7, 14].map((range) => (
                <button
                  key={range}
                  onClick={() => setChartRange(range)}
                  className={`rounded-md px-2.5 py-1 text-[10px] font-bold transition ${
                    chartRange === range
                      ? "bg-white text-ink-900 shadow-sm dark:bg-white/10 dark:text-white"
                      : "text-ink-400 hover:text-ink-700 dark:hover:text-ink-200"
                  }`}
                >
                  {range} days
                </button>
              ))}
            </div>
          </div>
          <div className="h-[278px] px-2 pb-3 pt-5">
            {loading ? (
              <div className="flex h-full items-center justify-center">
                <div className="skeleton h-44 w-[90%]" />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 8, right: 12, left: 4, bottom: 2 }}>
                  <defs>
                    <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#84cc16" stopOpacity={0.32} />
                      <stop offset="100%" stopColor="#84cc16" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="txFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#0ea5e9" stopOpacity={0.16} />
                      <stop offset="100%" stopColor="#0ea5e9" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={gridColor} vertical={false} strokeDasharray="4 4" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10, fill: axisColor, fontWeight: 600 }}
                    axisLine={false}
                    tickLine={false}
                    tickMargin={10}
                  />
                  <YAxis
                    yAxisId="revenue"
                    tick={{ fontSize: 10, fill: axisColor }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(value) => formatCurrency(value, { compact: true })}
                    width={58}
                  />
                  <Tooltip content={<ChartTooltip />} cursor={{ stroke: gridColor }} />
                  <Area
                    yAxisId="revenue"
                    type="monotone"
                    dataKey="revenue_paise"
                    stroke="#84cc16"
                    strokeWidth={2.3}
                    fill="url(#revenueFill)"
                    activeDot={{ r: 4, fill: "#84cc16", stroke: isDark ? "#10140e" : "white", strokeWidth: 3 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="grid grid-cols-3 divide-x divide-ink-100 border-t border-ink-100 dark:divide-white/[0.06] dark:border-white/[0.06]">
            <div className="px-5 py-3.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">
                This week
              </p>
              <p className="mt-1 font-display text-sm font-extrabold text-ink-950 dark:text-white">
                {formatCurrency(stats?.week_revenue_paise || 0, { compact: true })}
              </p>
            </div>
            <div className="px-5 py-3.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">
                Avg. order
              </p>
              <p className="mt-1 font-display text-sm font-extrabold text-ink-950 dark:text-white">
                {formatCurrency(stats?.avg_order_paise || 0)}
              </p>
            </div>
            <div className="px-5 py-3.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">
                Refunded
              </p>
              <p className="mt-1 font-display text-sm font-extrabold text-ink-950 dark:text-white">
                {formatCurrency(stats?.refunded_paise || 0)}
              </p>
            </div>
          </div>
        </section>

        <div className="grid gap-3.5">
          <section className="panel p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="section-kicker">Fleet health</p>
                <h2 className="mt-1 font-display text-base font-bold text-ink-950 dark:text-white">
                  Vending machines
                </h2>
              </div>
              <Link to="/admin/machines" className="btn-ghost h-8 w-8 p-0">
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="mt-4 space-y-2.5">
              {loading
                ? Array.from({ length: 3 }).map((_, index) => (
                    <div key={index} className="skeleton h-14" />
                  ))
                : data?.machines?.slice(0, 3).map((machine) => (
                    <Link
                      key={machine.id}
                      to="/admin/machines"
                      className="group flex items-center gap-3 rounded-xl border border-ink-100 p-3 transition hover:border-ink-200 hover:bg-ink-50/60 dark:border-white/[0.06] dark:hover:bg-white/[0.03]"
                    >
                      <span className="grid h-9 w-9 place-items-center rounded-xl bg-ink-50 text-ink-500 dark:bg-white/[0.04] dark:text-ink-300">
                        <Store className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-bold text-ink-800 dark:text-ink-100">
                          {machine.name}
                        </p>
                        <p className="mt-0.5 truncate text-[10px] text-ink-400">
                          {machine.location}
                        </p>
                      </div>
                      <MachineStatusBadge status={machine.status} />
                    </Link>
                  ))}
            </div>
          </section>

          <section className="panel p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="section-kicker">Payment mix</p>
                <h2 className="mt-1 font-display text-base font-bold text-ink-950 dark:text-white">
                  How they paid
                </h2>
              </div>
              <WalletCards className="h-4 w-4 text-ink-300" />
            </div>
            {data?.payment_mix?.length ? (
              <div className="mt-2 flex items-center gap-3">
                <div className="h-[108px] w-[108px] shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={data.payment_mix}
                        dataKey="count"
                        nameKey="label"
                        innerRadius={34}
                        outerRadius={51}
                        paddingAngle={3}
                        stroke="none"
                      >
                        {data.payment_mix.map((entry, index) => (
                          <Cell key={entry.method} fill={PAYMENT_COLORS[index % PAYMENT_COLORS.length]} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  {data.payment_mix.map((entry, index) => (
                    <div key={entry.method} className="flex items-center gap-2 text-[10px]">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ background: PAYMENT_COLORS[index % PAYMENT_COLORS.length] }}
                      />
                      <span className="flex-1 font-medium text-ink-500 dark:text-ink-400">
                        {entry.label}
                      </span>
                      <span className="font-bold text-ink-800 dark:text-ink-200">
                        {entry.count}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="mt-5 text-xs text-ink-400">No payments captured yet.</p>
            )}
          </section>
        </div>
      </div>

      <div className="mt-3.5 grid gap-3.5 xl:grid-cols-[1.65fr_0.85fr]">
        <section className="panel overflow-hidden">
          <div className="flex items-center justify-between border-b border-ink-100 px-5 py-4 dark:border-white/[0.07]">
            <div>
              <p className="section-kicker">Latest activity</p>
              <h2 className="mt-1 font-display text-base font-bold text-ink-950 dark:text-white">
                Recent transactions
              </h2>
            </div>
            <Link
              to="/admin/transactions"
              className="text-[11px] font-bold text-ink-500 hover:text-ink-950 dark:text-ink-400 dark:hover:text-white"
            >
              View all
            </Link>
          </div>
          {loading ? (
            <div className="p-5">
              <TableSkeleton rows={4} columns={4} />
            </div>
          ) : data?.recent_transactions?.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[9px] uppercase tracking-[0.14em] text-ink-400">
                    <th className="px-5 py-3 font-semibold">Reference</th>
                    <th className="hidden px-3 py-3 font-semibold sm:table-cell">Product</th>
                    <th className="px-3 py-3 font-semibold">Status</th>
                    <th className="px-5 py-3 text-right font-semibold">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recent_transactions.map((transaction) => (
                    <tr
                      key={transaction.reference}
                      className="cursor-pointer border-t border-ink-100 transition hover:bg-ink-50/70 dark:border-white/[0.05] dark:hover:bg-white/[0.03]"
                      onClick={() => navigate(`/admin/transactions/${transaction.reference}`)}
                    >
                      <td className="px-5 py-3.5">
                        <p className="font-mono text-[11px] font-semibold text-ink-800 dark:text-ink-100">
                          {transaction.reference}
                        </p>
                        <p className="mt-0.5 text-[10px] text-ink-400">
                          {relativeTime(transaction.started_at)}
                        </p>
                      </td>
                      <td className="hidden max-w-[180px] px-3 py-3.5 sm:table-cell">
                        <p className="truncate text-xs text-ink-600 dark:text-ink-300">
                          {transaction.item_names?.slice(0, 2).join(", ")}
                          {transaction.item_names?.length > 2 ? ` +${transaction.item_names.length - 2}` : ""}
                        </p>
                      </td>
                      <td className="px-3 py-3.5">
                        <StatusBadge state={transaction.current_state} />
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <p className="text-xs font-bold text-ink-900 dark:text-white">
                          {formatCurrency(transaction.total_paise)}
                        </p>
                        <p className="mt-0.5 text-[9px] uppercase text-ink-400">
                          {transaction.payment_method || "—"}
                        </p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              icon={ReceiptText}
              title="No transactions yet"
              description="The first vending purchase will appear here in real time."
            />
          )}
        </section>

        <section className="panel p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="section-kicker">Ranked by revenue</p>
              <h2 className="mt-1 font-display text-base font-bold text-ink-950 dark:text-white">
                Top products
              </h2>
            </div>
            <ShoppingBasket className="h-4 w-4 text-ink-300" />
          </div>
          <div className="mt-4 space-y-3">
            {loading
              ? Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="skeleton h-11" />
                ))
              : data?.top_products?.slice(0, 4).map((product, index) => {
                  const max = data.top_products[0]?.units_sold || 1;
                  return (
                    <div key={product.product_id} className="flex items-center gap-3">
                      <span className="w-3 font-mono text-[10px] font-semibold text-ink-300">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <ImageWithFallback
                        src={product.image_url}
                        alt={product.name}
                        className="h-9 w-9 shrink-0 rounded-lg object-cover"
                        fallbackLabel={product.name.slice(0, 1)}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[11px] font-bold text-ink-800 dark:text-ink-100">
                          {product.name}
                        </p>
                        <div className="mt-1 h-1 overflow-hidden rounded-full bg-ink-100 dark:bg-white/10">
                          <div
                            className="h-full rounded-full bg-volt-deep"
                            style={{ width: `${Math.max((product.units_sold / max) * 100, 4)}%` }}
                          />
                        </div>
                      </div>
                      <p className="text-right text-[11px] font-extrabold text-ink-900 dark:text-white">
                        {formatCurrency(product.revenue_paise, { compact: true })}
                      </p>
                    </div>
                  );
                })}
          </div>
          {!loading && !data?.top_products?.length && (
            <p className="mt-5 text-xs text-ink-400">No completed sales yet.</p>
          )}
          <div className="mt-5 flex items-center justify-between rounded-xl bg-ink-50 px-3.5 py-3 dark:bg-white/[0.03]">
            <div className="flex items-center gap-2">
              <Package className="h-3.5 w-3.5 text-ink-400" />
              <span className="text-[10px] font-medium text-ink-500 dark:text-ink-400">
                Catalog
              </span>
            </div>
            <span className="text-[11px] font-bold text-ink-800 dark:text-ink-200">
              {stats?.total_products || 0} active products
            </span>
          </div>
        </section>
      </div>

      <AdminFooterNote />
    </div>
  );
}

export default DashboardPage;
