"use client";

import { apiUrl } from "@/lib/api";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "./ui/button";
import { useAppointmentModal } from "@/hooks/useAppointmentModal";
import { Appointment, AppointmentFilters } from "../hooks/useAppointments";
import { formatDateToYYYYMMDD, formatWordyDate, parseBackendDateToLocal } from "../lib/utils";
import { useAuth } from "@/hooks/useAuth.tsx";
import { Calendar, DollarSign, AlertCircle, Users, ChevronRight } from "lucide-react";
import { getAppointmentTypeName } from "../lib/appointment-types";
import { formatTimeTo12h } from "@/lib/time-slots";
import { NextAppointmentCard } from "./NextAppointmentCard";
import { DashboardStats } from "./DashboardStats";
import { RevenueOverview } from "./RevenueOverview";
import { RecentSchedule } from "./RecentSchedule";
import { VisitStatistics } from "./VisitStatistics";
import { QuickActions } from "./QuickActions";
import { isCartAppointmentStatus, normalizeAppointmentStatus } from "@/lib/appointment-status";
import AppointmentHistoryView from "./AppointmentHistoryView";
import { useNotificationAppointmentSnapshot } from "@/hooks/useNotificationAppointmentSnapshot";
import { getAuthHeaders } from "@/lib/auth-headers";

const revenueData = [
  { month: "Jan", revenue: 42000, appointments: 180 },
  { month: "Feb", revenue: 38000, appointments: 165 },
  { month: "Mar", revenue: 45000, appointments: 195 },
  { month: "Apr", revenue: 41000, appointments: 175 },
  { month: "May", revenue: 48000, appointments: 210 },
  { month: "Jun", revenue: 48250, appointments: 220 }
];

const colorPalette = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444", "#06b6d4", "#f97316"];

const getDashboardPeriodRange = (mode: "day" | "week" | "month") => {
  const now = new Date();
  const start = new Date(now);
  const end = new Date(now);

  if (mode === "week") {
    start.setDate(now.getDate() - now.getDay());
  } else if (mode === "month") {
    start.setDate(1);
  }

  return {
    start: formatDateToYYYYMMDD(start),
    end: formatDateToYYYYMMDD(end),
    title: mode === "day" ? "Daily" : mode === "week" ? "Weekly" : "Monthly",
  };
};

const isDateWithinDashboardRange = (date: string | undefined, range: { start: string; end: string }) =>
  Boolean(date && date >= range.start && date <= range.end);

const toDashboardDateOnly = (value?: string | null) => String(value || "").split("T")[0].trim();

const getDashboardTransactionReportingDate = (transaction: { date?: string | null; paymentDate?: string | null }) =>
  toDashboardDateOnly(transaction.paymentDate) || toDashboardDateOnly(transaction.date);

const getDashboardExpenseReportingDate = (expense: { date?: string | null }) =>
  toDashboardDateOnly(expense.date);

const getDashboardExpensePaidAmount = (expense: { amount?: number | string | null; totalPaid?: number | string | null; status?: string | null }) => {
  if (expense.totalPaid !== undefined && expense.totalPaid !== null) return Math.max(0, Number(expense.totalPaid) || 0);
  return ["paid", "partial", "overpaid"].includes(String(expense.status || "").toLowerCase().trim())
    ? Math.max(0, Number(expense.amount) || 0)
    : 0;
};

const getAppointmentDateTime = (appointment: Appointment) => new Date(`${appointment.date}T${appointment.time}`);

const isVisibleDashboardAppointment = (appointment: Appointment) => {
  const status = normalizeAppointmentStatus(appointment.status);
  return status !== "cancelled" && status !== "deleted" && !isCartAppointmentStatus(status);
};

interface DashboardProps {
  portal: "admin" | "doctor" | "patient";
}

