"use client";

import DoctorLayout from "@/components/DoctorLayout";
import ProtectedRoute from "@/components/ProtectedRoute";
import { usePathname } from "next/navigation";

export default function Layout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === "/doctor/login";

  if (isLoginPage) {
    return <>{children}</>;
  }

  return (
    <ProtectedRoute allowedRoles={["doctor", "admin"]}>
      <DoctorLayout>{children}</DoctorLayout>
    </ProtectedRoute>
  );
}
