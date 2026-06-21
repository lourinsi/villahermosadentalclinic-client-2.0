"use client";

import { apiUrl } from "@/lib/api";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth.tsx";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Lock, User, Loader2, Settings, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function AdminLoginPage() {
  const { login, logout, isLoading, user } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const fillDemoCredentials = () => {
    setUsername("admin");
    setPassword("password");
    setShowPassword(true);
  };

  useEffect(() => {
    if (!isLoading && user?.role === "admin") {
      router.replace("/admin/dashboard");
    }
  }, [isLoading, router, user]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!username.trim() || !password.trim()) {
      toast.error("Please enter both username and password");
      return;
    }

    try {
      setIsSubmitting(true);
      await login(username, password);
      
      // The user is now logged in, but we must verify their role for this portal
      const response = await fetch(apiUrl("/api/auth/verify"), {
        method: "GET",
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        if (data.user?.role === "admin") {
          toast.success("Admin login successful!");
          router.push("/admin/dashboard");
        } else {
          // Wrong portal! Logout immediately
          await logout();
          toast.error("Unauthorized: This portal is for Admins only.");
        }
      } else {
        await logout();
        toast.error("Verification failed. Please try again.");
      }
    } catch (error) {
      console.error("[ADMIN LOGIN] Error:", error);
      toast.error(error instanceof Error ? error.message : "Login failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      {/* Decorative background elements */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-blue-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse"></div>
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-indigo-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse"></div>

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
            <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-3 rounded-lg">
              <Settings className="w-8 h-8 text-white" />
            </div>
          </div>
          <CardTitle className="text-3xl font-bold text-gray-900">
            Admin Portal
          </CardTitle>
          <CardDescription className="text-gray-600">
            Clinic Management System
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            {/* Username Field */}
            <div className="space-y-2">
              <label htmlFor="username" className="text-sm font-medium text-gray-700">
                Username
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  id="username"
                  data-tour-id="admin-login-username"
                  type="text"
                  placeholder="Enter your username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={isLoading || isSubmitting}
                  className="pl-10 h-10 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  autoComplete="username"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium text-gray-700">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  id="password"
                  data-tour-id="admin-login-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading || isSubmitting}
                  className="pl-10 pr-10 h-10 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  disabled={isLoading || isSubmitting}
                >
                  {showPassword ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-4.803m5.596-3.856a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0z" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Login Button */}
            <Button
              type="submit"
              data-tour-id="admin-login-submit"
              disabled={isLoading || isSubmitting}
              className="w-full h-10 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-medium rounded-lg transition-all duration-200 mt-6"
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

            {/* Demo Credentials */}
            <div
              data-tour-id="admin-login-demo-card"
              className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200"
            >
              <p className="text-xs font-semibold text-blue-900 mb-2">Demo Credentials:</p>
              <p className="text-xs text-blue-800 font-mono">
                <strong>Username:</strong> admin<br />
                <strong>Password:</strong> password
              </p>
              <Button
                type="button"
                variant="outline"
                data-tour-id="admin-demo-fill"
                onClick={fillDemoCredentials}
                className="mt-3 h-9 w-full border-blue-200 bg-white text-xs font-bold text-blue-700 hover:bg-blue-50"
              >
                Use demo credentials
              </Button>
            </div>

            {/* Footer */}
            <p className="text-center text-xs text-gray-500 mt-4">
              © 2025 Villahermosa Dental Clinic. All rights reserved.
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
