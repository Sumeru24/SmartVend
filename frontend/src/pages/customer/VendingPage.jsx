import {
  ArrowLeft,
  ArrowRight,
  Banknote,
  Check,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  Coins,
  Cpu,
  History,
  LockKeyhole,
  Minus,
  PackageCheck,
  Plus,
  Printer,
  ReceiptText,
  RotateCcw,
  Search,
  ShieldCheck,
  ShoppingBag,
  ShoppingBasket,
  Smartphone,
  Sparkles,
  Store,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { EmptyState } from "../../components/ui/EmptyState";
import { ImageWithFallback } from "../../components/ImageWithFallback";
import { Logo } from "../../components/Logo";
import { Modal } from "../../components/ui/Modal";
import { Spinner } from "../../components/ui/Spinner";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { ThemeToggle } from "../../components/ui/ThemeToggle";
import { useToast } from "../../context/ToastContext";
import { catalogService } from "../../services/catalog";
import { transactionService } from "../../services/transactions";
import { apiErrorMessage } from "../../services/client";
import {
  formatCurrency,
  formatDateTime,
  relativeTime,
  titleCase,
} from "../../utils/format";

const HISTORY_KEY = "smartvend_receipt_history";
const COIN_OPTIONS = [
  { label: "₹1", value: 100 },
  { label: "₹2", value: 200 },
  { label: "₹5", value: 500 },
  { label: "₹10", value: 1000 },
  { label: "₹20", value: 2000 },
];
const NOTE_OPTIONS = [
  { label: "₹10", value: 1000 },
  { label: "₹20", value: 2000 },
  { label: "₹50", value: 5000 },
  { label: "₹100", value: 10000 },
  { label: "₹200", value: 20000 },
  { label: "₹500", value: 50000 },
  { label: "₹1,000", value: 100000 },
  { label: "₹2,000", value: 200000 },
];
const PENDING_STATES = ["PAYMENT_PENDING"];
const LOCKED_STATES = ["PAYMENT_ACCEPTED"];
const TERMINAL_STATES = ["COMPLETED", "CANCELLED", "ERROR"];

function readHistory() {
  try {
    const raw = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
    return Array.isArray(raw) ? raw.filter((ref) => typeof ref === "string") : [];
  } catch {
    return [];
  }
}

function traceEntry(step) {
  return {
    ...step,
    traceId:
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`,
    rejected: !step.accepted,
  };
}

function QuantityControl({ quantity, stock, onChange, disabled }) {
  return (
    <div className="flex items-center rounded-xl border border-ink-200 bg-white p-0.5 dark:border-white/10 dark:bg-white/5">
      <button
        type="button"
        onClick={() => onChange(quantity - 1)}
        disabled={disabled}
        className="grid h-8 w-8 place-items-center rounded-lg text-ink-500 transition hover:bg-ink-100 disabled:opacity-40 dark:text-ink-300 dark:hover:bg-white/10"
        aria-label="Decrease quantity"
      >
        <Minus className="h-3.5 w-3.5" />
      </button>
      <span className="w-7 text-center text-xs font-extrabold text-ink-900 dark:text-white">
        {quantity}
      </span>
      <button
        type="button"
        onClick={() => onChange(quantity + 1)}
        disabled={disabled || quantity >= stock}
        className="grid h-8 w-8 place-items-center rounded-lg text-ink-500 transition hover:bg-ink-100 disabled:opacity-30 dark:text-ink-300 dark:hover:bg-white/10"
        aria-label="Increase quantity"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function ProductCard({ product, quantity, onAdd, onQuantity, busy }) {
  const soldOut = product.stock <= 0;
  const low = product.stock > 0 && product.stock <= 3;
  return (
    <article className="group panel flex flex-col overflow-hidden transition duration-300 hover:-translate-y-0.5 hover:shadow-lift">
      <div className="relative aspect-[4/3] overflow-hidden bg-ink-100 dark:bg-white/5">
        <ImageWithFallback
          src={product.image_url}
          alt={product.name}
          fallbackColor={product.category_color}
          fallbackLabel={product.category_name}
          className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
        />
        <span
          className="absolute left-3 top-3 rounded-full px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-[0.12em] text-white shadow-sm backdrop-blur"
          style={{ backgroundColor: `${product.category_color || "#84cc16"}dd` }}
        >
          {product.category_name}
        </span>
        <span
          className={`absolute right-3 top-3 rounded-full px-2 py-1 text-[9px] font-bold shadow-sm backdrop-blur ${
            soldOut
              ? "bg-ink-950/80 text-white"
              : low
                ? "bg-amber-400/95 text-amber-950"
                : "bg-white/90 text-ink-700"
          }`}
        >
          {soldOut ? "Sold out" : `${product.stock} left`}
        </span>
        <span className="absolute bottom-3 left-3 rounded-md bg-ink-950/70 px-2 py-1 font-mono text-[9px] font-semibold text-white/80">
          slot {product.slot_code}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="font-display text-[13px] font-extrabold leading-tight tracking-[-0.015em] text-ink-950 dark:text-white">
          {product.name}
        </h3>
        <p className="mt-1 line-clamp-2 flex-1 text-[10px] leading-relaxed text-ink-400">
          {product.description || "Freshly stocked and ready to vend."}
        </p>
        <div className="mt-3 flex items-end justify-between gap-2">
          <div>
            <p className="font-display text-lg font-extrabold tracking-[-0.03em] text-ink-950 dark:text-white">
              {formatCurrency(product.price_paise)}
            </p>
            <p className="text-[9px] text-ink-400">incl. taxes</p>
          </div>
          {quantity ? (
            <QuantityControl
              quantity={quantity}
              stock={product.stock}
              onChange={(next) => onQuantity(product, next)}
              disabled={busy}
            />
          ) : (
            <button
              type="button"
              className="btn-primary h-9 px-3 text-[11px]"
              onClick={() => onAdd(product)}
              disabled={soldOut || busy}
            >
              {soldOut ? (
                "Sold out"
              ) : (
                <>
                  <Plus className="h-3.5 w-3.5" /> Add
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

function CartContents({
  cart,
  totalPaise,
  onQuantity,
  onRemove,
  onCheckout,
  busy,
  machineOnline,
  compact = false,
}) {
  const count = cart.reduce((sum, item) => sum + item.quantity, 0);
  if (!cart.length) {
    return (
      <div className="flex flex-col items-center justify-center px-5 py-10 text-center">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-ink-50 text-ink-300 dark:bg-white/5 dark:text-ink-500">
          <ShoppingBag className="h-6 w-6" />
        </span>
        <p className="mt-4 font-display text-sm font-bold text-ink-900 dark:text-white">
          Your tray is empty
        </p>
        <p className="mt-1 max-w-[190px] text-[11px] leading-relaxed text-ink-400">
          Add something tasty from the machine. Stock is reserved only when you start checkout.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className={`divide-y divide-ink-100 dark:divide-white/[0.06] ${compact ? "" : "max-h-[380px] overflow-y-auto"}`}>
        {cart.map((item) => (
          <div key={item.product_id} className="flex items-center gap-3 p-4">
            <ImageWithFallback
              src={item.image_url}
              alt={item.name}
              fallbackColor={item.category_color}
              fallbackLabel={item.category_name}
              className="h-12 w-12 shrink-0 rounded-xl object-cover"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] font-bold text-ink-900 dark:text-white">
                {item.name}
              </p>
              <p className="mt-0.5 text-[10px] text-ink-400">
                {formatCurrency(item.price_paise)} each
              </p>
              <div className="mt-2 flex items-center gap-2">
                <QuantityControl
                  quantity={item.quantity}
                  stock={item.stock}
                  onChange={(next) => onQuantity(item, next)}
                  disabled={busy}
                />
                <span className="ml-auto text-[11px] font-extrabold text-ink-900 dark:text-white">
                  {formatCurrency(item.price_paise * item.quantity)}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onRemove(item)}
              disabled={busy}
              className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-ink-300 transition hover:bg-rose-50 hover:text-rose-500 disabled:opacity-40 dark:hover:bg-rose-500/10"
              aria-label={`Remove ${item.name}`}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
      <div className="border-t border-ink-100 p-4 dark:border-white/[0.07]">
        <div className="flex items-center justify-between text-[11px] text-ink-400">
          <span>{count} item{count === 1 ? "" : "s"} · simulated tender</span>
          <span>Subtotal</span>
        </div>
        <div className="mt-2 flex items-end justify-between">
          <span className="font-display text-2xl font-extrabold tracking-[-0.04em] text-ink-950 dark:text-white">
            {formatCurrency(totalPaise)}
          </span>
          <span className="text-[9px] font-semibold uppercase tracking-wider text-ink-400">
            no hidden fees
          </span>
        </div>
        <button
          type="button"
          className="btn-primary mt-4 h-11 w-full"
          onClick={onCheckout}
          disabled={busy || !machineOnline}
        >
          {busy ? <Spinner className="h-4 w-4" /> : <LockKeyhole className="h-4 w-4" />}
          {machineOnline ? "Checkout securely" : "Machine unavailable"}
          {!busy && machineOnline && <ArrowRight className="h-4 w-4" />}
        </button>
        <p className="mt-2 flex items-center justify-center gap-1.5 text-[9px] text-ink-400">
          <Cpu className="h-3 w-3" /> Executes the persisted 13-state EFSM
        </p>
      </div>
    </>
  );
}

function TraceList({ trace, currentState }) {
  const last = trace.length - 1;
  return (
    <div className="rounded-2xl border border-ink-100 bg-ink-50/50 p-4 dark:border-white/[0.06] dark:bg-white/[0.02]">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink-400">
          Automaton trace
        </p>
        <StatusBadge state={currentState} />
      </div>
      <div className="mt-3 max-h-[270px] space-y-2 overflow-y-auto pr-1">
        {trace.length === 0 && (
          <p className="py-4 text-[11px] text-ink-400">
            The EFSM trace will appear after the first transition.
          </p>
        )}
        {trace.map((step, index) => (
          <div
            key={step.traceId || `${step.event}-${index}`}
            className={`rounded-xl border px-3 py-2 transition ${
              step.rejected
                ? "border-rose-200 bg-rose-50/80 dark:border-rose-500/20 dark:bg-rose-500/[0.06]"
                : index === last
                  ? "border-lime-300 bg-lime-50/80 dark:border-volt/30 dark:bg-volt/[0.06]"
                  : "border-ink-200/70 bg-white dark:border-white/[0.07] dark:bg-white/[0.02]"
            }`}
          >
            <div className="flex items-center gap-2">
              <span
                className={`grid h-4 w-4 shrink-0 place-items-center rounded-full text-[8px] ${
                  step.rejected
                    ? "bg-rose-500 text-white"
                    : "bg-ink-950 text-volt dark:bg-volt dark:text-ink-950"
                }`}
              >
                {step.rejected ? <X className="h-2.5 w-2.5" /> : <Check className="h-2.5 w-2.5" />}
              </span>
              <p className="truncate font-mono text-[9px] font-semibold text-ink-700 dark:text-ink-200">
                {step.event}
              </p>
              <span className="ml-auto font-mono text-[8px] text-ink-300">
                {step.sequence ? `#${String(step.sequence).padStart(2, "0")}` : ""}
              </span>
            </div>
            <p className="mt-1 pl-6 font-mono text-[9px] text-ink-400">
              {step.source}
              <span className="mx-1 text-ink-300">→</span>
              {step.rejected ? "rejected" : step.target || "?"}
            </p>
            <p className="mt-1 pl-6 text-[9px] leading-relaxed text-ink-400">
              {step.reason || step.description}
            </p>
          </div>
        ))}
      </div>
      <p className="mt-2 border-t border-dashed border-ink-200 pt-2 text-[8px] text-ink-300 dark:border-white/10 dark:text-ink-500">
        Every accepted or rejected event is validated and logged by the server.
      </p>
    </div>
  );
}

