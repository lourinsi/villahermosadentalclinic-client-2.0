"use client";

import { useState } from "react";
import type { ComponentProps } from "react";
import { History, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useAppointmentModal } from "@/hooks/useAppointmentModal";
import BookingModalWrapper from "./BookingModalWrapper";
import { getDefaultPastAppointmentDate, getDefaultPastAppointmentTime } from "./sharedBookingLogic";

type PastAppointmentButtonProps = {
  label?: string;
  className?: string;
  doctorName?: string;
  patientId?: string;
  variant?: ComponentProps<typeof Button>["variant"];
  size?: ComponentProps<typeof Button>["size"];
  onCreated?: (appointment?: any) => void;
};

export function PastAppointmentButton({
  label = "Add Past Appointment",
  className,
  doctorName,
  patientId,
  variant = "outline",
  size,
  onCreated,
}: PastAppointmentButtonProps) {
  const { user } = useAuth();
  const { refreshAppointments } = useAppointmentModal();
  const [open, setOpen] = useState(false);
  const [defaults, setDefaults] = useState<{ date: Date; time: string; doctorName?: string } | null>(null);

  const canCreatePastAppointment = user?.role === "admin" || user?.role === "doctor";

  if (!canCreatePastAppointment) return null;

  const openPastAppointmentModal = () => {
    setDefaults({
      date: getDefaultPastAppointmentDate(),
      time: getDefaultPastAppointmentTime(),
      doctorName: doctorName || (user?.role === "doctor" ? user.username : undefined),
    });
    setOpen(true);
  };

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        onClick={openPastAppointmentModal}
        className={cn("gap-2 font-semibold", className)}
      >
        <History className="h-4 w-4" />
        <span>{label}</span>
        <Plus className="h-3.5 w-3.5 opacity-70" />
      </Button>

      {open && (
        <BookingModalWrapper
          open={open}
          onOpenChange={setOpen}
          title="Add Past Appointment"
          defaultDate={defaults?.date}
          defaultTime={defaults?.time}
          doctorName={defaults?.doctorName}
          defaultPatientId={patientId}
          appointmentCreationMode="past"
          onBooked={(appointment) => {
            refreshAppointments();
            onCreated?.(appointment);
            setOpen(false);
          }}
        />
      )}
    </>
  );
}

export default PastAppointmentButton;