export function Dashboard({ portal }: DashboardProps) {
  const router = useRouter();
  const { openCreateModal, openAddPatientModal, appointments, refreshTrigger, refreshAppointments, openEditModal, isEditModalOpen, selectedAppointment } = useAppointmentModal();
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState<"day" | "week" | "month">("day");
  const [financeTransactions, setFinanceTransactions] = useState<any[]>([]);
  const [detailedExpenses, setDetailedExpenses] = useState<any[]>([]);
  const [isLoadingView, setIsLoadingView] = useState(false);
  const {
    isAppointmentHistoryOpen,
    setIsAppointmentHistoryOpen,
    appointmentSnapshot,
    appointmentSnapshotId,
    appointmentSnapshotLogDate,
    appointmentSnapshotIsHistorical,
    handleViewCurrentSnapshot,
    handleViewAppointment,
    resetAppointmentSnapshot,
  } = useNotificationAppointmentSnapshot(appointments);

  const handleViewAll = () => {
    if (portal === "patient") {
      router.push("/patient/appointments");
    } else {
      const basePath = portal === "admin" && user?.role === "receptionist" ? "/receptionist" : `/${portal}`;
      router.push(`${basePath}/calendar`);
    }
  };

  useEffect(() => {
    if (portal === "doctor" && !user?.username) return;
    if (portal === "patient" && !user?.patientId) return;

    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    const end = new Date(today);
    end.setDate(today.getDate() + 60);

    const filters: AppointmentFilters = {
      startDate: formatDateToYYYYMMDD(start),
      endDate: formatDateToYYYYMMDD(end),
      status: "all",
    };

    if (portal === "doctor" && user?.username) {
      filters.doctor = user.username;
    }

    if (portal === "patient" && user?.patientId) {
      filters.patientId = user.patientId;
    }

    refreshAppointments(filters);
  }, [portal, refreshAppointments, user?.patientId, user?.username]);

  // Fetch admin finance metrics used by the day/week/month dashboard cards.
  useEffect(() => {
    if (portal !== "admin") return;

    const fetchFinanceMetrics = async () => {
      try {
        const [transactionsResponse, expensesResponse] = await Promise.all([
          fetch(apiUrl("/api/finance/recent-transactions?limit=500"), {
            headers: getAuthHeaders(),
            credentials: "include",
          }),
          fetch(apiUrl("/api/finance/detailed-expenses"), {
            headers: getAuthHeaders(),
            credentials: "include",
          }),
        ]);
        const [transactionsResult, expensesResult] = await Promise.all([
          transactionsResponse.json(),
          expensesResponse.json(),
        ]);
        setFinanceTransactions(transactionsResult.success && Array.isArray(transactionsResult.data) ? transactionsResult.data : []);
        setDetailedExpenses(expensesResult.success && Array.isArray(expensesResult.data) ? expensesResult.data : []);
      } catch (error) {
        console.error("Error fetching dashboard finance metrics:", error);
        setFinanceTransactions([]);
        setDetailedExpenses([]);
      }
    };
    fetchFinanceMetrics();
  }, [portal, refreshTrigger]);

  // Show loading when view mode changes
  useEffect(() => {
    setIsLoadingView(true);
    const t = setTimeout(() => setIsLoadingView(false), 300);
    return () => clearTimeout(t);
  }, [viewMode]);

  const portalAppointments = useMemo(() => {
    let filtered = appointments.filter((apt: Appointment) => normalizeAppointmentStatus(apt.status) !== "deleted");

    // For doctor portal, only show their appointments
    if (portal === "doctor" && user?.username) {
      filtered = filtered.filter((apt: Appointment) =>
        apt.doctor.toLowerCase() === user.username.toLowerCase()
      );
    }

    // For patient portal, only show their appointments
    if (portal === "patient" && user?.patientId) {
      filtered = filtered.filter((apt: Appointment) =>
        String(apt.patientId).trim() === String(user.patientId).trim()
      );
    }

    return filtered;
  }, [appointments, portal, user]);

  const currentMonthAppointments = useMemo(() => {
    const today = new Date();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    monthStart.setHours(0, 0, 0, 0);

    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    monthEnd.setHours(23, 59, 59, 999);

    return portalAppointments
      .filter((apt: Appointment) => {
        const aptDate = parseBackendDateToLocal(apt.date);
        return aptDate >= monthStart && aptDate <= monthEnd;
      })
      .filter((apt: Appointment) => !isCartAppointmentStatus(apt.status));
  }, [portalAppointments]);

  // Filter appointments based on selected dashboard view.
  const filteredAppointments = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (viewMode === "day") {
      const dayStr = today.toISOString().split("T")[0];
      return portalAppointments
        .filter((apt: Appointment) => parseBackendDateToLocal(apt.date).toISOString().split("T")[0] === dayStr)
        .filter((apt: Appointment) => !isCartAppointmentStatus(apt.status));
    } else if (viewMode === "week") {
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay());
      weekStart.setHours(0, 0, 0, 0);

      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);

      return portalAppointments
        .filter((apt: Appointment) => {
          const aptDate = parseBackendDateToLocal(apt.date);
          return aptDate >= weekStart && aptDate <= weekEnd;
        })
        .filter((apt: Appointment) => !isCartAppointmentStatus(apt.status));
    } else {
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      monthStart.setHours(0, 0, 0, 0);

      const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      monthEnd.setHours(23, 59, 59, 999);

      return portalAppointments
        .filter((apt: Appointment) => {
          const aptDate = parseBackendDateToLocal(apt.date);
          return aptDate >= monthStart && aptDate <= monthEnd;
        })
        .filter((apt: Appointment) => !isCartAppointmentStatus(apt.status));
    }
  }, [portalAppointments, viewMode]);

  const recentScheduleAppointments = useMemo(
    () => filteredAppointments.filter(isVisibleDashboardAppointment),
    [filteredAppointments]
  );

  const dashboardPeriodRange = useMemo(() => getDashboardPeriodRange(viewMode), [viewMode]);
  const periodRevenue = useMemo(() => (
    financeTransactions
      .filter((transaction) => transaction.type === "income")
      .filter((transaction) => isDateWithinDashboardRange(getDashboardTransactionReportingDate(transaction), dashboardPeriodRange))
      .reduce((sum, transaction) => sum + Math.abs(Number(transaction.amount) || 0), 0)
  ), [dashboardPeriodRange, financeTransactions]);
  const periodExpenses = useMemo(() => (
    detailedExpenses
      .filter((expense) => String(expense.status || "").toLowerCase().trim() !== "cancelled")
      .filter((expense) => isDateWithinDashboardRange(getDashboardExpenseReportingDate(expense), dashboardPeriodRange))
      .reduce((sum, expense) => sum + getDashboardExpensePaidAmount(expense), 0)
  ), [dashboardPeriodRange, detailedExpenses]);

  // Get upcoming appointments visible to the current portal.
  const upcomingAppointments = useMemo(() => {
    const now = new Date();
    const filteredByPortal = appointments.filter((apt: Appointment) => {
      if (portal === "doctor" && user?.username) {
        return apt.doctor.toLowerCase() === user.username.toLowerCase();
      }
      if (portal === "patient" && user?.patientId) {
        return String(apt.patientId).trim() === String(user.patientId).trim();
      }
      return true;
    });

    return filteredByPortal
      .filter((apt: Appointment) => {
        const aptDateTime = getAppointmentDateTime(apt);
        return aptDateTime > now && isVisibleDashboardAppointment(apt);
      })
      .sort((a, b) => {
        return getAppointmentDateTime(a).getTime() - getAppointmentDateTime(b).getTime();
      });
  }, [appointments, portal, user]);

  const nextAppointment = upcomingAppointments[0] ?? null;

  const nextAppointmentDayAppointments = useMemo(() => {
    if (!nextAppointment) return [];

    const nextAppointmentDate = formatDateToYYYYMMDD(nextAppointment.date);
    return upcomingAppointments.filter(
      (apt: Appointment) =>
        apt.id !== nextAppointment.id &&
        formatDateToYYYYMMDD(apt.date) === nextAppointmentDate
    );
  }, [nextAppointment, upcomingAppointments]);

  const pendingAppointmentsCount = useMemo(() => {
    let filtered = appointments;
    if (portal === "doctor" && user?.username) {
      filtered = filtered.filter((apt: Appointment) =>
        apt.doctor.toLowerCase() === user.username.toLowerCase()
      );
    }
    if (portal === "patient" && user?.patientId) {
      filtered = filtered.filter((apt: Appointment) =>
        String(apt.patientId).trim() === String(user.patientId).trim()
      );
    }
    return filtered.filter(apt => ["reserved", "to-pay", "tbd"].includes(normalizeAppointmentStatus(apt.status))).length;
  }, [appointments, portal, user]);

  const getViewTitle = (): string => {
    const today = new Date();
    if (viewMode === "day") {
      return formatWordyDate(today);
    } else if (viewMode === "week") {
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay());
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      return `${formatWordyDate(weekStart)} - ${formatWordyDate(weekEnd)}`;
    } else {
      return today.toLocaleDateString("en-US", { year: "numeric", month: "long" });
    }
  };

  const getHeaderText = () => {
    if (portal === "admin") {
      return {
        title: "Dashboard",
        subtitle: "Welcome back! Here's what's happening at your clinic today."
      };
    } else if (portal === "doctor") {
      const firstName = user?.username ? user.username.split('@')[0] : "Doctor";
      return {
        title: `Welcome, Dr. ${firstName}!`,
        subtitle: `Here's your schedule overview for ${viewMode === "day" ? "today" : viewMode === "week" ? "this week" : "this month"}.`
      };
    } else {
      const firstName = user?.username ? user.username.split('@')[0] : "there";
      return {
        title: `Welcome back, ${firstName}!`,
        subtitle: "Manage your dental appointments and track your health"
      };
    }
  };

  const headerText = getHeaderText();
  const handleOpenSnapshotAppointment = (appointmentId: string) => {
    const appointment = appointments.find((item: Appointment) => String(item.id) === String(appointmentId));
    setIsAppointmentHistoryOpen(false);
    resetAppointmentSnapshot();
    if (appointment) openEditModal(appointment, portal === "patient");
  };
  const isSnapshotAppointmentOpen = Boolean(
    isEditModalOpen &&
    appointmentSnapshotId &&
    selectedAppointment?.id &&
    String(selectedAppointment.id) === String(appointmentSnapshotId)
  );
  const managementBasePath = portal === "admin" && user?.role === "receptionist" ? "/receptionist" : `/${portal}`;
  const mobileVisitWeeks = [0.2, 0.47, 0.93, 0.58, 0.47, 0.32];
  const monthlyVisitTotal = currentMonthAppointments.length;
  const monthlyVisitAverage = Math.round((monthlyVisitTotal / Math.max(1, new Date().getDate())) * 10) / 10;

  return (
    <div data-tour-id={`${portal}-dashboard-page`} className="min-h-screen space-y-4 bg-[#f8fafc] p-1 sm:p-3 md:space-y-10 md:p-0">
      {portal !== "patient" && (
        <div className="md:hidden">
          <div className="grid grid-cols-3 rounded-2xl border border-gray-100 bg-white p-1 shadow-sm sm:p-1.5">
            {(["day", "week", "month"] as const).map((mode) => (
              <Button
                key={mode}
                size="sm"
                variant="ghost"
                className={`h-10 rounded-xl text-sm font-black transition-all sm:h-12 sm:rounded-2xl ${
                  viewMode === mode
                    ? "bg-violet-600 text-white shadow-lg shadow-violet-200 hover:bg-violet-600 hover:text-white"
                    : "text-slate-500 hover:bg-gray-50 hover:text-slate-700"
                }`}
                onClick={() => setViewMode(mode)}
              >
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </Button>
            ))}
          </div>
        </div>
      )}

      <div className="hidden flex-col gap-4 md:flex md:flex-row md:items-end md:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-black tracking-tight text-gray-900 sm:text-4xl">{headerText.title}</h1>
          <p className="text-sm font-medium text-gray-500 sm:text-base">{headerText.subtitle}</p>
        </div>
        {portal !== "patient" && (
          <div className="flex w-full items-center justify-between rounded-2xl border border-gray-100 bg-white p-1.5 shadow-sm sm:w-auto sm:justify-start sm:space-x-3">
            {(["day", "week", "month"] as const).map((mode) => (
              <Button
                key={mode}
                size="sm"
                variant="ghost"
                className={`flex-1 rounded-xl px-4 py-2 text-xs font-bold transition-all duration-300 sm:flex-none sm:px-6 ${
                  viewMode === mode
                    ? "bg-violet-600 text-white shadow-md shadow-violet-200"
                    : "text-gray-400 hover:text-gray-600 hover:bg-gray-50"
                }`}
                onClick={() => setViewMode(mode)}
              >
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </Button>
            ))}
          </div>
        )}
      </div>

      {/* Stats Cards */}
      <div
        data-tour-id={portal === "admin" ? "admin-dashboard-stats" : `${portal}-dashboard-stats`}
      >
        <DashboardStats
          portal={portal}
          appointments={portalAppointments}
          monthlyAppointments={filteredAppointments}
          pendingAppointmentsCount={pendingAppointmentsCount}
          periodLabel={dashboardPeriodRange.title}
          periodRevenue={periodRevenue}
          periodExpenses={periodExpenses}
          user={user}
        />
      </div>

      <div className="md:hidden">
        <div className="rounded-2xl border border-gray-100 bg-white p-3 shadow-sm sm:p-4">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-black text-gray-950">Next Appointment</h2>
              <p className="text-sm font-semibold text-slate-500">Don't miss your upcoming visit</p>
            </div>
            <Button variant="ghost" size="sm" onClick={handleViewAll} className="rounded-xl text-sm font-black text-violet-600 hover:bg-violet-50">
              View All
            </Button>
          </div>
          {nextAppointment ? (
            <button
              type="button"
              onClick={() => handleViewAppointment(nextAppointment)}
              className="flex w-full items-center gap-3 rounded-2xl border border-violet-100 bg-violet-50/50 p-3 text-left sm:gap-4 sm:p-4"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white text-violet-600 shadow-sm sm:h-14 sm:w-14 sm:rounded-2xl">
                <Calendar className="h-6 w-6 sm:h-7 sm:w-7" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-black text-gray-950">
                  {portal === "patient" ? `Dr. ${nextAppointment.doctor}` : nextAppointment.patientName}
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-500">
                  {formatWordyDate(nextAppointment.date, { fallback: nextAppointment.date || "N/A" })} at {nextAppointment.time ? formatTimeTo12h(nextAppointment.time) : "N/A"}
                </p>
              </div>
              <ChevronRight className="h-6 w-6 shrink-0 text-slate-400" />
            </button>
          ) : (
            <div className="rounded-2xl border border-dashed border-gray-200 p-5 text-center sm:p-6">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-violet-50 text-violet-600 sm:h-14 sm:w-14">
                <Calendar className="h-6 w-6 sm:h-7 sm:w-7" />
              </div>
              <p className="font-black text-gray-950">No appointments yet</p>
              <p className="mt-1 text-sm font-semibold text-slate-500">Schedule your first visit today.</p>
              <Button onClick={() => openCreateModal()} className="mt-4 rounded-xl bg-violet-600 px-8 font-black text-white hover:bg-violet-700">
                Book Now
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="hidden md:block">
        <NextAppointmentCard
          appointment={nextAppointment}
          role={portal}
          sameDayAppointments={nextAppointmentDayAppointments}
          onViewDetails={(apt: Appointment) => {
            handleViewAppointment(apt);
          }}
          onViewAll={handleViewAll}
          onBookAppointment={() => openCreateModal()}
          showHeader={true}
        />
      </div>

      {/* Bottom Grid: Schedule, Stats, and Quick Actions */}
      <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-3 lg:gap-8">
        <div className="hidden md:block">
          <RecentSchedule
            portal={portal}
            viewMode={viewMode}
            setViewMode={setViewMode}
            appointments={recentScheduleAppointments}
            isLoadingView={isLoadingView}
            viewTitle={getViewTitle()}
            onAppointmentClick={(apt: Appointment) => {
              handleViewAppointment(apt);
            }}
            onViewAll={handleViewAll}
          />
        </div>

        <div className="hidden md:block">
          <VisitStatistics
            appointments={portalAppointments}
            colorPalette={colorPalette}
          />
        </div>

        <div className="hidden md:block">
          <QuickActions
            portal={portal}
            openCreateModal={openCreateModal}
            openAddPatientModal={openAddPatientModal}
          />
        </div>
      </div>

      <div className="space-y-4 md:hidden">
        <div className="rounded-2xl border border-gray-100 bg-white p-3 shadow-sm sm:p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-black text-gray-950">{portal === "admin" ? "Recent Schedule" : "My Schedule"}</h2>
              <p className="text-sm font-semibold text-slate-500">{getViewTitle()}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={handleViewAll} className="rounded-xl text-sm font-black text-violet-600 hover:bg-violet-50">
              View All
            </Button>
          </div>
          <div className="divide-y divide-gray-100">
            {recentScheduleAppointments.length > 0 ? (
              recentScheduleAppointments.slice(0, 3).map((appointment) => (
                <button
                  key={appointment.id}
                  type="button"
                  onClick={() => handleViewAppointment(appointment)}
                  className="flex w-full items-center gap-3 py-3 text-left sm:gap-4"
                >
                  <div className="flex h-12 w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-violet-50 text-violet-600 sm:h-14 sm:w-16">
                    <span className="text-sm font-black">{formatTimeTo12h(appointment.time).split(" ")[0]}</span>
                    <span className="text-[10px] font-black uppercase">{formatTimeTo12h(appointment.time).split(" ")[1] || ""}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-black text-gray-950">{portal === "patient" ? `Dr. ${appointment.doctor}` : appointment.patientName}</p>
                    <p className="mt-0.5 truncate text-sm font-semibold text-slate-500">{getAppointmentTypeName(appointment.type, appointment.customType)}</p>
                  </div>
                  <span className="hidden rounded-xl bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700 min-[420px]:inline-flex">
                    {normalizeAppointmentStatus(appointment.status)}
                  </span>
                  <ChevronRight className="h-5 w-5 shrink-0 text-slate-400" />
                </button>
              ))
            ) : (
              <div className="py-8 text-center text-sm font-bold text-slate-400">No schedule found</div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-3 shadow-sm sm:p-4">
          <div className="mb-4 flex items-start justify-between">
            <div>
              <h2 className="text-xl font-black text-gray-950">Visit Statistics</h2>
              <p className="text-sm font-semibold text-slate-500">This Month</p>
            </div>
            <Button variant="ghost" size="sm" onClick={handleViewAll} className="rounded-xl text-sm font-black text-violet-600 hover:bg-violet-50">
              View All
            </Button>
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_7.5rem] gap-3 sm:grid-cols-[minmax(0,1fr)_8.5rem] sm:gap-4">
            <div className="flex h-28 items-end justify-between gap-2 border-b border-gray-100 px-1 sm:h-32 sm:px-2">
              {mobileVisitWeeks.map((height, index) => (
                <div key={index} className="flex flex-1 flex-col items-center justify-end gap-2">
                  <div
                    className="w-full max-w-7 rounded-t-xl bg-violet-500/80"
                    style={{ height: `${Math.max(14, height * 100)}%` }}
                  />
                  <span className="text-[10px] font-semibold text-slate-500">Jun {index * 7 + 1}</span>
                </div>
              ))}
            </div>
            <div className="rounded-2xl border border-violet-100 bg-violet-50/70 p-3 sm:p-4">
              <p className="text-sm font-bold text-slate-500">Total Visits</p>
              <p className="mt-1 text-2xl font-black text-violet-600 sm:text-3xl">{monthlyVisitTotal}</p>
              <p className="mt-4 text-sm font-bold text-slate-500">Avg. per day</p>
              <p className="mt-1 text-xl font-black text-violet-600 sm:text-2xl">{monthlyVisitAverage}</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-3 shadow-sm sm:p-4">
          <h2 className="text-xl font-black text-gray-950">Quick Actions</h2>
          <div className="mt-3 grid grid-cols-4 gap-2 sm:mt-4">
            {[
              { label: "Schedule", helper: "Book visit", icon: Calendar, action: () => openCreateModal() },
              { label: "Patients", helper: "Manage", icon: Users, action: () => router.push(`${managementBasePath}/patients`) },
              { label: "Requests", helper: "Review", icon: AlertCircle, action: () => router.push(`${managementBasePath}/requests`) },
              { label: "Finance", helper: "View", icon: DollarSign, action: () => router.push(`${managementBasePath}/finance`) },
            ].map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.label}
                  type="button"
                  onClick={action.action}
                  className="relative flex min-h-[5.75rem] flex-col items-center justify-center rounded-xl border border-gray-100 bg-white px-1.5 text-center shadow-sm sm:min-h-[7rem] sm:rounded-2xl sm:px-2"
                >
                  {action.label === "Requests" && pendingAppointmentsCount > 0 && (
                    <span className="absolute right-2 top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-black text-white">
                      {pendingAppointmentsCount > 9 ? "9+" : pendingAppointmentsCount}
                    </span>
                  )}
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-violet-50 text-violet-600 sm:h-11 sm:w-11">
                    <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
                  </span>
                  <span className="mt-2 text-[11px] font-black text-gray-950 sm:text-xs">{action.label}</span>
                  <span className="mt-0.5 hidden text-[10px] font-semibold text-slate-500 min-[420px]:inline">{action.helper}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Revenue Overview (Full Width, Admin/Doctor Only) */}
      <div className="hidden md:block">
        <RevenueOverview portal={portal} revenueData={revenueData} />
      </div>
      <AppointmentHistoryView
        open={isAppointmentHistoryOpen}
        onOpenChange={(open) => {
          setIsAppointmentHistoryOpen(open);
          if (!open) resetAppointmentSnapshot();
        }}
        appointmentSnapshot={appointmentSnapshot}
        logDate={appointmentSnapshotLogDate}
        onViewCurrent={handleViewCurrentSnapshot}
        onOpenAppointment={handleOpenSnapshotAppointment}
        isAppointmentOpen={isSnapshotAppointmentOpen}
        isHistorical={appointmentSnapshotIsHistorical}
        showPreviousInputChanges={false}
      />
    </div>
  );
}
