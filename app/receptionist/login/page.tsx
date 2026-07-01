"use client";

import { apiUrl } from "@/lib/api";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, ClipboardList, Loader2, Lock, User } from "lucide-react";
import { useAuth } from "@/hooks/useAuth.tsx";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function ReceptionistLoginPage() {
  const { login, logout, isLoading, user } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const fillDemoCredentials = () => {
    setUsername("hannah@villahermosa");
    setPassword("password");
    setShowPassword(true);
  };

  useEffect(() => {
    if (!isLoading && (user?.role === "receptionist" || user?.role === "admin")) {
      router.replace("/receptionist/dashboard");
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
      if (data.user?.role === "receptionist") {
        toast.success("Receptionist login successful!");
        router.push("/receptionist/dashboard");
        return;
      }

      await logout();
      toast.error("Unauthorized: This portal is for receptionists only.");
    } catch (error) {
      console.error("[RECEPTIONIST LOGIN] Error:", error);
      toast.error(error instanceof Error ? error.message : "Login failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-50 to-blue-100 p-4">
      <Card className="w-full max-w-md shadow-2xl relative z-10 border-0">
        <CardHeader className="space-y-2 text-center pb-8">
          <Link
            href="/"
            className="flex items-center text-blue-600 hover:text-blue-700 text-sm font-medium mb-4 transition-colors justify-center"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to Home
          </Link>

          <div className="flex justify-center mb-4">
            <div className="bg-gradient-to-br from-sky-500 to-blue-600 p-3 rounded-lg">
              <ClipboardList className="w-8 h-8 text-white" />
            </div>
          </div>
          <CardTitle className="text-3xl font-bold text-gray-900">
            Receptionist Portal
          </CardTitle>
          <CardDescription className="text-gray-600">
            Front Desk Access
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="username" className="text-sm font-medium text-gray-700">
                Username or Email
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  id="username"
                  data-tour-id="receptionist-login-username"
                  type="text"
                  placeholder="Enter your username or email"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  disabled={isLoading || isSubmitting}
                  className="pl-10 h-10 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  autoComplete="username"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium text-gray-700">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  id="password"
                  data-tour-id="receptionist-login-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={isLoading || isSubmitting}
                  className="pl-10 pr-10 h-10 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-500 hover:text-gray-700"
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
              className="w-full h-10 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white font-medium rounded-lg transition-all duration-200 mt-6"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Signing in...
                </>
              ) : (
                "Sign In"
              )}
            </Button>

            <div
              data-tour-id="receptionist-login-demo-card"
              className="mt-6 p-4 bg-sky-50 rounded-lg border border-sky-200"
            >
              <p className="text-xs font-semibold text-sky-900 mb-2">Demo Credentials:</p>
              <p className="text-xs text-sky-800 font-mono">
                <strong>Email:</strong> hannah@villahermosa<br />
                <strong>Password:</strong> password
              </p>
              <Button
                type="button"
                variant="outline"
                data-tour-id="receptionist-demo-fill"
                onClick={fillDemoCredentials}
                className="mt-3 h-9 w-full border-sky-200 bg-white text-xs font-bold text-sky-700 hover:bg-sky-50"
              >
                Use demo credentials
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
