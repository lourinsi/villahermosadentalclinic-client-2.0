"use client";

import React from "react";
import { toast } from "sonner";
import { apiUrl } from "@/lib/api";
import { getAuthHeaders } from "@/lib/auth-headers";
import { Appointment } from "@/hooks/useAppointments";
import { useAppointmentModal } from "@/hooks/useAppointmentModal";

type PendingNotificationAction = {
  appointment: Appointment;
  notificationId: string;
  mode: "approve" | "reject";
};

type Options = {
  markAsRead?: (id: string) => void | Promise<void>;
  refreshNotifications?: () => void;
};

const resolveActionMode = (status: string): PendingNotificationAction["mode"] =>
  String(status).toLowerCase() === "cancelled" ? "reject" : "approve";

export function useNotificationApprovalDialog({ markAsRead, refreshNotifications }: Options) {
  const { appointments, updateAppointment, refreshAppointments } = useAppointmentModal();
  const [pendingAction, setPendingAction] = React.useState<PendingNotificationAction | null>(null);
  const [isLoadingAction, setIsLoadingAction] = React.useState(false);
  const [isProcessingAction, setIsProcessingAction] = React.useState(false);

  const fetchAppointment = React.useCallback(async (appointmentId: string): Promise<Appointment> => {
    const localAppointment = appointments.find((appointment) => String(appointment.id) === String(appointmentId));
    if (localAppointment) return localAppointment;

    const response = await fetch(apiUrl(`/api/appointments/${encodeURIComponent(appointmentId)}`), {
      credentials: "include",
      headers: getAuthHeaders({ "Content-Type": "application/json" }),
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok || !payload?.data) {
      throw new Error(payload?.message || "Appointment not found");
    }

    return payload.data as Appointment;
  }, [appointments]);

  const openApprovalDialog = React.useCallback(async (
    appointmentId: string,
    status: string,
    notificationId: string
  ) => {
    if (!appointmentId) {
      toast.error("No appointment is linked to this notification");
      return;
    }

    setIsLoadingAction(true);
    try {
      const appointment = await fetchAppointment(appointmentId);
      setPendingAction({
        appointment,
        notificationId,
        mode: resolveActionMode(status),
      });
    } catch (error) {
      console.error("[Notifications] Failed to load appointment for confirmation:", error);
      toast.error(error instanceof Error ? error.message : "Failed to load appointment");
    } finally {
      setIsLoadingAction(false);
    }
  }, [fetchAppointment]);

  const closeApprovalDialog = React.useCallback((open: boolean) => {
    if (!open && !isProcessingAction) {
      setPendingAction(null);
    }
  }, [isProcessingAction]);

  const confirmApprovalAction = React.useCallback(async () => {
    if (!pendingAction) return;

    setIsProcessingAction(true);
    try {
      const currentStatus = String(pendingAction.appointment.status || "").toLowerCase();
      const nextStatus =
        pendingAction.mode === "reject"
          ? "cancelled"
          : currentStatus === "tbd"
            ? "completed"
            : "scheduled";

      await updateAppointment(pendingAction.appointment.id, { status: nextStatus as Appointment["status"] });
      await markAsRead?.(pendingAction.notificationId);
      toast.success(nextStatus === "cancelled" ? "Appointment cancelled" : "Appointment updated");
      refreshAppointments();
      refreshNotifications?.();
      setPendingAction(null);
    } catch (error) {
      console.error("[Notifications] Failed to update appointment status:", error);
      toast.error("Failed to update appointment status");
    } finally {
      setIsProcessingAction(false);
    }
  }, [markAsRead, pendingAction, refreshAppointments, refreshNotifications, updateAppointment]);

  return {
    approvalDialogAppointment: pendingAction?.appointment || null,
    approvalDialogMode: pendingAction?.mode || "approve",
    isApprovalDialogOpen: Boolean(pendingAction),
    isApprovalDialogLoading: isLoadingAction,
    isApprovalDialogProcessing: isProcessingAction,
    openApprovalDialog,
    closeApprovalDialog,
    confirmApprovalAction,
  };
}