function ReceiptView({ receipt, onPrint, compact = false }) {
  if (!receipt) return null;
  return (
    <div
      className={`receipt-printable overflow-hidden rounded-2xl border border-dashed border-ink-300 bg-white text-ink-950 dark:border-white/20 dark:bg-white ${
        compact ? "" : ""
      }`}
    >
      <div className="bg-ink-950 px-6 py-5 text-center text-white">
        <div className="mx-auto grid h-10 w-10 place-items-center rounded-xl bg-volt">
          <div className="flex items-end gap-[2px]">
            <span className="h-4 w-[4px] rounded-[1px] bg-ink-950" />
            <span className="flex flex-col gap-[2px]">
              <span className="h-[4px] w-[4px] rounded-[1px] bg-ink-950" />
              <span className="h-[4px] w-[4px] rounded-[1px] bg-ink-950/60" />
            </span>
          </div>
        </div>
        <p className="mt-2 font-display text-base font-extrabold tracking-[-0.02em]">SmartVend</p>
        <p className="mt-0.5 text-[9px] uppercase tracking-[0.2em] text-white/40">
          Digital purchase receipt
        </p>
      </div>
      <div className="px-6 py-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-ink-400">
              Reference
            </p>
            <p className="mt-0.5 font-mono text-xs font-bold">{receipt.reference}</p>
          </div>
          <div className="text-right">
            <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-ink-400">
              Issued
            </p>
            <p className="mt-0.5 text-[10px] font-semibold">{formatDateTime(receipt.issued_at)}</p>
          </div>
        </div>
        <div className="mt-4 rounded-xl bg-ink-50 px-3.5 py-3">
          <p className="text-[10px] font-bold text-ink-800">{receipt.machine_name}</p>
          <p className="mt-0.5 text-[9px] text-ink-400">{receipt.machine_location}</p>
        </div>

        <div className="mt-4 divide-y divide-dashed divide-ink-200">
          {receipt.items.map((item) => (
            <div key={item.id || `${item.product_id}-${item.quantity}`} className="flex items-start justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold">{item.product_name}</p>
                <p className="mt-0.5 text-[9px] text-ink-400">
                  {item.quantity} × {formatCurrency(item.unit_price_paise)}
                </p>
              </div>
              <p className="text-[11px] font-bold">{formatCurrency(item.line_total_paise)}</p>
            </div>
          ))}
        </div>

        <div className="mt-3 space-y-1.5 border-t border-ink-200 pt-3 text-[10px]">
          <div className="flex justify-between text-ink-500">
            <span>Subtotal</span>
            <span>{formatCurrency(receipt.subtotal_paise)}</span>
          </div>
          <div className="flex justify-between font-bold text-ink-950">
            <span>Total</span>
            <span>{formatCurrency(receipt.total_paise)}</span>
          </div>
          <div className="flex justify-between text-ink-500">
            <span>Paid · {titleCase(receipt.payment_method || "simulated")}</span>
            <span>{formatCurrency(receipt.amount_paid_paise)}</span>
          </div>
          <div className="flex justify-between text-ink-500">
            <span>Change returned</span>
            <span>{formatCurrency(receipt.change_paise)}</span>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between rounded-xl bg-lime-50 px-3.5 py-3">
          <div className="flex items-center gap-2">
            <CircleCheck className="h-4 w-4 text-emerald-600" />
            <span className="text-[10px] font-bold text-emerald-800">Purchase complete</span>
          </div>
          <span className="text-[9px] font-semibold text-emerald-700">SIMULATED VEND</span>
        </div>

        <div className="mt-5 border-t border-dashed border-ink-200 pt-4 text-center">
          <p className="font-mono text-[9px] tracking-[0.2em] text-ink-400">
            {receipt.reference}
          </p>
          <p className="mt-2 text-[9px] leading-relaxed text-ink-400">
            Thank you for vending with SmartVend.
            <br />
            All payments and dispensing were simulated in software.
          </p>
        </div>
      </div>
      {onPrint && (
        <div className="no-print border-t border-ink-100 bg-ink-50 px-4 py-3">
          <button className="btn-secondary h-9 w-full text-[11px]" onClick={onPrint}>
            <Printer className="h-3.5 w-3.5" /> Print receipt
          </button>
        </div>
      )}
    </div>
  );
}

