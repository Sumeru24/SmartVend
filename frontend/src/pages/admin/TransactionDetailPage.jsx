import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleDollarSign,
  Clock3,
  Cpu,
  Download,
  Info,
  Printer,
  ReceiptText,
  RotateCcw,
  ShieldCheck,
  Store,
  WalletCards,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ImageWithFallback } from "../../components/ImageWithFallback";
import { AdminFooterNote } from "../../layouts/AdminLayout";
import { EmptyState } from "../../components/ui/EmptyState";
import { Modal } from "../../components/ui/Modal";
import { PageLoader } from "../../components/ui/Spinner";
import { Spinner } from "../../components/ui/Spinner";
import { MachineStatusBadge, StatusBadge } from "../../components/ui/StatusBadge";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { adminService } from "../../services/admin";
import { apiErrorMessage } from "../../services/client";
import {
  formatCurrency,
  formatDateTime,
  formatTime,
  stateLabel,
  titleCase,
} from "../../utils/format";

function StateIcon({ accepted, state }) {
  if (!accepted) {
    return (
      <span className="grid h-7 w-7 place-items-center rounded-full border border-rose-200 bg-rose-50 text-rose-600 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-400">
        <X className="h-3.5 w-3.5" />
      </span>
    );
  }
  if (state === "COMPLETED") {
    return (
      <span className="grid h-7 w-7 place-items-center rounded-full bg-emerald-500 text-white">
        <Check className="h-3.5 w-3.5" />
      </span>
    );
  }
  return (
    <span className="grid h-7 w-7 place-items-center rounded-full border border-ink-200 bg-white text-ink-500 dark:border-white/10 dark:bg-[#151b13] dark:text-ink-300">
      <ArrowRight className="h-3.5 w-3.5" />
    </span>
  );
}

