import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleAlert,
  CircleCheck,
  Cpu,
  FastForward,
  History,
  Minus,
  Pause,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  SkipForward,
  Sparkles,
  Store,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import ReactFlow, {
  Background,
  BaseEdge,
  Controls,
  EdgeLabelRenderer,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  getBezierPath,
} from "reactflow";
import "reactflow/dist/style.css";
import { Logo } from "../../components/Logo";
import { EmptyState } from "../../components/ui/EmptyState";
import { Spinner } from "../../components/ui/Spinner";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { ThemeToggle } from "../../components/ui/ThemeToggle";
import { useTheme } from "../../context/ThemeContext";
import { useToast } from "../../context/ToastContext";
import { fsmService } from "../../services/fsm";
import { apiErrorMessage } from "../../services/client";
import { formatCurrency, FS_STATE_COLORS, titleCase } from "../../utils/format";

const POSITIONS = {
  IDLE: { x: 0, y: 200 },
  PRODUCT_SELECTED: { x: 220, y: 200 },
  INVENTORY_CHECK: { x: 440, y: 200 },
  OUT_OF_STOCK: { x: 440, y: 390 },
  PAYMENT_PENDING: { x: 660, y: 200 },
  PAYMENT_ACCEPTED: { x: 880, y: 200 },
  DISPENSING: { x: 880, y: 10 },
  CHANGE_RETURN: { x: 1100, y: 70 },
  COMPLETED: { x: 1320, y: 10 },
  CANCELLED: { x: 660, y: 390 },
  REFUNDING: { x: 880, y: 390 },
  ERROR: { x: 1100, y: 390 },
  MAINTENANCE: { x: 220, y: 10 },
};

const EVENT_GROUPS = ["selection", "payment", "dispensing", "recovery", "service"];
const GROUP_LABELS = {
  selection: "Selection",
  payment: "Payment",
  dispensing: "Dispensing",
  recovery: "Recovery",
  service: "Service",
};
const TERMINAL_STATES = ["COMPLETED", "CANCELLED", "ERROR"];
const PREFERRED_EVENTS = {
  IDLE: ["SELECT_PRODUCT", "ENTER_MAINTENANCE"],
  PRODUCT_SELECTED: ["CONFIRM_PRODUCT", "CHECK_STOCK", "CANCEL_TRANSACTION"],
  INVENTORY_CHECK: ["STOCK_AVAILABLE", "STOCK_UNAVAILABLE"],
  OUT_OF_STOCK: ["RESET_MACHINE", "CANCEL_TRANSACTION"],
  PAYMENT_PENDING: ["PAYMENT_SUCCESS", "INSERT_NOTE", "INSUFFICIENT_AMOUNT", "CANCEL_TRANSACTION"],
  PAYMENT_ACCEPTED: ["DISPENSE_PRODUCT", "CANCEL_TRANSACTION"],
  DISPENSING: ["DISPENSE_SUCCESS", "DISPENSE_FAILURE"],
  CHANGE_RETURN: ["RETURN_CHANGE"],
  COMPLETED: [],
  CANCELLED: ["RESET_MACHINE"],
  REFUNDING: ["PROCESS_REFUND"],
  ERROR: ["RESET_MACHINE", "CANCEL_TRANSACTION"],
  MAINTENANCE: ["EXIT_MAINTENANCE"],
};
const HAPPY_PATH = [
  "SELECT_PRODUCT",
  "CONFIRM_PRODUCT",
  "STOCK_AVAILABLE",
  "PAYMENT_SUCCESS",
  "DISPENSE_PRODUCT",
  "DISPENSE_SUCCESS",
  "RETURN_CHANGE",
];
const SAMPLE_PRODUCT = {
  product_id: 1,
  name: "Masala Chips",
  unit_price_paise: 3500,
  quantity: 1,
};

function makeContext(totalPaise = 3500, itemCount = 1) {
  const quantity = Math.max(1, Math.min(Number(itemCount) || 1, 6));
  return {
    transaction_id: 9000,
    machine_id: 1,
    items: [
      {
        product_id: SAMPLE_PRODUCT.product_id,
        name: SAMPLE_PRODUCT.name,
        unit_price_paise: Math.round(totalPaise / quantity),
        quantity,
      },
    ],
    total_paise: Math.max(0, Math.round(totalPaise)),
    balance_paise: 0,
    change_paise: 0,
    currency: "INR",
    payment_method: null,
    stock_reserved: false,
    inventory_available: true,
    payment_succeeded: false,
    dispensed: false,
    refunded_paise: 0,
    error_message: null,
    inserted_denominations: [],
    notes: [],
  };
}

function payloadFor(event) {
  switch (event) {
    case "INSERT_COIN":
      return { amount_paise: 1000, kind: "coin" };
    case "INSERT_NOTE":
      return { amount_paise: 10000, kind: "note" };
    case "PAYMENT_FAILED":
      return { reason: "Simulator injected a UPI decline." };
    case "DISPENSE_FAILURE":
      return { reason: "Simulator injected a dispense jam." };
    case "PAYMENT_SUCCESS":
      return { credit_upi: true };
    default:
      return {};
  }
}

function edgeGeometry(source, target) {
  const sourcePos = POSITIONS[source] || { x: 0, y: 0 };
  const targetPos = POSITIONS[target] || { x: 0, y: 0 };
  if (source === target) {
    return { sourceHandle: "top-source", targetHandle: "top-target", selfLoop: true };
  }
  const dx = targetPos.x - sourcePos.x;
  const dy = targetPos.y - sourcePos.y;
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0
      ? { sourceHandle: "right-source", targetHandle: "left-target" }
      : { sourceHandle: "left-source", targetHandle: "right-target" };
  }
  return dy >= 0
    ? { sourceHandle: "bottom-source", targetHandle: "top-target" }
    : { sourceHandle: "top-source", targetHandle: "bottom-target" };
}

