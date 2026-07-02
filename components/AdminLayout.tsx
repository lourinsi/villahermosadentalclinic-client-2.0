"use client";
import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth.tsx";
import { useBookingModalMode } from "@/hooks/useBookingModalMode";
import { useAdminViewMode } from "@/hooks/useAdminViewMode";
import { Button } from "@/components/ui/button";
import { LogOut, User, LayoutDashboard, Users, Calendar, Shield, Bell, ClipboardList, Stethoscope, DollarSign, Settings, ListChecks } from "lucide-react";
import { toast } from "sonner";
import NotificationsOpened from "./notificationsOpened";
import BookingModalWrapper from "./BookingModalWrapper";
import AppointmentHistoryView from "./AppointmentHistoryView";
import ApproveRejectDialog from "./ApproveRejectDialog";
import { useNotifications } from "@/hooks/useNotifications";
import { useAppointmentModal } from "@/hooks/useAppointmentModal";
import { useNotificationAppointmentSnapshot } from "@/hooks/useNotificationAppointmentSnapshot";
import { useNotificationApprovalDialog } from "@/hooks/useNotificationApprovalDialog";

export interface AdminLayoutTheme {
  sidebar: string;
  title: string;
  navActive: string;
  navInactive: string;
  footer: string;
  userBox: string;
  userIcon: string;
  logoutButton: string;
}

export const adminLayoutTheme: AdminLayoutTheme = {
  sidebar: "w-full bg-blue-900 text-white flex-shrink-0 flex flex-col md:h-full md:w-64",
  title: "border-b border-blue-800 px-4 py-3 text-lg font-bold md:p-4 md:text-2xl",
  navActive: "bg-blue-950 text-white",
  navInactive: "text-blue-100 hover:bg-blue-800 hover:text-white",
  footer: "flex items-center gap-2 border-t border-blue-800 p-2 md:block md:space-y-3 md:p-4",
  userBox: "hidden min-w-0 items-center space-x-2 rounded-lg bg-blue-800 px-3 py-2 sm:flex",
  userIcon: "w-4 h-4 text-blue-200",
  logoutButton: "w-auto shrink-0 justify-start bg-white text-blue-900 hover:bg-blue-50 md:w-full",
};

