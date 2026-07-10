"use client";

import { ChevronRight, Search, UserRound, X } from "lucide-react";

import PatientAvatar from "./PatientAvatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface AppointmentPatientChoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientName: string;
  patientImage?: string;
  patientDob?: string;
  canSelectPatient?: boolean;
  canOpenProfile?: boolean;
  onSelectPatient: () => void | Promise<void>;
  onOpenProfile: () => void;
}

export default function AppointmentPatientChoiceDialog({
  open,
  onOpenChange,
  patientName,
  patientImage,
  patientDob,
  canSelectPatient = true,
  canOpenProfile = true,
  onSelectPatient,
  onOpenProfile,
}: AppointmentPatientChoiceDialogProps) {
  const displayName = patientName || "No patient assigned";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="w-[calc(100vw-1.5rem)] max-w-[440px] overflow-hidden rounded-2xl border border-slate-200 bg-white p-0 shadow-2xl"
      >
        <DialogHeader className="border-b border-slate-100 px-5 pb-4 pt-5 text-left">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <PatientAvatar
                src={patientImage}
                name={displayName}
                dob={patientDob}
                className="h-12 w-12 shrink-0 rounded-full border border-violet-100 shadow-sm"
                sizeClass="h-12 w-12 rounded-full"
              />
              <div className="min-w-0">
                <DialogTitle className="truncate text-xl font-black tracking-tight text-slate-950">
                  {displayName}
                </DialogTitle>
                <DialogDescription className="mt-1 text-sm font-semibold text-slate-500">
                  Choose where to continue.
                </DialogDescription>
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
              className="h-9 w-9 shrink-0 rounded-full text-slate-500 hover:bg-slate-100"
              aria-label="Close patient choices"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </DialogHeader>

        <div className="grid gap-3 bg-slate-50/70 p-4">
          <button
            type="button"
            onClick={() => void onSelectPatient()}
            disabled={!canSelectPatient}
            className="group flex min-h-[5.25rem] w-full items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-all hover:border-blue-200 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:border-slate-200 disabled:hover:shadow-sm"
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
              <Search className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-black text-slate-950">Select Patient</span>
              <span className="mt-1 block text-xs font-semibold leading-5 text-slate-500">
                Choose a patient for this appointment.
              </span>
            </span>
            <ChevronRight className="h-5 w-5 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5 group-disabled:translate-x-0" />
          </button>

          <button
            type="button"
            onClick={onOpenProfile}
            disabled={!canOpenProfile}
            className="group flex min-h-[5.25rem] w-full items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-all hover:border-violet-200 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:border-slate-200 disabled:hover:shadow-sm"
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
              <UserRound className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-black text-slate-950">Patient Profile</span>
              <span className="mt-1 block text-xs font-semibold leading-5 text-slate-500">
                Open the patient record.
              </span>
            </span>
            <ChevronRight className="h-5 w-5 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5 group-disabled:translate-x-0" />
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
