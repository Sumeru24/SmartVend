import {
  Activity,
  ArrowUpRight,
  BellRing,
  CircleCheck,
  Cpu,
  MapPin,
  Pause,
  Play,
  Plus,
  Power,
  ReceiptText,
  Store,
  TriangleAlert,
  Wrench,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AdminFooterNote } from "../../layouts/AdminLayout";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { EmptyState } from "../../components/ui/EmptyState";
import { MachineStatusBadge } from "../../components/ui/StatusBadge";
import { Modal } from "../../components/ui/Modal";
import { PageHeader } from "../../components/ui/PageHeader";
import { Spinner } from "../../components/ui/Spinner";
import { StatCard } from "../../components/ui/StatCard";
import { Progress } from "../../components/ui/Progress";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { adminService } from "../../services/admin";
import { apiErrorMessage } from "../../services/client";
import {
  formatCurrency,
  formatDateTime,
  formatNumber,
  relativeTime,
} from "../../utils/format";

const ACTIONS = {
  online: { label: "Start machine", icon: Play, tone: "text-emerald-600" },
  maintenance: { label: "Maintenance", icon: Wrench, tone: "text-amber-600" },
  offline: { label: "Stop machine", icon: Power, tone: "text-rose-600" },
};

function AddMachineModal({ open, onClose, onSaved }) {
  const [form, setForm] = useState({ code: "", name: "", location: "", status: "online" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const { success, error: toastError } = useToast();

  useEffect(() => {
    if (open) {
      setForm({ code: "", name: "", location: "", status: "online" });
      setError("");
    }
  }, [open]);

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await adminService.createMachine({
        code: form.code.trim().toUpperCase(),
        name: form.name.trim(),
        location: form.location.trim(),
        status: form.status,
      });
      success("Vending machine registered.");
      onSaved();
      onClose();
    } catch (err) {
      const message = apiErrorMessage(err, "Could not add machine.");
      setError(message);
      toastError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={saving ? () => {} : onClose}
      title="Register a machine"
      description="New machines have no inventory plan until products are assigned."
      size="md"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button className="btn-primary" type="submit" form="machine-form" disabled={saving}>
            {saving && <Spinner className="h-4 w-4" />} Add machine
          </button>
        </>
      }
    >
      <form id="machine-form" onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="machine-code">
              Machine code
            </label>
            <input
              id="machine-code"
              className="input font-mono uppercase"
              value={form.code}
              onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))}
              placeholder="SV-BLR-03"
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="machine-name">
              Display name
            </label>
            <input
              id="machine-name"
              className="input"
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="Atrium Express"
              required
            />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="machine-location">
              Location
            </label>
            <input
              id="machine-location"
              className="input"
              value={form.location}
              onChange={(event) =>
                setForm((current) => ({ ...current, location: event.target.value }))
              }
              placeholder="Building, floor, city"
              required
            />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="machine-status">
              Initial status
            </label>
            <select
              id="machine-status"
              className="input"
              value={form.status}
              onChange={(event) =>
                setForm((current) => ({ ...current, status: event.target.value }))
              }
            >
              <option value="online">Online</option>
              <option value="offline">Offline</option>
              <option value="maintenance">Maintenance</option>
            </select>
          </div>
        </div>
        {error && (
          <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
            {error}
          </p>
        )}
      </form>
    </Modal>
  );
}

