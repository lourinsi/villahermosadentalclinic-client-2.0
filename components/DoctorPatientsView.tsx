"use client";

import { useAuth } from "@/hooks/useAuth.tsx";
import { PatientsView } from "./PatientsView";

export function DoctorPatientsView() {
  const { user } = useAuth();
  const doctorName = user?.username || "";

  // Use the full PatientsView component with doctor filter
  // This provides all the same functionality as admin but filtered to this doctor's patients
  return <PatientsView doctorFilter={doctorName} />;
}
