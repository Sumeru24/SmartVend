import {
  ArrowUpRight,
  BarChart3,
  Boxes,
  CircleDollarSign,
  Download,
  FileSpreadsheet,
  FileText,
  Package,
  ReceiptText,
  RefreshCw,
  ShoppingBasket,
  Store,
  TrendingUp,
  TriangleAlert,
  WalletCards,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Area,
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ImageWithFallback } from "../../components/ImageWithFallback";
import { AdminFooterNote } from "../../layouts/AdminLayout";
import { EmptyState } from "../../components/ui/EmptyState";
import { PageHeader } from "../../components/ui/PageHeader";
import { Spinner } from "../../components/ui/Spinner";
import { StatCard } from "../../components/ui/StatCard";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { useTheme } from "../../context/ThemeContext";
import { useToast } from "../../context/ToastContext";
import { adminService } from "../../services/admin";
import { apiErrorMessage } from "../../services/client";
import {
  formatCurrency,
  formatNumber,
  titleCase,
} from "../../utils/format";

const PAYMENT_COLORS = ["#84cc16", "#0ea5e9", "#f59e0b", "#8b5cf6", "#f43f5e"];
const STATUS_COLORS = {
  COMPLETED: "#22c55e",
  CANCELLED: "#f43f5e",
  ERROR: "#ef4444",
  REFUNDING: "#d946ef",
  PAYMENT_PENDING: "#06b6d4",
  PAYMENT_ACCEPTED: "#10b981",
  DISPENSING: "#8b5cf6",
  CHANGE_RETURN: "#0ea5e9",
  OUT_OF_STOCK: "#f97316",
  IDLE: "#94a3b8",
  PRODUCT_SELECTED: "#6366f1",
  INVENTORY_CHECK: "#f59e0b",
  MAINTENANCE: "#78716c",
};
const REPORT_TYPES = [
  { id: "summary", label: "Operations summary" },
  { id: "transactions", label: "Transactions ledger" },
  { id: "products", label: "Product performance" },
  { id: "inventory", label: "Inventory position" },
];

