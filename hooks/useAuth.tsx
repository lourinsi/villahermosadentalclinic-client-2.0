"use client";

import { apiUrl } from "@/lib/api";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface User {
  username: string;
  role: string;
  patientId?: string;
  staffId?: string;
}

interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isLoading: boolean;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const clearAuthState = () => {
    setIsAuthenticated(false);
    setUser(null);
    if (typeof window !== "undefined") {
      localStorage.removeItem("authToken");
    }
  };

  // Check if user is already authenticated on mount
  useEffect(() => {
    (async () => {
      await checkAuth();
    })();
  }, []);

  const checkAuth = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(apiUrl("/api/auth/verify"), {
        method: "GET",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        const data = await response.json();
        setIsAuthenticated(true);
        setUser({
          username: data.user.username,
          role: data.user.role,
          patientId: data.user.patientId,
          staffId: data.user.staffId,
        });
      } else {
        clearAuthState();
      }
    } catch (error) {
      console.error("[AUTH] Verification error:", error);
      clearAuthState();
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (username: string, password: string) => {
    try {
      setIsLoading(true);
      const response = await fetch(apiUrl("/api/auth/login"), {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Login failed");
      }

      setIsAuthenticated(true);
      setUser({
        username: data.user.username,
        role: data.user.role,
        patientId: data.user.patientId,
        staffId: data.user.staffId,
      });

      // Store token in localStorage for client-side use (optional)
      if (data.token) {
        localStorage.setItem("authToken", data.token);
      }
    } catch (error) {
      clearAuthState();
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      setIsLoading(true);
      await fetch(apiUrl("/api/auth/logout"), {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
      });

      clearAuthState();
    } catch (error) {
      console.error("[AUTH] Logout error:", error);
      clearAuthState();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, login, logout, isLoading, checkAuth }}>
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
