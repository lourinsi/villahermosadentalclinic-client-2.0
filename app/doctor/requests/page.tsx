"use client";

import { RequestsView } from "@/components/RequestsView";
import { useAuth } from "@/hooks/useAuth.tsx";

export default function DoctorRequestsPage() {
  const { user } = useAuth();
  const doctorName = user?.username || "";

  return <RequestsView doctorFilter={doctorName} />;
}
