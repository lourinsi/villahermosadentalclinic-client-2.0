"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth.tsx";
import { useBookingModalMode } from "@/hooks/useBookingModalMode";
import { Button } from "@/components/ui/button";
import { LogOut, User, LayoutDashboard, Calendar, Users, Bell, ClipboardList, Settings } from "lucide-react";
import { toast } from "sonner";
import NotificationsOpened from "./notificationsOpened";
import BookingModalWrapper from "./BookingModalWrapper";
import AppointmentHistoryView from "./AppointmentHistoryView";
import ApproveRejectDialog from "./ApproveRejectDialog";
import { useNotifications } from "@/hooks/useNotifications";
import { useAppointmentModal } from "@/hooks/useAppointmentModal";
import { useNotificationAppointmentSnapshot } from "@/hooks/useNotificationAppointmentSnapshot";
import { useNotificationApprovalDialog } from "@/hooks/useNotificationApprovalDialog";

const DoctorLayout = ({ children }: { children: React.ReactNode }) => {
  const pathname = usePathname();
  const router = useRouter();
  const { logout, user } = useAuth();
  const { mode, toggleMode } = useBookingModalMode();
  const {
    notifications,
    markAsRead,
    markAsUnread,
    deleteNotification,
    deleteNotificationWithResult,
    markAllAsRead,
    deleteAllNotifications,
    refreshNotifications,
    loadMoreNotifications,
    hasMore,
    isLoadingMore,
    unreadCount: serverUnreadCount,
  } = useNotifications();
  const { 
    appointments, 
    openEditModalById,
    isEditModalOpen,
    isCreateModalOpen,
    closeEditModal,
    closeCreateModal,
    selectedAppointment,
    newAppointmentDate,
    newAppointmentTime,
    newAppointmentPatientId,
    newAppointmentDoctorName,
    newAppointmentCreationMode
  } = useAppointmentModal();
  const {
    isAppointmentHistoryOpen,
    setIsAppointmentHistoryOpen,
    appointmentSnapshot,
    appointmentSnapshotId,
    appointmentSnapshotLogDate,
    appointmentSnapshotIsHistorical,
    handleViewCurrentSnapshot,
    handleViewAppointmentSnapshot,
    resetAppointmentSnapshot,
  } = useNotificationAppointmentSnapshot(appointments);

  const unreadCount = serverUnreadCount ?? notifications.filter(n => !n.isRead).length;
  const isBookingModalOpen = isEditModalOpen || isCreateModalOpen;
  const {
    approvalDialogAppointment,
    approvalDialogMode,
    isApprovalDialogOpen,
    isApprovalDialogProcessing,
    openApprovalDialog,
    closeApprovalDialog,
    confirmApprovalAction,
  } = useNotificationApprovalDialog({ markAsRead, refreshNotifications });

  const handleEditAppointment = async (appointmentId: string) => {
    console.log(`[DoctorLayout] Attempting to edit appointment: ${appointmentId}`);
    try {
      await openEditModalById(appointmentId);
    } catch (error) {
      console.error(`[DoctorLayout] Error in handleEditAppointment:`, error);
      toast.error("Appointment not found or could not be loaded");
    }
  };

  const handleOpenSnapshotAppointment = async (appointmentId: string) => {
    setIsAppointmentHistoryOpen(false);
    resetAppointmentSnapshot();
    await handleEditAppointment(appointmentId);
  };

  const isSnapshotAppointmentOpen = Boolean(
    isEditModalOpen &&
    appointmentSnapshotId &&
    selectedAppointment?.id &&
    String(selectedAppointment.id) === String(appointmentSnapshotId)
  );

  const handleLogout = async () => {
    try {
      await logout();
      toast.success("Logged out successfully");
      router.push("/login");
    } catch (error) {
      console.error("Logout error:", error);
      toast.error("Failed to logout");
    }
  };

  const navItems = [
    { href: "/doctor/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/doctor/requests", label: "Requests", icon: ClipboardList },
    { href: "/doctor/calendar", label: "My Schedule", icon: Calendar },
    { href: "/doctor/patients", label: "My Patients", icon: Users },
    { href: "/doctor/notifications", label: "Notifications", icon: Bell },
    { href: "/doctor/settings", label: "Settings", icon: Settings },
  ];

  return (
    <div className="flex min-h-dvh flex-col bg-gray-100 md:h-screen md:flex-row">
      <aside className="flex w-full flex-shrink-0 flex-col bg-violet-800 text-white md:h-full md:w-64">
        <div className="border-b border-violet-700 px-4 py-3 text-lg font-bold md:p-4 md:text-2xl">
          <span className="text-violet-200">Doctor</span> Portal
        </div>
        <nav className="flex-none overflow-x-auto py-2 md:flex-1 md:overflow-y-auto md:py-4">
          <ul className="flex gap-1 px-2 md:block md:space-y-1 md:px-0">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <li key={item.href} className="shrink-0">
                  <Link
                    href={item.href}
                    prefetch={false}
                    className={`mx-0 flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors md:mx-2 md:gap-3 md:px-4 md:py-3 md:text-base ${
                      isActive
                        ? "bg-violet-900 text-white"
                        : "text-violet-200 hover:bg-violet-700 hover:text-white"
                    }`}
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                    <span className="whitespace-nowrap">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="flex items-center gap-2 border-t border-violet-700 p-2 md:block md:space-y-3 md:p-4">
          <div className="hidden min-w-0 items-center space-x-2 rounded-lg bg-violet-700 px-3 py-2 sm:flex">
            <User className="w-4 h-4 text-violet-300" />
            <div className="flex-1 min-w-0">
              <span className="text-sm font-medium block truncate">{user?.username || "Doctor"}</span>
              <span className="text-xs text-violet-300">Doctor</span>
            </div>
          </div>
          <Button
            onClick={handleLogout}
            variant="outline"
            className="w-auto shrink-0 justify-start bg-white text-violet-800 hover:bg-violet-100 md:w-full"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>
      </aside>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <header className="flex min-h-14 flex-shrink-0 flex-wrap items-center justify-between gap-2 border-b border-gray-200 bg-white px-3 py-2 md:h-16 md:px-6">
          <div className="flex min-w-0 flex-wrap items-center gap-2 md:gap-3">
            <Button
              onClick={toggleMode}
              variant="outline"
              size="sm"
              className="text-xs"
              title={`Switch to ${mode === 'simple' ? 'Pro' : 'Simple'} mode`}
            >
              {mode === 'simple' ? '📱 Simple' : '⭐ Pro'}
            </Button>
          </div>
          <NotificationsOpened 
            notifications={notifications} 
            unreadCount={unreadCount} 
            portal="doctor" 
            onUpdateAppointmentStatus={openApprovalDialog}
            onMarkAsRead={markAsRead}
            onMarkAsUnread={markAsUnread}
            onDelete={deleteNotification}
            onDeleteWithResult={deleteNotificationWithResult}
            onMarkAllAsRead={markAllAsRead}
            onDeleteAll={deleteAllNotifications}
            onRefresh={refreshNotifications}
            hasMore={hasMore}
            isLoadingMore={isLoadingMore}
            onLoadMore={loadMoreNotifications}
            onEditAppointment={handleEditAppointment}
            onViewAppointmentSnapshot={handleViewAppointmentSnapshot}
          />
        </header>
        <main className="flex-1 overflow-auto bg-gray-50 p-3 sm:p-4 md:p-6">{children}</main>
        <AppointmentHistoryView
          open={isAppointmentHistoryOpen}
          onOpenChange={(open) => {
            setIsAppointmentHistoryOpen(open);
            if (!open) resetAppointmentSnapshot();
          }}
          appointmentSnapshot={appointmentSnapshot}
          logDate={appointmentSnapshotLogDate}
          onViewCurrent={handleViewCurrentSnapshot}
          onOpenAppointment={handleOpenSnapshotAppointment}
          isAppointmentOpen={isSnapshotAppointmentOpen}
          isHistorical={appointmentSnapshotIsHistorical}
        />
        <ApproveRejectDialog
          open={isApprovalDialogOpen}
          onOpenChange={closeApprovalDialog}
          mode={approvalDialogMode}
          appointment={approvalDialogAppointment}
          isProcessing={isApprovalDialogProcessing}
          onConfirm={confirmApprovalAction}
        />
        
        {/* Support editing appointments from notifications */}
        {isBookingModalOpen && (
          <BookingModalWrapper
            open={isBookingModalOpen}
            onOpenChange={(open) => {
              if (!open) {
                closeEditModal();
                closeCreateModal();
              }
            }}
            appointmentToEdit={selectedAppointment}
            defaultDate={newAppointmentDate}
            defaultTime={newAppointmentTime}
            defaultPatientId={isCreateModalOpen ? newAppointmentPatientId : undefined}
            doctorName={newAppointmentDoctorName}
            appointmentCreationMode={newAppointmentCreationMode}
          />
        )}
      </div>
    </div>
  );
};

export default DoctorLayout;
