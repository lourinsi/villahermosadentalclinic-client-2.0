import React from "react";
import dynamic from "next/dynamic";
import { NotificationView } from "@/components/NotificationView";
const AppointmentHistoryView = dynamic(() => import("@/components/AppointmentHistoryView"), { ssr: false });
import { useNotifications } from "@/hooks/useNotifications";
import { toast } from "sonner";
import { useAppointmentModal } from "@/hooks/useAppointmentModal";
import { useNotificationAppointmentSnapshot } from "@/hooks/useNotificationAppointmentSnapshot";
import { useNotificationApprovalDialog } from "@/hooks/useNotificationApprovalDialog";
const ApproveRejectDialog = dynamic(() => import("@/components/ApproveRejectDialog"), { ssr: false });

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
  } = useNotifications({ includeDeleted: true, limit: 10 });

  const { 
    updateAppointment,
    refreshAppointments,
    openEditModalById,
    // NOTE: we intentionally avoid reading `appointments`, `selectedAppointment`,
    // and `isEditModalOpen` here to prevent eager loading/processing that some
    // consumers trigger. Only imperative methods are required by this page.
    // The appointment snapshot logic is kept local and lazy.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    // (kept in provider) 
    // appointments,
    // isEditModalOpen,
    // selectedAppointment,
    // isLoading: appointmentsLoading
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
  // Pass an empty appointments array so the snapshot hook doesn't implicitly
  // iterate or depend on the full appointments list until the user explicitly
  // requests it (via the history view).
  } = useNotificationAppointmentSnapshot([]);

  const isLoading = notificationsLoading;

  // Local state to track whether the appointment edit modal was opened from
  // the snapshot view. This avoids reading provider internals like
  // `selectedAppointment`/`isEditModalOpen` which can cause additional work.
  const [isSnapshotAppointmentOpen, setIsSnapshotAppointmentOpen] = React.useState(false);

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
    // Mark that we're attempting to open the appointment editor from the
    // snapshot view. The actual editor is provided by the AppointmentModal
    // provider and will open when `openEditModalById` completes.
    setIsSnapshotAppointmentOpen(true);
    try {
      await handleReschedule(appointmentId);
    } catch (err) {
      // If opening failed, clear the local flag so UI reflects reality.
      setIsSnapshotAppointmentOpen(false);
      throw err;
    }
  };

  // `isSnapshotAppointmentOpen` is tracked locally (see above).

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
        isLoading={isLoading}
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
            setIsSnapshotAppointmentOpen(false);
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
