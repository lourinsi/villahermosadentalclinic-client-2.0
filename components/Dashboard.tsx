"use client";

import { apiUrl } from "@/lib/api";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "./ui/button";
import { useAppointmentModal } from "@/hooks/useAppointmentModal";
import { Appointment, AppointmentFilters } from "../hooks/useAppointments";
import { formatDateToYYYYMMDD, parseBackendDateToLocal } from "../lib/utils";
import { useAuth } from "@/hooks/useAuth.tsx";
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

interface DashboardProps {
  portal: "admin" | "doctor" | "patient";
}

export function Dashboard({ portal }: DashboardProps) {
  const router = useRouter();
  const { openCreateModal, openAddPatientModal, appointments, refreshTrigger, refreshAppointments, openEditModal, isEditModalOpen, selectedAppointment } = useAppointmentModal();
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState<"day" | "week" | "month">("day");
  const [totalPatients, setTotalPatients] = useState(0);
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
      router.push(`/${portal}/calendar`);
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

  // Fetch total patients from backend
  useEffect(() => {
    if (portal !== "admin") return;

    const fetchPatientCount = async () => {
      try {
        const response = await fetch(apiUrl("/api/patients?page=1&limit=1"), {
          headers: getAuthHeaders(),
          credentials: 'include',
        });
        const result = await response.json();
        if (result.success) {
          const total = result.meta?.total ?? (Array.isArray(result.data) ? result.data.length : 0);
          setTotalPatients(total);
        }
      } catch (error) {
        console.error("Error fetching patient count:", error);
        setTotalPatients(0);
      }
    };
    fetchPatientCount();
  }, [portal, refreshTrigger]);

  // Show loading when view mode changes
  useEffect(() => {
    setIsLoadingView(true);
    const t = setTimeout(() => setIsLoadingView(false), 300);
    return () => clearTimeout(t);
  }, [viewMode]);

  // Filter appointments based on portal
  const filteredAppointments = useMemo(() => {
    let filtered = appointments;

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

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (viewMode === "day") {
      const dayStr = today.toISOString().split("T")[0];
      return filtered
        .filter((apt: Appointment) => parseBackendDateToLocal(apt.date).toISOString().split("T")[0] === dayStr)
        .filter((apt: Appointment) => !isCartAppointmentStatus(apt.status));
    } else if (viewMode === "week") {
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay());
      weekStart.setHours(0, 0, 0, 0);

      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);

      return filtered
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

      return filtered
        .filter((apt: Appointment) => {
          const aptDate = parseBackendDateToLocal(apt.date);
          return aptDate >= monthStart && aptDate <= monthEnd;
        });
    }
  }, [appointments, viewMode, portal, user]);

  // Get next upcoming appointment
  const nextAppointment = useMemo(() => {
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

    const allFutureAppointments = filteredByPortal
      .filter((apt: Appointment) => {
        const aptDateTime = new Date(`${apt.date}T${apt.time}`);
        return aptDateTime > now && apt.status !== "cancelled";
      })
      .sort((a, b) => {
        const timeA = new Date(`${a.date}T${a.time}`).getTime();
        const timeB = new Date(`${b.date}T${b.time}`).getTime();
        return timeA - timeB;
      });
    return allFutureAppointments.length > 0 ? allFutureAppointments[0] : null;
  }, [appointments, portal, user]);

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
      return today.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
    } else if (viewMode === "week") {
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay());
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      return `${weekStart.toLocaleDateString()} - ${weekEnd.toLocaleDateString()}`;
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

  return (
    <div data-tour-id={`${portal}-dashboard-page`} className="p-8 space-y-10 bg-[#f8fafc] min-h-screen">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-4xl font-black text-gray-900 tracking-tight">{headerText.title}</h1>
          <p className="text-gray-500 font-medium">{headerText.subtitle}</p>
        </div>
        {portal !== "patient" && (
          <div className="flex items-center space-x-3 bg-white p-1.5 rounded-2xl shadow-sm border border-gray-100">
            {(["day", "week", "month"] as const).map((mode) => (
              <Button
                key={mode}
                size="sm"
                variant="ghost"
                className={`px-6 py-2 text-xs font-bold rounded-xl transition-all duration-300 ${
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
      <div data-tour-id={portal === "admin" ? "admin-dashboard-stats" : `${portal}-dashboard-stats`}>
        <DashboardStats
          portal={portal}
          viewMode={viewMode}
          appointments={appointments}
          filteredAppointments={filteredAppointments}
          totalPatients={totalPatients}
          pendingAppointmentsCount={pendingAppointmentsCount}
          user={user}
        />
      </div>

      {/* Next Appointment Section (Full Width) */}
      <NextAppointmentCard
        appointment={nextAppointment}
        role={portal}
        onViewDetails={(apt: Appointment) => {
          handleViewAppointment(apt);
        }}
        onViewAll={handleViewAll}
        showHeader={true}
      />

      {/* Bottom Grid: Schedule, Stats, and Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
        <RecentSchedule
          portal={portal}
          viewMode={viewMode}
          setViewMode={setViewMode}
          appointments={filteredAppointments}
          isLoadingView={isLoadingView}
          viewTitle={getViewTitle()}
          onAppointmentClick={(apt: Appointment) => {
            handleViewAppointment(apt);
          }}
          onViewAll={handleViewAll}
        />

        <VisitStatistics
          appointments={appointments}
          filteredAppointments={filteredAppointments}
          colorPalette={colorPalette}
          viewMode={viewMode}
        />

        <QuickActions
          portal={portal}
          openCreateModal={openCreateModal}
          openAddPatientModal={openAddPatientModal}
        />
      </div>

      {/* Revenue Overview (Full Width, Admin/Doctor Only) */}
      <RevenueOverview portal={portal} revenueData={revenueData} />
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
