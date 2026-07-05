"use client";

import type { ReactNode } from "react";

type SelectTreatmentModalProps = {
  children: ReactNode;
};

export function SelectTreatmentModal({ children }: SelectTreatmentModalProps) {
  return (
    <div data-tour-id="booking-treatment-step" className="mx-auto max-w-5xl space-y-2.5 animate-in fade-in slide-in-from-bottom-4 sm:space-y-4">
      {children}
    </div>
  );
}
