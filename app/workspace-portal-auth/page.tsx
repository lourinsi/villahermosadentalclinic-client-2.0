"use client";

import { apiUrl } from "@/lib/api";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Lock, ShieldCheck, User } from "lucide-react";
import { useAuth } from "@/hooks/useAuth.tsx";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getManagementDashboardPath } from "@/lib/management-routes";

export default function StaffPortalLoginPage() {
  const { login, logout, isLoading, user } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      const dashboardPath = getManagementDashboardPath(user?.role);
      if (dashboardPath) {
        router.replace(dashboardPath);
      }
    }
  }, [isLoading, router, user]);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!username.trim() || !password.trim()) {
      toast.error("Please enter both username and password");
      return;
    }

    try {
      setIsSubmitting(true);
      await login(username, password);

      const response = await fetch(apiUrl("/api/auth/verify"), {
        method: "GET",
        credentials: "include",
      });

      if (!response.ok) {
        await logout();
        toast.error("Verification failed. Please try again.");
        return;
      }

      const data = await response.json();
      const dashboardPath = getManagementDashboardPath(data.user?.role);
      if (dashboardPath) {
        toast.success("Staff login successful");
        router.push(dashboardPath);
        return;
      }

      await logout();
      toast.error("Unauthorized: This portal is for internal clinic staff only.");
    } catch (error) {
      console.error("[STAFF PORTAL LOGIN] Error:", error);
      toast.error(error instanceof Error ? error.message : "Login failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <Card className="relative z-10 w-full max-w-md border-slate-200 shadow-xl">
        <CardHeader className="space-y-2 pb-8 text-center">
          <Link
            href="/"
            className="mb-4 flex items-center justify-center text-sm font-medium text-slate-600 transition-colors hover:text-slate-900"
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back to Home
          </Link>

          <div className="mb-4 flex justify-center">
            <div className="rounded-lg bg-slate-900 p-3">
              <ShieldCheck className="h-8 w-8 text-white" />
            </div>
          </div>
          <CardTitle className="text-3xl font-bold text-slate-950">
            Staff Portal
          </CardTitle>
          <CardDescription className="text-slate-600">
            Internal workspace access
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="username" className="text-sm font-medium text-slate-700">
                Username or Email
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <Input
                  id="username"
                  data-tour-id="receptionist-login-username"
                  type="text"
                  placeholder="Enter your username or email"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  disabled={isLoading || isSubmitting}
                  className="h-10 border-slate-300 pl-10 focus:border-slate-500 focus:ring-slate-500"
                  autoComplete="username"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium text-slate-700">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <Input
                  id="password"
                  data-tour-id="receptionist-login-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={isLoading || isSubmitting}
                  className="h-10 border-slate-300 pl-10 pr-10 focus:border-slate-500 focus:ring-slate-500"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500 hover:text-slate-700"
                  disabled={isLoading || isSubmitting}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              data-tour-id="receptionist-login-submit"
              disabled={isLoading || isSubmitting}
              className="mt-6 h-10 w-full rounded-lg bg-slate-900 font-medium text-white transition-colors hover:bg-slate-800"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                "Sign In"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
