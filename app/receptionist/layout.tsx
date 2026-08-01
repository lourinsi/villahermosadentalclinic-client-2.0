"use client";

import ReceptionistLayout from "@/components/ReceptionistLayout";
import ProtectedRoute from "@/components/ProtectedRoute";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute allowedRoles={["admin", "doctor", "receptionist"]}>
      <ReceptionistLayout>{children}</ReceptionistLayout>
    </ProtectedRoute>
  );
}
