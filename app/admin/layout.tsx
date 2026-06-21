"use client";

import AdminLayout from "@/components/AdminLayout";
import ReceptionistLayout from "@/components/ReceptionistLayout";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAdminViewMode } from "@/hooks/useAdminViewMode";
import { usePathname } from "next/navigation";

export default function Layout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { isReceptionistView } = useAdminViewMode();
  const isLoginPage = pathname === "/admin/login";
  const ManagementLayout = isReceptionistView ? ReceptionistLayout : AdminLayout;

  if (isLoginPage) {
    return <>{children}</>;
  }

  return (
    <ProtectedRoute allowedRoles={["admin", "receptionist"]}>
      <ManagementLayout>{children}</ManagementLayout>
    </ProtectedRoute>
  );
}
