"use client";

import AdminLayout from "@/components/AdminLayout";
import ReceptionistLayout from "@/components/ReceptionistLayout";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAdminViewMode } from "@/hooks/useAdminViewMode";

export default function Layout({ children }: { children: React.ReactNode }) {
  const { isReceptionistView } = useAdminViewMode();
  const ManagementLayout = isReceptionistView ? ReceptionistLayout : AdminLayout;

  return (
    <ProtectedRoute allowedRoles={["admin", "doctor", "receptionist"]}>
      <ManagementLayout>{children}</ManagementLayout>
    </ProtectedRoute>
  );
}