export function MachinesPage() {
  const [machines, setMachines] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusUpdating, setStatusUpdating] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const { isAdmin } = useAuth();
  const { success, error: toastError } = useToast();

  const load = async () => {
    try {
      const [machineData, alertData] = await Promise.all([
        adminService.machines(),
        adminService.alerts({ resolved: false }),
      ]);
      setMachines(machineData);
      setAlerts(alertData);
      setError("");
    } catch (err) {
      const message = apiErrorMessage(err);
      setError(message);
      toastError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    document.title = "Machines · SmartVend";
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stats = useMemo(
    () => ({
      online: machines.filter((machine) => machine.status === "online").length,
      maintenance: machines.filter((machine) => machine.status === "maintenance").length,
      offline: machines.filter((machine) => ["offline", "error"].includes(machine.status)).length,
      revenue: machines.reduce((total, machine) => total + machine.revenue_paise, 0),
    }),
    [machines],
  );

  const changeStatus = async (machine, status) => {
    setStatusUpdating(machine.id);
    try {
      await adminService.setMachineStatus(
        machine.id,
        status,
        status === "maintenance"
          ? "Operator entered maintenance mode"
          : status === "online"
            ? "Machine returned to service"
            : "Machine stopped by operator",
      );
      success(`${machine.name} is now ${status}.`);
      setConfirmAction(null);
      await load();
    } catch (err) {
      toastError(apiErrorMessage(err, "Could not update machine status."));
    } finally {
      setStatusUpdating(null);
    }
  };

  const requestStatus = (machine, status) => {
    if (machine.status === status) return;
    if (status === "online") {
      changeStatus(machine, status);
    } else {
      setConfirmAction({ machine, status });
    }
  };

  const resolveAlert = async (alert) => {
    try {
      await adminService.resolveAlert(alert.id);
      success("Alert resolved.");
      await load();
    } catch (err) {
      toastError(apiErrorMessage(err, "Could not resolve alert."));
    }
  };

  return (
    <div className="admin-page">
      <PageHeader
        eyebrow="Fleet"
        title="Vending machines"
        description="Start, stop and service machines. Maintenance mode blocks new customer transactions while preserving existing ones."
        actions={
          isAdmin ? (
            <button className="btn-primary" onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4" /> Register machine
            </button>
          ) : null
        }
      />

      <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Online"
          value={formatNumber(stats.online)}
          icon={CircleCheck}
          hint={`${machines.length} machines registered`}
          tone="emerald"
          loading={loading}
        />
        <StatCard
          label="In maintenance"
          value={formatNumber(stats.maintenance)}
          icon={Wrench}
          hint="Customer purchases blocked"
          tone="amber"
          loading={loading}
        />
        <StatCard
          label="Offline / error"
          value={formatNumber(stats.offline)}
          icon={Power}
          hint="Needs an operator check"
          tone="rose"
          loading={loading}
        />
        <StatCard
          label="Fleet revenue"
          value={formatCurrency(stats.revenue, { compact: true })}
          icon={ReceiptText}
          hint="Completed FSM runs only"
          tone="lime"
          loading={loading}
        />
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[1.55fr_0.85fr]">
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-base font-bold text-ink-950 dark:text-white">
              Machine fleet
            </h2>
            <span className="text-[10px] font-semibold text-ink-400">
              Availability updates in real time
            </span>
          </div>

          {loading ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="panel p-5">
                  <div className="skeleton h-10 w-10 rounded-xl" />
                  <div className="skeleton mt-4 h-4 w-36" />
                  <div className="skeleton mt-2 h-3 w-48" />
                  <div className="skeleton mt-6 h-16 w-full" />
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="panel">
              <EmptyState
                icon={TriangleAlert}
                title="Could not load machines"
                description={error}
                action={<button className="btn-primary" onClick={load}>Retry</button>}
              />
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {machines.map((machine) => (
                <article key={machine.id} className="panel group overflow-hidden">
                  <div className="relative p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="relative grid h-11 w-11 place-items-center rounded-2xl bg-ink-950 text-volt dark:bg-volt dark:text-ink-950">
                          <Store className="h-5 w-5" />
                          <span
                            className={`absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-white dark:border-[#121710] ${
                              machine.status === "online"
                                ? "bg-emerald-500"
                                : machine.status === "maintenance"
                                  ? "bg-amber-400"
                                  : "bg-rose-500"
                            }`}
                          />
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-display text-sm font-extrabold text-ink-950 dark:text-white">
                              {machine.name}
                            </h3>
                            <span className="font-mono text-[9px] text-ink-300">{machine.code}</span>
                          </div>
                          <p className="mt-1 flex items-center gap-1 text-[10px] text-ink-400">
                            <MapPin className="h-3 w-3" /> {machine.location}
                          </p>
                        </div>
                      </div>
                      <MachineStatusBadge status={machine.status} />
                    </div>

                    <div className="mt-5 grid grid-cols-3 gap-2">
                      <div className="rounded-xl bg-ink-50 p-2.5 dark:bg-white/[0.03]">
                        <p className="text-[8px] font-bold uppercase tracking-[0.12em] text-ink-400">
                          Revenue
                        </p>
                        <p className="mt-1 font-display text-xs font-extrabold text-ink-900 dark:text-white">
                          {formatCurrency(machine.revenue_paise, { compact: true })}
                        </p>
                      </div>
                      <div className="rounded-xl bg-ink-50 p-2.5 dark:bg-white/[0.03]">
                        <p className="text-[8px] font-bold uppercase tracking-[0.12em] text-ink-400">
                          Sales
                        </p>
                        <p className="mt-1 font-display text-xs font-extrabold text-ink-900 dark:text-white">
                          {machine.transaction_count}
                        </p>
                      </div>
                      <div className="rounded-xl bg-ink-50 p-2.5 dark:bg-white/[0.03]">
                        <p className="text-[8px] font-bold uppercase tracking-[0.12em] text-ink-400">
                          Alerts
                        </p>
                        <p
                          className={`mt-1 font-display text-xs font-extrabold ${
                            machine.open_alerts ? "text-amber-600 dark:text-amber-400" : "text-ink-900 dark:text-white"
                          }`}
                        >
                          {machine.open_alerts}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3">
                      <div className="flex items-center justify-between text-[9px]">
                        <span className="font-semibold text-ink-400">
                          {machine.inventory_count} inventory SKUs · {machine.low_stock_count} low
                        </span>
                        <span className="font-bold text-ink-500 dark:text-ink-300">
                          {machine.inventory_count
                            ? Math.round(
                                ((machine.inventory_count - machine.low_stock_count) /
                                  machine.inventory_count) *
                                  100,
                              )
                            : 0}
                          % healthy
                        </span>
                      </div>
                      <Progress
                        value={
                          machine.inventory_count
                            ? ((machine.inventory_count - machine.low_stock_count) /
                                machine.inventory_count) *
                              100
                            : 0
                        }
                        className="mt-1.5"
                        tone={
                          machine.low_stock_count
                            ? "bg-amber-400"
                            : "bg-emerald-500"
                        }
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-ink-100 bg-ink-50/50 px-3 py-2.5 dark:border-white/[0.06] dark:bg-white/[0.015]">
                    <span className="flex items-center gap-1.5 text-[9px] text-ink-400">
                      <Activity className="h-3 w-3" />
                      {machine.status === "online" ? "Accepting orders" : `Mode: ${machine.status}`}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        className={`btn-icon h-7 w-7 border-transparent bg-transparent ${machine.status === "online" ? "text-emerald-500" : ACTIONS.online.tone}`}
                        title="Set online"
                        onClick={() => requestStatus(machine, "online")}
                        disabled={statusUpdating === machine.id || machine.status === "online"}
                      >
                        <Play className="h-3.5 w-3.5" />
                      </button>
                      <button
                        className={`btn-icon h-7 w-7 border-transparent bg-transparent ${machine.status === "maintenance" ? "text-amber-500" : ACTIONS.maintenance.tone}`}
                        title="Enter maintenance"
                        onClick={() => requestStatus(machine, "maintenance")}
                        disabled={statusUpdating === machine.id || machine.status === "maintenance"}
                      >
                        <Wrench className="h-3.5 w-3.5" />
                      </button>
                      <button
                        className={`btn-icon h-7 w-7 border-transparent bg-transparent ${machine.status === "offline" ? "text-rose-500" : ACTIONS.offline.tone}`}
                        title="Stop machine"
                        onClick={() => requestStatus(machine, "offline")}
                        disabled={statusUpdating === machine.id || machine.status === "offline"}
                      >
                        <Power className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-base font-bold text-ink-950 dark:text-white">
              Open alerts
            </h2>
            <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-600 dark:bg-rose-500/10 dark:text-rose-400">
              {alerts.length}
            </span>
          </div>
          <div className="panel overflow-hidden">
            <div className="max-h-[690px] divide-y divide-ink-100 overflow-y-auto dark:divide-white/[0.06]">
              {loading ? (
                <div className="space-y-3 p-4">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <div key={index} className="skeleton h-16" />
                  ))}
                </div>
              ) : alerts.length ? (
                alerts.map((alert) => (
                  <div key={alert.id} className="p-4 transition hover:bg-ink-50/50 dark:hover:bg-white/[0.02]">
                    <div className="flex items-start gap-3">
                      <span
                        className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl ${
                          alert.severity === "critical"
                            ? "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400"
                            : alert.severity === "warning"
                              ? "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400"
                              : "bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400"
                        }`}
                      >
                        {alert.type === "maintenance" ? (
                          <Wrench className="h-3.5 w-3.5" />
                        ) : alert.severity === "critical" ? (
                          <TriangleAlert className="h-3.5 w-3.5" />
                        ) : (
                          <BellRing className="h-3.5 w-3.5" />
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-ink-400">
                            {alert.type.replaceAll("_", " ")}
                          </p>
                          <span className="text-[9px] text-ink-300">· {alert.machine_name}</span>
                        </div>
                        <p className="mt-1 text-[11px] leading-relaxed text-ink-700 dark:text-ink-200">
                          {alert.message}
                        </p>
                        <div className="mt-2 flex items-center justify-between">
                          <span className="text-[9px] text-ink-400">
                            {relativeTime(alert.created_at)}
                          </span>
                          <button
                            className="text-[9px] font-bold text-ink-500 hover:text-ink-950 dark:text-ink-400 dark:hover:text-white"
                            onClick={() => resolveAlert(alert)}
                          >
                            Resolve
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <EmptyState
                  icon={CircleCheck}
                  title="All clear"
                  description="No unresolved machine alerts right now."
                  className="py-10"
                />
              )}
            </div>
          </div>
          <div className="mt-3 rounded-2xl border border-ink-200/70 bg-white p-4 dark:border-white/10 dark:bg-[#121710]">
            <div className="flex items-start gap-2.5">
              <Cpu className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" />
              <p className="text-[10px] leading-relaxed text-ink-400">
                Service mode emits a machine-level FSM log (
                <span className="font-mono">ENTER_MAINTENANCE</span> /{" "}
                <span className="font-mono">EXIT_MAINTENANCE</span>) and blocks new carts until
                online.
              </p>
            </div>
          </div>
        </div>
      </div>

      <AdminFooterNote />

      <AddMachineModal open={addOpen} onClose={() => setAddOpen(false)} onSaved={load} />
      <ConfirmDialog
        open={Boolean(confirmAction)}
        onClose={() => setConfirmAction(null)}
        onConfirm={() =>
          confirmAction && changeStatus(confirmAction.machine, confirmAction.status)
        }
        loading={Boolean(statusUpdating)}
        title={
          confirmAction?.status === "maintenance"
            ? "Enter maintenance mode?"
            : "Stop this machine?"
        }
        description={
          confirmAction
            ? `${confirmAction.machine.name} will ${
                confirmAction.status === "maintenance"
                  ? "stop accepting new customer transactions until maintenance is complete."
                  : "go offline and reject new carts."
              } Existing transactions are not interrupted.`
            : ""
        }
        confirmLabel={confirmAction?.status === "maintenance" ? "Enter maintenance" : "Stop machine"}
        tone="warning"
      />
    </div>
  );
}

export default MachinesPage;
