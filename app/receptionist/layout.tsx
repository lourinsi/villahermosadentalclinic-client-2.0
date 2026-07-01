"use client";

import ReceptionistLayout from "@/components/ReceptionistLayout";
import ProtectedRoute from "@/components/ProtectedRoute";
import { usePathname } from "next/navigation";

export default function Layout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === "/receptionist/login";

  if (isLoginPage) {
    return <>{children}</>;
  }

  return (
    <ProtectedRoute allowedRoles={["receptionist"]} loginPath="/receptionist/login">
      <ReceptionistLayout>{children}</ReceptionistLayout>
    </ProtectedRoute>
  );
}
