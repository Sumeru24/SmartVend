import {
  ArrowDownToLine,
  ArrowUpDown,
  Boxes,
  History,
  PackageCheck,
  PackageX,
  Search,
  Settings2,
  SlidersHorizontal,
  TriangleAlert,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AdminFooterNote } from "../../layouts/AdminLayout";
import { EmptyState } from "../../components/ui/EmptyState";
import { Modal } from "../../components/ui/Modal";
import { PageHeader } from "../../components/ui/PageHeader";
import { Progress } from "../../components/ui/Progress";
import { StatCard } from "../../components/ui/StatCard";
import { Spinner, TableSkeleton } from "../../components/ui/Spinner";
import { useToast } from "../../context/ToastContext";
import { useDebounce } from "../../hooks/useDebounce";
import { adminService } from "../../services/admin";
import { apiErrorMessage } from "../../services/client";
import { formatDateTime, formatNumber, formatTime } from "../../utils/format";

export function InventoryPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [inventory, setInventory] = useState([]);
  const [summary, setSummary] = useState(null);
  const [machines, setMachines] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [logsLoading, setLogsLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 250);
  const [machineFilter, setMachineFilter] = useState("all");
  const [lowOnly, setLowOnly] = useState(searchParams.get("low") === "1");
  const [tab, setTab] = useState("stock");
  const [restocking, setRestocking] = useState(null);
  const [restockQty, setRestockQty] = useState("20");
  const [restockReason, setRestockReason] = useState("Scheduled restock");
  const [saving, setSaving] = useState(false);
  const [thresholdItem, setThresholdItem] = useState(null);
  const [thresholdValue, setThresholdValue] = useState("5");
  const { success, error: toastError } = useToast();

  const loadInventory = async () => {
    try {
      const [items, summaryData] = await Promise.all([
        adminService.inventory({
          machine_id: machineFilter === "all" ? undefined : machineFilter,
          low_stock: lowOnly || undefined,
          search: debouncedSearch || undefined,
        }),
        adminService.inventorySummary({
          machine_id: machineFilter === "all" ? undefined : machineFilter,
        }),
      ]);
      setInventory(items);
      setSummary(summaryData);
      setError("");
    } catch (err) {
      const message = apiErrorMessage(err);
      setError(message);
      toastError(message);
    } finally {
      setLoading(false);
    }
  };

  const loadMeta = async () => {
    try {
      const [machineData, logData] = await Promise.all([
        adminService.machines(),
        adminService.inventoryLogs({
          page_size: 20,
          machine_id: machineFilter === "all" ? undefined : machineFilter,
        }),
      ]);
      setMachines(machineData);
      setLogs(logData.items || []);
    } catch {
      // Primary inventory error is surfaced in the page.
    } finally {
      setLogsLoading(false);
    }
  };

  useEffect(() => {
    document.title = "Inventory · SmartVend";
    loadMeta();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [machineFilter]);

  useEffect(() => {
    setLoading(true);
    loadInventory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [machineFilter, lowOnly, debouncedSearch]);

  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    if (lowOnly) params.set("low", "1");
    else params.delete("low");
    setSearchParams(params, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lowOnly]);

  const filtered = useMemo(() => inventory, [inventory]);

  const refresh = async () => {
    setLoading(true);
    setLogsLoading(true);
    await Promise.all([loadInventory(), loadMeta()]);
  };

  const submitRestock = async (event) => {
    event.preventDefault();
    if (!restocking) return;
    const quantity = Number(restockQty);
    if (!Number.isInteger(quantity) || quantity <= 0) {
      toastError("Restock quantity must be a positive whole number.");
      return;
    }
    setSaving(true);
    try {
      await adminService.restock(restocking.id, quantity, restockReason.trim() || "Restock");
      success(`${quantity} units added to ${restocking.product_name}.`);
      setRestocking(null);
      setRestockQty("20");
      await refresh();
    } catch (err) {
      toastError(apiErrorMessage(err, "Restock failed."));
    } finally {
      setSaving(false);
    }
  };

  const openRestock = (item) => {
    setRestocking(item);
    setRestockQty(String(Math.max(10, item.low_stock_threshold * 3)));
    setRestockReason("Scheduled restock");
  };

  const openThreshold = (item) => {
    setThresholdItem(item);
    setThresholdValue(String(item.low_stock_threshold));
  };

  const submitThreshold = async (event) => {
    event.preventDefault();
    if (!thresholdItem) return;
    const value = Number(thresholdValue);
    if (!Number.isInteger(value) || value < 0) {
      toastError("Threshold must be a whole number of 0 or more.");
      return;
    }
    setSaving(true);
    try {
      await adminService.setThreshold(thresholdItem.id, value);
      success("Low-stock threshold updated.");
      setThresholdItem(null);
      await loadInventory();
    } catch (err) {
      toastError(apiErrorMessage(err, "Could not update threshold."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-page">
      <PageHeader
        eyebrow="Supply"
        title="Inventory"
        description="Atomic reservations protect every checkout. Restocks create an audit record and automatically clear low-stock alerts."
        actions={
          <button className="btn-secondary" onClick={refresh}>
            <ArrowUpDown className="h-4 w-4" /> Refresh
          </button>
        }
      />

      <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total units on hand"
          value={formatNumber(summary?.total_units)}
          icon={Boxes}
          hint={`${formatNumber(summary?.sku_count)} machine SKUs`}
          tone="lime"
          loading={loading && !summary}
        />
        <StatCard
          label="Available now"
          value={formatNumber(summary?.available_units)}
          icon={PackageCheck}
          hint={`${formatNumber(summary?.reserved_units)} reserved in active carts`}
          tone="emerald"
          loading={loading && !summary}
        />
        <StatCard
          label="Low stock"
          value={formatNumber(summary?.low_stock_count)}
          icon={TriangleAlert}
          hint="At or below the configured threshold"
          tone="amber"
          loading={loading && !summary}
        />
        <StatCard
          label="Out of stock"
          value={formatNumber(summary?.out_of_stock_count)}
          icon={PackageX}
          hint="Needs an urgent restock"
          tone="rose"
          loading={loading && !summary}
        />
      </div>

      <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex rounded-xl border border-ink-200 bg-white p-1 shadow-sm dark:border-white/10 dark:bg-[#121710]">
          <button
            onClick={() => setTab("stock")}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold transition ${
              tab === "stock"
                ? "bg-ink-950 text-white dark:bg-volt dark:text-ink-950"
                : "text-ink-500 hover:text-ink-900 dark:text-ink-400 dark:hover:text-white"
            }`}
          >
            <Boxes className="h-3.5 w-3.5" /> Stock levels
          </button>
          <button
            onClick={() => setTab("logs")}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold transition ${
              tab === "logs"
                ? "bg-ink-950 text-white dark:bg-volt dark:text-ink-950"
                : "text-ink-500 hover:text-ink-900 dark:text-ink-400 dark:hover:text-white"
            }`}
          >
            <History className="h-3.5 w-3.5" /> Movement log
          </button>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative min-w-0 sm:w-64">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
            <input
              className="input bg-white pl-10 dark:bg-[#121710]"
              placeholder="Search products, slots, machines…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <select
            className="input bg-white text-xs dark:bg-[#121710] sm:w-44"
            value={machineFilter}
            onChange={(event) => setMachineFilter(event.target.value)}
            aria-label="Filter by machine"
          >
            <option value="all">All machines</option>
            {machines.map((machine) => (
              <option key={machine.id} value={machine.id}>
                {machine.name}
              </option>
            ))}
          </select>
          <button
            onClick={() => setLowOnly((value) => !value)}
            className={`inline-flex h-[42px] items-center gap-2 rounded-xl border px-3 text-xs font-bold transition ${
              lowOnly
                ? "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400"
                : "border-ink-200 bg-white text-ink-500 hover:bg-ink-50 dark:border-white/10 dark:bg-[#121710] dark:text-ink-300"
            }`}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Low only
          </button>
        </div>
      </div>

      <div className="mt-4">
        {tab === "stock" ? (
          loading ? (
            <TableSkeleton rows={7} columns={6} />
          ) : error ? (
            <EmptyState
              icon={TriangleAlert}
              title="Inventory unavailable"
              description={error}
              action={<button className="btn-primary" onClick={refresh}>Retry</button>}
            />
          ) : filtered.length ? (
            <div className="table-shell">
              <div className="overflow-x-auto">
                <table>
                  <thead>
                    <tr>
                      <th>SKU & machine</th>
                      <th>Slot</th>
                      <th>On hand</th>
                      <th>Available</th>
                      <th>Stock health</th>
                      <th>Threshold</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((item) => {
                      const ratio = Math.min(
                        (item.available_quantity / Math.max(item.low_stock_threshold * 4, 12)) * 100,
                        100,
                      );
                      return (
                        <tr key={item.id}>
                          <td>
                            <div>
                              <p className="text-[13px] font-bold text-ink-900 dark:text-white">
                                {item.product_name}
                              </p>
                              <p className="mt-0.5 text-[10px] text-ink-400">{item.machine_name}</p>
                            </div>
                          </td>
                          <td>
                            <span className="rounded-lg border border-ink-200 bg-ink-50 px-2 py-1 font-mono text-[10px] font-semibold text-ink-600 dark:border-white/10 dark:bg-white/5 dark:text-ink-300">
                              {item.slot_code}
                            </span>
                          </td>
                          <td>
                            <span className="font-mono text-xs font-bold text-ink-800 dark:text-ink-100">
                              {item.quantity}
                            </span>
                          </td>
                          <td>
                            <span className="text-xs font-bold text-ink-900 dark:text-white">
                              {item.available_quantity}
                            </span>
                            {item.reserved_quantity > 0 && (
                              <span className="ml-1.5 rounded bg-sky-50 px-1.5 py-0.5 text-[9px] font-semibold text-sky-700 dark:bg-sky-500/10 dark:text-sky-400">
                                {item.reserved_quantity} held
                              </span>
                            )}
                          </td>
                          <td className="min-w-[150px]">
                            <div className="flex items-center justify-between text-[10px]">
                              <span
                                className={`font-bold ${
                                  item.available_quantity <= 0
                                    ? "text-rose-600 dark:text-rose-400"
                                    : item.is_low_stock
                                      ? "text-amber-600 dark:text-amber-400"
                                      : "text-emerald-600 dark:text-emerald-400"
                                }`}
                              >
                                {item.available_quantity <= 0
                                  ? "Out of stock"
                                  : item.is_low_stock
                                    ? "Low"
                                    : "Healthy"}
                              </span>
                              <span className="text-ink-400">{ratio.toFixed(0)}%</span>
                            </div>
                            <Progress
                              value={ratio}
                              className="mt-1.5"
                              tone={
                                item.available_quantity <= 0
                                  ? "bg-rose-500"
                                  : item.is_low_stock
                                    ? "bg-amber-400"
                                    : "bg-emerald-500"
                              }
                            />
                          </td>
                          <td>
                            <button
                              onClick={() => openThreshold(item)}
                              className="group inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-ink-600 hover:bg-ink-50 dark:text-ink-300 dark:hover:bg-white/5"
                            >
                              {item.low_stock_threshold}
                              <Settings2 className="h-3 w-3 opacity-0 transition group-hover:opacity-60" />
                            </button>
                          </td>
                          <td>
                            <div className="flex justify-end">
                              <button
                                className="btn-secondary h-8 px-2.5 text-[11px]"
                                onClick={() => openRestock(item)}
                              >
                                <ArrowDownToLine className="h-3.5 w-3.5" /> Restock
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="panel">
              <EmptyState
                icon={Boxes}
                title={lowOnly ? "No low-stock items" : "No inventory found"}
                description={
                  lowOnly
                    ? "Every machine SKU is currently above its threshold."
                    : "Try clearing the search or machine filter."
                }
                action={
                  lowOnly ? (
                    <button className="btn-secondary" onClick={() => setLowOnly(false)}>
                      Show all stock
                    </button>
                  ) : null
                }
              />
            </div>
          )
        ) : logsLoading ? (
          <TableSkeleton rows={6} columns={5} />
        ) : logs.length ? (
          <div className="table-shell">
            <div className="flex items-center justify-between border-b border-ink-100 px-5 py-4 dark:border-white/[0.07]">
              <div>
                <p className="section-kicker">Audit trail</p>
                <h2 className="mt-1 font-display text-base font-bold text-ink-950 dark:text-white">
                  Stock movements
                </h2>
              </div>
              <span className="text-[10px] text-ink-400">Most recent 20</span>
            </div>
            <div className="overflow-x-auto">
              <table>
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Product</th>
                    <th>Machine</th>
                    <th>Reason</th>
                    <th>Change</th>
                    <th>Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id}>
                      <td>
                        <p className="text-xs font-medium text-ink-700 dark:text-ink-200">
                          {formatDateTime(log.created_at)}
                        </p>
                      </td>
                      <td className="text-xs font-semibold text-ink-800 dark:text-ink-100">
                        {log.product_name}
                      </td>
                      <td className="text-xs text-ink-500 dark:text-ink-400">{log.machine_name}</td>
                      <td>
                        <span className="chip bg-ink-50 text-ink-600 dark:bg-white/5 dark:text-ink-300">
                          {log.reason}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`font-mono text-xs font-bold ${
                            log.change >= 0
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-rose-600 dark:text-rose-400"
                          }`}
                        >
                          {log.change >= 0 ? "+" : ""}
                          {log.change}
                        </span>
                      </td>
                      <td className="font-mono text-xs text-ink-500 dark:text-ink-400">
                        {log.previous_quantity} → {log.new_quantity}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="panel">
            <EmptyState
              icon={History}
              title="No stock movements yet"
              description="Restocks and completed purchases will be recorded here."
            />
          </div>
        )}
      </div>

      <AdminFooterNote />

      <Modal
        open={Boolean(restocking)}
        onClose={saving ? () => {} : () => setRestocking(null)}
        title="Restock product"
        description={
          restocking
            ? `${restocking.product_name} · ${restocking.machine_name} · slot ${restocking.slot_code}`
            : ""
        }
        size="sm"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setRestocking(null)} disabled={saving}>
              Cancel
            </button>
            <button className="btn-primary" form="restock-form" type="submit" disabled={saving}>
              {saving && <Spinner className="h-4 w-4" />} Add stock
            </button>
          </>
        }
      >
        <form id="restock-form" onSubmit={submitRestock} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-ink-400">
                Current on hand
              </p>
              <p className="mt-1 font-display text-xl font-extrabold text-ink-950 dark:text-white">
                {restocking?.quantity} units
              </p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-ink-400">
                Reserved
              </p>
              <p className="mt-1 font-display text-xl font-extrabold text-ink-950 dark:text-white">
                {restocking?.reserved_quantity || 0} units
              </p>
            </div>
          </div>
          <div>
            <label className="label" htmlFor="restock-qty">
              Units to add
            </label>
            <input
              id="restock-qty"
              type="number"
              min="1"
              max="100000"
              className="input font-mono"
              value={restockQty}
              onChange={(event) => setRestockQty(event.target.value)}
              autoFocus
            />
          </div>
          <div>
            <label className="label" htmlFor="restock-reason">
              Reason
            </label>
            <input
              id="restock-reason"
              className="input"
              value={restockReason}
              onChange={(event) => setRestockReason(event.target.value)}
              maxLength={200}
            />
          </div>
          <p className="rounded-xl bg-lime-50 px-3.5 py-3 text-[11px] leading-relaxed text-lime-900 dark:bg-volt/[0.06] dark:text-lime-200">
            New level will be{" "}
            <strong>{Number(restocking?.quantity || 0) + Number(restockQty || 0)} units</strong>.
            The movement is logged and low-stock alerts are resolved automatically.
          </p>
        </form>
      </Modal>

      <Modal
        open={Boolean(thresholdItem)}
        onClose={saving ? () => {} : () => setThresholdItem(null)}
        title="Low-stock threshold"
        description={thresholdItem ? `Set an alert trigger for ${thresholdItem.product_name}.` : ""}
        size="sm"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setThresholdItem(null)} disabled={saving}>
              Cancel
            </button>
            <button className="btn-primary" form="threshold-form" type="submit" disabled={saving}>
              {saving && <Spinner className="h-4 w-4" />} Save threshold
            </button>
          </>
        }
      >
        <form id="threshold-form" onSubmit={submitThreshold} className="space-y-4">
          <div>
            <label className="label" htmlFor="threshold-input">
              Alert when available stock is at or below
            </label>
            <input
              id="threshold-input"
              type="number"
              min="0"
              max="10000"
              className="input font-mono"
              value={thresholdValue}
              onChange={(event) => setThresholdValue(event.target.value)}
              autoFocus
            />
          </div>
          <p className="text-xs leading-relaxed text-ink-400">
            The current available quantity is{" "}
            <strong className="text-ink-700 dark:text-ink-200">
              {thresholdItem?.available_quantity || 0}
            </strong>
            . Alerts appear on the dashboard and machines page.
          </p>
        </form>
      </Modal>
    </div>
  );
}

export default InventoryPage;
