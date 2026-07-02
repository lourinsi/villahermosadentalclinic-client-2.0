"use client";

import React from "react";
import { AdminLayoutShell, type AdminLayoutTheme } from "./AdminLayout";
import { PatientProfileDraftRedirect } from "./PatientProfileDraftRedirect";

export const receptionistLayoutTheme: AdminLayoutTheme = {
  sidebar: "w-full bg-teal-900 text-white flex-shrink-0 flex flex-col md:h-full md:w-64",
  title: "border-b border-teal-800 px-4 py-3 text-lg font-bold md:p-4 md:text-2xl",
  navActive: "bg-teal-950 text-white",
  navInactive: "text-teal-100 hover:bg-teal-800 hover:text-white",
  footer: "flex items-center gap-2 border-t border-teal-800 p-2 md:block md:space-y-3 md:p-4",
  userBox: "hidden min-w-0 items-center space-x-2 rounded-lg bg-teal-800 px-3 py-2 sm:flex",
  userIcon: "w-4 h-4 text-teal-200",
  logoutButton: "w-auto shrink-0 justify-start bg-white text-teal-900 hover:bg-teal-50 md:w-full",
};

const ReceptionistLayout = ({ children }: { children: React.ReactNode }) => (
  <AdminLayoutShell portalTitle="Receptionist" theme={receptionistLayoutTheme}>
    <PatientProfileDraftRedirect />
    {children}
  </AdminLayoutShell>
);

export default ReceptionistLayout;
