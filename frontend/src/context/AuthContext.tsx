import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import axios from "axios";
import type { AuthUser, UserRole } from "@/lib/auth";
import { registerAuthFailureHandler } from "@/lib/authSignal";
import { getProfile } from "@/lib/authApi";

type AuthContextValue = {
  user: AuthUser | null;
  isLoading: boolean;
  setUser: (user: AuthUser) => void;
  clearUser: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function toRole(roles: string[]): UserRole {
  return roles.map((r) => r.toLowerCase()).includes("admin") ? "admin" : "user";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const setUser = useCallback((u: AuthUser) => setUserState(u), []);

  const clearUser = useCallback(() => setUserState(null), []);

  // Let api.ts call clearUser when a 401 cannot be recovered
  useEffect(() => {
    registerAuthFailureHandler(clearUser);
  }, [clearUser]);

  // Rehydrate from the backend cookie on every page load
  useEffect(() => {
    getProfile()
      .then((res) => {
        if (res.success) {
          const u = res.data;
          setUserState({
            userId: u.userId,
            name: u.name,
            email: u.email,
            role: toRole(u.roles),
          });
        }
      })
      .catch((err) => {
        // 401 means the user is simply not authenticated — expected, no action needed.
        // Any other status (network failure, 500, etc.) is unexpected; log it for diagnostics.
        if (!axios.isAxiosError(err) || (err.response?.status ?? 0) !== 401) {
          console.error("[AuthContext] Failed to rehydrate session:", err);
        }
      })
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, setUser, clearUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