function PaymentPanel({
  transaction,
  busy,
  error,
  paymentTab,
  setPaymentTab,
  upiVpa,
  setUpiVpa,
  upiFailure,
  setUpiFailure,
  onPay,
  onDispense,
  dispenseFailure,
  setDispenseFailure,
  onCancel,
}) {
  const state = transaction.current_state;
  const due = Math.max(transaction.total_paise - transaction.amount_paid_paise, 0);
  const overpay = Math.max(transaction.amount_paid_paise - transaction.total_paise, 0);
  const terminal = TERMINAL_STATES.includes(state);

  if (terminal) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-6 text-center">
        <span
          className={`grid h-16 w-16 place-items-center rounded-3xl ${
            state === "COMPLETED"
              ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400"
              : "bg-ink-100 text-ink-500 dark:bg-white/5 dark:text-ink-300"
          }`}
        >
          {state === "COMPLETED" ? (
            <PackageCheck className="h-7 w-7" />
          ) : (
            <RotateCcw className="h-7 w-7" />
          )}
        </span>
        <h3 className="mt-4 font-display text-lg font-extrabold text-ink-950 dark:text-white">
          {state === "COMPLETED"
            ? "Enjoy your snacks."
            : state === "CANCELLED"
              ? "This order was safely closed."
              : "The machine hit an error."}
        </h3>
        <p className="mt-1.5 max-w-[290px] text-[11px] leading-relaxed text-ink-400">
          {state === "COMPLETED"
            ? "Your simulated dispensing finished and the digital receipt is ready."
            : state === "CANCELLED"
              ? "Any captured funds were automatically refunded through the recovery transitions."
              : "No stock change was committed. Review the trace and try again."}
        </p>
        <div className="mt-4 grid w-full max-w-[300px] grid-cols-2 gap-2">
          <div className="rounded-xl bg-ink-50 p-3 text-left dark:bg-white/[0.03]">
            <p className="text-[8px] font-bold uppercase tracking-wider text-ink-400">Paid</p>
            <p className="mt-1 font-display text-sm font-extrabold text-ink-900 dark:text-white">
              {formatCurrency(transaction.amount_paid_paise)}
            </p>
          </div>
          <div className="rounded-xl bg-ink-50 p-3 text-left dark:bg-white/[0.03]">
            <p className="text-[8px] font-bold uppercase tracking-wider text-ink-400">
              {state === "COMPLETED" ? "Change" : "Refunded"}
            </p>
            <p className="mt-1 font-display text-sm font-extrabold text-ink-900 dark:text-white">
              {formatCurrency(
                state === "COMPLETED"
                  ? transaction.change_paise
                  : transaction.refunds?.reduce((sum, refund) => sum + refund.amount_paise, 0) || overpay,
              )}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (state === "PAYMENT_ACCEPTED") {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-5 dark:border-emerald-500/20 dark:bg-emerald-500/[0.07]">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-emerald-500 text-white">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <div>
              <p className="font-display text-sm font-extrabold text-emerald-900 dark:text-emerald-300">
                Payment accepted
              </p>
              <p className="text-[10px] text-emerald-700/70 dark:text-emerald-400/70">
                Stock is reserved. Dispensing is now unlocked.
              </p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <div>
              <p className="text-[8px] font-bold uppercase tracking-wider text-emerald-700/60 dark:text-emerald-400/60">
                Total
              </p>
              <p className="mt-1 font-display text-sm font-extrabold text-emerald-950 dark:text-white">
                {formatCurrency(transaction.total_paise)}
              </p>
            </div>
            <div>
              <p className="text-[8px] font-bold uppercase tracking-wider text-emerald-700/60 dark:text-emerald-400/60">
                Paid
              </p>
              <p className="mt-1 font-display text-sm font-extrabold text-emerald-950 dark:text-white">
                {formatCurrency(transaction.amount_paid_paise)}
              </p>
            </div>
            <div>
              <p className="text-[8px] font-bold uppercase tracking-wider text-emerald-700/60 dark:text-emerald-400/60">
                Change
              </p>
              <p className="mt-1 font-display text-sm font-extrabold text-emerald-950 dark:text-white">
                {formatCurrency(overpay)}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-ink-200 p-4 dark:border-white/10">
          <div className="flex items-start gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400">
              <Cpu className="h-4 w-4" />
            </span>
            <div>
              <p className="text-[11px] font-bold text-ink-900 dark:text-white">
                Ready to dispense
              </p>
              <p className="mt-0.5 text-[10px] leading-relaxed text-ink-400">
                The simulated hardware adapter will release your items, deduct inventory and return
                any change through the FSM.
              </p>
            </div>
          </div>
          <label className="mt-3 flex cursor-pointer items-center gap-2 rounded-lg bg-ink-50 px-3 py-2 text-[9px] font-medium text-ink-500 dark:bg-white/[0.03] dark:text-ink-400">
            <input
              type="checkbox"
              checked={dispenseFailure}
              onChange={(event) => setDispenseFailure(event.target.checked)}
              className="h-3.5 w-3.5 rounded border-ink-300 text-ink-950 focus:ring-ink-400"
            />
            Demo: inject a simulated dispense failure (auto-refunds)
          </label>
          <button
            className="btn-primary mt-3 h-11 w-full"
            onClick={onDispense}
            disabled={busy}
          >
            {busy ? <Spinner className="h-4 w-4" /> : <Zap className="h-4 w-4" />}
            {busy ? "Dispensing…" : "Dispense now"}
          </button>
        </div>

        <button className="btn-secondary w-full text-rose-600 dark:text-rose-400" onClick={onCancel} disabled={busy}>
          <X className="h-4 w-4" /> Cancel and refund
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-ink-950 p-5 text-white">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/35">
              Amount due
            </p>
            <p className="mt-1 font-display text-4xl font-extrabold tracking-[-0.05em]">
              {formatCurrency(due)}
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-volt/15 px-2.5 py-1 text-[9px] font-bold text-volt">
            <LockKeyhole className="h-3 w-3" /> stock reserved
          </span>
        </div>
        <div className="mt-4 h-1 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-volt transition-all duration-500"
            style={{
              width: `${Math.min(
                (transaction.amount_paid_paise / Math.max(transaction.total_paise, 1)) * 100,
                100,
              )}%`,
            }}
          />
        </div>
        <div className="mt-2 flex justify-between text-[9px] text-white/40">
          <span>Paid {formatCurrency(transaction.amount_paid_paise)}</span>
          <span>Total {formatCurrency(transaction.total_paise)}</span>
        </div>
      </div>

      <div className="flex rounded-xl bg-ink-50 p-1 dark:bg-white/[0.04]">
        <button
          onClick={() => setPaymentTab("cash")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-[11px] font-bold transition ${
            paymentTab === "cash"
              ? "bg-white text-ink-950 shadow-sm dark:bg-white/10 dark:text-white"
              : "text-ink-400 hover:text-ink-700 dark:hover:text-ink-200"
          }`}
        >
          <Coins className="h-3.5 w-3.5" /> Cash
        </button>
        <button
          onClick={() => setPaymentTab("upi")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-[11px] font-bold transition ${
            paymentTab === "upi"
              ? "bg-white text-ink-950 shadow-sm dark:bg-white/10 dark:text-white"
              : "text-ink-400 hover:text-ink-700 dark:hover:text-ink-200"
          }`}
        >
          <Smartphone className="h-3.5 w-3.5" /> UPI
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-[10px] font-medium text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
          <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {error}
        </div>
      )}

      {paymentTab === "cash" ? (
        <div className="space-y-3">
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink-400">
                Coins
              </p>
              <span className="text-[8px] text-ink-300">RBI denominations</span>
            </div>
            <div className="grid grid-cols-5 gap-2">
              {COIN_OPTIONS.map((coin) => (
                <button
                  key={coin.value}
                  onClick={() => onPay("coin", coin.value)}
                  disabled={busy}
                  className="group rounded-full border-2 border-amber-300/70 bg-gradient-to-br from-amber-100 to-amber-200 px-1 py-2.5 text-[11px] font-extrabold text-amber-900 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md disabled:opacity-50 dark:border-amber-400/30 dark:from-amber-500/20 dark:to-amber-600/10 dark:text-amber-300"
                >
                  {coin.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink-400">
                Notes
              </p>
              <span className="inline-flex items-center gap-1 text-[8px] text-ink-300">
                <Banknote className="h-3 w-3" /> tap to insert
              </span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {NOTE_OPTIONS.map((note) => (
                <button
                  key={note.value}
                  onClick={() => onPay("note", note.value)}
                  disabled={busy}
                  className="rounded-lg border border-emerald-200 bg-gradient-to-br from-emerald-50 to-lime-50 px-1 py-2.5 text-[11px] font-extrabold text-emerald-900 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md disabled:opacity-50 dark:border-emerald-400/20 dark:from-emerald-500/15 dark:to-lime-500/5 dark:text-emerald-300"
                >
                  {note.label}
                </button>
              ))}
            </div>
          </div>
          <p className="text-center text-[9px] leading-relaxed text-ink-400">
            Simulated cash only. The machine records each accepted denomination and auto-detects
            sufficient balance.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <label className="label text-[11px]" htmlFor="upi-vpa">
              UPI ID
            </label>
            <div className="relative">
              <Smartphone className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
              <input
                id="upi-vpa"
                className="input pl-10"
                value={upiVpa}
                onChange={(event) => setUpiVpa(event.target.value)}
                placeholder="you@upi"
                autoComplete="off"
              />
            </div>
          </div>
          <div className="rounded-xl border border-dashed border-ink-200 p-3 dark:border-white/10">
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-ink-400">Payable now</span>
              <span className="font-display text-base font-extrabold text-ink-950 dark:text-white">
                {formatCurrency(due)}
              </span>
            </div>
            <button
              className="btn-primary mt-3 h-11 w-full"
              onClick={() => onPay("upi", due)}
              disabled={busy}
            >
              {busy ? <Spinner className="h-4 w-4" /> : <Smartphone className="h-4 w-4" />}
              {busy ? "Contacting simulator…" : "Complete simulated UPI"}
            </button>
          </div>
          <label className="flex cursor-pointer items-center gap-2 rounded-lg bg-ink-50 px-3 py-2 text-[9px] font-medium text-ink-500 dark:bg-white/[0.03] dark:text-ink-400">
            <input
              type="checkbox"
              checked={upiFailure}
              onChange={(event) => setUpiFailure(event.target.checked)}
              className="h-3.5 w-3.5 rounded border-ink-300 text-ink-950 focus:ring-ink-400"
            />
            Demo: simulate a declined UPI payment
          </label>
          <p className="flex items-start gap-1.5 text-[9px] leading-relaxed text-ink-400">
            <ShieldCheck className="mt-0.5 h-3 w-3 shrink-0" />
            No real payment is taken. UPI is simulated server-side and logged as a captured payment.
          </p>
        </div>
      )}

      <button className="btn-ghost w-full text-[11px] text-ink-400" onClick={onCancel} disabled={busy}>
        <X className="h-3.5 w-3.5" /> Cancel order
      </button>
    </div>
  );
}

export function VendingPage() {
  const [machines, setMachines] = useState([]);
  const [selectedMachineId, setSelectedMachineId] = useState(null);
  const [catalog, setCatalog] = useState(null);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [cart, setCart] = useState([]);
  const [busy, setBusy] = useState("");
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [transaction, setTransaction] = useState(null);
  const [trace, setTrace] = useState([]);
  const [receipt, setReceipt] = useState(null);
  const [receiptLoading, setReceiptLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");
  const [paymentTab, setPaymentTab] = useState("cash");
  const [upiVpa, setUpiVpa] = useState("demo@smartvend");
  const [upiFailure, setUpiFailure] = useState(false);
  const [dispenseFailure, setDispenseFailure] = useState(false);
  const [leaveConfirm, setLeaveConfirm] = useState(false);
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyItems, setHistoryItems] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [historyReceipt, setHistoryReceipt] = useState(null);
  const [historyRefs, setHistoryRefs] = useState(readHistory);
  const [historyNonce, setHistoryNonce] = useState(0);
  const { success, error: toastError, info } = useToast();

  const applyCatalog = (data, { pruneCart = false } = {}) => {
    setCatalog(data);
    if (pruneCart) {
      const byId = Object.fromEntries(data.products.map((product) => [product.id, product]));
      setCart((current) =>
        current
          .map((item) => {
            const product = byId[item.product_id];
            if (!product || product.stock <= 0) return null;
            return {
              ...item,
              stock: product.stock,
              price_paise: product.price_paise,
              quantity: Math.min(item.quantity, product.stock),
            };
          })
          .filter(Boolean),
      );
    }
  };

  const loadCatalog = async (machineId, options = {}) => {
    setCatalogLoading(true);
    try {
      const data = await catalogService.getCatalog(machineId);
      applyCatalog(data, options);
      setCatalogError("");
    } catch (err) {
      const message = apiErrorMessage(err, "Could not load the machine catalog.");
      setCatalogError(message);
    } finally {
      setCatalogLoading(false);
    }
  };

  useEffect(() => {
    document.title = "Vend something good · SmartVend";
    let active = true;
    async function bootstrap() {
      try {
        const rows = await catalogService.getMachines();
        if (!active) return;
        setMachines(rows);
        const preferred = rows.find((machine) => machine.status === "online") || rows[0];
        if (preferred) {
          setSelectedMachineId(preferred.id);
          await loadCatalog(preferred.id);
        } else {
          setCatalogLoading(false);
          setCatalogError("No vending machines are available right now.");
        }
      } catch (err) {
        if (!active) return;
        setCatalogLoading(false);
        setCatalogError(apiErrorMessage(err, "Could not reach the vending network."));
      }
    }
    bootstrap();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!historyOpen) return;
    let active = true;
    setHistoryLoading(true);
    transactionService
      .history(historyRefs)
      .then((rows) => {
        if (active) {
          setHistoryItems(rows);
          setHistoryError("");
        }
      })
      .catch((err) => {
        if (active) setHistoryError(apiErrorMessage(err, "Could not load receipt history."));
      })
      .finally(() => {
        if (active) setHistoryLoading(false);
      });
    return () => {
      active = false;
    };
  }, [historyOpen, historyRefs, historyNonce]);

  useEffect(() => {
    if (!checkoutOpen) setCartOpen(false);
  }, [checkoutOpen]);

  const selectedMachine = machines.find((machine) => machine.id === selectedMachineId);
  const machineOnline = selectedMachine?.status === "online" && catalog?.machine_status === "online";

  const products = catalog?.products || [];
  const categories = useMemo(() => {
    const map = new Map();
    products.forEach((product) => {
      if (!map.has(product.category_id)) {
        map.set(product.category_id, {
          id: product.category_id,
          name: product.category_name,
          color: product.category_color,
          count: 0,
        });
      }
      map.get(product.category_id).count += 1;
    });
    return [...map.values()];
  }, [products]);

  const visibleProducts = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return products.filter((product) => {
      if (category !== "all" && product.category_id !== category) return false;
      if (!needle) return true;
      return (
        product.name.toLowerCase().includes(needle) ||
        (product.description || "").toLowerCase().includes(needle) ||
        product.category_name.toLowerCase().includes(needle)
      );
    });
  }, [products, query, category]);

  const totalPaise = cart.reduce((sum, item) => sum + item.price_paise * item.quantity, 0);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const changeMachine = async (nextId) => {
    const id = Number(nextId);
    if (id === selectedMachineId) return;
    if (cart.length) {
      setCart([]);
      info("Tray cleared for the new machine.");
    }
    setSelectedMachineId(id);
    setQuery("");
    setCategory("all");
    await loadCatalog(id);
  };

  const addToCart = (product) => {
    if (product.stock <= 0) return;
    setCart((current) => {
      const existing = current.find((item) => item.product_id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) {
          info("That's all the stock in this slot.");
          return current;
        }
        return current.map((item) =>
          item.product_id === product.id ? { ...item, quantity: item.quantity + 1 } : item,
        );
      }
      return [
        ...current,
        {
          product_id: product.id,
          name: product.name,
          price_paise: product.price_paise,
          stock: product.stock,
          image_url: product.image_url,
          category_name: product.category_name,
          category_color: product.category_color,
          slot_code: product.slot_code,
          quantity: 1,
        },
      ];
    });
  };

  const setQuantity = (product, quantity) => {
    if (quantity <= 0) {
      removeFromCart(product);
      return;
    }
    setCart((current) =>
      current.map((item) =>
        item.product_id === product.product_id || item.product_id === product.id
          ? { ...item, quantity: Math.min(quantity, item.stock) }
          : item,
      ),
    );
  };

  const removeFromCart = (product) => {
    setCart((current) => current.filter((item) => item.product_id !== product.product_id && item.product_id !== product.id));
  };

  const appendTrace = (steps = []) => {
    if (!steps?.length) return;
    setTrace((current) => [...current, ...steps.map(traceEntry)]);
  };

  const pushRejection = ({ source, event, reason }) => {
    setTrace((current) => [
      ...current,
      traceEntry({
        accepted: false,
        source: source || transaction?.current_state || "IDLE",
        event,
        target: null,
        reason,
        description: "Transition rejected by the server-side EFSM guard.",
        sequence: null,
      }),
    ]);
  };

  const rememberTransaction = (reference) => {
    setHistoryRefs((current) => {
      const next = [reference, ...current.filter((value) => value !== reference)].slice(0, 30);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      return next;
    });
  };

  const startCheckout = async () => {
    if (!cart.length || !machineOnline) return;
    setBusy("create");
    setCheckoutError("");
    try {
      const created = await transactionService.create({
        machineId: selectedMachineId,
        items: cart.map((item) => ({ product_id: item.product_id, quantity: item.quantity })),
      });
      setTransaction(created);
      setTrace([]);
      appendTrace(created.transitions);
      setReceipt(null);
      setPaymentTab("cash");
      setCheckoutOpen(true);
      setCartOpen(false);
      success("Stock reserved. Complete your simulated payment.");
    } catch (err) {
      const message = apiErrorMessage(err, "Could not start the transaction.");
      setCheckoutError(message);
      toastError(message);
    } finally {
      setBusy("");
    }
  };

  const pay = async (method, amountPaise) => {
    if (!transaction || busy) return;
    if (method === "upi" && (!upiVpa.includes("@") || upiVpa.trim().length < 5)) {
      setCheckoutError("Enter a valid simulated UPI ID, for example demo@smartvend.");
      return;
    }
    const event =
      method === "coin" ? "INSERT_COIN" : method === "note" ? "INSERT_NOTE" : "PAYMENT_SUCCESS";
    setBusy("pay");
    setCheckoutError("");
    try {
      const result = await transactionService.pay(transaction.reference, {
        method,
        amountPaise,
        simulateFailure: method === "upi" ? upiFailure : false,
        upiVpa,
      });
      setTransaction(result.transaction);
      appendTrace(result.transitions);
      if (result.transaction.current_state === "PAYMENT_ACCEPTED") {
        success("Payment accepted — ready to dispense.");
      } else if (result.transaction.current_state === "CANCELLED") {
        success("The declined payment was closed with no charge.");
        rememberTransaction(result.transaction.reference);
      } else {
        info("Payment logged. Add more simulated funds to cover the total.");
      }
    } catch (err) {
      const message = apiErrorMessage(err, "Payment was rejected.");
      setCheckoutError(message);
      pushRejection({
        source: transaction.current_state,
        event: method === "upi" ? (upiFailure ? "PAYMENT_FAILED" : "PAYMENT_SUCCESS") : event,
        reason: message,
      });
      toastError(message);
    } finally {
      setBusy("");
    }
  };

  const fetchReceipt = async (reference) => {
    setReceiptLoading(true);
    try {
      const data = await transactionService.getReceipt(reference);
      setReceipt(data);
    } catch (err) {
      toastError(apiErrorMessage(err, "Could not generate the digital receipt."));
    } finally {
      setReceiptLoading(false);
    }
  };

  const runDispense = async () => {
    if (!transaction || busy) return;
    setBusy("dispense");
    setCheckoutError("");
    try {
      const result = await transactionService.dispense(transaction.reference);
      setTransaction(result.transaction);
      appendTrace(result.transitions);
      setCart([]);
      rememberTransaction(result.transaction.reference);
      if (result.transaction.current_state === "COMPLETED") {
        success("Dispensed. Your simulated receipt is ready.");
        await fetchReceipt(result.transaction.reference);
      } else {
        info(
          `Dispense failure handled safely. ${
            result.transaction.refunds?.length ? "Refund processed automatically." : "No charge retained."
          }`,
        );
      }
    } catch (err) {
      const message = apiErrorMessage(err, "Dispensing could not be completed.");
      setCheckoutError(message);
      pushRejection({ source: transaction.current_state, event: "DISPENSE_PRODUCT", reason: message });
      toastError(message);
    } finally {
      setBusy("");
    }
  };

  const cancelOrder = async () => {
    if (!transaction || busy) return;
    setBusy("cancel");
    try {
      const result = await transactionService.cancel(
        transaction.reference,
        "Customer cancelled from the vending kiosk.",
      );
      setTransaction(result.transaction);
      appendTrace(result.transitions);
      rememberTransaction(result.transaction.reference);
      setCancelConfirm(false);
      success(
        result.transaction.refunds?.length
          ? "Order cancelled and captured funds refunded."
          : "Order cancelled before any charge.",
      );
    } catch (err) {
      toastError(apiErrorMessage(err, "Could not cancel this transaction."));
    } finally {
      setBusy("");
    }
  };

  const resetCheckout = () => {
    setCheckoutOpen(false);
    setTransaction(null);
    setTrace([]);
    setReceipt(null);
    setReceiptLoading(false);
    setCheckoutError("");
    setUpiFailure(false);
    setDispenseFailure(false);
    setLeaveConfirm(false);
    setCancelConfirm(false);
    setPaymentTab("cash");
    setCart([]);
    loadCatalog(selectedMachineId);
  };

  const requestCloseCheckout = () => {
    if (busy) return;
    if (!transaction || TERMINAL_STATES.includes(transaction.current_state)) {
      resetCheckout();
      return;
    }
    setLeaveConfirm(true);
  };

  const confirmLeave = async () => {
    if (!transaction) {
      resetCheckout();
      return;
    }
    setBusy("cancel");
    try {
      await transactionService.cancel(
        transaction.reference,
        "Customer left checkout; stock reservation released.",
      );
      setLeaveConfirm(false);
      resetCheckout();
      info("Checkout closed. Reserved stock was released.");
    } catch (err) {
      setLeaveConfirm(false);
      toastError(apiErrorMessage(err, "Could not close checkout safely."));
    } finally {
      setBusy("");
    }
  };

  const openHistory = () => {
    setHistoryReceipt(null);
    setHistoryOpen(true);
  };

  const viewHistoryReceipt = async (reference) => {
    setHistoryLoading(true);
    try {
      const data = await transactionService.getReceipt(reference);
      setHistoryReceipt(data);
    } catch (err) {
      toastError(apiErrorMessage(err, "Could not fetch that receipt."));
    } finally {
      setHistoryLoading(false);
    }
  };

  const printReceipt = () => window.print();

  const filteredCount = visibleProducts.length;

  return (
    <div className="min-h-screen bg-[#f5f6f2] pb-24 dark:bg-[#0b0f0a] lg:pb-0">
      <div className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(ellipse_50%_35%_at_90%_0%,rgba(201,245,106,0.12),transparent),radial-gradient(circle_at_0%_80%,rgba(14,165,233,0.06),transparent_40%)]" />

      <header className="sticky top-0 z-40 border-b border-ink-200/70 bg-[#f5f6f2]/85 backdrop-blur-xl dark:border-white/[0.07] dark:bg-[#0b0f0a]/80">
        <div className="mx-auto flex h-[72px] max-w-[1480px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-6">
            <Link to="/vending" aria-label="SmartVend home">
              <Logo />
            </Link>
            <nav className="hidden items-center gap-1 md:flex">
              <Link
                to="/vending"
                className="rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-ink-950 shadow-sm ring-1 ring-ink-200/70 dark:bg-white/10 dark:text-white dark:ring-white/10"
              >
                Vending
              </Link>
              <Link
                to="/simulator"
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-ink-500 transition hover:bg-white/60 hover:text-ink-900 dark:text-ink-400 dark:hover:bg-white/5 dark:hover:text-white"
              >
                <Cpu className="h-3.5 w-3.5" /> FSM explorer
              </Link>
              <Link
                to="/admin"
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-ink-500 transition hover:bg-white/60 hover:text-ink-900 dark:text-ink-400 dark:hover:bg-white/5 dark:hover:text-white"
              >
                <Store className="h-3.5 w-3.5" /> Admin console
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <button className="btn-secondary h-9 gap-2 px-3 text-[11px]" onClick={openHistory}>
              <History className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Receipts</span>
              {historyRefs.length > 0 && (
                <span className="rounded-full bg-ink-950 px-1.5 py-0.5 text-[8px] font-bold text-white dark:bg-volt dark:text-ink-950">
                  {historyRefs.length}
                </span>
              )}
            </button>
            <ThemeToggle />
            <Link to="/simulator" className="btn-icon md:hidden" aria-label="FSM explorer">
              <Cpu className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-[1480px] px-4 pt-5 sm:px-6 lg:px-8">
        <section className="relative overflow-hidden rounded-[28px] bg-ink-950 text-white shadow-lift">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_80%_at_85%_0%,rgba(201,245,106,0.16),transparent),radial-gradient(circle_at_10%_100%,rgba(132,204,22,0.08),transparent_40%)]" />
          <div className="dot-grid absolute inset-0 opacity-25" />
          <div className="relative grid gap-6 p-6 sm:p-8 lg:grid-cols-[1.25fr_0.75fr] lg:items-center">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.16em] text-white/50">
                <Sparkles className="h-3 w-3 text-volt" />
                Finite-automata vending · every tap validated
              </span>
              <h1 className="mt-4 max-w-xl font-display text-[32px] font-extrabold leading-[1.02] tracking-[-0.045em] sm:text-[42px]">
                Good things,
                <br />
                <span className="text-volt">dispensed.</span>
              </h1>
              <p className="mt-3 max-w-md text-xs leading-relaxed text-white/40 sm:text-sm">
                Pick your snacks, pay with simulated coins, notes or UPI, and watch a persisted
                13-state EFSM guard every step. No real money, no physical hardware.
              </p>
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2">
                  <span className="relative flex h-2 w-2">
                    <span
                      className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${
                        machineOnline ? "bg-emerald-400" : "bg-amber-400"
                      }`}
                    />
                    <span
                      className={`relative inline-flex h-2 w-2 rounded-full ${
                        machineOnline ? "bg-emerald-400" : "bg-amber-400"
                      }`}
                    />
                  </span>
                  <span className="text-[10px] font-bold text-white/70">
                    {machineOnline
                      ? catalog?.machine_name || "Select a machine"
                      : selectedMachine?.status === "maintenance"
                        ? "Machine in maintenance"
                        : "Machine unavailable"}
                  </span>
                </div>
                <span className="inline-flex items-center gap-1.5 text-[10px] text-white/30">
                  <ShieldCheck className="h-3.5 w-3.5" /> payments simulated
                </span>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.055] p-4 backdrop-blur-md">
              <div className="flex items-center justify-between">
                <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-white/35">
                  Machine
                </p>
                <span className="inline-flex items-center gap-1 text-[9px] font-bold text-white/40">
                  <Store className="h-3 w-3" /> vending point
                </span>
              </div>
              <div className="relative mt-3">
                <select
                  value={selectedMachineId || ""}
                  onChange={(event) => changeMachine(event.target.value)}
                  disabled={checkoutOpen || Boolean(busy)}
                  aria-label="Select vending machine"
                  className="w-full appearance-none rounded-xl border border-white/10 bg-ink-900 px-3 py-2.5 pr-9 text-xs font-bold text-white outline-none transition focus:border-volt/50 disabled:opacity-60"
                >
                  {machines.map((machine) => (
                    <option key={machine.id} value={machine.id}>
                      {machine.name} · {machine.location} ({machine.status})
                    </option>
                  ))}
                </select>
                <ChevronRight className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 rotate-90 text-white/40" />
              </div>
              <div className="mt-3 flex items-center justify-between rounded-xl bg-ink-950/70 px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-volt/15 text-volt">
                    <Store className="h-3.5 w-3.5" />
                  </span>
                  <div>
                    <p className="text-[10px] font-bold text-white">{catalog?.machine_name || "—"}</p>
                    <p className="max-w-[190px] truncate text-[9px] text-white/35">
                      {selectedMachine?.location || "—"}
                    </p>
                  </div>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-[8px] font-extrabold uppercase tracking-wider ${
                    machineOnline
                      ? "bg-emerald-400/15 text-emerald-300"
                      : "bg-amber-400/15 text-amber-300"
                  }`}
                >
                  {selectedMachine?.status || "unknown"}
                </span>
              </div>
              <p className="mt-3 flex items-center gap-1.5 text-[9px] text-white/25">
                <Cpu className="h-3 w-3" /> Status gates every new cart in real time
              </p>
            </div>
          </div>
        </section>

        {!machineOnline && selectedMachine && (
          <div className="mt-3.5 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-[11px] text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/[0.08] dark:text-amber-300">
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              <strong>{selectedMachine.name}</strong> is currently{" "}
              <strong>{selectedMachine.status}</strong>. Browse the slot plan, but checkout will
              stay disabled until an operator brings it online.
            </p>
          </div>
        )}

        <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_330px] xl:grid-cols-[1fr_360px]">
          <div className="min-w-0">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="section-kicker">The machine menu</p>
                <h2 className="mt-1 font-display text-xl font-extrabold tracking-[-0.03em] text-ink-950 dark:text-white">
                  Pick your fix
                </h2>
              </div>
              <div className="relative w-full sm:w-[250px]">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search the machine…"
                  className="input h-10 pl-10 text-xs"
                  aria-label="Search products"
                />
              </div>
            </div>

            <div className="no-scrollbar -mx-1 mb-4 flex gap-2 overflow-x-auto px-1 pb-1">
              <button
                onClick={() => setCategory("all")}
                className={`shrink-0 rounded-full px-3.5 py-1.5 text-[10px] font-bold transition ${
                  category === "all"
                    ? "bg-ink-950 text-white dark:bg-volt dark:text-ink-950"
                    : "border border-ink-200 bg-white text-ink-500 hover:border-ink-300 dark:border-white/10 dark:bg-white/[0.03] dark:text-ink-300"
                }`}
              >
                All items · {products.length}
              </button>
              {categories.map((entry) => (
                <button
                  key={entry.id}
                  onClick={() => setCategory(entry.id)}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[10px] font-bold transition ${
                    category === entry.id
                      ? "bg-ink-950 text-white dark:bg-volt dark:text-ink-950"
                      : "border border-ink-200 bg-white text-ink-500 hover:border-ink-300 dark:border-white/10 dark:bg-white/[0.03] dark:text-ink-300"
                  }`}
                >
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: entry.color }}
                  />
                  {entry.name}
                  <span className="opacity-50">{entry.count}</span>
                </button>
              ))}
            </div>

            {catalogLoading ? (
              <div className="grid grid-cols-2 gap-3.5 xl:grid-cols-3">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div key={index} className="panel overflow-hidden">
                    <div className="skeleton aspect-[4/3] rounded-none" />
                    <div className="space-y-2 p-4">
                      <div className="skeleton h-3.5 w-3/4" />
                      <div className="skeleton h-3 w-full" />
                      <div className="skeleton h-8 w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : catalogError ? (
              <div className="panel">
                <EmptyState
                  icon={CircleAlert}
                  title="The machine is offline to the catalog"
                  description={catalogError}
                  action={
                    <button
                      className="btn-primary"
                      onClick={() => loadCatalog(selectedMachineId, { pruneCart: true })}
                    >
                      <RotateCcw className="h-4 w-4" /> Retry
                    </button>
                  }
                />
              </div>
            ) : visibleProducts.length ? (
              <div className="grid grid-cols-2 gap-3.5 xl:grid-cols-3">
                {visibleProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    quantity={cart.find((item) => item.product_id === product.id)?.quantity || 0}
                    onAdd={addToCart}
                    onQuantity={(item, next) => setQuantity(item, next)}
                    busy={Boolean(busy)}
                  />
                ))}
              </div>
            ) : (
              <div className="panel">
                <EmptyState
                  icon={Search}
                  title="No matching snacks"
                  description={
                    query
                      ? `Nothing in this machine matches “${query}”. Try another search or category.`
                      : "This category is empty in the selected machine."
                  }
                  action={
                    <button
                      className="btn-secondary"
                      onClick={() => {
                        setQuery("");
                        setCategory("all");
                      }}
                    >
                      Clear filters
                    </button>
                  }
                />
              </div>
            )}

            <div className="mt-4 flex items-center justify-between text-[10px] text-ink-400">
              <span>
                Showing {filteredCount} of {products.length} slots
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> live stock from
                inventory
              </span>
            </div>
          </div>

          <aside className="hidden lg:block">
            <div className="sticky top-[92px] panel overflow-hidden">
              <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3.5 dark:border-white/[0.07]">
                <div className="flex items-center gap-2">
                  <ShoppingBasket className="h-4 w-4 text-ink-400" />
                  <h2 className="font-display text-sm font-extrabold text-ink-950 dark:text-white">
                    Your tray
                  </h2>
                  {cartCount > 0 && (
                    <span className="rounded-full bg-volt px-2 py-0.5 text-[9px] font-extrabold text-ink-950">
                      {cartCount}
                    </span>
                  )}
                </div>
                {cart.length > 0 && (
                  <button
                    onClick={() => setCart([])}
                    className="text-[9px] font-bold text-ink-400 transition hover:text-rose-500"
                  >
                    Clear
                  </button>
                )}
              </div>
              <CartContents
                cart={cart}
                totalPaise={totalPaise}
                onQuantity={setQuantity}
                onRemove={removeFromCart}
                onCheckout={startCheckout}
                busy={busy === "create"}
                machineOnline={machineOnline}
              />
            </div>
            <div className="mt-3 rounded-2xl border border-dashed border-ink-200 p-3.5 dark:border-white/10">
              <p className="flex items-start gap-2 text-[9px] leading-relaxed text-ink-400">
                <Cpu className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Adding to the tray is local. The server reserves stock only after you press
                checkout, then validates each transition against EFSM guards.
              </p>
            </div>
          </aside>
        </div>

        <footer className="mt-8 flex flex-col items-center justify-between gap-2 border-t border-ink-200/60 py-5 text-[10px] text-ink-400 dark:border-white/[0.06] sm:flex-row">
          <span>SmartVend · finite automata vending management</span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-volt" />
            All payments & dispensing are simulated
          </span>
        </footer>
      </main>

      {cartCount > 0 && !checkoutOpen && !cartOpen && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-ink-200 bg-white/95 p-3 backdrop-blur-xl dark:border-white/10 dark:bg-[#121710]/95 lg:hidden">
          <button
            className="btn-primary h-12 w-full justify-between px-4"
            onClick={() => setCartOpen(true)}
          >
            <span className="flex items-center gap-2">
              <ShoppingBasket className="h-4 w-4" />
              {cartCount} item{cartCount === 1 ? "" : "s"}
            </span>
            <span className="flex items-center gap-2">
              {formatCurrency(totalPaise)}
              <ArrowRight className="h-4 w-4" />
            </span>
          </button>
        </div>
      )}

      <Modal
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        title="Your tray"
        description={`${cartCount} item${cartCount === 1 ? "" : "s"} ready for a guarded checkout.`}
        size="md"
      >
        <CartContents
          cart={cart}
          totalPaise={totalPaise}
          onQuantity={setQuantity}
          onRemove={removeFromCart}
          onCheckout={startCheckout}
          busy={busy === "create"}
          machineOnline={machineOnline}
          compact
        />
      </Modal>

      <Modal
        open={checkoutOpen}
        onClose={requestCloseCheckout}
        title="Secure EFSM checkout"
        description={
          transaction
            ? `${transaction.reference} · ${transaction.machine_name || catalog?.machine_name || ""}`
            : ""
        }
        size="full"
        footer={
          transaction && TERMINAL_STATES.includes(transaction.current_state) ? (
            <>
              <button className="btn-secondary" onClick={openHistory}>
                <History className="h-4 w-4" /> Receipt history
              </button>
              <button className="btn-primary" onClick={resetCheckout} disabled={Boolean(busy)}>
                Start a new order <ArrowRight className="h-4 w-4" />
              </button>
            </>
          ) : (
            <>
              <span className="mr-auto hidden items-center gap-1.5 text-[9px] text-ink-400 sm:flex">
                <ShieldCheck className="h-3.5 w-3.5" /> Server-side validation · integer paise
              </span>
              <button
                className="btn-secondary text-rose-600 dark:text-rose-400"
                onClick={() => setCancelConfirm(true)}
                disabled={Boolean(busy)}
              >
                <X className="h-4 w-4" /> Cancel order
              </button>
              <button className="btn-primary" onClick={requestCloseCheckout} disabled={Boolean(busy)}>
                Close
              </button>
            </>
          )
        }
      >
        {transaction && (
          <div className="grid gap-5 lg:grid-cols-[1.08fr_0.92fr]">
            <div className="min-w-0">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-ink-100 bg-white px-4 py-3 dark:border-white/[0.07] dark:bg-white/[0.02]">
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-ink-400">
                    Transaction
                  </p>
                  <p className="mt-0.5 font-mono text-xs font-bold text-ink-900 dark:text-white">
                    {transaction.reference}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge state={transaction.current_state} />
                  <span className="rounded-full bg-ink-50 px-2 py-1 font-mono text-[9px] text-ink-400 dark:bg-white/5">
                    v{transaction.version}
                  </span>
                </div>
              </div>

              {transaction.current_state === "COMPLETED" ? (
                receiptLoading ? (
                  <div className="flex min-h-[380px] items-center justify-center">
                    <div className="flex flex-col items-center gap-3">
                      <Spinner className="h-6 w-6 text-ink-950 dark:text-volt" />
                      <p className="text-[11px] text-ink-400">Generating your receipt…</p>
                    </div>
                  </div>
                ) : receipt ? (
                  <ReceiptView receipt={receipt} onPrint={printReceipt} />
                ) : (
                  <div className="rounded-2xl border border-dashed border-ink-200 p-6 text-center">
                    <ReceiptText className="mx-auto h-6 w-6 text-ink-300" />
                    <p className="mt-2 text-xs text-ink-400">Receipt could not be rendered.</p>
                    <button
                      className="btn-secondary mt-3"
                      onClick={() => fetchReceipt(transaction.reference)}
                    >
                      Try again
                    </button>
                  </div>
                )
              ) : (
                <PaymentPanel
                  transaction={transaction}
                  busy={Boolean(busy)}
                  error={checkoutError}
                  paymentTab={paymentTab}
                  setPaymentTab={setPaymentTab}
                  upiVpa={upiVpa}
                  setUpiVpa={setUpiVpa}
                  upiFailure={upiFailure}
                  setUpiFailure={setUpiFailure}
                  onPay={pay}
                  onDispense={runDispense}
                  dispenseFailure={dispenseFailure}
                  setDispenseFailure={setDispenseFailure}
                  onCancel={() => setCancelConfirm(true)}
                />
              )}
            </div>

            <div className="min-w-0">
              <div className="rounded-2xl border border-ink-100 bg-white p-4 dark:border-white/[0.07] dark:bg-white/[0.02]">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink-400">
                    Order summary
                  </p>
                  <span className="text-[9px] font-semibold text-ink-400">
                    {transaction.item_count} item{transaction.item_count === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="mt-3 divide-y divide-ink-100 dark:divide-white/[0.06]">
                  {transaction.items.map((item) => (
                    <div key={item.id} className="flex items-center gap-3 py-2.5">
                      <ImageWithFallback
                        src={item.image_url}
                        alt={item.product_name}
                        className="h-10 w-10 shrink-0 rounded-lg object-cover"
                        fallbackLabel={item.product_name.slice(0, 1)}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[10px] font-bold text-ink-800 dark:text-ink-100">
                          {item.product_name}
                        </p>
                        <p className="mt-0.5 text-[9px] text-ink-400">
                          {item.quantity} × {formatCurrency(item.unit_price_paise)}
                        </p>
                      </div>
                      <p className="text-[10px] font-bold text-ink-900 dark:text-white">
                        {formatCurrency(item.line_total_paise)}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="mt-2 space-y-1.5 border-t border-dashed border-ink-200 pt-3 text-[10px] dark:border-white/10">
                  <div className="flex justify-between text-ink-500 dark:text-ink-400">
                    <span>Subtotal</span>
                    <span>{formatCurrency(transaction.total_paise)}</span>
                  </div>
                  <div className="flex justify-between text-ink-500 dark:text-ink-400">
                    <span>Amount paid</span>
                    <span>{formatCurrency(transaction.amount_paid_paise)}</span>
                  </div>
                  <div className="flex justify-between font-extrabold text-ink-950 dark:text-white">
                    <span>Change due</span>
                    <span>
                      {formatCurrency(
                        Math.max(transaction.amount_paid_paise - transaction.total_paise, 0),
                      )}
                    </span>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2 rounded-xl bg-ink-50 px-3 py-2 dark:bg-white/[0.03]">
                  <Store className="h-3.5 w-3.5 text-ink-400" />
                  <div className="min-w-0">
                    <p className="truncate text-[9px] font-bold text-ink-700 dark:text-ink-200">
                      {transaction.machine_name || catalog?.machine_name}
                    </p>
                    <p className="text-[8px] text-ink-400">{selectedMachine?.location}</p>
                  </div>
                </div>
              </div>

              {transaction.current_state !== "COMPLETED" && (
                <div className="mt-3">
                  <TraceList trace={trace} currentState={transaction.current_state} />
                </div>
              )}

              {transaction.current_state === "CANCELLED" && (
                <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-[10px] text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/[0.08] dark:text-rose-300">
                  <div className="flex items-center gap-2 font-bold">
                    <CircleCheck className="h-4 w-4" /> Funds recovered safely
                  </div>
                  <p className="mt-1 leading-relaxed opacity-80">
                    {transaction.refunds?.length
                      ? `${formatCurrency(
                          transaction.refunds.reduce(
                            (sum, refund) => sum + refund.amount_paise,
                            0,
                          ),
                        )} was refunded via ${transaction.refunds[0]?.provider_ref || "the simulated gateway"}.`
                      : "No funds were captured, so no refund was required."}
                  </p>
                </div>
              )}

              <div className="mt-3 rounded-xl border border-dashed border-ink-200 px-3 py-2.5 dark:border-white/10">
                <p className="flex items-start gap-1.5 text-[8px] leading-relaxed text-ink-400">
                  <ReceiptText className="mt-0.5 h-3 w-3 shrink-0" />
                  Prices and balances are stored as integer paise. Payments, stock reservation and
                  dispensing are simulator-backed demos.
                </p>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        title={historyReceipt ? "Receipt" : "Your vending history"}
        description={
          historyReceipt
            ? "Reprint or review a previous simulated purchase."
            : "Receipt references are stored locally on this device and hydrated from the live API."
        }
        size="lg"
        footer={
          historyReceipt ? (
            <>
              <button className="btn-secondary" onClick={() => setHistoryReceipt(null)}>
                <ArrowLeft className="h-4 w-4" /> All receipts
              </button>
              <button className="btn-primary" onClick={printReceipt}>
                <Printer className="h-4 w-4" /> Print
              </button>
            </>
          ) : (
            <button className="btn-secondary" onClick={() => setHistoryOpen(false)}>
              Close
            </button>
          )
        }
      >
        {historyReceipt ? (
          <ReceiptView receipt={historyReceipt} compact />
        ) : historyLoading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner className="h-6 w-6" />
          </div>
        ) : historyError ? (
          <EmptyState
            icon={CircleAlert}
            title="Couldn't load receipts"
            description={historyError}
            action={
              <button
                className="btn-primary"
                onClick={() => setHistoryNonce((value) => value + 1)}
              >
                Retry
              </button>
            }
          />
        ) : historyItems.length ? (
          <div className="space-y-2">
            {historyItems.map((item) => (
              <div
                key={item.reference}
                className="flex flex-col gap-3 rounded-xl border border-ink-100 p-3.5 transition hover:bg-ink-50/60 dark:border-white/[0.07] dark:hover:bg-white/[0.03] sm:flex-row sm:items-center"
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-ink-50 text-ink-400 dark:bg-white/5">
                    <ReceiptText className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-mono text-[10px] font-bold text-ink-900 dark:text-white">
                        {item.reference}
                      </p>
                      <StatusBadge state={item.current_state} />
                    </div>
                    <p className="mt-1 truncate text-[10px] text-ink-400">
                      {item.item_names?.slice(0, 3).join(", ")}
                      {item.item_names?.length > 3 ? ` +${item.item_names.length - 3}` : ""}
                    </p>
                    <p className="mt-0.5 text-[9px] text-ink-300">
                      {formatDateTime(item.started_at)} · {relativeTime(item.started_at)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3 sm:justify-end">
                  <p className="font-display text-sm font-extrabold text-ink-950 dark:text-white">
                    {formatCurrency(item.total_paise)}
                  </p>
                  {item.current_state === "COMPLETED" ? (
                    <button
                      className="btn-secondary h-8 px-3 text-[10px]"
                      onClick={() => viewHistoryReceipt(item.reference)}
                    >
                      Receipt
                    </button>
                  ) : (
                    <span className="text-[9px] font-semibold capitalize text-ink-300">
                      {item.current_state.toLowerCase()}
                    </span>
                  )}
                </div>
              </div>
            ))}
            <p className="pt-2 text-center text-[9px] text-ink-300">
              Showing up to 30 local receipt references · receipts are issued by the backend.
            </p>
          </div>
        ) : (
          <EmptyState
            icon={History}
            title="No receipts on this device yet"
            description="Complete a simulated purchase and its receipt reference will live here for quick reprints."
            action={
              <button
                className="btn-primary"
                onClick={() => {
                  setHistoryOpen(false);
                  setCartOpen(false);
                }}
              >
                Browse the machine <ArrowRight className="h-4 w-4" />
              </button>
            }
          />
        )}
      </Modal>

      <ConfirmDialog
        open={leaveConfirm}
        onClose={() => setLeaveConfirm(false)}
        onConfirm={confirmLeave}
        loading={busy === "cancel"}
        title="Leave this checkout?"
        description="Stock is reserved for this order. Leaving will cancel the transaction and automatically refund any captured simulated funds."
        confirmLabel="Cancel & release stock"
        tone="warning"
      />
      <ConfirmDialog
        open={cancelConfirm}
        onClose={() => setCancelConfirm(false)}
        onConfirm={cancelOrder}
        loading={busy === "cancel"}
        title="Cancel this order?"
        description="The transaction will follow the FSM cancellation path. Any captured simulated funds are refunded automatically and reserved stock is released."
        confirmLabel="Cancel & refund"
        tone="danger"
      />
    </div>
  );
}

export default VendingPage;