const navItems = [
  { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { path: "/requests", label: "Requests", icon: ClipboardList },
  { path: "/patients", label: "Patients", icon: Users },
  { path: "/doctors", label: "Find Doctors", icon: Stethoscope, hideForReceptionist: true },
  { path: "/services", label: "Services", icon: ListChecks },
  { path: "/questionnaire", label: "Questionnaire", icon: ClipboardList },
  { path: "/calendar", label: "Calendar", icon: Calendar },
  { path: "/finance", label: "Finance", icon: DollarSign },
  { path: "/staff", label: "Staff", icon: Shield },
  { path: "/notifications", label: "Notifications", icon: Bell },
  { path: "/settings", label: "Settings", icon: Settings },
];

const MANAGEMENT_LOGOUT_REDIRECT_KEY = "villahermosa-management-logout-redirect";

interface AdminLayoutShellProps {
  children: React.ReactNode;
  portalTitle: string;
  theme: AdminLayoutTheme;
}

export const AdminLayoutShell = ({ children, portalTitle, theme }: AdminLayoutShellProps) => {
  const pathname = usePathname();
  const router = useRouter();
  const { logout, user } = useAuth();
  const { mode, toggleMode } = useBookingModalMode();
  const { isReceptionistView, canSwitchAdminView, toggleViewMode } = useAdminViewMode();
  const managementBasePath = user?.role === "receptionist" ? "/receptionist" : "/admin";
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
  const visibleNavItems = navItems.filter((item) => !item.hideForReceptionist || !isReceptionistView);
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
    console.log(`[AdminLayout] Attempting to edit appointment: ${appointmentId}`);
    try {
      await openEditModalById(appointmentId);
    } catch (error) {
      console.error(`[AdminLayout] Error in handleEditAppointment:`, error);
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
      const logoutRedirect = user?.role === "receptionist" ? "/receptionist/login" : "/admin/login";
      try {
        sessionStorage.setItem(MANAGEMENT_LOGOUT_REDIRECT_KEY, logoutRedirect);
      } catch {
        // Ignore storage failures; the explicit router push below still handles normal logout.
      }
      await logout();
      toast.success("Logged out successfully");
      router.push(logoutRedirect);
    } catch (error) {
      console.error("Logout error:", error);
      toast.error("Failed to logout");
    }
  };

  const getNavTourId = (label: string) =>
    `admin-nav-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;

  React.useEffect(() => {
    if (user?.role !== "receptionist" || !pathname.startsWith("/admin/")) return;
    router.replace(pathname.replace(/^\/admin/, "/receptionist"));
  }, [pathname, router, user?.role]);

  return (
    <div className="flex min-h-dvh flex-col bg-gray-100 md:h-screen md:flex-row">
      <aside data-tour-id="admin-sidebar" className={theme.sidebar}>
        <div className={theme.title}>{portalTitle}</div>
        <nav className="flex-none overflow-x-auto py-2 md:flex-1 md:overflow-y-auto md:py-4">
          <ul className="flex gap-1 px-2 md:block md:space-y-1 md:px-0">
            {visibleNavItems.map((item) => {
              const Icon = item.icon;
              const itemHref = `${managementBasePath}${item.path}`;
              const isActive = pathname === itemHref;
              return (
                <li key={itemHref} className="shrink-0">
                  <Link
                    href={itemHref}
                    prefetch={false}
                    data-tour-id={getNavTourId(item.label)}
                    className={`mx-0 flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors md:mx-2 md:gap-3 md:px-4 md:py-3 md:text-base ${
                      isActive
                        ? theme.navActive
                        : theme.navInactive
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
        <div className={theme.footer}>
          <div className={theme.userBox}>
            <User className={theme.userIcon} />
            <span className="text-sm font-medium truncate">{user?.username || portalTitle}</span>
          </div>
          <Button
            onClick={handleLogout}
            variant="outline"
            className={theme.logoutButton}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>
      </aside>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <header className="flex min-h-14 flex-shrink-0 flex-wrap items-center justify-between gap-2 border-b border-gray-200 bg-white px-3 py-2 md:h-16 md:px-6">
          <div className="flex min-w-0 flex-wrap items-center gap-2 md:gap-3">
            {canSwitchAdminView && (
              <Button
                onClick={toggleViewMode}
                variant="outline"
                size="sm"
                data-tour-id="admin-role-view-toggle"
                className="text-xs gap-2"
                title={`Switch to ${isReceptionistView ? "Admin" : "Receptionist"} view`}
              >
                {isReceptionistView ? (
                  <User className="h-3.5 w-3.5" />
                ) : (
                  <Shield className="h-3.5 w-3.5" />
                )}
                {isReceptionistView ? "Receptionist" : "Admin"}
              </Button>
            )}
            <Button
              onClick={toggleMode}
              variant="outline"
              size="sm"
              data-tour-id="admin-mode-toggle"
              className="text-xs"
              title={`Switch to ${mode === 'simple' ? 'Pro' : 'Simple'} mode`}
            >
              {mode === 'simple' ? '📱 Simple' : '⭐ Pro'}
            </Button>
          </div>
          <div data-tour-id="admin-notifications">
            <NotificationsOpened
              notifications={notifications}
              unreadCount={unreadCount}
              portal="admin"
              notificationsPath={`${managementBasePath}/notifications`}
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
          </div>
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

const AdminLayout = ({ children }: { children: React.ReactNode }) => (
  <AdminLayoutShell portalTitle="Admin" theme={adminLayoutTheme}>
    {children}
  </AdminLayoutShell>
);

export default AdminLayout;
