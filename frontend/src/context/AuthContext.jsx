import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { authService } from "../services/auth";
import { getToken } from "../services/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(getToken()));

  useEffect(() => {
    let active = true;
    async function bootstrap() {
      if (!getToken()) {
        setLoading(false);
        return;
      }
      try {
        const me = await authService.me();
        if (active) setUser(me);
      } catch {
        authService.logout();
      } finally {
        if (active) setLoading(false);
      }
    }
    bootstrap();
    const onUnauthorized = () => {
      setUser(null);
      setLoading(false);
    };
    window.addEventListener("smartvend:unauthorized", onUnauthorized);
    return () => {
      active = false;
      window.removeEventListener("smartvend:unauthorized", onUnauthorized);
    };
  }, []);

  const login = useCallback(async (email, password) => {
    const data = await authService.login(email, password);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(() => {
    authService.logout();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      isAuthenticated: Boolean(user),
      login,
      logout,
      isAdmin: user?.role === "admin",
      isStaff: user?.role === "admin" || user?.role === "operator",
    }),
    [user, loading, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
