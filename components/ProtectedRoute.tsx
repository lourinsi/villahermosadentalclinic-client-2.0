"use client";

import React, { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth.tsx";
import { useRouter, usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

export default function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/login");
      return;
    }

    // Role-based access control
    if (!isLoading && isAuthenticated && user) {
      // If allowedRoles is specified, check if user has the required role
      if (allowedRoles && !allowedRoles.includes(user.role)) {
        // Redirect to appropriate dashboard based on role
        if (user.role === "doctor") {
          router.push("/doctor/dashboard");
        } else {
          router.push("/admin/dashboard");
        }
        return;
      }

      // Redirect doctors away from admin routes
      if (user.role === "doctor" && pathname?.startsWith("/admin")) {
        router.push("/doctor/dashboard");
        return;
      }

      // Redirect admins away from doctor routes (optional - admins can access everything)
      // if (user.role === "admin" && pathname?.startsWith("/doctor")) {
      //   router.push("/admin/dashboard");
      //   return;
      // }
    }
  }, [isLoading, isAuthenticated, user, router, pathname, allowedRoles]);

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

  // Check role-based access
  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return null; // Router will redirect
  }

  return <>{children}</>;
}
