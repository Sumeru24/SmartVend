import {
  CalendarDays,
  ChevronRight,
  Download,
  ReceiptText,
  RotateCcw,
  Search,
  SlidersHorizontal,
  TriangleAlert,
  WalletCards,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AdminFooterNote } from "../../layouts/AdminLayout";
import { EmptyState } from "../../components/ui/EmptyState";
import { PageHeader } from "../../components/ui/PageHeader";
import { Pagination } from "../../components/ui/Pagination";
import { TableSkeleton } from "../../components/ui/Spinner";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { useToast } from "../../context/ToastContext";
import { useDebounce } from "../../hooks/useDebounce";
import { adminService } from "../../services/admin";
import { apiErrorMessage } from "../../services/client";
import {
  formatCurrency,
  formatDateTime,
  formatNumber,
  stateLabel,
  STATE_META,
} from "../../utils/format";

const STATUSES = Object.keys(STATE_META);

export function TransactionsPage() {
  const [tab, setTab] = useState("transactions");
  const [data, setData] = useState({ items: [], total: 0, pages: 1 });
  const [refunds, setRefunds] = useState([]);
  const [machines, setMachines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [status, setStatus] = useState("");
  const [machine, setMachine] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);
  const { error: toastError, success } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "Transactions · SmartVend";
    adminService
      .machines()
      .then(setMachines)
      .catch(() => {});
  }, []);

  useEffect(() => {
    let active = true;
    if (tab !== "transactions") return;
    setLoading(true);
    adminService
      .transactions({
        page,
        page_size: 15,
        search: debouncedSearch || undefined,
        status: status || undefined,
        machine_id: machine || undefined,
        from_date: fromDate || undefined,
        to_date: toDate || undefined,
      })
      .then((result) => {
        if (active) {
          setData(result);
          setError("");
        }
      })
      .catch((err) => {
        if (active) {
          const message = apiErrorMessage(err);
          setError(message);
          toastError(message);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, page, debouncedSearch, status, machine, fromDate, toDate]);

  useEffect(() => {
    let active = true;
    if (tab !== "refunds") return;
    setLoading(true);
    adminService
      .refunds()
      .then((rows) => {
        if (active) setRefunds(rows);
      })
      .catch((err) => {
        if (active) toastError(apiErrorMessage(err, "Could not load refunds."));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, status, machine, fromDate, toDate]);

  const clearFilters = () => {
    setSearch("");
    setStatus("");
    setMachine("");
    setFromDate("");
    setToDate("");
    setPage(1);
  };

  const exportTransactions = async () => {
    setExporting(true);
    try {
      await adminService.exportReport("csv", "transactions");
      success("Transaction CSV downloaded.");
    } catch (err) {
      toastError(apiErrorMessage(err, "Export failed."));
    } finally {
      setExporting(false);
    }
  };

  const hasFilters = search || status || machine || fromDate || toDate;

  return (
    <div className="admin-page">
      <PageHeader
        eyebrow="Audit & control"
        title="Transactions"
        description="Every purchase is a persisted automaton run. Inspect payment, inventory and transition evidence down to the guard."
        actions={
          <>
            <button className="btn-secondary" onClick={exportTransactions} disabled={exporting}>
              <Download className="h-4 w-4" /> {exporting ? "Exporting…" : "Export CSV"}
            </button>
            <button
              className={`btn-secondary ${tab === "refunds" ? "border-ink-400" : ""}`}
              onClick={() => setTab(tab === "refunds" ? "transactions" : "refunds")}
            >
              <RotateCcw className="h-4 w-4" /> Refunds
            </button>
          </>
        }
      />

      <div className="mb-4 flex rounded-xl border border-ink-200 bg-white p-1 shadow-sm dark:border-white/10 dark:bg-[#121710] sm:w-fit">
        <button
          onClick={() => setTab("transactions")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition sm:flex-none ${
            tab === "transactions"
              ? "bg-ink-950 text-white dark:bg-volt dark:text-ink-950"
              : "text-ink-500 hover:text-ink-900 dark:text-ink-400 dark:hover:text-white"
          }`}
        >
          <ReceiptText className="h-3.5 w-3.5" /> All transactions
          <span className="rounded-full bg-white/15 px-1.5 py-0.5 text-[9px] dark:bg-ink-950/10">
            {data.total}
          </span>
        </button>
        <button
          onClick={() => setTab("refunds")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition sm:flex-none ${
            tab === "refunds"
              ? "bg-ink-950 text-white dark:bg-volt dark:text-ink-950"
              : "text-ink-500 hover:text-ink-900 dark:text-ink-400 dark:hover:text-white"
          }`}
        >
          <RotateCcw className="h-3.5 w-3.5" /> Refunds
        </button>
      </div>

      {tab === "transactions" ? (
        <>
          <div className="mb-4 rounded-2xl border border-ink-200/70 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-[#121710]">
            <div className="flex flex-col gap-2.5 xl:flex-row xl:items-center">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
                <input
                  className="input border-0 bg-transparent pl-10 shadow-none focus:ring-0 dark:bg-transparent"
                  placeholder="Search reference, product or machine…"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="hidden text-ink-300 xl:block">
                  <SlidersHorizontal className="h-4 w-4" />
                </span>
                <select
                  className="input w-auto bg-transparent py-2 text-xs"
                  value={status}
                  onChange={(event) => setStatus(event.target.value)}
                  aria-label="Filter by status"
                >
                  <option value="">All statuses</option>
                  {STATUSES.map((item) => (
                    <option key={item} value={item}>
                      {stateLabel(item)}
                    </option>
                  ))}
                </select>
                <select
                  className="input w-auto bg-transparent py-2 text-xs"
                  value={machine}
                  onChange={(event) => setMachine(event.target.value)}
                  aria-label="Filter by machine"
                >
                  <option value="">All machines</option>
                  {machines.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
                <div className="relative">
                  <CalendarDays className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400" />
                  <input
                    type="date"
                    className="input w-auto bg-transparent py-2 pl-8 text-xs"
                    value={fromDate}
                    onChange={(event) => setFromDate(event.target.value)}
                    aria-label="From date"
                  />
                </div>
                <span className="text-xs text-ink-300">to</span>
                <div className="relative">
                  <CalendarDays className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400" />
                  <input
                    type="date"
                    className="input w-auto bg-transparent py-2 pl-8 text-xs"
                    value={toDate}
                    onChange={(event) => setToDate(event.target.value)}
                    aria-label="To date"
                  />
                </div>
                {hasFilters && (
                  <button
                    className="rounded-lg px-2.5 py-2 text-[11px] font-bold text-ink-500 hover:bg-ink-50 dark:text-ink-300 dark:hover:bg-white/5"
                    onClick={clearFilters}
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          </div>

          {loading ? (
            <TableSkeleton rows={8} columns={6} />
          ) : error ? (
            <div className="panel">
              <EmptyState
                icon={TriangleAlert}
                title="Could not load transactions"
                description={error}
                action={<button className="btn-primary" onClick={() => setPage(page)}>Retry</button>}
              />
            </div>
          ) : data.items.length ? (
            <>
              <div className="table-shell">
                <div className="overflow-x-auto">
                  <table>
                    <thead>
                      <tr>
                        <th>Reference</th>
                        <th>Items</th>
                        <th>Machine</th>
                        <th>Payment</th>
                        <th>Status</th>
                        <th className="text-right">Total</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {data.items.map((transaction) => (
                        <tr
                          key={transaction.reference}
                          className="cursor-pointer"
                          onClick={() => navigate(`/admin/transactions/${transaction.reference}`)}
                        >
                          <td>
                            <p className="font-mono text-[11px] font-bold text-ink-800 dark:text-ink-100">
                              {transaction.reference}
                            </p>
                            <p className="mt-0.5 text-[10px] text-ink-400">
                              {formatDateTime(transaction.started_at)}
                            </p>
                          </td>
                          <td>
                            <p className="max-w-[210px] truncate text-xs font-medium text-ink-700 dark:text-ink-200">
                              {transaction.item_names?.slice(0, 2).join(", ") || "—"}
                            </p>
                            <p className="mt-0.5 text-[10px] text-ink-400">
                              {formatNumber(transaction.item_count)} item
                              {transaction.item_count === 1 ? "" : "s"}
                            </p>
                          </td>
                          <td className="text-xs text-ink-500 dark:text-ink-400">
                            {transaction.machine_name}
                          </td>
                          <td>
                            <div className="flex items-center gap-2">
                              <span className="grid h-7 w-7 place-items-center rounded-lg bg-ink-50 text-ink-500 dark:bg-white/5 dark:text-ink-300">
                                <WalletCards className="h-3.5 w-3.5" />
                              </span>
                              <div>
                                <p className="text-[10px] font-bold uppercase text-ink-600 dark:text-ink-300">
                                  {transaction.payment_method || "None"}
                                </p>
                                <p className="text-[9px] text-ink-400">
                                  {formatCurrency(transaction.amount_paid_paise)} paid
                                </p>
                              </div>
                            </div>
                          </td>
                          <td>
                            <StatusBadge state={transaction.current_state} />
                          </td>
                          <td className="text-right">
                            <p className="font-mono text-xs font-bold text-ink-900 dark:text-white">
                              {formatCurrency(transaction.total_paise)}
                            </p>
                            {transaction.change_paise > 0 && (
                              <p className="text-[9px] text-ink-400">
                                change {formatCurrency(transaction.change_paise)}
                              </p>
                            )}
                          </td>
                          <td>
                            <ChevronRight className="h-4 w-4 text-ink-300" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <Pagination
                  page={data.page}
                  pages={data.pages}
                  total={data.total}
                  pageSize={data.page_size}
                  onPage={setPage}
                />
                <span className="hidden text-[10px] font-medium text-ink-400 sm:block">
                  Updates live · last refresh now
                </span>
              </div>
            </>
          ) : (
            <div className="panel">
              <EmptyState
                icon={ReceiptText}
                title={hasFilters ? "No matching transactions" : "No transactions yet"}
                description={
                  hasFilters
                    ? "Try widening the date range or clearing the filters."
                    : "Complete a vending purchase and its full FSM run will appear here."
                }
                action={
                  hasFilters ? (
                    <button className="btn-secondary" onClick={clearFilters}>
                      Clear filters
                    </button>
                  ) : null
                }
              />
            </div>
          )}
        </>
      ) : loading ? (
        <TableSkeleton rows={5} columns={5} />
      ) : refunds.length ? (
        <div className="table-shell">
          <div className="flex items-center justify-between border-b border-ink-100 px-5 py-4 dark:border-white/[0.07]">
            <div>
              <p className="section-kicker">Recovery ledger</p>
              <h2 className="mt-1 font-display text-base font-bold text-ink-950 dark:text-white">
                Processed refunds
              </h2>
            </div>
            <span className="text-[10px] font-medium text-ink-400">
              {formatCurrency(refunds.reduce((total, refund) => total + refund.amount_paise, 0))} returned
            </span>
          </div>
          <div className="overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Machine</th>
                  <th>Reason</th>
                  <th>Provider ref</th>
                  <th>Status</th>
                  <th className="text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {refunds.map((refund) => (
                  <tr
                    key={refund.id}
                    className="cursor-pointer"
                    onClick={() =>
                      navigate(`/admin/transactions/${refund.transaction_reference}`)
                    }
                  >
                    <td>
                      <p className="font-mono text-[11px] font-bold text-ink-800 dark:text-ink-100">
                        {refund.transaction_reference}
                      </p>
                      <p className="mt-0.5 text-[10px] text-ink-400">
                        {formatDateTime(refund.created_at)}
                      </p>
                    </td>
                    <td className="text-xs text-ink-500 dark:text-ink-400">
                      {refund.machine_name}
                    </td>
                    <td className="max-w-[250px] text-xs text-ink-600 dark:text-ink-300">
                      {refund.reason}
                    </td>
                    <td className="font-mono text-[10px] text-ink-400">{refund.provider_ref}</td>
                    <td>
                      <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold capitalize text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
                        {refund.status}
                      </span>
                    </td>
                    <td className="text-right font-mono text-xs font-bold text-ink-900 dark:text-white">
                      {formatCurrency(refund.amount_paise)}
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
            icon={RotateCcw}
            title="No refunds processed"
            description="Cancellations with captured funds and failed dispenses create refund records automatically."
          />
        </div>
      )}

      <AdminFooterNote />
    </div>
  );
}

export default TransactionsPage;
