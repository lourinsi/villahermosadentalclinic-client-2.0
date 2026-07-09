"use client";

import AdminLayout, { adminLayoutTheme } from "@/components/AdminLayout";
import { receptionistLayoutTheme } from "@/components/ReceptionistLayout";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAdminViewMode } from "@/hooks/useAdminViewMode";

export default function Layout({ children }: { children: React.ReactNode }) {
  const { isReceptionistView } = useAdminViewMode();

  return (
    <ProtectedRoute allowedRoles={["admin", "doctor", "receptionist"]}>
      <AdminLayout
        portalTitle={isReceptionistView ? "Receptionist" : "Admin"}
        theme={isReceptionistView ? receptionistLayoutTheme : adminLayoutTheme}
      >
        {children}
      </AdminLayout>
    </ProtectedRoute>
  );
}
