import PatientLayout from "@/components/PatientLayout";
import ProtectedRoute from "@/components/ProtectedRoute";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute allowedRoles={["patient"]}>
      <PatientLayout>{children}</PatientLayout>
    </ProtectedRoute>
  );
}
