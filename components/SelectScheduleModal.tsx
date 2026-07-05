"use client";

import type { ReactNode } from "react";

type SelectScheduleModalProps = {
  children: ReactNode;
};

export function SelectScheduleModal({ children }: SelectScheduleModalProps) {
  return (
    <div data-tour-id="booking-schedule-step" className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
      {children}
    </div>
  );
}
