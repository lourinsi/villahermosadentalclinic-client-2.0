"use client";

import { useParams } from "next/navigation";
import PublicDoctorAvailabilityPage from "@/components/PublicDoctorAvailabilityPage";

export default function DoctorAvailabilityPage() {
  const params = useParams();
  const doctorName = decodeURIComponent(params.name as string);

  return <PublicDoctorAvailabilityPage doctorName={doctorName} />;
}
