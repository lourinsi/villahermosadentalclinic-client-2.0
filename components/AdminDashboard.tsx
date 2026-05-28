"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Users, Calendar, DollarSign, AlertCircle, TrendingUp, Clock, Heart } from "lucide-react";
import { useAppointmentModal } from "../hooks/useAppointmentModal";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Badge } from "./ui/badge";
import { Appointment } from "../hooks/useAppointments";
import { getAppointmentTypeName } from "../lib/appointment-types";
import { parseBackendDateToLocal } from "../lib/utils";
import BookingModalWrapper from "./BookingModalWrapper";
import { NextAppointmentCard } from "./NextAppointmentCard";
import { isCartAppointmentStatus, normalizeAppointmentStatus } from "@/lib/appointment-status";
import AppointmentHistoryView from "./AppointmentHistoryView";
import { useNotificationAppointmentSnapshot } from "@/hooks/useNotificationAppointmentSnapshot";
import { apiUrl } from "@/lib/api";
import { getDefaultAppointmentStatusColors } from "@/lib/status-colors";
import { getAuthHeaders } from "@/lib/auth-headers";

const revenueData = [
  { month: "Jan", revenue: 42000, appointments: 180 },
  { month: "Feb", revenue: 38000, appointments: 165 },
  { month: "Mar", revenue: 45000, appointments: 195 },
  { month: "Apr", revenue: 41000, appointments: 175 },
  { month: "May", revenue: 48000, appointments: 210 },
  { month: "Jun", revenue: 48250, appointments: 220 }
];

// Derive appointment types/counts from real appointments
const colorPalette = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444", "#06b6d4", "#f97316"];

