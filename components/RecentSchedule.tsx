"use client";

import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Calendar } from "lucide-react";
import { Appointment } from "../hooks/useAppointments";
import { getAppointmentTypeName } from "../lib/appointment-types";
import { getDefaultAppointmentStatusColors } from "@/lib/status-colors";

interface RecentScheduleProps {
  portal: "admin" | "doctor" | "patient";
  viewMode: "day" | "week" | "month";
  setViewMode: (mode: "day" | "week" | "month") => void;
  appointments: Appointment[];
  isLoadingView: boolean;
  viewTitle: string;
  onAppointmentClick: (appointment: Appointment) => void;
  onViewAll?: () => void;
}

export function RecentSchedule({
  portal,
  viewMode,
  setViewMode,
  appointments,
  isLoadingView,
  viewTitle,
  onAppointmentClick,
  onViewAll
}: RecentScheduleProps) {
  const sortedAppointments = [...appointments].sort((a, b) => {
    if (a.date !== b.date) {
      return a.date.localeCompare(b.date);
    }
    return a.time.localeCompare(b.time);
  });

  return (
    <div className="w-full h-full flex flex-col">
      <Card className="border border-gray-100 shadow-sm bg-white rounded-3xl overflow-hidden flex flex-col w-full flex-1 min-h-[240px]">
      <CardHeader className="border-b border-gray-50 p-8 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl font-black text-gray-900 tracking-tight">
              {portal === "admin" ? "Recent Schedule" : "My Schedule"}
            </CardTitle>
            <p className="text-sm font-medium text-gray-500 mt-1">{viewTitle}</p>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            className={`rounded-lg font-bold ${portal === 'patient' ? 'text-violet-600 hover:bg-violet-50' : 'text-emerald-600 hover:bg-emerald-50'}`}
            onClick={onViewAll}
          >
            View All
          </Button>
        </div>
        <div className="flex items-center bg-gray-50/80 rounded-xl p-1 backdrop-blur-sm w-fit">
          {(["day", "week", "month"] as const).map((mode) => (
            <Button
              key={mode}
              size="sm"
              variant="ghost"
              className={`px-3 py-1 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all duration-300 ${
                viewMode === mode
                  ? "bg-white text-violet-600 shadow-sm"
                  : "text-gray-400 hover:text-gray-600"
              }`}
              onClick={() => setViewMode(mode)}
            >
              {mode}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="p-0 flex-1">
        <div className="divide-y divide-gray-50 h-full min-h-[400px]">
          {isLoadingView ? (
            <div className="flex flex-col items-center justify-center h-full py-16">
              <div className="h-10 w-10 rounded-full border-4 border-violet-100 border-t-violet-600 animate-spin"></div>
            </div>
          ) : sortedAppointments.length > 0 ? (
            sortedAppointments.slice(0, 6).map((appointment: Appointment) => {
              const dateObj = new Date(appointment.date);
              const month = dateObj.toLocaleDateString('en-US', { month: 'short' });
              const day = dateObj.getDate();
              
              return (
                <div
                  key={appointment.id}
                  className="group flex items-center justify-between p-5 hover:bg-violet-50/50 transition-all duration-300 cursor-pointer"
                  onClick={() => onAppointmentClick(appointment)}
                >
                  <div className="flex items-center space-x-4">
                    <div className="flex flex-col items-center justify-center h-12 w-12 rounded-xl bg-violet-50 text-violet-600 group-hover:bg-violet-600 group-hover:text-white transition-colors duration-300">
                      {viewMode === "day" ? (
                        <>
                          <span className="text-xs font-bold">{appointment.time.split(':')[0]}:{appointment.time.split(':')[1].split(' ')[0]}</span>
                          <span className="text-[8px] font-black uppercase">{appointment.time.split(' ')[1]}</span>
                        </>
                      ) : (
                        <>
                          <span className="text-[10px] font-black uppercase">{month}</span>
                          <span className="text-sm font-bold">{day}</span>
                        </>
                      )}
                    </div>
                    <div>
                      <div className="text-sm font-black text-gray-900 group-hover:text-violet-700 transition-colors">
                        {portal === "patient" ? `Dr. ${appointment.doctor}` : appointment.patientName}
                      </div>
                      <div className="text-[10px] font-bold text-gray-400 uppercase tracking-tight mt-0.5 flex items-center gap-2">
                        {viewMode !== "day" && (
                          <>
                            <span>{appointment.time}</span>
                            <span className="h-1 w-1 rounded-full bg-gray-200"></span>
                          </>
                        )}
                        <span>{getAppointmentTypeName(appointment.type, appointment.customType)}</span>
                        <span className="h-1 w-1 rounded-full bg-gray-200"></span>
                        <span className={getDefaultAppointmentStatusColors(appointment.status).textColor}>
                          {appointment.status}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="flex flex-col items-center justify-center h-full py-16 text-gray-400">
              <Calendar className="h-10 w-10 opacity-20 mb-3" />
              <p className="text-xs font-bold uppercase tracking-widest">No schedule found</p>
            </div>
          )}
        </div>
      </CardContent>
      </Card>
    </div>
  );
}
