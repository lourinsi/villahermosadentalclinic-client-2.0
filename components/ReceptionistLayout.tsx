"use client";

import React from "react";
import { AdminLayoutShell, type AdminLayoutTheme } from "./AdminLayout";
import { PatientProfileDraftRedirect } from "./PatientProfileDraftRedirect";

export const receptionistLayoutTheme: AdminLayoutTheme = {
  sidebar: "w-64 bg-teal-900 text-white flex-shrink-0 flex flex-col",
  title: "p-4 text-2xl font-bold border-b border-teal-800",
  navActive: "bg-teal-950 text-white",
  navInactive: "text-teal-100 hover:bg-teal-800 hover:text-white",
  footer: "p-4 border-t border-teal-800 space-y-3",
  userBox: "flex items-center space-x-2 px-3 py-2 bg-teal-800 rounded-lg",
  userIcon: "w-4 h-4 text-teal-200",
  logoutButton: "w-full justify-start text-teal-900 hover:bg-teal-50 bg-white",
};

const ReceptionistLayout = ({ children }: { children: React.ReactNode }) => (
  <AdminLayoutShell portalTitle="Receptionist" theme={receptionistLayoutTheme}>
    <PatientProfileDraftRedirect />
    {children}
  </AdminLayoutShell>
);

export default ReceptionistLayout;
