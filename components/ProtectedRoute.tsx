"use client";

import React, { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth.tsx";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
  loginPath?: "/admin/login" | "/receptionist/login";
}

const MANAGEMENT_ROLES = ["admin", "receptionist"];
const MANAGEMENT_LOGOUT_REDIRECT_KEY = "villahermosa-management-logout-redirect";

const getManagementLoginRedirect = (defaultLoginPath: "/admin/login" | "/receptionist/login") => {
  try {
    const pendingRedirect = sessionStorage.getItem(MANAGEMENT_LOGOUT_REDIRECT_KEY);
    if (pendingRedirect === "/admin/login" || pendingRedirect === "/receptionist/login") {
      sessionStorage.removeItem(MANAGEMENT_LOGOUT_REDIRECT_KEY);
      return pendingRedirect;
    }
  } catch {
    // Fall through to the default management login when storage is unavailable.
  }

  return defaultLoginPath;
};

export default function ProtectedRoute({ children, allowedRoles, loginPath = "/admin/login" }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push(getManagementLoginRedirect(loginPath));
      return;
    }

    if (!isLoading && isAuthenticated && user) {
      const routeRoles = allowedRoles || MANAGEMENT_ROLES;

      if (!routeRoles.includes(user.role)) {
        router.push(loginPath);
        return;
      }
    }
  }, [isLoading, isAuthenticated, user, router, allowedRoles, loginPath]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null; // Router will redirect to login
  }

  const routeRoles = allowedRoles || MANAGEMENT_ROLES;
  if (user && !routeRoles.includes(user.role)) {
    return null;
  }

  return <>{children}</>;
}