function StateNode({ data }) {
  const color = FS_STATE_COLORS[data.state.id] || "#84cc16";
  return (
    <div
      className={`relative w-[188px] rounded-2xl border bg-white px-3.5 py-3 shadow-card transition-all duration-300 dark:bg-[#121710] ${
        data.isCurrent
          ? "border-lime-500 ring-2 ring-lime-400/30 dark:border-volt dark:ring-volt/20"
          : data.isRecent
            ? "border-sky-300 dark:border-sky-500/40"
            : "border-ink-200 dark:border-white/10"
      }`}
      style={{ borderTopColor: color, borderTopWidth: 3 }}
    >
      <Handle
        id="left-source"
        type="source"
        position={Position.Left}
        style={{ opacity: 0, pointerEvents: "none" }}
      />
      <Handle
        id="left-target"
        type="target"
        position={Position.Left}
        style={{ opacity: 0, pointerEvents: "none" }}
      />
      <Handle
        id="right-source"
        type="source"
        position={Position.Right}
        style={{ opacity: 0, pointerEvents: "none" }}
      />
      <Handle
        id="right-target"
        type="target"
        position={Position.Right}
        style={{ opacity: 0, pointerEvents: "none" }}
      />
      <Handle
        id="top-source"
        type="source"
        position={Position.Top}
        style={{ opacity: 0, pointerEvents: "none", left: "68%" }}
      />
      <Handle
        id="top-target"
        type="target"
        position={Position.Top}
        style={{ opacity: 0, pointerEvents: "none", left: "32%" }}
      />
      <Handle
        id="bottom-source"
        type="source"
        position={Position.Bottom}
        style={{ opacity: 0, pointerEvents: "none", left: "68%" }}
      />
      <Handle
        id="bottom-target"
        type="target"
        position={Position.Bottom}
        style={{ opacity: 0, pointerEvents: "none", left: "32%" }}
      />

      <div className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
        <p className="truncate font-mono text-[9px] font-bold tracking-[0.02em] text-ink-500 dark:text-ink-300">
          {data.state.id}
        </p>
        {data.state.isInitial && (
          <span className="rounded bg-ink-950 px-1 py-0.5 font-mono text-[7px] font-bold text-volt dark:bg-volt dark:text-ink-950">
            q0
          </span>
        )}
        {data.state.isAccepting && (
          <span className="ml-auto rounded-full border border-emerald-300 p-0.5 text-emerald-600 dark:border-emerald-500/40 dark:text-emerald-400">
            <Check className="h-2.5 w-2.5" />
          </span>
        )}
      </div>
      <p className="mt-1.5 font-display text-[12px] font-extrabold leading-tight text-ink-950 dark:text-white">
        {data.state.label}
      </p>
      <p className="mt-1 line-clamp-2 h-[22px] text-[8.5px] leading-[1.35] text-ink-400">
        {data.state.description}
      </p>
      {data.isCurrent && (
        <span className="absolute -top-2.5 right-2.5 rounded-full bg-lime-500 px-2 py-0.5 text-[7px] font-extrabold uppercase tracking-[0.1em] text-ink-950 shadow-sm dark:bg-volt">
          Current
        </span>
      )}
    </div>
  );
}

function TransitionEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  data,
}) {
  let path;
  let labelX;
  let labelY;
  if (data.selfLoop) {
    const x1 = sourceX - 18;
    const x2 = targetX + 18;
    path = `M ${x1},${sourceY} C ${x1 - 46},${sourceY - 86} ${x2 + 46},${sourceY - 86} ${x2},${targetY}`;
    labelX = (x1 + x2) / 2;
    labelY = sourceY - 62;
  } else {
    [path, labelX, labelY] = getBezierPath({
      sourceX,
      sourceY,
      targetX,
      targetY,
      sourcePosition,
      targetPosition,
      curvature: 0.22,
    });
  }

  const color = data.active
    ? "#84cc16"
    : data.recent
      ? "#0ea5e9"
      : data.conditional
        ? "#d946ef"
        : data.dark
          ? "rgba(255,255,255,0.22)"
          : "rgba(95,111,86,0.42)";

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        markerEnd={markerEnd}
        className={data.active ? "fsm-edge-active" : ""}
        style={{
          stroke: color,
          strokeWidth: data.active ? 2.6 : data.recent ? 2 : 1.35,
          strokeDasharray: data.conditional && !data.active ? "5 4" : undefined,
          opacity: data.dim ? 0.45 : 1,
        }}
      />
      <EdgeLabelRenderer>
        <div
          style={{
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            backgroundColor: data.dark ? "#10140e" : "#ffffff",
            borderColor: data.active
              ? "rgba(132,204,22,0.65)"
              : data.recent
                ? "rgba(14,165,233,0.4)"
                : data.dark
                  ? "rgba(255,255,255,0.1)"
                  : "rgba(207,212,200,0.9)",
            color: data.active
              ? data.dark
                ? "#c9f56a"
                : "#3f6212"
              : data.dark
                ? "rgba(255,255,255,0.6)"
                : "#5f6f56",
          }}
          className={`pointer-events-none flex max-w-[150px] flex-col items-center rounded-md border px-1.5 py-0.5 text-center font-mono text-[7px] font-semibold leading-[1.3] shadow-sm ${
            data.active ? "z-20" : ""
          }`}
        >
          {data.events.map((event) => (
            <span key={event} className="whitespace-nowrap">
              {event}
              {data.conditional ? "*" : ""}
            </span>
          ))}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

const nodeTypes = { state: StateNode };
const edgeTypes = { transition: TransitionEdge };

function buildGraph(model, trace, currentState, isDark) {
  if (!model) return { nodes: [], edges: [] };
  const accepted = trace.filter((step) => step.accepted);
  const lastAccepted = accepted[accepted.length - 1];
  const recentSteps = accepted.slice(-4);
  const recentEdgeKeys = new Set(
    recentSteps.slice(0, -1).map((step) => `${step.source}__${step.target}`),
  );
  const recentNodeIds = new Set(recentSteps.flatMap((step) => [step.source, step.target]));
  const activeKey = lastAccepted ? `${lastAccepted.source}__${lastAccepted.target}` : null;

  const groups = new Map();
  model.transitions.forEach((transition) => {
    const targets = transition.dynamic
      ? transition.possible_targets
      : transition.target
        ? [transition.target]
        : [];
    targets.forEach((target) => {
      const key = `${transition.source}__${target}`;
      if (!groups.has(key)) {
        groups.set(key, {
          id: key,
          source: transition.source,
          target,
          events: [],
          descriptions: [],
          conditional: false,
        });
      }
      const group = groups.get(key);
      if (!group.events.includes(transition.event)) group.events.push(transition.event);
      group.descriptions.push(transition.description);
      group.conditional = group.conditional || Boolean(transition.dynamic);
    });
  });

  const nodes = model.states.map((state) => ({
    id: state.id,
    type: "state",
    position: POSITIONS[state.id] || { x: 0, y: 0 },
    data: {
      state,
      isCurrent: state.id === currentState,
      isRecent: state.id !== currentState && recentNodeIds.has(state.id),
    },
    draggable: false,
    selectable: false,
  }));

  const edges = [...groups.values()].map((group) => {
    const geometry = edgeGeometry(group.source, group.target);
    const active = group.id === activeKey;
    const recent = !active && recentEdgeKeys.has(group.id);
    const color = active
      ? "#84cc16"
      : recent
        ? "#0ea5e9"
        : group.conditional
          ? "#d946ef"
          : isDark
            ? "rgba(255,255,255,0.28)"
            : "rgba(95,111,86,0.5)";
    return {
      id: group.id,
      source: group.source,
      target: group.target,
      sourceHandle: geometry.sourceHandle,
      targetHandle: geometry.targetHandle,
      type: "transition",
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color,
        width: 16,
        height: 16,
      },
      data: {
        events: group.events,
        descriptions: group.descriptions,
        conditional: group.conditional,
        active,
        recent,
        selfLoop: Boolean(geometry.selfLoop),
        dark: isDark,
        dim: Boolean(lastAccepted) && !active && !recent,
      },
    };
  });

  return { nodes, edges };
}

