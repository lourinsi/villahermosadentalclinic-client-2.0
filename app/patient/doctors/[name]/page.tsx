"use client";

import { useParams } from "next/navigation";
import { DoctorAvailabilityView } from "@/components/DoctorAvailabilityView";

export default function PatientDoctorDetailPage() {
  const params = useParams();
  const doctorName = decodeURIComponent(params.name as string);

  return <DoctorAvailabilityView doctorName={doctorName} portal="patient" />;
}
