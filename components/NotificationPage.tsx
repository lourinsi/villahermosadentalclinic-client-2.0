import React from "react";
import { NotificationView } from "@/components/NotificationView";
import AppointmentHistoryView from "@/components/AppointmentHistoryView";
import { useNotifications } from "@/hooks/useNotifications";
import { toast } from "sonner";
import { useAppointmentModal } from "@/hooks/useAppointmentModal";
import { useNotificationAppointmentSnapshot } from "@/hooks/useNotificationAppointmentSnapshot";
import { useNotificationApprovalDialog } from "@/hooks/useNotificationApprovalDialog";
import ApproveRejectDialog from "@/components/ApproveRejectDialog";

type Portal = "patient" | "doctor" | "admin";

interface NotificationPageProps {
  portal: Portal;
}

export function NotificationPage({ portal }: NotificationPageProps) {
  const { 
    notifications, 
    isLoading: notificationsLoading, 
    error,
    markAsRead,
    markAsUnread,
    deleteNotification, 
    deleteNotificationWithResult,
    markAllAsRead,
    deleteAllNotifications,
    refreshNotifications,
    restoreNotification,
    hasMore,
    isLoadingMore,
    loadMoreNotifications
  } = useNotifications({ includeDeleted: true, limit: 30 });

  const { 
    updateAppointment, 
    refreshAppointments, 
    openEditModalById,
    appointments,
    isEditModalOpen,
    selectedAppointment,
    isLoading: appointmentsLoading
  } = useAppointmentModal();

  const {
    isAppointmentHistoryOpen,
    setIsAppointmentHistoryOpen,
    appointmentSnapshot,
    appointmentSnapshotId,
    appointmentSnapshotLogDate,
    appointmentSnapshotIsHistorical,
    appointmentSnapshotNotificationId,
    appointmentSnapshotNotificationDeleted,
    handleViewCurrentSnapshot,
    handleViewAppointmentSnapshot,
    resetAppointmentSnapshot,
  } = useNotificationAppointmentSnapshot(appointments);

  const isLoading = notificationsLoading || appointmentsLoading;

  const {
    approvalDialogAppointment,
    approvalDialogMode,
    isApprovalDialogOpen,
    isApprovalDialogProcessing,
    openApprovalDialog,
    closeApprovalDialog,
    confirmApprovalAction,
  } = useNotificationApprovalDialog({ markAsRead, refreshNotifications });

  const handleReschedule = async (appointmentId: string) => {
    console.log(`[NotificationPage] Attempting to view/edit appointment: ${appointmentId}`);
    try {
      await openEditModalById(appointmentId, portal === "patient");
    } catch (error) {
      console.error(`[NotificationPage] Error in handleReschedule:`, error);
      toast.error("Appointment not found or could not be loaded");
    }
  };

  const handleOpenSnapshotAppointment = async (appointmentId: string) => {
    setIsAppointmentHistoryOpen(false);
    resetAppointmentSnapshot();
    await handleReschedule(appointmentId);
  };

  const isSnapshotAppointmentOpen = Boolean(
    isEditModalOpen &&
    appointmentSnapshotId &&
    selectedAppointment?.id &&
    String(selectedAppointment.id) === String(appointmentSnapshotId)
  );

  const handleCancelAppointment = async (appointmentId: string) => {
    const confirmed = window.confirm("This appointment is unrefundable. Are you sure you want to cancel?");
    if (confirmed) {
      try {
        await updateAppointment(appointmentId, { status: 'cancelled' });
        toast.success("Appointment cancelled successfully");
        refreshAppointments();
        refreshNotifications();
      } catch (error) {
        toast.error("Failed to cancel appointment");
        console.error(error);
      }
    }
  };

  const handleRestoreNotification = async (notificationId: string) => {
    try {
      await restoreNotification(notificationId);
      toast.success("Notification restored successfully");
      refreshNotifications();
    } catch (error) {
      toast.error("Failed to restore notification");
      console.error(error);
    }
  };

  if (isLoading) {
    return (
      <div data-tour-id={`${portal}-notifications-page`} className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Portal-specific props
  const portalProps: Record<Portal, any> = {
    patient: {
      onViewAppointmentSnapshot: handleViewAppointmentSnapshot,
      onReschedule: handleReschedule,
      onCancelAppointment: handleCancelAppointment,
    },
    doctor: {
      onUpdateAppointmentStatus: openApprovalDialog,
      onViewAppointmentSnapshot: handleViewAppointmentSnapshot,
    },
    admin: {
      onUpdateAppointmentStatus: openApprovalDialog,
      onViewAppointmentSnapshot: handleViewAppointmentSnapshot,
    },
  };

  return (
    <div data-tour-id={`${portal}-notifications-page`} className="max-w-4xl mx-auto">
      <NotificationView 
        notifications={notifications}
        isLoading={notificationsLoading}
        error={error}
        onMarkAsRead={markAsRead}
        onMarkAsUnread={markAsUnread}
        onDelete={deleteNotification}
        onDeleteWithResult={deleteNotificationWithResult}
        onRestore={handleRestoreNotification}
        onMarkAllAsRead={markAllAsRead}
        onDeleteAll={deleteAllNotifications}
        hasMore={hasMore}
        isLoadingMore={isLoadingMore}
        onLoadMore={loadMoreNotifications}
        portal={portal}
        {...portalProps[portal]}
      />
      <AppointmentHistoryView
        open={isAppointmentHistoryOpen}
        onOpenChange={(open) => {
          setIsAppointmentHistoryOpen(open);
          if (!open) {
            resetAppointmentSnapshot();
          }
        }}
        appointmentSnapshot={appointmentSnapshot}
        logDate={appointmentSnapshotLogDate}
        onViewCurrent={handleViewCurrentSnapshot}
        onOpenAppointment={handleOpenSnapshotAppointment}
        isAppointmentOpen={isSnapshotAppointmentOpen}
        isHistorical={appointmentSnapshotIsHistorical}
        actionsDisabled={appointmentSnapshotNotificationDeleted}
        restoreNotificationId={appointmentSnapshotNotificationId}
        onRestoreNotification={handleRestoreNotification}
        openedFromBookingModal={false}
      />
      <ApproveRejectDialog
        open={isApprovalDialogOpen}
        onOpenChange={closeApprovalDialog}
        mode={approvalDialogMode}
        appointment={approvalDialogAppointment}
        isProcessing={isApprovalDialogProcessing}
        onConfirm={confirmApprovalAction}
      />
    </div>
  );
}
