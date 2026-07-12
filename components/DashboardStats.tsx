"use client";

import { Users, Calendar, DollarSign, AlertCircle, CheckCircle2 } from "lucide-react";
import { Appointment } from "../hooks/useAppointments";
import { MetricCardGrid, type MetricCardDefinition } from "./MetricCardGrid";

type DashboardUser = {
  username?: string;
} | null | undefined;

interface DashboardStatsProps {
  portal: "admin" | "doctor" | "patient";
  appointments: Appointment[];
  monthlyAppointments: Appointment[];
  pendingAppointmentsCount: number;
  periodLabel?: string;
  periodRevenue?: number;
  periodExpenses?: number;
  user: DashboardUser;
}

export function DashboardStats({
  portal,
  appointments,
  monthlyAppointments,
  pendingAppointmentsCount,
  periodLabel = "Monthly",
  periodRevenue = 0,
  periodExpenses = 0,
  user
}: DashboardStatsProps) {
  const getStats = (): MetricCardDefinition[] => {
    if (portal === "admin") {
      return [
        {
          id: "expenses",
          title: `${periodLabel} Expenses`,
          value: `\u20b1${periodExpenses.toLocaleString()}`,
          helper: "Paid expenses",
          icon: DollarSign,
          iconClass: "bg-rose-50 text-rose-600",
          pillClass: "bg-emerald-50 text-emerald-700",
        },
        {
          id: "appointments",
          title: `${periodLabel} Appointments`,
          value: monthlyAppointments.length.toString(),
          helper: "Scheduled",
          icon: Calendar,
          iconClass: "bg-emerald-50 text-emerald-600",
          pillClass: "bg-emerald-50 text-emerald-700",
        },
        {
          id: "appointment-requests",
          title: "Appointment Requests",
          value: pendingAppointmentsCount.toString(),
          helper: "Action required",
          icon: AlertCircle,
          iconClass: "bg-amber-50 text-amber-600",
          pillClass: "bg-amber-50 text-amber-700",
        },
        {
          id: "revenue",
          title: `${periodLabel} Revenue`,
          value: `\u20b1${periodRevenue.toLocaleString()}`,
          helper: "Recorded payments",
          icon: DollarSign,
          iconClass: "bg-violet-50 text-violet-600",
          pillClass: "bg-emerald-50 text-emerald-700",
        }
      ];
    } else if (portal === "doctor") {
      const uniquePatients = new Set(appointments
        .filter(apt => apt.doctor.toLowerCase() === user?.username?.toLowerCase())
        .map(apt => apt.patientName)
      ).size;

      return [
        {
          id: "my-patients",
          title: "My Patients",
          value: uniquePatients.toString(),
          helper: "Total seen",
          icon: Users,
          iconClass: "bg-blue-50 text-blue-600",
          pillClass: "bg-emerald-50 text-emerald-700",
        },
        {
          id: "monthly-appointments",
          title: "This Month's Appointments",
          value: monthlyAppointments.length.toString(),
          helper: "Scheduled",
          icon: Calendar,
          iconClass: "bg-emerald-50 text-emerald-600",
          pillClass: "bg-emerald-50 text-emerald-700",
        },
        {
          id: "completed",
          title: "Completed",
          value: appointments
            .filter(apt => apt.doctor.toLowerCase() === user?.username?.toLowerCase() && apt.status === "completed")
            .length.toString(),
          helper: "Finished",
          icon: CheckCircle2,
          iconClass: "bg-emerald-50 text-emerald-600",
          pillClass: "bg-emerald-50 text-emerald-700",
        },
        {
          id: "appointment-requests",
          title: "Appointment Requests",
          value: pendingAppointmentsCount.toString(),
          helper: "Awaiting",
          icon: AlertCircle,
          iconClass: "bg-amber-50 text-amber-600",
          pillClass: "bg-amber-50 text-amber-700",
        }
      ];
    } else {
      const completedCount = appointments.filter(apt => apt.status === "completed").length;
      const totalSpent = appointments.reduce((sum, apt) => sum + (apt.totalPaid || 0), 0);
      const pendingBalance = appointments.reduce((sum, apt) => sum + (apt.balance || 0), 0);

      return [
        {
          id: "total-appointments",
          title: "TOTAL APPOINTMENTS",
          value: appointments.length.toString(),
          helper: "All time",
          icon: Calendar,
          iconClass: "bg-blue-50 text-blue-600",
          pillClass: "bg-blue-50 text-blue-700",
        },
        {
          id: "completed",
          title: "COMPLETED",
          value: completedCount.toString(),
          helper: "Finished",
          icon: CheckCircle2,
          iconClass: "bg-emerald-50 text-emerald-600",
          pillClass: "bg-emerald-50 text-emerald-700",
        },
        {
          id: "amount-paid",
          title: "AMOUNT PAID",
          value: `\u20b1${totalSpent.toLocaleString()}`,
          helper: "Total spent",
          icon: DollarSign,
          iconClass: "bg-violet-50 text-violet-600",
          pillClass: "bg-violet-50 text-violet-700",
        },
        {
          id: "pending-balance",
          title: "PENDING BALANCE",
          value: `\u20b1${pendingBalance.toLocaleString()}`,
          helper: "Outstanding",
          icon: AlertCircle,
          iconClass: "bg-amber-50 text-amber-600",
          pillClass: "bg-amber-50 text-amber-700",
        }
      ];
    }
  };

  const stats = getStats();

  return <MetricCardGrid metrics={stats} />;
}
