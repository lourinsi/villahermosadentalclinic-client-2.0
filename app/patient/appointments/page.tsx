"use client";

import { CalendarPageLayout } from "@/components/CalendarPageLayout";

export default function MyAppointmentsPage() {
  return <CalendarPageLayout portal="patient" defaultStatusFilter={["reserved", "scheduled"]} />;
}