export function Dashboard({ portal }: { portal?: string }) {
  const { openCreateModal, openAddPatientModal, appointments, refreshTrigger, openEditModal } = useAppointmentModal();
  const [viewMode, setViewMode] = useState<"day" | "week" | "month">("day");
  const [totalPatients, setTotalPatients] = useState(0);
  const [isLoadingView, setIsLoadingView] = useState(false);
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
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

  // Fetch total patients from backend
  useEffect(() => {
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
  }, [refreshTrigger]);

  // Show loading when view mode changes
  useEffect(() => {
    setIsLoadingView(true);
    const t = setTimeout(() => setIsLoadingView(false), 300);
    return () => clearTimeout(t);
  }, [viewMode]);

  const filteredAppointments = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (viewMode === "day") {
      const dayStr = today.toISOString().split("T")[0];
      return appointments
        .filter((apt: Appointment) => parseBackendDateToLocal(apt.date).toISOString().split("T")[0] === dayStr)
        .filter((apt: Appointment) => !isCartAppointmentStatus(apt.status));
    } else if (viewMode === "week") {
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay());
      weekStart.setHours(0, 0, 0, 0);

      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);

      return appointments
        .filter((apt: Appointment) => {
          const aptDate = parseBackendDateToLocal(apt.date);
          return aptDate >= weekStart && aptDate <= weekEnd;
        })
        .filter((apt: Appointment) => !isCartAppointmentStatus(apt.status));
    } else {
      // month - today's month
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      monthStart.setHours(0, 0, 0, 0);

      const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      monthEnd.setHours(23, 59, 59, 999);

      return appointments
        .filter((apt: Appointment) => {
          const aptDate = parseBackendDateToLocal(apt.date);
          return aptDate >= monthStart && aptDate <= monthEnd;
        })
        .filter((apt: Appointment) => !isCartAppointmentStatus(apt.status));
    }
  }, [appointments, viewMode]);

  const pendingAppointmentsCount = useMemo(() => {
    return appointments.filter(apt => ["reserved", "to-pay", "tbd"].includes(normalizeAppointmentStatus(apt.status))).length;
  }, [appointments]);

  // Get next upcoming appointment (regardless of view mode)
  const nextAppointment = useMemo(() => {
    const now = new Date();
    const allFutureAppointments = appointments
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
  }, [appointments]);

  // Get all appointments at the same time as next appointment
  const sameTimeAppointments = useMemo(() => {
    if (!nextAppointment) return [];
    return appointments.filter(
      (apt: Appointment) =>
        apt.date === nextAppointment.date &&
        apt.time === nextAppointment.time &&
        apt.id !== nextAppointment.id &&
        apt.status !== "cancelled"
    );
  }, [nextAppointment, appointments]);

  // Build dynamic stats based on backend data
  const dynamicStats = [
    {
      title: "Total Patients",
      value: totalPatients.toString(),
      change: "+12%",
      icon: Users,
      color: "text-blue-600",
      bgColor: "bg-blue-50"
    },
    {
      title: viewMode === "day" ? "Today's Appointments" : viewMode === "week" ? "This Week's Appointments" : "This Month's Appointments",
      value: filteredAppointments.length.toString(),
      change: "+2",
      icon: Calendar,
      color: "text-green-600",
      bgColor: "bg-green-50"
    },
    {
      title: "Action Needed",
      value: pendingAppointmentsCount.toString(),
      change: "Action required",
      icon: AlertCircle,
      color: "text-amber-600",
      bgColor: "bg-amber-50"
    },
    {
      title: "Monthly Revenue",
      value: "$48,250",
      change: "+8.2%",
      icon: DollarSign,
      color: "text-purple-600",
      bgColor: "bg-purple-50"
    }
  ];

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

  const appointmentTypeCounts = appointments.reduce<Record<string, number>>((acc, apt: Appointment) => {
    const key = getAppointmentTypeName(apt.type, apt.customType);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const totalAppointments = (Object.values(appointmentTypeCounts) as number[]).reduce((s: number, v: number) => s + v, 0) || 1;

  const appointmentTypes = Object.keys(appointmentTypeCounts).map((name, idx) => ({
    name,
    value: Math.round(((appointmentTypeCounts[name] as number) / totalAppointments) * 100),
    color: colorPalette[idx % colorPalette.length]
  }));
  const handleOpenSnapshotAppointment = (appointmentId: string) => {
    const appointment = appointments.find((item: Appointment) => String(item.id) === String(appointmentId));
    setIsAppointmentHistoryOpen(false);
    resetAppointmentSnapshot();
    if (appointment) {
      setSelectedAppointment(appointment);
      setBookingModalOpen(true);
    }
  };
  const isSnapshotAppointmentOpen = Boolean(
    bookingModalOpen &&
    appointmentSnapshotId &&
    selectedAppointment?.id &&
    String(selectedAppointment.id) === String(appointmentSnapshotId)
  );

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-4xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-muted-foreground">Welcome back! Here&apos;s what&apos;s happening at your clinic today.</p>
      </div>
      
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {dynamicStats.map((stat, index) => (
          <Card key={index} className="relative overflow-hidden border-none shadow-md hover:shadow-xl transition-all duration-300 group">
            <div className={`absolute top-0 right-0 w-32 h-32 -mr-8 -mt-8 rounded-full opacity-10 transition-transform duration-500 group-hover:scale-110 ${stat.bgColor || 'bg-gray-50'}`} />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-semibold text-gray-600 uppercase tracking-wider">
                {stat.title}
              </CardTitle>
              <div className={`p-3 rounded-2xl shadow-sm transform transition-transform duration-300 group-hover:rotate-12 ${stat.bgColor || 'bg-gray-50'} ${stat.color}`}>
                <stat.icon className="h-5 w-5" />
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="text-3xl font-extrabold tracking-tight text-gray-900 mb-1">{stat.value}</div>
              <p className="text-sm font-medium flex items-center gap-1.5">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${
                  stat.title === "Action Needed" 
                    ? "bg-amber-100 text-amber-700" 
                    : "bg-emerald-100 text-emerald-700"
                }`}>
                  {stat.change}
                </span>
                <span className="text-gray-400 text-xs font-normal">vs last month</span>
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Chart */}
        <Card className="lg:col-span-2 border-none shadow-md overflow-hidden bg-white">
          <CardHeader className="flex flex-row items-center justify-between border-b border-gray-50 pb-4">
            <div>
              <CardTitle className="text-xl font-bold text-gray-800">Revenue Overview</CardTitle>
              <p className="text-sm text-gray-500 mt-1">Monthly statistics for clinic growth</p>
            </div>
            <div className="flex items-center space-x-2">
              <div className="flex items-center space-x-1 px-2 py-1 bg-blue-50 text-blue-700 rounded-md text-xs font-semibold">
                <TrendingUp className="h-3 w-3" />
                <span>+8.2%</span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={revenueData}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis 
                  dataKey="month" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{fill: '#94a3b8', fontSize: 12}}
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{fill: '#94a3b8', fontSize: 12}}
                />
                <Tooltip 
                  contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                  formatter={(value, name) => [
                    name === 'revenue' ? `₱${Number(value).toLocaleString()}` : value,
                    name === 'revenue' ? 'Revenue' : 'Appointments'
                  ]} 
                />
                <Area 
                  type="monotone" 
                  dataKey="revenue" 
                  stroke="#3b82f6" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorRevenue)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        
        {/* Appointment Types */}
        <Card className="border-none shadow-md bg-white">
          <CardHeader className="border-b border-gray-50 pb-4">
            <CardTitle className="text-lg font-bold text-gray-800">Visit Statistics</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            {(() => {
              // Use all-time appointments if current view has no data
              const appointmentsToAnalyze = filteredAppointments.length === 0 ? appointments : filteredAppointments;
              const isAllTime = filteredAppointments.length === 0;
              
              if (appointmentsToAnalyze.length === 0) return null;

              const typeCounts = appointmentsToAnalyze.reduce<Record<string, number>>((acc, apt: Appointment) => {
                const key = getAppointmentTypeName(apt.type, apt.customType);
                acc[key] = (acc[key] || 0) + 1;
                return acc;
              }, {});

              const total = (Object.values(typeCounts) as number[]).reduce((s, v) => s + v, 0) || 1;
              const chartData = Object.keys(typeCounts).map((name, idx) => ({
                name,
                value: Math.round(((typeCounts[name] as number) / total) * 100),
                color: colorPalette[idx % colorPalette.length]
              }));

              const getTimeLabel = () => {
                if (isAllTime) return "All Time";
                if (viewMode === "day") return "Today";
                if (viewMode === "week") return "This Week";
                return "This Month";
              };

              return (
                <>
                  <div className="mb-3">
                    <p className="text-xs font-semibold text-gray-600 mb-2">{getTimeLabel()}</p>
                  </div>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => [`${value}%`, 'Percentage']} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-2 mt-4">
                    {chartData.map((type, index) => (
                      <div key={index} className="flex items-center justify-between text-sm">
                        <div className="flex items-center space-x-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: type.color }} />
                          <span>{type.name}</span>
                        </div>
                        <span className="font-medium">{type.value}%</span>
                      </div>
                    ))}
                  </div>
                </>
              );
            })()}
          </CardContent>
        </Card>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Today's Schedule / Appointments */}
        <Card className="border-none shadow-md bg-white overflow-hidden">
          <CardHeader className="border-b border-gray-50 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl font-bold text-gray-800">Recent Schedule</CardTitle>
                <p className="text-sm text-gray-500 mt-1">{getViewTitle()}</p>
              </div>
              <div className="flex items-center bg-gray-100/80 rounded-xl p-1 backdrop-blur-sm">
                {(["day", "week", "month"] as const).map((mode) => (
                  <Button
                    key={mode}
                    size="sm"
                    variant="ghost"
                    className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all duration-300 ${
                      viewMode === mode
                        ? "bg-white text-violet-600 shadow-sm"
                        : "bg-transparent text-gray-500 hover:text-gray-900"
                    }`}
                    onClick={() => setViewMode(mode)}
                  >
                    {mode.charAt(0).toUpperCase() + mode.slice(1)}
                  </Button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-gray-50">
              {isLoadingView ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <div className="relative">
                    <div className="h-12 w-12 rounded-full border-4 border-violet-100 border-t-violet-600 animate-spin"></div>
                  </div>
                  <p className="mt-4 text-sm font-medium text-gray-500">Updating schedule...</p>
                </div>
              ) : filteredAppointments.length > 0 ? (
                filteredAppointments.slice(0, 5).map((appointment: Appointment) => (
                  <div
                    key={appointment.id}
                    className="group flex items-center justify-between p-4 hover:bg-violet-50/50 transition-all duration-300 cursor-pointer"
                    onClick={() => {
                      handleViewAppointment(appointment);
                    }}
                  >
                    <div className="flex items-center space-x-4">
                      <div className="flex flex-col items-center justify-center h-14 w-14 rounded-2xl bg-violet-50 text-violet-600 group-hover:bg-violet-600 group-hover:text-white transition-colors duration-300">
                        <span className="text-sm font-bold">{appointment.time.split(':')[0]}:{appointment.time.split(':')[1].split(' ')[0]}</span>
                        <span className="text-[10px] font-bold uppercase">{appointment.time.split(' ')[1]}</span>
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-bold text-gray-900 group-hover:text-violet-700 transition-colors">
                          {appointment.patientName}
                        </div>
                        <div className="text-xs font-medium text-gray-500 flex items-center space-x-2 mt-0.5">
                          <span>{getAppointmentTypeName(appointment.type, appointment.customType)}</span>
                          <span className="h-1 w-1 rounded-full bg-gray-300"></span>
                          <span className={`capitalize ${getDefaultAppointmentStatusColors(appointment.status).textColor}`}>{appointment.status}</span>
                        </div>
                        {(viewMode === "week" || viewMode === "month") && (
                          <div className="text-xs text-gray-400 mt-1">
                            {parseBackendDateToLocal(appointment.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity transform translate-x-2 group-hover:translate-x-0">
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0 rounded-full bg-white shadow-sm">
                        <Users className="h-4 w-4 text-violet-600" />
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-gray-500">
                  <div className="p-4 bg-gray-50 rounded-full mb-4">
                    <Calendar className="h-8 w-8 opacity-20" />
                  </div>
                  <p className="text-sm font-semibold">No appointments scheduled for this {viewMode}</p>
                  {viewMode !== "month" && (
                    <p className="text-xs text-gray-400 mt-1 max-w-[200px] text-center">
                      Try switching to {viewMode === "day" ? "week or month" : "month"} view to see more.
                    </p>
                  )}
                  {viewMode === "day" && (
                    <div className="mt-4 flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="text-xs font-bold rounded-xl"
                        onClick={() => setViewMode("week")}
                      >
                        Week View
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="text-xs font-bold rounded-xl"
                        onClick={() => setViewMode("month")}
                      >
                        Month View
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
            {filteredAppointments.length > 5 && (
              <div className="p-4 bg-gray-50/50 text-center">
                <Button variant="link" className="text-xs font-bold text-violet-600 hover:text-violet-700 p-0 h-auto">
                  View {filteredAppointments.length - 5} more appointments
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Quick Actions */}
        <Card className="border-none shadow-md bg-white overflow-hidden">
          <CardHeader className="border-b border-gray-50 pb-4">
            <CardTitle className="text-xl font-bold text-gray-800">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 gap-4">
              <Button
                variant="outline"
                className="group relative flex items-center justify-between p-6 h-auto border-gray-100 hover:border-blue-200 hover:bg-blue-50/50 rounded-2xl transition-all duration-300 overflow-hidden"
                onClick={() => openCreateModal()}
              >
                <div className="flex items-center space-x-4 relative z-10">
                  <div className="p-3 rounded-xl bg-blue-100 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors duration-300">
                    <Calendar className="h-6 w-6" />
                  </div>
                  <div className="text-left">
                    <div className="font-bold text-gray-900">Schedule Appointment</div>
                    <div className="text-xs text-gray-500">Book a new patient visit</div>
                  </div>
                </div>
                <div className="absolute right-0 top-0 h-full w-24 bg-gradient-to-l from-blue-100/20 to-transparent pointer-events-none" />
              </Button>
              
              <Button
                className="group relative flex items-center justify-between p-6 h-auto bg-violet-600 hover:bg-violet-700 text-white border-none rounded-2xl transition-all duration-300 shadow-lg hover:shadow-violet-200"
                onClick={() => openAddPatientModal()}
              >
                <div className="flex items-center space-x-4">
                  <div className="p-3 rounded-xl bg-white/20 text-white">
                    <Users className="h-6 w-6" />
                  </div>
                  <div className="text-left">
                    <div className="font-bold">Add New Patient</div>
                    <div className="text-xs text-violet-100">Register a new record</div>
                  </div>
                </div>
              </Button>
              
              <Button 
                variant="outline" 
                className="group flex items-center justify-between p-6 h-auto border-gray-100 hover:border-purple-200 hover:bg-purple-50/50 rounded-2xl transition-all duration-300"
                onClick={() => window.location.href = "/admin/finance"}
              >
                <div className="flex items-center space-x-4">
                  <div className="p-3 rounded-xl bg-purple-100 text-purple-600 group-hover:bg-purple-600 group-hover:text-white transition-colors duration-300">
                    <DollarSign className="h-6 w-6" />
                  </div>
                  <div className="text-left">
                    <div className="font-bold text-gray-900">Financial Reports</div>
                    <div className="text-xs text-gray-500">View clinic performance</div>
                  </div>
                </div>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* Next Appointment Card */}
        {nextAppointment && (
          <NextAppointmentCard
            appointment={nextAppointment}
            role="admin"
            sameTimeAppointments={sameTimeAppointments}
            onViewDetails={(apt) => {
              handleViewAppointment(apt);
            }}
            showHeader={true}
          />
        )}
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

      {bookingModalOpen && (
        <BookingModalWrapper
          open={bookingModalOpen}
          onOpenChange={setBookingModalOpen}
          appointmentToEdit={selectedAppointment}
          onBooked={() => {
            setSelectedAppointment(null);
            setBookingModalOpen(false);
          }}
        />
      )}
    </div>
  );
}