function ChartTooltip({ active, payload, label, moneyKeys = [] }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-ink-200 bg-white px-3.5 py-2.5 shadow-lift dark:border-white/10 dark:bg-[#181f15]">
      {label && (
        <p className="text-[10px] font-bold uppercase tracking-wider text-ink-400">{label}</p>
      )}
      {payload.map((item) => (
        <div key={item.dataKey} className="mt-1 flex items-center gap-2">
          <span
            className="h-2 w-2 rounded-full"
            style={{ background: item.color || item.fill || "#84cc16" }}
          />
          <span className="text-[11px] font-medium text-ink-500 dark:text-ink-400">
            {item.name}:
          </span>
          <span className="text-xs font-extrabold text-ink-950 dark:text-white">
            {moneyKeys.includes(item.dataKey)
              ? formatCurrency(item.value)
              : formatNumber(item.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

function SectionHeader({ kicker, title, icon: Icon, action }) {
  return (
    <div className="flex items-center justify-between border-b border-ink-100 px-5 py-4 dark:border-white/[0.07]">
      <div>
        <p className="section-kicker">{kicker}</p>
        <h2 className="mt-1 inline-flex items-center gap-2 font-display text-base font-bold text-ink-950 dark:text-white">
          {Icon && <Icon className="h-4 w-4 text-ink-300" />} {title}
        </h2>
      </div>
      {action}
    </div>
  );
}

export function AnalyticsPage() {
  const [data, setData] = useState(null);
  const [revenue, setRevenue] = useState(null);
  const [period, setPeriod] = useState("daily");
  const [loading, setLoading] = useState(true);
  const [revenueLoading, setRevenueLoading] = useState(false);
  const [error, setError] = useState("");
  const [productTab, setProductTab] = useState("best");
  const [reportType, setReportType] = useState("summary");
  const [exporting, setExporting] = useState(null);
  const { isDark } = useTheme();
  const { success, error: toastError } = useToast();
  const firstPeriodRender = useRef(true);

  const load = async () => {
    try {
      const [
        dashboard,
        productPerformance,
        categoryRevenue,
        paymentMix,
        statusBreakdown,
        inventory,
        machines,
        revenueSeries,
      ] = await Promise.all([
        adminService.dashboard(),
        adminService.productAnalytics(),
        adminService.categoryAnalytics(),
        adminService.paymentAnalytics(),
        adminService.statusAnalytics(),
        adminService.inventoryAnalytics(),
        adminService.machineAnalytics(),
        adminService.revenue(period),
      ]);
      setData({
        dashboard,
        products: productPerformance,
        categories: categoryRevenue,
        payments: paymentMix,
        statuses: statusBreakdown,
        inventory,
        machines,
      });
      setRevenue(revenueSeries);
      setError("");
    } catch (err) {
      const message = apiErrorMessage(err, "Could not load analytics.");
      setError(message);
      toastError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    document.title = "Analytics · SmartVend";
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (firstPeriodRender.current) {
      firstPeriodRender.current = false;
      return;
    }
    let active = true;
    setRevenueLoading(true);
    adminService
      .revenue(period)
      .then((result) => {
        if (active) setRevenue(result);
      })
      .catch((err) => {
        if (active) toastError(apiErrorMessage(err, "Could not load revenue."));
      })
      .finally(() => {
        if (active) setRevenueLoading(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  const stats = data?.dashboard?.stats;
  const axisColor = isDark ? "rgba(255,255,255,0.28)" : "#94a3b8";
  const gridColor = isDark ? "rgba(255,255,255,0.06)" : "#eef1ea";

  const productRows = useMemo(() => {
    if (!data?.products) return [];
    if (productTab === "all") return data.products.all;
    return data.products[productTab] || [];
  }, [data, productTab]);

  const maxProductRevenue = useMemo(
    () => Math.max(...(data?.products?.all || []).map((product) => product.revenue_paise), 1),
    [data],
  );

  const exportReport = async (format) => {
    setExporting(format);
    try {
      await adminService.exportReport(format, reportType);
      success(
        `${format.toUpperCase()} · ${REPORT_TYPES.find((type) => type.id === reportType)?.label} downloaded.`,
      );
    } catch (err) {
      toastError(apiErrorMessage(err, "Could not export the report."));
    } finally {
      setExporting(null);
    }
  };

  if (loading) {
    return (
      <div className="admin-page">
        <PageHeader
          eyebrow="Business intelligence"
          title="Analytics & reports"
          description="Quantify demand, payments, fleet revenue and stock exposure from live persisted rows."
        />
        <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="stat-card">
              <div className="skeleton h-4 w-24" />
              <div className="skeleton mt-4 h-8 w-32" />
              <div className="skeleton mt-3 h-3 w-20" />
            </div>
          ))}
        </div>
        <div className="mt-5 grid gap-4 xl:grid-cols-[1.6fr_0.9fr]">
          <div className="panel h-[360px] p-5">
            <div className="skeleton h-full w-full" />
          </div>
          <div className="panel h-[360px] p-5">
            <div className="skeleton h-full w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="admin-page">
        <EmptyState
          icon={TriangleAlert}
          title="Analytics are unavailable"
          description={error}
          action={
            <button className="btn-primary" onClick={load}>
              <RefreshCw className="h-4 w-4" /> Retry
            </button>
          }
        />
      </div>
    );
  }

  const revenueItems = revenue?.items || data?.dashboard?.revenue_series || [];

  return (
    <div className="admin-page">
      <PageHeader
        eyebrow="Business intelligence"
        title="Analytics & reports"
        description="Every chart is computed from persisted transactions, payments, inventory and FSM state logs — never from mock arrays."
        actions={
          <>
            <button
              className="btn-secondary"
              onClick={() => {
                load();
                success("Analytics refreshed.");
              }}
            >
              <RefreshCw className="h-4 w-4" /> Refresh
            </button>
            <Link to="/admin/transactions" className="btn-primary">
              <ReceiptText className="h-4 w-4" /> Open ledger
            </Link>
          </>
        }
      />

      <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Completed revenue"
          value={formatCurrency(stats?.total_revenue_paise || 0, { compact: true })}
          icon={CircleDollarSign}
          hint={`${formatCurrency(stats?.week_revenue_paise || 0, { compact: true })} in the last 7 days`}
          trend={stats?.revenue_growth_percent}
          tone="emerald"
        />
        <StatCard
          label="Successful orders"
          value={formatNumber(stats?.successful_transactions)}
          icon={ReceiptText}
          hint={`${stats?.success_rate ?? 0}% success across ${formatNumber(stats?.total_transactions)} runs`}
          tone="lime"
        />
        <StatCard
          label="Average order value"
          value={formatCurrency(stats?.avg_order_paise || 0)}
          icon={TrendingUp}
          hint={`${formatNumber(stats?.units_sold)} units dispensed`}
          tone="sky"
        />
        <StatCard
          label="Refunded value"
          value={formatCurrency(stats?.refunded_paise || 0)}
          icon={WalletCards}
          hint={`${formatNumber(stats?.low_stock_products)} low-stock SKUs need attention`}
          tone="rose"
        />
      </div>

      <div className="mt-3.5 grid gap-3.5 xl:grid-cols-[1.6fr_0.9fr]">
        <section className="panel overflow-hidden">
          <SectionHeader
            kicker="Revenue series"
            title="Sales velocity"
            icon={BarChart3}
            action={
              <div className="flex rounded-lg bg-ink-50 p-1 dark:bg-white/[0.04]">
                {["daily", "weekly", "monthly"].map((option) => (
                  <button
                    key={option}
                    onClick={() => setPeriod(option)}
                    className={`rounded-md px-2.5 py-1 text-[10px] font-bold capitalize transition ${
                      period === option
                        ? "bg-white text-ink-900 shadow-sm dark:bg-white/10 dark:text-white"
                        : "text-ink-400 hover:text-ink-700 dark:hover:text-ink-200"
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            }
          />
          <div className="h-[300px] px-2 pb-2 pt-5">
            {revenueLoading ? (
              <div className="flex h-full items-center justify-center">
                <div className="skeleton h-44 w-[90%]" />
              </div>
            ) : revenueItems.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={revenueItems}
                  margin={{ top: 8, right: 14, left: 4, bottom: 2 }}
                >
                  <defs>
                    <linearGradient id="analyticsRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#84cc16" stopOpacity={0.34} />
                      <stop offset="100%" stopColor="#84cc16" stopOpacity={0} />
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
                  <YAxis
                    yAxisId="orders"
                    orientation="right"
                    tick={{ fontSize: 10, fill: axisColor }}
                    axisLine={false}
                    tickLine={false}
                    width={30}
                    allowDecimals={false}
                  />
                  <Tooltip
                    content={
                      <ChartTooltip moneyKeys={["revenue_paise"]} />
                    }
                    cursor={{ fill: isDark ? "rgba(255,255,255,0.035)" : "rgba(16,20,14,0.035)" }}
                  />
                  <Area
                    yAxisId="revenue"
                    type="monotone"
                    dataKey="revenue_paise"
                    name="Revenue"
                    stroke="#84cc16"
                    strokeWidth={2.4}
                    fill="url(#analyticsRevenue)"
                    activeDot={{
                      r: 4,
                      fill: "#84cc16",
                      stroke: isDark ? "#10140e" : "white",
                      strokeWidth: 3,
                    }}
                  />
                  <Bar
                    yAxisId="orders"
                    dataKey="transactions"
                    name="Orders"
                    fill={isDark ? "rgba(14,165,233,0.5)" : "rgba(14,165,233,0.24)"}
                    radius={[3, 3, 0, 0]}
                    barSize={10}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState
                icon={BarChart3}
                title="No revenue in this window"
                description="Complete a vending purchase and it will appear here automatically."
              />
            )}
          </div>
          <div className="grid grid-cols-3 divide-x divide-ink-100 border-t border-ink-100 dark:divide-white/[0.06] dark:border-white/[0.06]">
            <div className="px-5 py-3.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">
                Period revenue
              </p>
              <p className="mt-1 font-display text-sm font-extrabold text-ink-950 dark:text-white">
                {formatCurrency(revenue?.total_revenue_paise || 0, { compact: true })}
              </p>
            </div>
            <div className="px-5 py-3.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">
                Period average
              </p>
              <p className="mt-1 font-display text-sm font-extrabold text-ink-950 dark:text-white">
                {formatCurrency(revenue?.average_paise || 0)}
              </p>
            </div>
            <div className="px-5 py-3.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">
                Orders this week
              </p>
              <p className="mt-1 font-display text-sm font-extrabold text-ink-950 dark:text-white">
                {formatNumber(stats?.successful_transactions)}
              </p>
            </div>
          </div>
        </section>

        <div className="grid gap-3.5">
          <section className="panel p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="section-kicker">Tender mix</p>
                <h2 className="mt-1 font-display text-base font-bold text-ink-950 dark:text-white">
                  Payment methods
                </h2>
              </div>
              <WalletCards className="h-4 w-4 text-ink-300" />
            </div>
            {data?.payments?.length ? (
              <>
                <div className="mx-auto mt-2 h-[140px] w-[140px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={data.payments}
                        dataKey="count"
                        nameKey="label"
                        innerRadius={42}
                        outerRadius={66}
                        paddingAngle={3}
                        stroke="none"
                      >
                        {data.payments.map((entry, index) => (
                          <Cell
                            key={entry.method}
                            fill={PAYMENT_COLORS[index % PAYMENT_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip content={<ChartTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-1 space-y-2">
                  {data.payments.map((entry, index) => (
                    <div key={entry.method} className="flex items-center gap-2 text-[11px]">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ background: PAYMENT_COLORS[index % PAYMENT_COLORS.length] }}
                      />
                      <span className="flex-1 font-medium text-ink-500 dark:text-ink-400">
                        {entry.label}
                      </span>
                      <span className="font-semibold text-ink-400">{entry.share_percent}%</span>
                      <span className="w-20 text-right font-bold text-ink-800 dark:text-ink-200">
                        {formatCurrency(entry.amount_paise, { compact: true })}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="mt-4 text-xs text-ink-400">No captured payments yet.</p>
            )}
          </section>

          <section className="panel p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="section-kicker">Terminal state</p>
                <h2 className="mt-1 font-display text-base font-bold text-ink-950 dark:text-white">
                  Run outcomes
                </h2>
              </div>
              <CpuIcon />
            </div>
            <div className="mt-4 space-y-3">
              {data?.statuses?.length ? (
                data.statuses.map((row) => (
                  <div key={row.status}>
                    <div className="flex items-center justify-between gap-2">
                      <StatusBadge state={row.status} />
                      <span className="text-[11px] font-bold text-ink-800 dark:text-ink-200">
                        {row.count} · {row.share_percent}%
                      </span>
                    </div>
                    <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-ink-100 dark:bg-white/10">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.max(row.share_percent, 2)}%`,
                          background: STATUS_COLORS[row.status] || "#84cc16",
                        }}
                      />
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-ink-400">No transactions recorded yet.</p>
              )}
            </div>
          </section>
        </div>
      </div>

      <div className="mt-3.5 grid gap-3.5 xl:grid-cols-[1.35fr_1fr]">
        <section className="panel overflow-hidden">
          <SectionHeader
            kicker="Category economics"
            title="Revenue by category"
            icon={ShoppingBasket}
            action={
              <span className="text-[10px] font-semibold text-ink-400">
                Completed orders only
              </span>
            }
          />
          <div className="h-[260px] px-2 py-4">
            {data?.categories?.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={data.categories}
                  layout="vertical"
                  margin={{ top: 0, right: 24, left: 12, bottom: 0 }}
                >
                  <CartesianGrid stroke={gridColor} horizontal={false} strokeDasharray="4 4" />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 10, fill: axisColor }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(value) => formatCurrency(value, { compact: true })}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={88}
                    tick={{ fontSize: 10, fill: axisColor, fontWeight: 600 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<ChartTooltip moneyKeys={["revenue_paise"]} />} />
                  <Bar
                    dataKey="revenue_paise"
                    name="Revenue"
                    radius={[0, 5, 5, 0]}
                    barSize={16}
                  >
                    {data.categories.map((entry) => (
                      <Cell key={entry.category_id} fill={entry.color || "#84cc16"} />
                    ))}
                  </Bar>
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState
                icon={ShoppingBasket}
                title="No category sales"
                description="Category revenue appears once completed purchases are persisted."
              />
            )}
          </div>
        </section>

        <section className="panel overflow-hidden">
          <SectionHeader
            kicker="Catalog detail"
            title="Product performance"
            icon={Package}
            action={
              <div className="flex rounded-lg bg-ink-50 p-1 dark:bg-white/[0.04]">
                {[
                  ["best", "Best"],
                  ["least", "Least"],
                  ["all", "All"],
                ].map(([id, label]) => (
                  <button
                    key={id}
                    onClick={() => setProductTab(id)}
                    className={`rounded-md px-2 py-1 text-[10px] font-bold transition ${
                      productTab === id
                        ? "bg-white text-ink-900 shadow-sm dark:bg-white/10 dark:text-white"
                        : "text-ink-400 hover:text-ink-700 dark:hover:text-ink-200"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            }
          />
          <div className="max-h-[280px] divide-y divide-ink-100 overflow-y-auto dark:divide-white/[0.06]">
            {productRows.length ? (
              productRows.map((product, index) => (
                <div key={product.product_id} className="flex items-center gap-3 px-5 py-3">
                  <span className="w-4 shrink-0 font-mono text-[10px] font-semibold text-ink-300">
                    {productTab === "least"
                      ? String(productRows.length - index).padStart(2, "0")
                      : String(index + 1).padStart(2, "0")}
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
                        style={{
                          width: `${Math.max((product.revenue_paise / maxProductRevenue) * 100, product.revenue_paise ? 4 : 0)}%`,
                        }}
                      />
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] font-extrabold text-ink-900 dark:text-white">
                      {formatCurrency(product.revenue_paise, { compact: true })}
                    </p>
                    <p className="text-[9px] text-ink-400">{product.units_sold} units</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="px-5 py-8 text-center text-xs text-ink-400">
                No products in this view.
              </p>
            )}
          </div>
        </section>
      </div>

      <div className="mt-3.5 grid gap-3.5 xl:grid-cols-[1fr_1.35fr]">
        <section className="panel overflow-hidden">
          <SectionHeader
            kicker="Stock exposure"
            title="Inventory position"
            icon={Boxes}
            action={
              <Link
                to="/admin/inventory"
                className="inline-flex items-center gap-1 text-[10px] font-bold text-ink-500 hover:text-ink-950 dark:text-ink-400 dark:hover:text-white"
              >
                Manage <ArrowUpRight className="h-3 w-3" />
              </Link>
            }
          />
          <div className="grid grid-cols-2 divide-x divide-y divide-ink-100 dark:divide-white/[0.06]">
            {[
              {
                label: "Available units",
                value: formatNumber(data?.inventory?.total_available_units),
                tone: "text-ink-950 dark:text-white",
              },
              {
                label: "Stock value",
                value: formatCurrency(data?.inventory?.stock_value_paise || 0, { compact: true }),
                tone: "text-ink-950 dark:text-white",
              },
              {
                label: "Reserved units",
                value: formatNumber(data?.inventory?.reserved_units),
                tone: "text-sky-600 dark:text-sky-400",
              },
              {
                label: "Low-stock SKUs",
                value: formatNumber(data?.inventory?.low_stock?.length),
                tone: "text-amber-600 dark:text-amber-400",
              },
            ].map((metric) => (
              <div key={metric.label} className="px-5 py-4">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">
                  {metric.label}
                </p>
                <p className={`mt-1 font-display text-lg font-extrabold ${metric.tone}`}>
                  {metric.value}
                </p>
              </div>
            ))}
          </div>
          <div className="border-t border-ink-100 p-4 dark:border-white/[0.06]">
            <p className="mb-2 text-[9px] font-bold uppercase tracking-[0.16em] text-ink-400">
              Available by category
            </p>
            <div className="space-y-2">
              {(data?.inventory?.by_category || []).map((category) => (
                <div key={category.name} className="flex items-center gap-2 text-[11px]">
                  <span className="flex-1 text-ink-500 dark:text-ink-400">{category.name}</span>
                  <span className="font-mono text-[10px] text-ink-400">
                    {category.units} units
                  </span>
                  <span className="w-20 text-right font-bold text-ink-800 dark:text-ink-200">
                    {formatCurrency(category.value_paise, { compact: true })}
                  </span>
                </div>
              ))}
              {!data?.inventory?.by_category?.length && (
                <p className="text-xs text-ink-400">No inventory configured.</p>
              )}
            </div>
          </div>
        </section>

        <section className="panel overflow-hidden">
          <SectionHeader
            kicker="Fleet comparison"
            title="Machine performance"
            icon={Store}
            action={
              <Link
                to="/admin/machines"
                className="inline-flex items-center gap-1 text-[10px] font-bold text-ink-500 hover:text-ink-950 dark:text-ink-400 dark:hover:text-white"
              >
                Fleet <ArrowUpRight className="h-3 w-3" />
              </Link>
            }
          />
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-ink-50/70 text-[9px] uppercase tracking-[0.14em] text-ink-400 dark:bg-white/[0.03]">
                  <th className="px-5 py-3 font-semibold">Machine</th>
                  <th className="px-3 py-3 font-semibold">Status</th>
                  <th className="px-3 py-3 text-right font-semibold">Orders</th>
                  <th className="px-3 py-3 text-right font-semibold">Revenue</th>
                  <th className="px-5 py-3 text-right font-semibold">Health</th>
                </tr>
              </thead>
              <tbody>
                {(data?.machines || []).map((machine) => (
                  <tr
                    key={machine.machine_id}
                    className="border-t border-ink-100 dark:border-white/[0.06]"
                  >
                    <td className="px-5 py-3.5">
                      <p className="text-[11px] font-bold text-ink-800 dark:text-ink-100">
                        {machine.name}
                      </p>
                      <p className="mt-0.5 font-mono text-[9px] text-ink-400">{machine.code}</p>
                    </td>
                    <td className="px-3 py-3.5">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[9px] font-bold capitalize ${
                          machine.status === "online"
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
                            : machine.status === "maintenance"
                              ? "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400"
                              : "bg-ink-100 text-ink-500 dark:bg-white/5 dark:text-ink-400"
                        }`}
                      >
                        {machine.status}
                      </span>
                    </td>
                    <td className="px-3 py-3.5 text-right text-[11px] font-semibold text-ink-600 dark:text-ink-300">
                      {machine.transactions}
                    </td>
                    <td className="px-3 py-3.5 text-right text-[11px] font-extrabold text-ink-900 dark:text-white">
                      {formatCurrency(machine.revenue_paise, { compact: true })}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-ink-500 dark:text-ink-400">
                        {machine.available_units} units
                        {machine.low_stock > 0 && (
                          <TriangleAlert className="h-3 w-3 text-amber-500" />
                        )}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <section className="panel mt-3.5 overflow-hidden">
        <SectionHeader
          kicker="Board-ready exports"
          title="Download reports"
          icon={Download}
          action={
            <div className="flex items-center gap-2">
              <select
                className="input h-8 w-auto py-0 text-[11px]"
                value={reportType}
                onChange={(event) => setReportType(event.target.value)}
                aria-label="Report type"
              >
                {REPORT_TYPES.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.label}
                  </option>
                ))}
              </select>
              <button
                className="btn-secondary h-8 px-3 text-[11px]"
                onClick={() => exportReport("csv")}
                disabled={Boolean(exporting)}
              >
                {exporting === "csv" ? (
                  <Spinner className="h-3.5 w-3.5" />
                ) : (
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                )}
                CSV
              </button>
              <button
                className="btn-primary h-8 px-3 text-[11px]"
                onClick={() => exportReport("pdf")}
                disabled={Boolean(exporting)}
              >
                {exporting === "pdf" ? (
                  <Spinner className="h-3.5 w-3.5" />
                ) : (
                  <FileText className="h-3.5 w-3.5" />
                )}
                PDF
              </button>
            </div>
          }
        />
        <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-4">
          {REPORT_TYPES.map((type) => (
            <button
              key={type.id}
              onClick={() => setReportType(type.id)}
              className={`rounded-xl border p-3 text-left transition ${
                reportType === type.id
                  ? "border-ink-950 bg-ink-950 text-white dark:border-volt/60 dark:bg-volt/10"
                  : "border-ink-200 bg-white hover:border-ink-300 dark:border-white/10 dark:bg-white/[0.02] dark:hover:border-white/20"
              }`}
            >
              <p
                className={`text-[11px] font-bold ${
                  reportType === type.id ? "text-white dark:text-volt" : "text-ink-800 dark:text-ink-100"
                }`}
              >
                {type.label}
              </p>
              <p
                className={`mt-1 text-[9px] leading-relaxed ${
                  reportType === type.id
                    ? "text-white/50 dark:text-ink-300"
                    : "text-ink-400"
                }`}
              >
                {type.id === "summary"
                  ? "Revenue, refunds, stock and fleet KPIs."
                  : type.id === "transactions"
                    ? "Reference-level ledger with FSM outcomes."
                    : type.id === "products"
                      ? "Units and revenue across the catalog."
                      : "Availability, thresholds and stock value."}
              </p>
            </button>
          ))}
        </div>
      </section>

      <AdminFooterNote />
    </div>
  );
}

function CpuIcon() {
  return <span className="text-[10px] font-mono text-ink-300">q ∈ Q</span>;
}

export default AnalyticsPage;
