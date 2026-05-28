"use client";

import { Card, CardHeader, CardTitle, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { Calendar, Users, Clock } from "lucide-react";

interface QuickActionsProps {
  portal: "admin" | "doctor" | "patient";
  openCreateModal: () => void;
  openAddPatientModal: () => void;
}

export function QuickActions({
  portal,
  openCreateModal,
  openAddPatientModal
}: QuickActionsProps) {
  return (
    <Card
      data-tour-id={portal === "admin" ? "admin-quick-actions" : `${portal}-quick-actions`}
      className="border border-gray-100 shadow-sm bg-white rounded-3xl overflow-hidden flex flex-col h-full"
    >
      <CardHeader className="border-b border-gray-50 p-8">
        <CardTitle className="text-xl font-black text-gray-900 tracking-tight">Quick Actions</CardTitle>
        <p className="text-sm font-medium text-gray-500 mt-1">Common tasks</p>
      </CardHeader>
      <CardContent className="p-8 flex-1">
        <div className="grid grid-cols-1 gap-6">
          {portal === "admin" && (
            <>
              <Button
                variant="outline"
                data-tour-id="admin-quick-schedule"
                className="group flex items-center justify-between p-8 h-auto border-gray-100 hover:border-blue-100 hover:bg-blue-50/30 rounded-3xl transition-all duration-300"
                onClick={openCreateModal}
              >
                <div className="flex items-center space-x-5">
                  <div className="p-4 rounded-2xl bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all">
                    <Calendar className="h-6 w-6" />
                  </div>
                  <div className="text-left">
                    <div className="font-black text-gray-900">Schedule</div>
                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Book new visit</div>
                  </div>
                </div>
              </Button>
              <Button
                data-tour-id="admin-quick-add-patient"
                className="group flex items-center justify-between p-8 h-auto bg-violet-600 hover:bg-violet-700 text-white rounded-3xl transition-all shadow-xl shadow-violet-100"
                onClick={openAddPatientModal}
              >
                <div className="flex items-center space-x-5">
                  <div className="p-4 rounded-2xl bg-white/20">
                    <Users className="h-6 w-6" />
                  </div>
                  <div className="text-left">
                    <div className="font-black">Add Patient</div>
                    <div className="text-[10px] font-bold text-violet-100 uppercase tracking-wider">New record</div>
                  </div>
                </div>
              </Button>
            </>
          )}
          {portal === "doctor" && (
            <>
              <Button
                variant="outline"
                className="group flex items-center justify-between p-8 h-auto border-gray-100 hover:border-violet-100 hover:bg-violet-50/30 rounded-3xl transition-all"
                onClick={openCreateModal}
              >
                <div className="flex items-center space-x-5">
                  <div className="p-4 rounded-2xl bg-violet-50 text-violet-600 group-hover:bg-violet-600 group-hover:text-white transition-all">
                    <Calendar className="h-6 w-6" />
                  </div>
                  <div className="text-left">
                    <div className="font-black text-gray-900">Book Now</div>
                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Schedule visit</div>
                  </div>
                </div>
              </Button>
              <Button
                variant="outline"
                className="group flex items-center justify-between p-8 h-auto border-gray-100 hover:border-blue-100 hover:bg-blue-50/30 rounded-3xl transition-all"
                onClick={() => window.location.href = "/doctor/calendar"}
              >
                <div className="flex items-center space-x-5">
                  <div className="p-4 rounded-2xl bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all">
                    <Clock className="h-6 w-6" />
                  </div>
                  <div className="text-left">
                    <div className="font-black text-gray-900">Calendar</div>
                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Full schedule</div>
                  </div>
                </div>
              </Button>
            </>
          )}
          {portal === "patient" && (
            <>
              <Button
                className="group flex items-center justify-between p-8 h-auto bg-indigo-600 hover:bg-indigo-700 text-white rounded-3xl transition-all shadow-xl shadow-indigo-100"
                onClick={() => window.location.href = "/patient/doctors"}
              >
                <div className="flex items-center space-x-5">
                  <div className="p-4 rounded-2xl bg-white/20">
                    <Calendar className="h-6 w-6" />
                  </div>
                  <div className="text-left">
                    <div className="font-black">Book New</div>
                    <div className="text-[10px] font-bold text-indigo-100 uppercase tracking-wider">Find doctors</div>
                  </div>
                </div>
              </Button>
              <Button
                variant="outline"
                className="group flex items-center justify-between p-8 h-auto border-gray-100 hover:border-blue-100 hover:bg-blue-50/30 rounded-3xl transition-all"
                onClick={() => window.location.href = "/patient/appointments"}
              >
                <div className="flex items-center space-x-5">
                  <div className="p-4 rounded-2xl bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all">
                    <Clock className="h-6 w-6" />
                  </div>
                  <div className="text-left">
                    <div className="font-black text-gray-900">History</div>
                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">My visits</div>
                  </div>
                </div>
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