export function TransactionDetailPage() {
  const { reference } = useParams();
  const [transaction, setTransaction] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refundOpen, setRefundOpen] = useState(false);
  const [reason, setReason] = useState("Customer refund requested");
  const [refunding, setRefunding] = useState(false);
  const { isAdmin } = useAuth();
  const { success, error: toastError } = useToast();
  const navigate = useNavigate();

  const load = async () => {
    try {
      const data = await adminService.transaction(reference);
      setTransaction(data);
      setError("");
    } catch (err) {
      setError(apiErrorMessage(err, "Could not load transaction."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    document.title = `${reference} · SmartVend`;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reference]);

  const submitRefund = async (event) => {
    event.preventDefault();
    if (reason.trim().length < 2) {
      toastError("Enter a refund reason with at least 2 characters.");
      return;
    }
    setRefunding(true);
    try {
      const updated = await adminService.refund(reference, reason.trim());
      setTransaction(updated);
      success("Refund processed through the FSM.");
      setRefundOpen(false);
    } catch (err) {
      toastError(apiErrorMessage(err, "Refund failed."));
    } finally {
      setRefunding(false);
    }
  };

  if (loading) return <PageLoader label="Loading transaction evidence" />;

  if (error || !transaction) {
    return (
      <div className="admin-page">
        <EmptyState
          title="Transaction not found"
          description={error}
          action={
            <button className="btn-primary" onClick={() => navigate("/admin/transactions")}>
              Back to transactions
            </button>
          }
        />
      </div>
    );
  }

  const canRefund =
    isAdmin && transaction.current_state === "COMPLETED" && !transaction.refunds?.length;
  const refundTotal = transaction.refunds?.reduce(
    (total, refund) => total + refund.amount_paise,
    0,
  );

  return (
    <div className="admin-page">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <button
          onClick={() => navigate("/admin/transactions")}
          className="inline-flex items-center gap-2 text-xs font-bold text-ink-500 transition hover:text-ink-950 dark:text-ink-400 dark:hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" /> All transactions
        </button>
        <div className="flex items-center gap-2">
          <button className="btn-secondary" onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> Print receipt
          </button>
          {canRefund && (
            <button className="btn-primary" onClick={() => setRefundOpen(true)}>
              <RotateCcw className="h-4 w-4" /> Refund purchase
            </button>
          )}
        </div>
      </div>

      <div className="mb-4 overflow-hidden rounded-3xl border border-ink-800 bg-ink-950 p-5 text-white shadow-lift dark:border-white/10 sm:p-6">
        <div className="relative z-10 flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-mono text-[11px] text-white/40">{transaction.reference}</p>
              <StatusBadge state={transaction.current_state} />
            </div>
            <h1 className="mt-3 font-display text-2xl font-extrabold tracking-[-0.035em] sm:text-3xl">
              {transaction.item_names?.slice(0, 3).join(" · ") || "Cart"}
            </h1>
            <p className="mt-2 flex items-center gap-2 text-xs text-white/40">
              <Store className="h-3.5 w-3.5" /> {transaction.machine_name} ·{" "}
              {formatDateTime(transaction.started_at)}
            </p>
            {transaction.error_message && (
              <div className="mt-4 flex max-w-lg items-start gap-2 rounded-xl border border-rose-400/20 bg-rose-500/10 p-3 text-xs leading-relaxed text-rose-200">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {transaction.error_message}
              </div>
            )}
          </div>
          <div className="grid grid-cols-3 gap-5 sm:text-right">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-white/30">
                Total
              </p>
              <p className="mt-1 font-display text-lg font-extrabold">
                {formatCurrency(transaction.total_paise)}
              </p>
            </div>
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-white/30">
                Paid
              </p>
              <p className="mt-1 font-display text-lg font-extrabold">
                {formatCurrency(transaction.amount_paid_paise)}
              </p>
            </div>
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-white/30">
                Change
              </p>
              <p className="mt-1 font-display text-lg font-extrabold">
                {formatCurrency(transaction.change_paise)}
              </p>
            </div>
          </div>
        </div>
        <div className="dot-grid pointer-events-none absolute inset-0 opacity-20" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.5fr_0.85fr]">
        <div className="space-y-4">
          <section className="panel overflow-hidden">
            <div className="flex items-center justify-between border-b border-ink-100 px-5 py-4 dark:border-white/[0.07]">
              <div>
                <p className="section-kicker">Automaton evidence</p>
                <h2 className="mt-1 font-display text-base font-bold text-ink-950 dark:text-white">
                  State transition log
                </h2>
              </div>
              <span className="rounded-full bg-ink-50 px-2.5 py-1 font-mono text-[10px] text-ink-500 dark:bg-white/5 dark:text-ink-300">
                δ · {transaction.state_logs.length} transitions
              </span>
            </div>
            <div className="px-5 py-5">
              {transaction.state_logs.length ? (
                <ol className="relative space-y-0">
                  <div className="absolute bottom-4 left-[13px] top-4 w-px bg-ink-100 dark:bg-white/10" />
                  {transaction.state_logs.map((log, index) => (
                    <li key={log.id} className="relative flex gap-3.5 pb-5 last:pb-0">
                      <div className="relative z-10 bg-white dark:bg-[#121710]">
                        <StateIcon accepted={log.accepted} state={log.next_state} />
                      </div>
                      <div className="min-w-0 flex-1 pt-0.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-[10px] font-bold text-ink-400">
                            {String(log.sequence).padStart(2, "0")}
                          </span>
                          <span className="font-mono text-[10px] font-semibold text-ink-600 dark:text-ink-300">
                            {log.previous_state}
                          </span>
                          <ArrowRight className="h-3 w-3 text-ink-300" />
                          <span className="rounded-md bg-lime-50 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wide text-lime-800 dark:bg-volt/10 dark:text-volt">
                            {log.event}
                          </span>
                          <ArrowRight className="h-3 w-3 text-ink-300" />
                          <span className="font-mono text-[10px] font-semibold text-ink-600 dark:text-ink-300">
                            {log.next_state || "REJECTED"}
                          </span>
                        </div>
                        <p className="mt-1.5 text-[11px] leading-relaxed text-ink-500 dark:text-ink-400">
                          {log.reason || periodReason(log)}
                        </p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-3">
                          <span className="text-[9px] text-ink-400">{formatTime(log.created_at)}</span>
                          {log.context_snapshot?.balance_paise !== undefined && (
                            <span className="text-[9px] text-ink-400">
                              balance {formatCurrency(log.context_snapshot.balance_paise)}
                            </span>
                          )}
                          {log.context_snapshot?.stock_reserved && (
                            <span className="text-[9px] font-semibold text-emerald-500">
                              stock reserved
                            </span>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="py-5 text-center text-xs text-ink-400">
                  No state logs yet. The transaction may still be at IDLE.
                </p>
              )}
            </div>
          </section>

          <section className="panel overflow-hidden">
            <div className="border-b border-ink-100 px-5 py-4 dark:border-white/[0.07]">
              <p className="section-kicker">Cart</p>
              <h2 className="mt-1 font-display text-base font-bold text-ink-950 dark:text-white">
                Items in this purchase
              </h2>
            </div>
            <div className="divide-y divide-ink-100 dark:divide-white/[0.06]">
              {transaction.items.map((item) => (
                <div key={item.id} className="flex items-center gap-3 px-5 py-3.5">
                  <ImageWithFallback
                    src={item.image_url}
                    alt={item.product_name}
                    className="h-11 w-11 shrink-0 rounded-xl object-cover"
                    fallbackLabel={item.product_name.slice(0, 1)}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold text-ink-800 dark:text-ink-100">
                      {item.product_name}
                    </p>
                    <p className="mt-0.5 text-[10px] text-ink-400">
                      {formatCurrency(item.unit_price_paise)} × {item.quantity}
                    </p>
                  </div>
                  <p className="font-mono text-xs font-bold text-ink-900 dark:text-white">
                    {formatCurrency(item.line_total_paise)}
                  </p>
                </div>
              ))}
            </div>
            <div className="border-t border-ink-100 bg-ink-50/50 px-5 py-4 dark:border-white/[0.07] dark:bg-white/[0.02]">
              <div className="flex justify-between text-xs">
                <span className="text-ink-500 dark:text-ink-400">Order total</span>
                <span className="font-bold text-ink-900 dark:text-white">
                  {formatCurrency(transaction.total_paise)}
                </span>
              </div>
              <div className="mt-1.5 flex justify-between text-xs">
                <span className="text-ink-500 dark:text-ink-400">Amount paid</span>
                <span className="font-bold text-ink-900 dark:text-white">
                  {formatCurrency(transaction.amount_paid_paise)}
                </span>
              </div>
              {transaction.change_paise > 0 && (
                <div className="mt-1.5 flex justify-between text-xs">
                  <span className="text-ink-500 dark:text-ink-400">Change returned</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(transaction.change_paise)}
                  </span>
                </div>
              )}
            </div>
          </section>
        </div>

        <div className="space-y-4">
          <section className="panel p-5">
            <p className="section-kicker">Payment record</p>
            <h2 className="mt-1 font-display text-base font-bold text-ink-950 dark:text-white">
              Payments & refunds
            </h2>
            <div className="mt-4 space-y-2.5">
              {transaction.payments.map((payment) => (
                <div
                  key={payment.id}
                  className="rounded-xl border border-ink-100 p-3.5 dark:border-white/[0.07]"
                >
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-2 text-xs font-bold capitalize text-ink-800 dark:text-ink-100">
                      <WalletCards className="h-3.5 w-3.5 text-ink-400" />
                      {payment.method}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[9px] font-bold capitalize ${
                        payment.status === "failed"
                          ? "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400"
                          : payment.status === "refunded"
                            ? "bg-fuchsia-50 text-fuchsia-600 dark:bg-fuchsia-500/10 dark:text-fuchsia-400"
                            : "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400"
                      }`}
                    >
                      {payment.status}
                    </span>
                  </div>
                  <div className="mt-2 flex items-end justify-between">
                    <span className="font-mono text-[9px] text-ink-400">
                      {payment.provider_ref}
                    </span>
                    <span className="font-mono text-xs font-bold text-ink-900 dark:text-white">
                      {formatCurrency(payment.amount_paise)}
                    </span>
                  </div>
                  <p className="mt-1 text-[9px] text-ink-400">
                    {formatDateTime(payment.created_at)}
                    {payment.is_simulated ? " · simulated" : ""}
                  </p>
                </div>
              ))}
              {!transaction.payments.length && (
                <p className="rounded-xl border border-dashed border-ink-200 p-4 text-center text-[11px] text-ink-400 dark:border-white/10">
                  No payment captured.
                </p>
              )}
              {transaction.refunds.map((refund) => (
                <div
                  key={refund.id}
                  className="rounded-xl border border-fuchsia-100 bg-fuchsia-50/50 p-3.5 dark:border-fuchsia-500/15 dark:bg-fuchsia-500/[0.05]"
                >
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-2 text-xs font-bold text-fuchsia-700 dark:text-fuchsia-300">
                      <RotateCcw className="h-3.5 w-3.5" /> Refund
                    </span>
                    <span className="font-mono text-xs font-bold text-fuchsia-800 dark:text-fuchsia-200">
                      {formatCurrency(refund.amount_paise)}
                    </span>
                  </div>
                  <p className="mt-1.5 text-[10px] leading-snug text-fuchsia-700/70 dark:text-fuchsia-300/60">
                    {refund.reason}
                  </p>
                </div>
              ))}
              {refundTotal > 0 && (
                <div className="flex items-center justify-between rounded-xl bg-ink-50 px-3.5 py-2.5 text-[10px] dark:bg-white/[0.03]">
                  <span className="font-semibold text-ink-500">Net refunded</span>
                  <span className="font-bold text-ink-900 dark:text-white">
                    {formatCurrency(refundTotal)}
                  </span>
                </div>
              )}
            </div>
          </section>

          <section className="panel p-5">
            <p className="section-kicker">Execution context</p>
            <h2 className="mt-1 font-display text-base font-bold text-ink-950 dark:text-white">
              Machine & timing
            </h2>
            <div className="mt-4 space-y-3.5">
              <div className="flex items-start gap-3">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-ink-50 text-ink-400 dark:bg-white/5">
                  <Store className="h-3.5 w-3.5" />
                </span>
                <div>
                  <p className="text-xs font-bold text-ink-800 dark:text-ink-100">
                    {transaction.machine_name}
                  </p>
                  <p className="mt-0.5 text-[10px] text-ink-400">Machine #{transaction.machine_id}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-ink-50 text-ink-400 dark:bg-white/5">
                  <Clock3 className="h-3.5 w-3.5" />
                </span>
                <div>
                  <p className="text-xs font-bold text-ink-800 dark:text-ink-100">
                    {formatDateTime(transaction.started_at)}
                  </p>
                  <p className="mt-0.5 text-[10px] text-ink-400">
                    {transaction.completed_at
                      ? `Ended ${formatDateTime(transaction.completed_at)}`
                      : "Awaiting completion"}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-ink-50 text-ink-400 dark:bg-white/5">
                  <Cpu className="h-3.5 w-3.5" />
                </span>
                <div>
                  <p className="text-xs font-bold text-ink-800 dark:text-ink-100">
                    EFSM version {transaction.version}
                  </p>
                  <p className="mt-0.5 text-[10px] text-ink-400">
                    Stock {transaction.stock_reserved ? "reserved" : "not held"} ·{" "}
                    {transaction.dispensed ? "dispensed" : "not dispensed"}
                  </p>
                </div>
              </div>
              {transaction.payment_method && (
                <div className="flex items-start gap-3">
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-ink-50 text-ink-400 dark:bg-white/5">
                    <CircleDollarSign className="h-3.5 w-3.5" />
                  </span>
                  <div>
                    <p className="text-xs font-bold capitalize text-ink-800 dark:text-ink-100">
                      {transaction.payment_method} payment
                    </p>
                    <p className="mt-0.5 text-[10px] text-ink-400">
                      {transaction.payments.length} payment record(s)
                    </p>
                  </div>
                </div>
              )}
            </div>
          </section>

          <div className="flex items-start gap-2.5 rounded-2xl border border-ink-200/70 bg-white p-4 dark:border-white/10 dark:bg-[#121710]">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <p className="text-[10px] leading-relaxed text-ink-400">
              This is a complete, immutable audit view of the persisted FSM run. Hardware dispensing
              is simulated; no physical product was released.
            </p>
          </div>
        </div>
      </div>

      {/* Printable digital receipt */}
      <div className="receipt-printable mt-4 hidden print:block">
        <div className="mx-auto max-w-xl p-6">
          <div className="flex items-start justify-between border-b-2 border-ink-950 pb-4">
            <div>
              <h2 className="text-2xl font-black">SmartVend</h2>
              <p className="text-xs">Finite Automata Vending · Digital Receipt</p>
            </div>
            <div className="text-right text-xs">
              <p className="font-bold">{transaction.reference}</p>
              <p>{formatDateTime(transaction.completed_at || transaction.started_at)}</p>
            </div>
          </div>
          <p className="mt-4 text-xs">
            {transaction.machine_name} · {formatDateTime(transaction.started_at)}
          </p>
          <table className="mt-5 w-full border-collapse text-xs">
            <thead>
              <tr className="border-b border-ink-300 text-left">
                <th className="py-2">Item</th>
                <th className="py-2 text-center">Qty</th>
                <th className="py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {transaction.items.map((item) => (
                <tr key={item.id} className="border-b border-ink-100">
                  <td className="py-2">{item.product_name}</td>
                  <td className="py-2 text-center">{item.quantity}</td>
                  <td className="py-2 text-right">{formatCurrency(item.line_total_paise)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="ml-auto mt-4 w-56 space-y-1 text-xs">
            <div className="flex justify-between">
              <span>Total</span>
              <strong>{formatCurrency(transaction.total_paise)}</strong>
            </div>
            <div className="flex justify-between">
              <span>Paid</span>
              <span>{formatCurrency(transaction.amount_paid_paise)}</span>
            </div>
            <div className="flex justify-between">
              <span>Change</span>
              <span>{formatCurrency(transaction.change_paise)}</span>
            </div>
          </div>
          <p className="mt-8 text-center text-[10px]">
            Status: {stateLabel(transaction.current_state)} · Payment:{" "}
            {transaction.payment_method || "—"} · Dispensing simulated
          </p>
          <p className="mt-1 text-center text-[9px]">Thank you for choosing SmartVend.</p>
        </div>
      </div>

      <AdminFooterNote />

      <Modal
        open={refundOpen}
        onClose={refunding ? () => {} : () => setRefundOpen(false)}
        title="Refund this purchase"
        description={`Refund ${formatCurrency(Math.min(transaction.total_paise, transaction.amount_paid_paise))} through the simulated payment gateway.`}
        size="sm"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setRefundOpen(false)} disabled={refunding}>
              Cancel
            </button>
            <button className="btn-danger" form="refund-form" type="submit" disabled={refunding}>
              {refunding && <Spinner className="h-4 w-4" />} Process refund
            </button>
          </>
        }
      >
        <form id="refund-form" onSubmit={submitRefund} className="space-y-4">
          <div className="rounded-xl bg-amber-50 p-3.5 text-[11px] leading-relaxed text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
            This executes <span className="font-mono font-bold">CANCEL_TRANSACTION</span> (COMPLETED →
            REFUNDING) followed by <span className="font-mono font-bold">PROCESS_REFUND</span>{" "}
            (REFUNDING → CANCELLED). The action is logged permanently.
          </div>
          <div>
            <label className="label" htmlFor="refund-reason">
              Reason
            </label>
            <textarea
              id="refund-reason"
              className="input min-h-[90px] resize-y"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={300}
              required
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}

function periodReason(log) {
  return log.next_state
    ? `Transition to ${stateLabel(log.next_state)}.`
    : "Transition rejected.";
}

export default TransactionDetailPage;
