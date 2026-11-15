import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { PageLoader } from "./ui/Spinner";

export function ProtectedRoute({ roles }) {
  const { isAuthenticated, loading, user } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f5f6f2] dark:bg-[#0b0f0a]">
        <PageLoader label="Restoring secure session" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" state={{ from: location }} replace />;
  }

  if (roles && !roles.includes(user.role)) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#f5f6f2] px-6 dark:bg-[#0b0f0a]">
        <div className="panel max-w-md p-8 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400">
            <span className="text-xl font-black">403</span>
          </div>
          <h1 className="mt-5 font-display text-xl font-bold text-ink-950 dark:text-white">
            Access restricted
          </h1>
          <p className="mt-2 text-sm text-ink-500 dark:text-ink-400">
            Your role does not have permission to open this area.
          </p>
        </div>
      </div>
    );
  }

  return <Outlet />;
}
