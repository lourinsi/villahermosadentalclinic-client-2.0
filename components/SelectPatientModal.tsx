"use client";

import type { ReactNode } from "react";

type SelectPatientModalProps = {
  children: ReactNode;
};

export function SelectPatientModal({ children }: SelectPatientModalProps) {
  return (
    <div data-tour-id="booking-patient-step" className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
      {children}
    </div>
  );
}
