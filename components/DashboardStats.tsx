"use client";

import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Users, Calendar, DollarSign, AlertCircle, CheckCircle2 } from "lucide-react";
import { Appointment } from "../hooks/useAppointments";

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
          value: `₱${totalSpent.toLocaleString()}`,
          change: "Total spent",
          icon: DollarSign,
          color: "text-purple-600",
          bgColor: "bg-purple-50"
        },
        {
          title: "PENDING BALANCE",
          value: `₱${pendingBalance.toLocaleString()}`,
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
        <Card key={index} className="relative overflow-hidden border border-gray-100 bg-white shadow-sm transition-all duration-300 hover:shadow-md">
          <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-2">
            <CardTitle className="min-w-0 truncate text-[10px] font-black uppercase tracking-wider text-gray-400">
              {stat.title}
            </CardTitle>
            <div className={`shrink-0 rounded-xl p-2 ${stat.bgColor} ${stat.color} transition-colors duration-300`}>
              <stat.icon className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="pt-1">
            <div className="flex min-w-0 items-baseline gap-2">
              <span className="min-w-0 flex-1 truncate text-2xl font-black tracking-tight text-gray-900">{stat.value}</span>
              <span className={`min-w-0 max-w-[8rem] truncate rounded-lg px-2 py-0.5 text-[10px] font-bold ${
                stat.title.toUpperCase() === "APPOINTMENT REQUESTS" || stat.title.toUpperCase() === "PENDING BALANCE" 
                  ? "bg-amber-50 text-amber-600" 
                  : "bg-emerald-50 text-emerald-600"
              }`}>
                {stat.change}
              </span>
            </div>
            <div className="mt-1">
              <span className="text-[10px] font-medium uppercase tracking-wider text-gray-400">
                {portal === "admin" ? "current view" : "vs last month"}
              </span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
