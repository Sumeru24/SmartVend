import { ArrowLeft, ArrowRight, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { Logo } from "../../components/Logo";
import { Spinner } from "../../components/ui/Spinner";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { apiErrorMessage } from "../../services/client";

const DEMO_ACCOUNTS = [
  {
    role: "Administrator",
    email: "admin@smartvend.in",
    password: "Admin@123",
    detail: "Full catalog, analytics & refund access",
  },
  {
    role: "Operator",
    email: "operator@smartvend.in",
    password: "Operator@123",
    detail: "Machines, inventory & transaction operations",
  },
];

function AutomataPreview() {
  return (
    <div className="relative hidden min-h-screen overflow-hidden bg-ink-950 lg:flex lg:flex-col">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_80%_10%,rgba(201,245,106,0.12),transparent),radial-gradient(circle_at_10%_80%,rgba(132,204,22,0.07),transparent_35%)]" />
      <div className="dot-grid absolute inset-0 opacity-30" />
      <div className="relative z-10 flex items-center justify-between px-10 pt-9">
        <Logo inverted />
        <span className="rounded-full border border-white/10 px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.18em] text-white/35">
          M = (Q, Σ, δ, q0, F)
        </span>
      </div>

      <div className="relative flex flex-1 items-center justify-center px-10">
        <div className="relative h-[460px] w-full max-w-[570px]">
          <svg className="absolute inset-0 h-full w-full" viewBox="0 0 570 460" fill="none">
            <defs>
              <marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                <path d="M0 0L8 4L0 8Z" fill="rgba(201,245,106,0.35)" />
              </marker>
            </defs>
            <g stroke="rgba(201,245,106,0.22)" strokeWidth="1.2" markerEnd="url(#arrow)">
              <path d="M150 230C205 140 275 120 350 145" />
              <path d="M382 155C454 176 478 215 492 262" />
              <path d="M492 292C475 362 405 395 330 385" />
              <path d="M298 374C215 360 161 323 142 278" />
              <path d="M145 255C180 330 280 370 360 352" strokeDasharray="4 5" />
            </g>
            <g>
              <circle cx="120" cy="245" r="30" fill="#141b11" stroke="#c9f56a" strokeWidth="1.5" />
              <circle cx="120" cy="245" r="23" fill="none" stroke="rgba(201,245,106,0.2)" strokeWidth="1" />
              <circle cx="350" cy="137" r="30" fill="#141b11" stroke="rgba(255,255,255,0.16)" />
              <circle cx="512" cy="276" r="35" fill="#c9f56a" />
              <circle cx="318" cy="388" r="30" fill="#141b11" stroke="rgba(255,255,255,0.16)" />
              <circle cx="90" cy="374" r="24" fill="#141b11" stroke="rgba(255,255,255,0.12)" />
            </g>
            <g fill="rgba(255,255,255,0.32)" fontFamily="JetBrains Mono, monospace" fontSize="8.5" letterSpacing="1">
              <text x="99" y="248">IDLE</text>
              <text x="322" y="140">PAYMENT</text>
              <text x="495" y="280" fill="#10140e" fontWeight="700">DONE</text>
              <text x="289" y="391">CHANGE</text>
            </g>
            <g fill="rgba(201,245,106,0.5)" fontFamily="JetBrains Mono, monospace" fontSize="7.5">
              <text x="225" y="163">SELECT</text>
              <text x="451" y="202">ACCEPT</text>
              <text x="381" y="358">DISPENSE</text>
            </g>
          </svg>

          <div className="absolute right-6 top-8 w-[190px] animate-float rounded-2xl border border-white/10 bg-white/[0.055] p-4 backdrop-blur-xl">
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-volt" />
              <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-white/40">
                Transition accepted
              </p>
            </div>
            <p className="mt-3 font-mono text-[11px] text-white/80">
              δ(PAYMENT_PENDING,
              <br />
              &nbsp;&nbsp;SUFFICIENT_AMOUNT)
            </p>
            <p className="mt-2 text-[11px] font-bold text-volt">→ PAYMENT_ACCEPTED</p>
          </div>

          <div className="absolute bottom-4 left-2 w-[215px] rounded-2xl border border-white/10 bg-white/[0.045] p-4 backdrop-blur-xl">
            <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/30">Balance</p>
            <div className="mt-2 flex items-end justify-between">
              <span className="font-display text-2xl font-extrabold text-white">₹80.00</span>
              <span className="rounded-full bg-volt/15 px-2 py-0.5 font-mono text-[9px] text-volt">
                SUFFICIENT
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="relative z-10 flex items-end justify-between px-10 pb-9">
        <div className="max-w-sm">
          <p className="font-display text-[19px] font-bold leading-snug tracking-[-0.02em] text-white">
            Retail operations,
            <br />
            modelled as a living automaton.
          </p>
          <p className="mt-2 text-xs leading-relaxed text-white/35">
            Every rupee and every product movement is guarded, validated and logged.
          </p>
        </div>
        <div className="text-right font-mono text-[9px] text-white/25">
          13 states
          <br />
          20 events
          <br />
          29 transitions
        </div>
      </div>
    </div>
  );
}