function CurrentStateCard({ state, model, trace }) {
  const meta = model?.states?.find((row) => row.id === state);
  const accepted = trace.filter((step) => step.accepted).length;
  const rejected = trace.length - accepted;
  return (
    <div className="relative overflow-hidden rounded-2xl bg-ink-950 p-5 text-white">
      <div className="dot-grid absolute inset-0 opacity-25" />
      <div className="relative">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/35">
              Current state · q
            </p>
            <p className="mt-1.5 font-mono text-lg font-extrabold tracking-[-0.02em] text-volt">
              {state}
            </p>
            <p className="mt-1 font-display text-sm font-bold text-white">
              {meta?.label || titleCase(state)}
            </p>
          </div>
          <span
            className={`rounded-full px-2.5 py-1 text-[8px] font-extrabold uppercase tracking-[0.12em] ${
              meta?.is_accepting
                ? "bg-emerald-400/15 text-emerald-300"
                : "bg-white/10 text-white/60"
            }`}
          >
            {meta?.is_accepting ? "Accepting" : "Transient"}
          </span>
        </div>
        <p className="mt-3 text-[10px] leading-relaxed text-white/45">
          {meta?.description || "The automaton is ready for the next input."}
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-white/[0.05] px-3 py-2">
            <p className="text-[8px] font-bold uppercase tracking-wider text-white/30">
              Accepted steps
            </p>
            <p className="mt-0.5 font-mono text-sm font-extrabold text-white">{accepted}</p>
          </div>
          <div className="rounded-xl bg-white/[0.05] px-3 py-2">
            <p className="text-[8px] font-bold uppercase tracking-wider text-white/30">
              Rejected steps
            </p>
            <p className="mt-0.5 font-mono text-sm font-extrabold text-white">{rejected}</p>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2 text-[9px]">
          <span className="inline-flex items-center gap-1.5 text-white/40">
            <Store className="h-3 w-3" /> Machine
          </span>
          <span
            className={`font-bold ${
              state === "MAINTENANCE" ? "text-amber-300" : "text-emerald-300"
            }`}
          >
            {state === "MAINTENANCE" ? "Service mode" : "Online · simulated"}
          </span>
        </div>
      </div>
    </div>
  );
}

