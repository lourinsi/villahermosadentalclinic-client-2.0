"use client";

import AdminLayout from "@/components/AdminLayout";
import ProtectedRoute from "@/components/ProtectedRoute";
import { usePathname } from "next/navigation";
import * as Lucide from "lucide-react";

const Search = (Lucide as any)?.Search ?? (() => null);

export default function Layout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === "/admin/login";

  if (isLoginPage) {
    return <>{children}</>;
  }

  return (
    <ProtectedRoute allowedRoles={["admin", "receptionist"]}>
      <AdminLayout>{children}</AdminLayout>
    </ProtectedRoute>
  );
}
