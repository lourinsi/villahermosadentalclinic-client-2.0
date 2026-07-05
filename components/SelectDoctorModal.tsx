"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type SelectDoctorModalProps = {
  children: ReactNode;
  className?: string;
};

export function SelectDoctorModal({ children, className }: SelectDoctorModalProps) {
  return (
    <div
      data-tour-id="booking-doctor-step"
      className={cn(
        "space-y-5 px-0.5 py-1 animate-in fade-in slide-in-from-bottom-4 sm:space-y-6 sm:px-1",
        className
      )}
    >
      {children}
    </div>
  );
}
