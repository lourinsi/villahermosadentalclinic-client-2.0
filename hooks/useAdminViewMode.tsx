"use client";

import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";

export type AdminViewMode = "admin" | "receptionist";

interface AdminViewModeContextType {
  viewMode: AdminViewMode;
  effectiveRole: string | undefined;
  isReceptionistView: boolean;
  canSwitchAdminView: boolean;
  setViewMode: (mode: AdminViewMode) => void;
  toggleViewMode: () => void;
}

const STORAGE_KEY = "adminViewMode";

const AdminViewModeContext = createContext<AdminViewModeContextType | undefined>(undefined);

const isAdminViewMode = (value: string | null): value is AdminViewMode =>
  value === "admin" || value === "receptionist";

export function AdminViewModeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [viewMode, setViewModeState] = useState<AdminViewMode>("admin");
  const userRole = user?.role;
  const canSwitchAdminView = userRole === "admin";

  useEffect(() => {
    if (userRole === "admin") {
      try {
        const savedMode = localStorage.getItem(STORAGE_KEY);
        if (isAdminViewMode(savedMode)) {
          setViewModeState(savedMode);
          return;
        }
      } catch {
        // Ignore storage failures in restricted browser contexts.
      }
      setViewModeState("admin");
      return;
    }

    setViewModeState(userRole === "receptionist" ? "receptionist" : "admin");
  }, [userRole]);

  const setViewMode = useCallback((mode: AdminViewMode) => {
    const nextMode = canSwitchAdminView ? mode : userRole === "receptionist" ? "receptionist" : "admin";
    setViewModeState(nextMode);

    if (canSwitchAdminView) {
      try {
        localStorage.setItem(STORAGE_KEY, nextMode);
      } catch {
        // Ignore storage failures in restricted browser contexts.
      }
    }
  }, [canSwitchAdminView, userRole]);

  const toggleViewMode = useCallback(() => {
    setViewMode(viewMode === "admin" ? "receptionist" : "admin");
  }, [setViewMode, viewMode]);

  const value = useMemo<AdminViewModeContextType>(() => {
    const effectiveRole = userRole === "admin" ? viewMode : userRole;

    return {
      viewMode,
      effectiveRole,
      isReceptionistView: effectiveRole === "receptionist",
      canSwitchAdminView,
      setViewMode,
      toggleViewMode,
    };
  }, [canSwitchAdminView, setViewMode, toggleViewMode, userRole, viewMode]);

  return (
    <AdminViewModeContext.Provider value={value}>
      {children}
    </AdminViewModeContext.Provider>
  );
}

export function useAdminViewMode() {
  const context = useContext(AdminViewModeContext);
  if (!context) {
    throw new Error("useAdminViewMode must be used within AdminViewModeProvider");
  }
  return context;
}