function TransitionRow({ step }) {
  return (
    <div
      className={`rounded-xl border p-3 ${
        step.accepted
          ? "border-ink-200/70 bg-white dark:border-white/[0.08] dark:bg-white/[0.02]"
          : "border-rose-200 bg-rose-50/70 dark:border-rose-500/20 dark:bg-rose-500/[0.06]"
      }`}
    >
      <div className="flex items-center gap-2">
        <span
          className={`grid h-5 w-5 shrink-0 place-items-center rounded-full ${
            step.accepted
              ? "bg-lime-100 text-lime-700 dark:bg-volt/15 dark:text-volt"
              : "bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400"
          }`}
        >
          {step.accepted ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
        </span>
        <p className="truncate font-mono text-[9px] font-bold text-ink-800 dark:text-ink-100">
          {step.event}
        </p>
        <span
          className={`ml-auto rounded-full px-2 py-0.5 text-[8px] font-bold ${
            step.accepted
              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
              : "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300"
          }`}
        >
          {step.accepted ? "accepted" : "rejected"}
        </span>
      </div>
      <p className="mt-1.5 font-mono text-[9px] text-ink-400">
        {step.source}
        <span className="mx-1">→</span>
        {step.accepted ? step.target || step.source : "state unchanged"}
      </p>
      <p className="mt-1 text-[9px] leading-relaxed text-ink-400">
        {step.reason || step.description}
      </p>
    </div>
  );
}

export function SimulatorPage() {
  const [model, setModel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [currentState, setCurrentState] = useState("IDLE");
  const [context, setContext] = useState(() => makeContext(3500, 1));
  const [trace, setTrace] = useState([]);
  const [busy, setBusy] = useState(false);
  const [autoPlaying, setAutoPlaying] = useState(false);
  const [sequencePlaying, setSequencePlaying] = useState(false);
  const [sequenceQueue, setSequenceQueue] = useState([]);
  const [sequencePick, setSequencePick] = useState("SELECT_PRODUCT");
  const [activeTab, setActiveTab] = useState("run");
  const [lastRejection, setLastRejection] = useState(null);
  const { isDark } = useTheme();
  const { success, error: toastError, info } = useToast();
  const busyRef = useRef(false);
  const stateRef = useRef(currentState);
  const contextRef = useRef(context);

  useEffect(() => {
    stateRef.current = currentState;
  }, [currentState]);
  useEffect(() => {
    contextRef.current = context;
  }, [context]);

  const loadModel = async () => {
    setLoading(true);
    try {
      const result = await fsmService.getModel();
      setModel(result);
      setLoadError("");
    } catch (err) {
      setLoadError(apiErrorMessage(err, "Could not load the automaton model."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    document.title = "FSM Explorer · SmartVend";
    loadModel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const availableEvents = useMemo(() => {
    if (!model) return [];
    return [...new Set(model.transitions.filter((row) => row.source === currentState).map((row) => row.event))];
  }, [model, currentState]);

  const availableTargets = useMemo(() => {
    if (!model) return {};
    const map = {};
    model.transitions
      .filter((row) => row.source === currentState)
      .forEach((row) => {
        const targets = row.dynamic ? row.possible_targets : [row.target];
        map[row.event] = targets.filter(Boolean).join(" | ");
      });
    return map;
  }, [model, currentState]);

  const performStep = useCallback(
    async (event) => {
      if (busyRef.current) return null;
      busyRef.current = true;
      setBusy(true);
      const source = stateRef.current;
      const activeContext = contextRef.current;
      try {
        const result = await fsmService.step({
          state: source,
          event,
          context: activeContext,
          payload: payloadFor(event),
        });
        const next = result.accepted && result.target ? result.target : source;
        const nextContext = result.context || activeContext;
        setCurrentState(next);
        stateRef.current = next;
        setContext(nextContext);
        contextRef.current = nextContext;
        setTrace((rows) =>
          [
            ...rows,
            {
              ...result,
              traceId:
                typeof crypto !== "undefined" && crypto.randomUUID
                  ? crypto.randomUUID()
                  : `${Date.now()}-${Math.random()}`,
              timestamp: new Date().toISOString(),
            },
          ].slice(-100),
        );
        if (!result.accepted) {
          setLastRejection(result);
        } else {
          setLastRejection(null);
        }
        return result;
      } catch (err) {
        const message = apiErrorMessage(err, "The simulator request failed.");
        const result = {
          accepted: false,
          source,
          event,
          target: null,
          reason: message,
          description: "The request did not reach the automaton.",
          context: activeContext,
          traceId: `${Date.now()}-${Math.random()}`,
          timestamp: new Date().toISOString(),
        };
        setTrace((rows) => [...rows, result].slice(-100));
        setLastRejection(result);
        return result;
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [],
  );

  const preferredEvent = useCallback(() => {
    if (!model) return null;
    const available = model.transitions
      .filter((row) => row.source === stateRef.current)
      .map((row) => row.event);
    const preference = PREFERRED_EVENTS[stateRef.current] || [];
    return preference.find((event) => available.includes(event)) || available[0] || null;
  }, [model]);

  const stepOnce = async () => {
    if (busy || autoPlaying || sequencePlaying) return;
    const event = preferredEvent();
    if (!event) {
      info("This state has no outgoing transitions. Reset to explore another run.");
      return;
    }
    setAutoPlaying(false);
    const result = await performStep(event);
    if (!result) return;
    if (!result.accepted) {
      toastError(result.reason);
    }
  };

  useEffect(() => {
    if (!autoPlaying || loading || !model || busy) return;
    if (TERMINAL_STATES.includes(currentState)) {
      setAutoPlaying(false);
      return;
    }
    if (!context.items?.length && currentState === "IDLE") {
      setAutoPlaying(false);
      info("Add at least one cart item before starting auto-play.");
      return;
    }
    const timer = setTimeout(async () => {
      const event = preferredEvent();
      if (!event) {
        setAutoPlaying(false);
        return;
      }
      const result = await performStep(event);
      if (!result?.accepted) {
        setAutoPlaying(false);
        toastError(result?.reason || "Auto-play stopped on a rejected transition.");
      }
    }, 1050);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPlaying, currentState, busy, model, loading, context, trace]);

  useEffect(() => {
    if (!sequencePlaying || busy || !model) return;
    if (!sequenceQueue.length) {
      setSequencePlaying(false);
      return;
    }
    const timer = setTimeout(async () => {
      const [event, ...rest] = sequenceQueue;
      const result = await performStep(event);
      if (!result) {
        setSequencePlaying(false);
        return;
      }
      if (!result.accepted) {
        setSequencePlaying(false);
        setSequenceQueue([]);
        toastError(`Sequence stopped at ${event}: ${result.reason}`);
        return;
      }
      if (!rest.length) {
        setSequencePlaying(false);
        setSequenceQueue([]);
        success(`Sequence complete · reached ${result.target || stateRef.current}.`);
        return;
      }
      setSequenceQueue(rest);
    }, 720);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sequencePlaying, sequenceQueue, busy, model]);

  const toggleAuto = () => {
    if (autoPlaying) {
      setAutoPlaying(false);
      return;
    }
    if (TERMINAL_STATES.includes(currentState)) {
      info("Reset the simulator before auto-playing a new run.");
      return;
    }
    setSequencePlaying(false);
    setSequenceQueue([]);
    setAutoPlaying(true);
  };

  const addToSequence = (event) => {
    setSequenceQueue((queue) => [...queue, event]);
  };

  const runSequence = () => {
    if (!sequenceQueue.length) {
      info("Add at least one event to the sequence first.");
      return;
    }
    setAutoPlaying(false);
    setSequencePlaying(true);
  };

  const buildHappySequence = () => {
    setSequenceQueue(HAPPY_PATH);
    setSequencePlaying(false);
    setActiveTab("sequence");
    info("Happy-path sequence loaded. Press run sequence.");
  };

  const resetSimulation = () => {
    setAutoPlaying(false);
    setSequencePlaying(false);
    setSequenceQueue([]);
    setCurrentState("IDLE");
    stateRef.current = "IDLE";
    const fresh = makeContext(3500, 1);
    setContext(fresh);
    contextRef.current = fresh;
    setTrace([]);
    setLastRejection(null);
    setActiveTab("run");
    success("Simulator reset to q0 = IDLE.");
  };

  const updateTotal = (rupees) => {
    const value = Math.max(0, Math.round(Number(rupees || 0) * 100));
    setContext((prev) => {
      const next = {
        ...prev,
        total_paise: value,
        items: prev.items?.length
          ? prev.items.map((item) => ({
              ...item,
              unit_price_paise: Math.round(value / item.quantity),
            }))
          : makeContext(value, 1).items,
      };
      contextRef.current = next;
      return next;
    });
  };

  const updateBalance = (rupees) => {
    const value = Math.max(0, Math.round(Number(rupees || 0) * 100));
    setContext((prev) => {
      const next = { ...prev, balance_paise: value };
      contextRef.current = next;
      return next;
    });
  };

  const updateItemCount = (count) => {
    const quantity = Math.max(1, Math.min(Number(count) || 1, 6));
    setContext((prev) => {
      const total = prev.total_paise;
      const next = {
        ...prev,
        items: [
          {
            ...SAMPLE_PRODUCT,
            unit_price_paise: Math.round(total / quantity),
            quantity,
          },
        ],
      };
      contextRef.current = next;
      return next;
    });
  };

  const graph = useMemo(
    () => buildGraph(model, trace, currentState, isDark),
    [model, trace, currentState, isDark],
  );

  const groupedEvents = useMemo(() => {
    if (!model) return {};
    return model.events.reduce((groups, event) => {
      groups[event.group] = groups[event.group] || [];
      groups[event.group].push(event);
      return groups;
    }, {});
  }, [model]);

  const acceptedCount = trace.filter((step) => step.accepted).length;
  const rejectedCount = trace.length - acceptedCount;
  const selectedProduct = context.items?.[0];

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#f5f6f2] dark:bg-[#0b0f0a]">
        <div className="flex flex-col items-center gap-4">
          <div className="relative grid h-14 w-14 place-items-center rounded-2xl bg-ink-950 dark:bg-volt">
            <Cpu className="h-6 w-6 animate-pulse text-volt dark:text-ink-950" />
          </div>
          <p className="text-sm font-semibold text-ink-500 dark:text-ink-400">
            Loading the automaton…
          </p>
        </div>
      </div>
    );
  }

  if (loadError || !model) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#f5f6f2] px-5 dark:bg-[#0b0f0a]">
        <EmptyState
          icon={CircleAlert}
          title="The automaton could not be loaded"
          description={loadError || "No FSM model was returned."}
          action={
            <button className="btn-primary" onClick={loadModel}>
              <RefreshCw className="h-4 w-4" /> Retry
            </button>
          }
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f6f2] dark:bg-[#0b0f0a]">
      <header className="sticky top-0 z-40 border-b border-ink-200/70 bg-[#f5f6f2]/85 backdrop-blur-xl dark:border-white/[0.07] dark:bg-[#0b0f0a]/80">
        <div className="mx-auto flex h-[72px] max-w-[1720px] items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-5">
            <Link to="/vending" aria-label="SmartVend home">
              <Logo />
            </Link>
            <div className="hidden items-center gap-1 md:flex">
              <Link
                to="/vending"
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-ink-500 transition hover:bg-white/70 hover:text-ink-900 dark:text-ink-400 dark:hover:bg-white/5 dark:hover:text-white"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Vending
              </Link>
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-ink-950 shadow-sm ring-1 ring-ink-200/70 dark:bg-white/10 dark:text-white dark:ring-white/10">
                <Cpu className="h-3.5 w-3.5" /> FSM Explorer
              </span>
              <Link
                to="/admin"
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-ink-500 transition hover:bg-white/70 hover:text-ink-900 dark:text-ink-400 dark:hover:bg-white/5 dark:hover:text-white"
              >
                <Store className="h-3.5 w-3.5" /> Admin
              </Link>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden rounded-full border border-ink-200 bg-white px-3 py-1.5 font-mono text-[9px] font-semibold text-ink-400 dark:border-white/10 dark:bg-white/5 dark:text-ink-300 lg:inline-flex">
              M = (Q, Σ, δ, q₀, F)
            </span>
            <button
              onClick={resetSimulation}
              className="btn-secondary h-9 px-3 text-[11px]"
              disabled={busy}
            >
              <RotateCcw className="h-3.5 w-3.5" /> Reset
            </button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1720px] px-4 py-4 sm:px-6">
        <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <p className="section-kicker">Interactive automaton</p>
            <h1 className="mt-1 font-display text-2xl font-extrabold tracking-[-0.04em] text-ink-950 dark:text-white sm:text-[28px]">
              Watch the machine think.
            </h1>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-ink-500 dark:text-ink-400">
              Step real transitions against the live FastAPI automaton, build custom event
              sequences, and inspect guard explanations when an input is rejected.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[9px] font-semibold text-ink-400">
            <span className="rounded-full border border-ink-200 bg-white px-2.5 py-1 dark:border-white/10 dark:bg-white/5">
              {model.states.length} states
            </span>
            <span className="rounded-full border border-ink-200 bg-white px-2.5 py-1 dark:border-white/10 dark:bg-white/5">
              {model.events.length} events
            </span>
            <span className="rounded-full border border-ink-200 bg-white px-2.5 py-1 dark:border-white/10 dark:bg-white/5">
              {model.transitions.length} transitions
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-lime-100 px-2.5 py-1 text-lime-800 dark:bg-volt/10 dark:text-volt">
              <span className="h-1.5 w-1.5 rounded-full bg-lime-500 dark:bg-volt" />
              live backend
            </span>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_390px]">
          <section className="panel relative overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-100 px-4 py-3 dark:border-white/[0.07]">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-ink-700 dark:text-ink-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-volt-deep" /> Current
                </span>
                <span className="inline-flex items-center gap-1.5 text-[10px] text-sky-600 dark:text-sky-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-sky-400" /> Recent
                </span>
                <span className="inline-flex items-center gap-1.5 text-[10px] text-fuchsia-600 dark:text-fuchsia-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-fuchsia-400" /> Conditional
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="hidden text-[9px] text-ink-300 sm:inline">
                  drag to pan · scroll to zoom
                </span>
                <StatusBadge state={currentState} />
              </div>
            </div>
            <div className="h-[540px] w-full sm:h-[600px] xl:h-[660px]">
              <ReactFlow
                nodes={graph.nodes}
                edges={graph.edges}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                fitView
                fitViewOptions={{ padding: 0.12, maxZoom: 1 }}
                minZoom={0.35}
                maxZoom={1.8}
                nodesDraggable={false}
                nodesConnectable={false}
                elementsSelectable={false}
                proOptions={{ hideAttribution: true }}
                className="bg-[#fbfcf8] dark:bg-[#0e120c]"
              >
                <Background
                  color={isDark ? "rgba(255,255,255,0.08)" : "#dde3d5"}
                  gap={22}
                  size={1}
                />
                <Controls showInteractive={false} />
                <MiniMap
                  nodeColor={(node) => FS_STATE_COLORS[node.id] || "#84cc16"}
                  maskColor={isDark ? "rgba(8,12,7,0.72)" : "rgba(245,246,242,0.75)"}
                  pannable
                  zoomable
                />
              </ReactFlow>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-ink-100 px-4 py-2.5 text-[9px] text-ink-400 dark:border-white/[0.07]">
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="h-3 w-3" /> Pure FSM endpoint · no transaction rows are
                created while exploring
              </span>
              <span className="font-mono text-[8px] text-ink-300">
                q₀ = {model.initial_state} · F = {"{"}{model.accepting_states.join(", ")}{"}"}
              </span>
            </div>
          </section>

          <aside className="flex flex-col gap-3">
            <div className="panel flex items-center gap-1 p-1.5">
              <button
                onClick={stepOnce}
                disabled={busy || autoPlaying || sequencePlaying}
                className="btn-primary h-10 flex-1 text-[11px]"
              >
                {busy ? <Spinner className="h-3.5 w-3.5" /> : <SkipForward className="h-3.5 w-3.5" />}
                Step
              </button>
              <button
                onClick={toggleAuto}
                disabled={busy || sequencePlaying || TERMINAL_STATES.includes(currentState)}
                className={`h-10 flex-1 rounded-xl text-[11px] font-bold transition ${
                  autoPlaying
                    ? "bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-500/15 dark:text-amber-300"
                    : "bg-ink-100 text-ink-700 hover:bg-ink-200 dark:bg-white/10 dark:text-ink-200 dark:hover:bg-white/15"
                }`}
              >
                {autoPlaying ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Pause className="h-3.5 w-3.5" /> Pause
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5">
                    <Play className="h-3.5 w-3.5" /> Auto
                  </span>
                )}
              </button>
              <button
                onClick={resetSimulation}
                disabled={busy}
                className="grid h-10 w-10 place-items-center rounded-xl bg-ink-100 text-ink-600 transition hover:bg-ink-200 disabled:opacity-40 dark:bg-white/10 dark:text-ink-300 dark:hover:bg-white/15"
                title="Reset simulator"
                aria-label="Reset simulator"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            </div>

            <div className="flex rounded-xl bg-ink-100/70 p-1 dark:bg-white/[0.04]">
              {[
                ["run", "Run"],
                ["sequence", "Sequence"],
                ["trace", "Trace"],
                ["model", "Model"],
              ].map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  className={`flex-1 rounded-lg py-1.5 text-[10px] font-bold transition ${
                    activeTab === id
                      ? "bg-white text-ink-950 shadow-sm dark:bg-white/10 dark:text-white"
                      : "text-ink-400 hover:text-ink-700 dark:hover:text-ink-200"
                  }`}
                >
                  {label}
                  {id === "trace" && rejectedCount > 0 && (
                    <span className="ml-1 rounded-full bg-rose-100 px-1.5 text-[8px] text-rose-600 dark:bg-rose-500/15 dark:text-rose-400">
                      {trace.length}
                    </span>
                  )}
                </button>
              ))}
            </div>

            <div className="panel min-h-[560px] overflow-hidden">
              {activeTab === "run" && (
                <div className="space-y-3 p-3.5">
                  <CurrentStateCard state={currentState} model={model} trace={trace} />

                  <div className="rounded-2xl border border-ink-100 bg-white p-3.5 dark:border-white/[0.07] dark:bg-white/[0.02]">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink-400">
                        Extended context
                      </p>
                      <span className="rounded-full bg-ink-50 px-2 py-0.5 font-mono text-[8px] text-ink-400 dark:bg-white/5">
                        integer paise
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <div>
                        <label className="label text-[10px]" htmlFor="fsm-total">
                          Cart total (₹)
                        </label>
                        <input
                          id="fsm-total"
                          type="number"
                          min="0"
                          step="1"
                          value={context.total_paise / 100}
                          onChange={(event) => updateTotal(event.target.value)}
                          className="input h-9 px-2.5 text-xs"
                          disabled={busy || autoPlaying || sequencePlaying}
                        />
                      </div>
                      <div>
                        <label className="label text-[10px]" htmlFor="fsm-balance">
                          Inserted (₹)
                        </label>
                        <input
                          id="fsm-balance"
                          type="number"
                          min="0"
                          step="1"
                          value={context.balance_paise / 100}
                          onChange={(event) => updateBalance(event.target.value)}
                          className="input h-9 px-2.5 text-xs"
                          disabled={busy || autoPlaying || sequencePlaying}
                        />
                      </div>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex-1">
                        <label className="label text-[10px]" htmlFor="fsm-items">
                          Cart items
                        </label>
                        <select
                          id="fsm-items"
                          className="input h-9 px-2.5 text-xs"
                          value={selectedProduct?.quantity || 1}
                          onChange={(event) => updateItemCount(event.target.value)}
                          disabled={busy || autoPlaying || sequencePlaying}
                        >
                          {[1, 2, 3, 4, 5, 6].map((count) => (
                            <option key={count} value={count}>
                              {count} × {SAMPLE_PRODUCT.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="rounded-xl bg-ink-50 px-3 py-2 text-center dark:bg-white/[0.03]">
                        <p className="text-[8px] font-bold uppercase tracking-wider text-ink-400">
                          Due
                        </p>
                        <p className="mt-0.5 font-mono text-[11px] font-extrabold text-ink-900 dark:text-white">
                          {formatCurrency(
                            Math.max(context.total_paise - context.balance_paise, 0),
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-1.5 text-[8px]">
                      <div className="rounded-lg bg-ink-50 px-2 py-1.5 dark:bg-white/[0.03]">
                        <p className="text-ink-400">Balance</p>
                        <p className="mt-0.5 font-mono font-bold text-ink-800 dark:text-ink-100">
                          {formatCurrency(context.balance_paise)}
                        </p>
                      </div>
                      <div className="rounded-lg bg-ink-50 px-2 py-1.5 dark:bg-white/[0.03]">
                        <p className="text-ink-400">Total</p>
                        <p className="mt-0.5 font-mono font-bold text-ink-800 dark:text-ink-100">
                          {formatCurrency(context.total_paise)}
                        </p>
                      </div>
                      <div className="rounded-lg bg-ink-50 px-2 py-1.5 dark:bg-white/[0.03]">
                        <p className="text-ink-400">Change</p>
                        <p className="mt-0.5 font-mono font-bold text-ink-800 dark:text-ink-100">
                          {formatCurrency(context.change_paise)}
                        </p>
                      </div>
                    </div>
                    <p className="mt-2 text-[8px] leading-relaxed text-ink-400">
                      Product: <strong>{SAMPLE_PRODUCT.name}</strong> · stock reserved:{" "}
                      {String(context.stock_reserved)} · payment:{" "}
                      {context.payment_method || "none"}
                    </p>
                  </div>

                  {lastRejection && (
                    <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-[10px] text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/[0.07] dark:text-rose-300">
                      <p className="flex items-center gap-1.5 font-bold">
                        <CircleAlert className="h-3.5 w-3.5" /> {lastRejection.event} rejected
                      </p>
                      <p className="mt-1 leading-relaxed opacity-80">{lastRejection.reason}</p>
                    </div>
                  )}

                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink-400">
                        Alphabet Σ · click to send
                      </p>
                      <span className="text-[8px] text-ink-300">+ adds to sequence</span>
                    </div>
                    <div className="max-h-[330px] space-y-2.5 overflow-y-auto pr-1">
                      {EVENT_GROUPS.map((group) => (
                        <div key={group}>
                          <p className="mb-1 text-[8px] font-bold uppercase tracking-[0.14em] text-ink-300">
                            {GROUP_LABELS[group]}
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {(groupedEvents[group] || []).map((event) => {
                              const available = availableEvents.includes(event.id);
                              return (
                                <div
                                  key={event.id}
                                  className={`group inline-flex overflow-hidden rounded-lg border text-[8px] font-semibold transition ${
                                    available
                                      ? "border-lime-300 bg-lime-50 text-lime-800 dark:border-volt/25 dark:bg-volt/[0.06] dark:text-volt"
                                      : "border-ink-200 bg-white text-ink-400 dark:border-white/10 dark:bg-white/[0.02] dark:text-ink-500"
                                  }`}
                                  title={
                                    available
                                      ? `Available from ${currentState}${
                                          availableTargets[event.id]
                                            ? ` → ${availableTargets[event.id]}`
                                            : ""
                                        }`
                                      : event.description
                                  }
                                >
                                  <button
                                    onClick={() => stepOnceWith(event.id)}
                                    disabled={busy || autoPlaying || sequencePlaying}
                                    className="px-2 py-1 text-left font-mono hover:bg-black/[0.03] disabled:opacity-50 dark:hover:bg-white/[0.05]"
                                  >
                                    {event.id}
                                  </button>
                                  <button
                                    onClick={() => addToSequence(event.id)}
                                    className="border-l border-current/10 px-1.5 py-1 hover:bg-black/[0.06] dark:hover:bg-white/[0.1]"
                                    title={`Queue ${event.id}`}
                                    aria-label={`Add ${event.id} to sequence`}
                                  >
                                    <Plus className="h-2.5 w-2.5" />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <p className="text-[8px] leading-relaxed text-ink-400">
                    INSERT_COIN sends a ₹10 coin and INSERT_NOTE sends a ₹100 note. In the
                    simulator, PAYMENT_SUCCESS auto-credits the outstanding balance, mirroring a
                    UPI callback.
                  </p>
                </div>
              )}

              {activeTab === "sequence" && (
                <div className="space-y-3 p-3.5">
                  <div>
                    <p className="section-kicker">Compose</p>
                    <h2 className="mt-1 font-display text-base font-bold text-ink-950 dark:text-white">
                      Custom event sequence
                    </h2>
                    <p className="mt-1 text-[10px] leading-relaxed text-ink-400">
                      Pick any alphabet symbol. Events execute one at a time against the live FSM;
                      the run halts at the first rejected transition.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <select
                      className="input h-9 flex-1 text-[11px]"
                      value={sequencePick}
                      onChange={(event) => setSequencePick(event.target.value)}
                      aria-label="Sequence event"
                    >
                      {model.events.map((event) => (
                        <option key={event.id} value={event.id}>
                          {event.id}
                        </option>
                      ))}
                    </select>
                    <button
                      className="btn-secondary h-9 px-3 text-[11px]"
                      onClick={() => addToSequence(sequencePick)}
                      disabled={sequencePlaying}
                    >
                      <Plus className="h-3.5 w-3.5" /> Add
                    </button>
                  </div>
                  <button
                    className="btn-secondary h-9 w-full text-[10px]"
                    onClick={buildHappySequence}
                    disabled={sequencePlaying || busy}
                  >
                    <Sparkles className="h-3.5 w-3.5" /> Load the 7-event happy path
                  </button>
                  <div className="rounded-2xl border border-ink-100 bg-white p-3 dark:border-white/[0.07] dark:bg-white/[0.02]">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink-400">
                        Queue · {sequenceQueue.length}
                      </p>
                      {sequenceQueue.length > 0 && (
                        <button
                          onClick={() => setSequenceQueue([])}
                          className="text-[9px] font-bold text-ink-400 hover:text-rose-500"
                          disabled={sequencePlaying}
                        >
                          Clear
                        </button>
                      )}
                    </div>
                    <div className="mt-2 max-h-[240px] space-y-1.5 overflow-y-auto">
                      {sequenceQueue.length === 0 ? (
                        <p className="py-4 text-center text-[10px] text-ink-400">
                          Queue is empty. Add events from here or the Run tab.
                        </p>
                      ) : (
                        sequenceQueue.map((event, index) => (
                          <div
                            key={`${event}-${index}`}
                            className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 ${
                              sequencePlaying && index === 0
                                ? "border-amber-300 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/[0.08]"
                                : "border-ink-100 bg-white dark:border-white/10 dark:bg-white/[0.02]"
                            }`}
                          >
                            <span className="w-4 font-mono text-[8px] text-ink-300">
                              {String(index + 1).padStart(2, "0")}
                            </span>
                            <span className="flex-1 truncate font-mono text-[9px] font-semibold text-ink-700 dark:text-ink-200">
                              {event}
                            </span>
                            {sequencePlaying && index === 0 && (
                              <span className="text-[8px] font-bold text-amber-600 dark:text-amber-400">
                                running
                              </span>
                            )}
                            <button
                              onClick={() =>
                                setSequenceQueue((queue) => queue.filter((_, i) => i !== index))
                              }
                              disabled={sequencePlaying}
                              className="text-ink-300 hover:text-rose-500 disabled:opacity-40"
                              aria-label={`Remove ${event}`}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      className="btn-primary h-10 flex-1 text-[11px]"
                      onClick={runSequence}
                      disabled={sequencePlaying || busy || !sequenceQueue.length}
                    >
                      {sequencePlaying ? (
                        <Spinner className="h-3.5 w-3.5" />
                      ) : (
                        <FastForward className="h-3.5 w-3.5" />
                      )}
                      {sequencePlaying ? "Running…" : "Run sequence"}
                    </button>
                    <button
                      className="btn-secondary h-10 px-3 text-[11px]"
                      onClick={() => setSequencePlaying(false)}
                      disabled={!sequencePlaying}
                    >
                      <Pause className="h-3.5 w-3.5" /> Pause
                    </button>
                  </div>
                  <div className="rounded-xl border border-dashed border-ink-200 p-3 text-[9px] leading-relaxed text-ink-400 dark:border-white/10">
                    <strong className="text-ink-600 dark:text-ink-300">Tip:</strong> use
                    RESET_MACHINE after COMPLETED or CANCELLED to return to q0. Sequence events are
                    validated exactly like manual steps.
                  </div>
                </div>
              )}

              {activeTab === "trace" && (
                <div className="p-3.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="section-kicker">δ execution log</p>
                      <h2 className="mt-1 font-display text-base font-bold text-ink-950 dark:text-white">
                        Recent transitions
                      </h2>
                    </div>
                    <span className="rounded-full bg-ink-100 px-2 py-1 text-[9px] font-bold text-ink-500 dark:bg-white/5 dark:text-ink-300">
                      {acceptedCount} ✓ / {rejectedCount} ✕
                    </span>
                  </div>
                  <div className="mt-3 max-h-[570px] space-y-2 overflow-y-auto pr-1">
                    {trace.length === 0 ? (
                      <EmptyState
                        icon={History}
                        title="No transitions yet"
                        description="Send an event from the Run tab or start auto-play to populate the guarded execution log."
                        className="py-10"
                      />
                    ) : (
                      [...trace]
                        .reverse()
                        .map((step) => <TransitionRow key={step.traceId} step={step} />)
                    )}
                  </div>
                </div>
              )}

              {activeTab === "model" && (
                <div className="p-3.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="section-kicker">Formal definition</p>
                      <h2 className="mt-1 font-display text-base font-bold text-ink-950 dark:text-white">
                        The complete δ table
                      </h2>
                    </div>
                    <span className="font-mono text-[9px] text-ink-400">
                      {model.transitions.length} edges
                    </span>
                  </div>
                  <p className="mt-2 text-[10px] leading-relaxed text-ink-400">
                    {model.formal_note}
                  </p>
                  <div className="mt-3 max-h-[520px] overflow-y-auto rounded-xl border border-ink-100 dark:border-white/[0.07]">
                    <table className="w-full text-left">
                      <thead className="sticky top-0 bg-ink-50 text-[8px] uppercase tracking-[0.1em] text-ink-400 dark:bg-[#181f15]">
                        <tr>
                          <th className="px-2.5 py-2 font-semibold">δ</th>
                          <th className="px-2 py-2 font-semibold">Event</th>
                          <th className="px-2 py-2 font-semibold">Target</th>
                          <th className="px-2 py-2 font-semibold">Guard</th>
                        </tr>
                      </thead>
                      <tbody>
                        {model.transitions.map((transition) => (
                          <tr
                            key={transition.id}
                            className="border-t border-ink-100 dark:border-white/[0.06]"
                          >
                            <td className="px-2.5 py-2 font-mono text-[8px] text-ink-500 dark:text-ink-400">
                              {transition.source}
                            </td>
                            <td className="px-2 py-2 font-mono text-[8px] font-semibold text-ink-700 dark:text-ink-200">
                              {transition.event}
                            </td>
                            <td className="px-2 py-2 font-mono text-[8px] text-ink-500 dark:text-ink-400">
                              {transition.dynamic
                                ? transition.possible_targets.join(" | ")
                                : transition.target}
                            </td>
                            <td className="px-2 py-2 text-[8px] text-ink-400">
                              {transition.has_guard ? "guarded" : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div className="rounded-xl bg-ink-50 p-2.5 dark:bg-white/[0.03]">
                      <p className="text-[8px] font-bold uppercase tracking-wider text-ink-400">
                        Initial state
                      </p>
                      <p className="mt-0.5 font-mono text-[10px] font-bold text-ink-800 dark:text-ink-100">
                        q₀ = {model.initial_state}
                      </p>
                    </div>
                    <div className="rounded-xl bg-ink-50 p-2.5 dark:bg-white/[0.03]">
                      <p className="text-[8px] font-bold uppercase tracking-wider text-ink-400">
                        Accepting states F
                      </p>
                      <p className="mt-0.5 font-mono text-[9px] font-bold text-ink-800 dark:text-ink-100">
                        {model.accepting_states.join(", ")}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </aside>
        </div>

        <footer className="mt-5 flex flex-col items-center justify-between gap-2 border-t border-ink-200/60 py-4 text-[10px] text-ink-400 dark:border-white/[0.06] sm:flex-row">
          <span>SmartVend FSM Explorer · pure step endpoint</span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-volt" />
            No payments, stock or hardware touched while simulating
          </span>
        </footer>
      </main>
    </div>
  );

  function stepOnceWith(event) {
    if (busy || autoPlaying || sequencePlaying) return;
    performStep(event).then((result) => {
      if (result && !result.accepted) toastError(result.reason);
    });
  }
}

export default SimulatorPage;