export function LoginPage() {
  const { login, isAuthenticated, loading: authLoading } = useAuth();
  const { error: toastError, success } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    document.title = "Sign in · SmartVend";
  }, []);

  if (!authLoading && isAuthenticated) {
    return <Navigate to="/admin" replace />;
  }

  const destination = location.state?.from?.pathname || "/admin";

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError("");
    setSubmitting(true);
    try {
      const user = await login(email.trim(), password);
      success(`Welcome back, ${user.full_name.split(" ")[0]}.`);
      navigate(destination, { replace: true });
    } catch (err) {
      const message = apiErrorMessage(err, "Unable to sign in.");
      setFormError(message);
      toastError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const fillAccount = (account) => {
    setEmail(account.email);
    setPassword(account.password);
    setFormError("");
  };

  return (
    <div className="grid min-h-screen bg-[#f5f6f2] lg:grid-cols-[1.06fr_1fr] dark:bg-[#0b0f0a]">
      <AutomataPreview />

      <div className="flex min-h-screen flex-col">
        <div className="flex items-center justify-between px-6 pt-6 sm:px-10 lg:px-14">
          <div className="lg:hidden">
            <Logo />
          </div>
          <Link
            to="/vending"
            className="ml-auto inline-flex items-center gap-2 text-xs font-semibold text-ink-500 transition hover:text-ink-950 dark:text-ink-400 dark:hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to vending
          </Link>
        </div>

        <div className="flex flex-1 items-center justify-center px-5 py-10 sm:px-10">
          <div className="w-full max-w-[400px] animate-fade-in">
            <span className="inline-flex items-center gap-2 rounded-full border border-ink-200 bg-white px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-ink-500 shadow-sm dark:border-white/10 dark:bg-white/5 dark:text-ink-300">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              Secure operations access
            </span>
            <h1 className="mt-5 font-display text-[34px] font-extrabold leading-[1.05] tracking-[-0.045em] text-ink-950 dark:text-white">
              Sign in to your
              <br />
              control room.
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-ink-500 dark:text-ink-400">
              Manage products, inventory, machines and every automaton transition from one
              beautifully boring place.
            </p>

            <form onSubmit={handleSubmit} className="mt-8 space-y-4">
              <div>
                <label className="label" htmlFor="email">
                  Work email
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="input h-12 pl-10"
                    placeholder="you@smartvend.in"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label className="label" htmlFor="password">
                    Password
                  </label>
                  <span className="mb-1.5 text-[11px] font-medium text-ink-400">
                    JWT secured
                  </span>
                </div>
                <div className="relative">
                  <LockKeyhole className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="input h-12 pl-10 pr-11"
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="absolute right-3 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-ink-400 hover:bg-ink-50 dark:hover:bg-white/10"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {formError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-xs font-medium text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
                  {formError}
                </div>
              )}

              <button type="submit" className="btn-primary h-12 w-full" disabled={submitting}>
                {submitting ? <Spinner className="h-4 w-4" /> : null}
                {submitting ? "Signing in…" : "Enter control room"}
                {!submitting && <ArrowRight className="h-4 w-4" />}
              </button>
            </form>

            <div className="mt-8">
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-ink-200 dark:bg-white/10" />
                <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink-400">
                  Demo credentials
                </span>
                <div className="h-px flex-1 bg-ink-200 dark:bg-white/10" />
              </div>
              <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
                {DEMO_ACCOUNTS.map((account) => (
                  <button
                    key={account.role}
                    type="button"
                    onClick={() => fillAccount(account)}
                    className="group rounded-xl border border-ink-200 bg-white p-3 text-left transition hover:-translate-y-0.5 hover:border-ink-300 hover:shadow-card dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-white/20"
                  >
                    <span className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-ink-800 dark:text-ink-100">
                        {account.role}
                      </span>
                      <span className="text-[9px] font-bold uppercase tracking-wider text-lime-700 opacity-0 transition group-hover:opacity-100 dark:text-volt">
                        Use
                      </span>
                    </span>
                    <span className="mt-1 block truncate font-mono text-[9px] text-ink-400">
                      {account.email}
                    </span>
                    <span className="mt-1.5 block text-[9px] leading-snug text-ink-400 dark:text-ink-500">
                      {account.detail}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <p className="mt-8 text-center text-[10px] leading-relaxed text-ink-400 dark:text-ink-500">
              Protected with PBKDF2 password hashing, JWT access tokens and role-based access
              control.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
