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
  sidebar: "w-64 bg-blue-900 text-white flex-shrink-0 flex flex-col",
  title: "p-4 text-2xl font-bold border-b border-blue-800",
  navActive: "bg-blue-950 text-white",
  navInactive: "text-blue-100 hover:bg-blue-800 hover:text-white",
  footer: "p-4 border-t border-blue-800 space-y-3",
  userBox: "flex items-center space-x-2 px-3 py-2 bg-blue-800 rounded-lg",
  userIcon: "w-4 h-4 text-blue-200",
  logoutButton: "w-full justify-start text-blue-900 hover:bg-blue-50 bg-white",
};

const navItems = [
  { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { path: "/requests", label: "Requests", icon: ClipboardList },
  { path: "/patients", label: "Patients", icon: Users },
  { path: "/doctors", label: "Find Doctors", icon: Stethoscope },
  { path: "/services", label: "Services", icon: ListChecks },
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
    <div className="flex h-screen bg-gray-100">
      <aside data-tour-id="admin-sidebar" className={theme.sidebar}>
        <div className={theme.title}>{portalTitle}</div>
        <nav className="flex-1 py-4">
          <ul className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const itemHref = `${managementBasePath}${item.path}`;
              const isActive = pathname === itemHref;
              return (
                <li key={itemHref}>
                  <Link
                    href={itemHref}
                    prefetch={false}
                    data-tour-id={getNavTourId(item.label)}
                    className={`flex items-center gap-3 px-4 py-3 mx-2 rounded-lg transition-colors ${
                      isActive
                        ? theme.navActive
                        : theme.navInactive
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span>{item.label}</span>
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
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 flex-shrink-0">
          <div className="flex items-center gap-3">
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
        <main className="flex-1 p-6 overflow-auto bg-gray-50">{children}</main>
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
