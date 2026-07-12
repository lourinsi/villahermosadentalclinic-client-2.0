"use client";

import React, { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2, ServerCog, ShieldCheck, WifiOff } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  SESSION_EXPIRED_MESSAGE,
  clearPendingAuthRedirect,
  rememberAuthRedirect,
} from "@/lib/auth-redirect";
import {
  BACKEND_STARTUP_TIMEOUT_MS,
  waitForNextCheck,
} from "@/lib/backend-readiness";
import {
  MANAGEMENT_LOGOUT_REDIRECT_KEY,
  STAFF_PORTAL_LOGIN_PATH,
  getManagementDashboardPath,
  isManagementRole,
} from "@/lib/management-routes";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
  loginPath?: string;
}

export type ProtectedRouteState =
  | "checking-session"
  | "checking-backend"
  | "starting-backend"
  | "restoring-session"
  | "ready"
  | "session-expired"
  | "unavailable";

const MANAGEMENT_ROLES = ["admin", "doctor", "receptionist"];

const getManagementLoginRedirect = (defaultLoginPath: string) => {
  try {
    const pendingRedirect = sessionStorage.getItem(MANAGEMENT_LOGOUT_REDIRECT_KEY);
    if (pendingRedirect === STAFF_PORTAL_LOGIN_PATH) {
      sessionStorage.removeItem(MANAGEMENT_LOGOUT_REDIRECT_KEY);
      return pendingRedirect;
    }
  } catch {
    // Fall through to the default management login when storage is unavailable.
  }

  return defaultLoginPath;
};

const getIntendedPath = (pathname: string) => {
  if (typeof window === "undefined") return pathname;
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
};

function StartupState({ state, onRetry }: {
  state: Exclude<ProtectedRouteState, "ready">;
  onRetry: () => void;
}) {
  const isUnavailable = state === "unavailable";
  const isExpired = state === "session-expired";
  const isStarting = state === "checking-backend" || state === "starting-backend";

  const title = isUnavailable
    ? "The clinic server is temporarily unavailable"
    : isExpired
      ? "Your session has expired"
      : isStarting
        ? "Starting the clinic server…"
        : state === "restoring-session"
          ? "Restoring your session…"
          : "Checking your session…";

  const description = isUnavailable
    ? "Your session is still intact. The server is taking longer than expected to respond."
    : isExpired
      ? "Please sign in again to continue."
      : isStarting
        ? "The server is restarting after being inactive. This page will continue automatically when it is ready."
        : state === "restoring-session"
          ? "The server is ready. We’re securely confirming your sign-in."
          : "We’re checking for an existing sign-in on this device.";

  const Icon = isUnavailable ? WifiOff : isExpired ? ShieldCheck : isStarting ? ServerCog : ShieldCheck;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 px-4">
      <div
        className="w-full max-w-lg rounded-3xl border border-white/80 bg-white/90 p-8 text-center shadow-xl shadow-slate-200/70 backdrop-blur sm:p-10"
        role={isUnavailable ? "alert" : "status"}
        aria-live="polite"
      >
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-200">
          {isUnavailable || isExpired ? (
            <Icon className="h-8 w-8" />
          ) : (
            <Loader2 className="h-8 w-8 animate-spin" />
          )}
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
          {title}
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-600 sm:text-base">
          {description}
        </p>

        {isUnavailable && (
          <Button onClick={onRetry} className="mt-7 min-w-32 rounded-xl">
            Try again
          </Button>
        )}
      </div>
    </div>
  );
}

export default function ProtectedRoute({
  children,
  allowedRoles,
  loginPath = STAFF_PORTAL_LOGIN_PATH,
}: ProtectedRouteProps) {
  const {
    isAuthenticated,
    user,
    checkAuth,
    hasStoredSession,
    clearAuthState,
  } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const intendedPath = useRef(pathname);
  const [state, setState] = useState<ProtectedRouteState>("checking-session");
  const [attempt, setAttempt] = useState(0);
  const startupDependencies = useRef({
    checkAuth,
    clearAuthState,
    hasStoredSession,
    loginPath,
    router,
  });
  startupDependencies.current = {
    checkAuth,
    clearAuthState,
    hasStoredSession,
    loginPath,
    router,
  };

  useEffect(() => {
    const controller = new AbortController();
    const requestedPath = getIntendedPath(intendedPath.current);
    const startup = startupDependencies.current;

    const redirectToLogin = (expired: boolean) => {
      rememberAuthRedirect(
        requestedPath,
        expired ? SESSION_EXPIRED_MESSAGE : undefined
      );
      startup.router.replace(getManagementLoginRedirect(startup.loginPath));
    };

    const restoreProtectedSession = async () => {
      setState("checking-session");

      // The project mirrors its JWT to localStorage. Its presence is only a
      // session hint; the backend remains the authority after it is healthy.
      if (!startup.hasStoredSession()) {
        redirectToLogin(false);
        return;
      }

      setState("checking-backend");
      const deadline = Date.now() + BACKEND_STARTUP_TIMEOUT_MS;
      let waitingWasReported = false;

      while (!controller.signal.aborted && Date.now() < deadline) {
        setState("restoring-session");
        const validation = await startup.checkAuth({ signal: controller.signal });
        if (controller.signal.aborted || validation.kind === "aborted") return;

        if (validation.kind === "authenticated") {
          clearPendingAuthRedirect();
          setState("ready");
          return;
        }

        if (validation.kind === "unauthorized") {
          startup.clearAuthState();
          setState("session-expired");
          redirectToLogin(true);
          return;
        }

        if (!waitingWasReported) {
          waitingWasReported = true;
          setState("starting-backend");
        }

        const remainingMs = Math.max(0, deadline - Date.now());
        const delayUntilNextAttempt = Math.min(4_000, remainingMs);

        if (
          delayUntilNextAttempt > 0 &&
          !(await waitForNextCheck(delayUntilNextAttempt, controller.signal))
        ) {
          return;
        }
      }

      // A 403 is an authorization outcome, and 5xx/network failures are
      // availability outcomes. Neither is proof that the session expired.
      setState("unavailable");
    };

    void restoreProtectedSession();

    // `attempt` is the deliberate restart switch. Reading framework/context
    // dependencies through a ref prevents render identity changes from
    // creating parallel polling loops, including under React Strict Mode.
    return () => controller.abort();
  }, [attempt]);

  useEffect(() => {
    if (state !== "ready" || !isAuthenticated || !user) return;

    const routeRoles = allowedRoles || MANAGEMENT_ROLES;
    const hasAccess =
      routeRoles.includes(user.role) ||
      (routeRoles === MANAGEMENT_ROLES && isManagementRole(user.role));

    if (!hasAccess) {
      router.replace(getManagementDashboardPath(user.role) || loginPath);
    }
  }, [allowedRoles, isAuthenticated, loginPath, router, state, user]);

  if (state !== "ready") {
    return (
      <StartupState
        state={state}
        onRetry={() => setAttempt((current) => current + 1)}
      />
    );
  }

  if (!isAuthenticated || !user) {
    return <StartupState state="restoring-session" onRetry={() => undefined} />;
  }

  const routeRoles = allowedRoles || MANAGEMENT_ROLES;
  if (
    !routeRoles.includes(user.role) &&
    !(routeRoles === MANAGEMENT_ROLES && isManagementRole(user.role))
  ) {
    return null;
  }

  return <>{children}</>;
}
