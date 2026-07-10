"use client";

import { Card, CardTitle } from "./ui/card";
import { Users, Calendar, DollarSign, AlertCircle, CheckCircle2 } from "lucide-react";
import { Appointment } from "../hooks/useAppointments";
import { CurrencyText } from "./CurrencyAmount";

interface DashboardStatsProps {
  portal: "admin" | "doctor" | "patient";
  appointments: Appointment[];
  monthlyAppointments: Appointment[];
  pendingAppointmentsCount: number;
  periodLabel?: string;
  periodRevenue?: number;
  periodExpenses?: number;
  user: any;
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
  const getStats = () => {
    if (portal === "admin") {
      return [
        {
          title: `${periodLabel} Expenses`,
          value: `\u20b1${periodExpenses.toLocaleString()}`,
          change: "Paid expenses",
          icon: DollarSign,
          color: "text-red-600",
          bgColor: "bg-red-50"
        },
        {
          title: `${periodLabel} Appointments`,
          value: monthlyAppointments.length.toString(),
          change: "Scheduled",
          icon: Calendar,
          color: "text-green-600",
          bgColor: "bg-green-50"
        },
        {
          title: "Appointment Requests",
          value: pendingAppointmentsCount.toString(),
          change: "Action required",
          icon: AlertCircle,
          color: "text-amber-600",
          bgColor: "bg-amber-50"
        },
        {
          title: `${periodLabel} Revenue`,
          value: `\u20b1${periodRevenue.toLocaleString()}`,
          change: "Recorded payments",
          icon: DollarSign,
          color: "text-purple-600",
          bgColor: "bg-purple-50"
        }
      ];
    } else if (portal === "doctor") {
      const uniquePatients = new Set(appointments
        .filter(apt => apt.doctor.toLowerCase() === user?.username?.toLowerCase())
        .map(apt => apt.patientName)
      ).size;

      return [
        {
          title: "My Patients",
          value: uniquePatients.toString(),
          change: "Total seen",
          icon: Users,
          color: "text-blue-600",
          bgColor: "bg-blue-50"
        },
        {
          title: "This Month's Appointments",
          value: monthlyAppointments.length.toString(),
          change: "Scheduled",
          icon: Calendar,
          color: "text-green-600",
          bgColor: "bg-green-50"
        },
        {
          title: "Completed",
          value: appointments
            .filter(apt => apt.doctor.toLowerCase() === user?.username?.toLowerCase() && apt.status === "completed")
            .length.toString(),
          change: "Finished",
          icon: CheckCircle2,
          color: "text-emerald-600",
          bgColor: "bg-emerald-50"
        },
        {
          title: "Appointment Requests",
          value: pendingAppointmentsCount.toString(),
          change: "Awaiting",
          icon: AlertCircle,
          color: "text-amber-600",
          bgColor: "bg-amber-50"
        }
      ];
    } else {
      const completedCount = appointments.filter(apt => apt.status === "completed").length;
      const totalSpent = appointments.reduce((sum, apt) => sum + (apt.totalPaid || 0), 0);
      const pendingBalance = appointments.reduce((sum, apt) => sum + (apt.balance || 0), 0);

      return [
        {
          title: "TOTAL APPOINTMENTS",
          value: appointments.length.toString(),
          change: "All time",
          icon: Calendar,
          color: "text-blue-600",
          bgColor: "bg-blue-50"
        },
        {
          title: "COMPLETED",
          value: completedCount.toString(),
          change: "Finished",
          icon: CheckCircle2,
          color: "text-green-600",
          bgColor: "bg-green-50"
        },
        {
          title: "AMOUNT PAID",
          value: `\u20b1${totalSpent.toLocaleString()}`,
          change: "Total spent",
          icon: DollarSign,
          color: "text-purple-600",
          bgColor: "bg-purple-50"
        },
        {
          title: "PENDING BALANCE",
          value: `\u20b1${pendingBalance.toLocaleString()}`,
          change: "Outstanding",
          icon: AlertCircle,
          color: "text-amber-600",
          bgColor: "bg-amber-50"
        }
      ];
    }
  };

  const stats = getStats();

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4 xl:gap-6">
      {stats.map((stat, index) => (
        <Card key={index} className="relative overflow-hidden rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition-all duration-300 hover:shadow-md sm:p-5 xl:p-6">
          <div className="flex min-w-0 items-center gap-4 xl:gap-5">
            <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full sm:h-16 sm:w-16 ${stat.bgColor} ${stat.color} transition-colors duration-300`}>
              <stat.icon className="h-7 w-7 sm:h-8 sm:w-8" />
            </div>
            <div className="min-w-0 flex-1">
              <CardTitle className="min-w-0 truncate text-sm font-black uppercase tracking-wider text-slate-400 sm:text-base xl:text-lg">
                {stat.title}
              </CardTitle>
              <div className="mt-3 flex min-w-0 items-center gap-3">
                <span className="max-w-[calc(100%-2.25rem)] shrink-0 truncate text-3xl font-black tracking-tight text-gray-900 sm:text-4xl">
                  <CurrencyText value={stat.value} />
                </span>
                <span className={`min-w-0 max-w-[10rem] truncate rounded-full px-3 py-1 text-sm font-black ${
                  stat.title.toUpperCase() === "APPOINTMENT REQUESTS" || stat.title.toUpperCase() === "PENDING BALANCE"
                    ? "bg-amber-50 text-amber-600"
                    : "bg-emerald-50 text-emerald-600"
                }`}>
                  {stat.change}
                </span>
              </div>
            </div>
          </div>
          <div className="mt-6 border-t border-slate-100" />
        </Card>
      ))}
    </div>
  );
}
