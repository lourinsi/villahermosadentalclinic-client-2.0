"use client";

import { apiUrl } from "@/lib/api";
import { getAuthHeaders } from "@/lib/auth-headers";
import React, {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";

export interface AuthUser {
  username: string;
  role: string;
  patientId?: string;
  staffId?: string;
  mustChangePassword?: boolean;
}

export type SessionValidationResult =
  | { kind: "authenticated"; user: AuthUser }
  | { kind: "unauthorized" }
  | { kind: "forbidden" }
  | { kind: "unavailable" }
  | { kind: "aborted" };

type CheckAuthOptions = {
  signal?: AbortSignal;
};

interface AuthContextType {
  isAuthenticated: boolean;
  user: AuthUser | null;
  login: (username: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  isLoading: boolean;
  checkAuth: (options?: CheckAuthOptions) => Promise<SessionValidationResult>;
  hasStoredSession: () => boolean;
  clearAuthState: () => void;
}

const AUTH_REQUEST_TIMEOUT_MS = 15_000;
const LOGOUT_REQUEST_TIMEOUT_MS = 8_000;

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const normalizeUser = (value: unknown): AuthUser | null => {
  if (!value || typeof value !== "object") return null;

  const candidate = value as Record<string, unknown>;
  if (typeof candidate.username !== "string" || typeof candidate.role !== "string") {
    return null;
  }

  return {
    username: candidate.username,
    role: candidate.role,
    patientId:
      typeof candidate.patientId === "string" ? candidate.patientId : undefined,
    staffId: typeof candidate.staffId === "string" ? candidate.staffId : undefined,
    mustChangePassword: Boolean(candidate.mustChangePassword),
  };
};

const fetchWithTimeout = async (
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs: number,
  parentSignal?: AbortSignal
) => {
  const controller = new AbortController();
  const abortFromParent = () => controller.abort();

  if (parentSignal?.aborted) {
    controller.abort();
  } else {
    parentSignal?.addEventListener("abort", abortFromParent, { once: true });
  }

  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timeout);
    parentSignal?.removeEventListener("abort", abortFromParent);
  }
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const hasInMemorySession = useRef(false);

  const hasStoredSession = useCallback(() => {
    if (hasInMemorySession.current) return true;
    if (typeof window === "undefined") return false;

    try {
      return Boolean(localStorage.getItem("authToken")?.trim());
    } catch {
      return false;
    }
  }, []);

  const clearAuthState = useCallback(() => {
    hasInMemorySession.current = false;
    setIsAuthenticated(false);
    setUser(null);

    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem("authToken");
      } catch {
        // React state is still cleared when storage is unavailable.
      }
    }
  }, []);

  const checkAuth = useCallback(
    async (options: CheckAuthOptions = {}): Promise<SessionValidationResult> => {
      setIsLoading(true);

      try {
        const response = await fetchWithTimeout(
          apiUrl("/api/auth/verify"),
          {
            method: "GET",
            credentials: "include",
            cache: "no-store",
            headers: getAuthHeaders({ Accept: "application/json" }),
          },
          AUTH_REQUEST_TIMEOUT_MS,
          options.signal
        );

        if (response.status === 401) return { kind: "unauthorized" };
        if (response.status === 403) return { kind: "forbidden" };
        if (!response.ok) return { kind: "unavailable" };

        const payload = await response.json().catch(() => null);
        const verifiedUser = normalizeUser(payload?.user);
        if (!verifiedUser) return { kind: "unavailable" };

        setIsAuthenticated(true);
        hasInMemorySession.current = true;
        setUser(verifiedUser);
        return { kind: "authenticated", user: verifiedUser };
      } catch {
        return options.signal?.aborted
          ? { kind: "aborted" }
          : { kind: "unavailable" };
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const login = useCallback(async (username: string, password: string) => {
    setIsLoading(true);

    try {
      let response: Response;
      try {
        response = await fetchWithTimeout(
          apiUrl("/api/auth/login"),
          {
            method: "POST",
            credentials: "include",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify({ username, password }),
          },
          AUTH_REQUEST_TIMEOUT_MS
        );
      } catch {
        throw new Error(
          "The clinic server is starting or temporarily unavailable. Please wait a moment and try again."
        );
      }

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("The username or password is incorrect.");
        }

        if (response.status >= 500) {
          throw new Error(
            "The clinic server is temporarily unavailable. Please wait a moment and try again."
          );
        }

        throw new Error(
          typeof payload?.message === "string"
            ? payload.message
            : "We could not sign you in. Please check your details and try again."
        );
      }

      const authenticatedUser = normalizeUser(payload?.user);
      if (!authenticatedUser || typeof payload?.token !== "string") {
        throw new Error(
          "We could not restore your session. Please wait a moment and try again."
        );
      }

      try {
        localStorage.setItem("authToken", payload.token);
      } catch {
        // The in-memory session still works for the current tab.
      }

      setIsAuthenticated(true);
      hasInMemorySession.current = true;
      setUser(authenticatedUser);
      return authenticatedUser;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setIsLoading(true);
    const headers = getAuthHeaders({ "Content-Type": "application/json" });

    // Explicit logout is a local decision first. The server call only clears the
    // HttpOnly cookie and is never retried, because it is a write request.
    clearAuthState();

    try {
      await fetchWithTimeout(
        apiUrl("/api/auth/logout"),
        {
          method: "POST",
          credentials: "include",
          headers,
        },
        LOGOUT_REQUEST_TIMEOUT_MS
      );
    } catch {
      // Local logout remains complete if Render is unavailable.
    } finally {
      setIsLoading(false);
    }
  }, [clearAuthState]);

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        user,
        login,
        logout,
        isLoading,
        checkAuth,
        hasStoredSession,
        clearAuthState,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
