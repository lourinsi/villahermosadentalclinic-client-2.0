"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth.tsx";
import { useBookingModalMode } from "@/hooks/useBookingModalMode";
import { Button } from "@/components/ui/button";
import { LogOut, User, Home, Users, Calendar, Search, ShoppingBag, ShoppingCart, Bell, LayoutDashboard, Settings } from "lucide-react";
import { toast } from "sonner";
import NotificationsOpened from "./notificationsOpened";
import BookingModalWrapper from "./BookingModalWrapper";
import AppointmentHistoryView from "./AppointmentHistoryView";
import { useNotifications } from "@/hooks/useNotifications";
import { useAppointmentModal } from "@/hooks/useAppointmentModal";
import { useNotificationAppointmentSnapshot } from "@/hooks/useNotificationAppointmentSnapshot";

const PatientLayout = ({ children }: { children: React.ReactNode }) => {
  const pathname = usePathname();
  const router = useRouter();
  const { logout, user } = useAuth();
  const { mode, toggleMode } = useBookingModalMode();
  const {
    notifications,
    refreshNotifications,
    markAsRead,
    markAsUnread,
    deleteNotification,
    deleteNotificationWithResult,
    markAllAsRead,
    deleteAllNotifications,
    loadMoreNotifications,
    hasMore,
    isLoadingMore,
    unreadCount: serverUnreadCount,
  } = useNotifications();
  const { 
    appointments, 
    openEditModal, 
    openEditModalById,
    updateAppointment, 
    refreshAppointments,
    isEditModalOpen,
    isCreateModalOpen,
    closeEditModal,
    closeCreateModal,
    selectedAppointment,
    isPatientFieldReadOnly,
    newAppointmentDate,
    newAppointmentTime,
    newAppointmentPatientId,
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

  const handleReschedule = async (appointmentId: string) => {
    console.log(`[PatientLayout] Attempting to reschedule/view appointment: ${appointmentId}`);
    try {
      await openEditModalById(appointmentId, true);
    } catch (error) {
      console.error(`[PatientLayout] Error in handleReschedule:`, error);
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
    { href: "/patient/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/patient/account", label: "My Account", icon: Home },
    { href: "/patient/family", label: "Family Members", icon: Users },
    { href: "/patient/appointments", label: "My Appointments", icon: Calendar },
    { href: "/patient/doctors", label: "Find Doctors", icon: Search },
    { href: "/patient/orders", label: "Orders", icon: ShoppingBag },
    { href: "/patient/cart", label: "Cart", icon: ShoppingCart },
    { href: "/patient/notifications", label: "Notifications", icon: Bell },
    // { href: "/patient/settings", label: "Settings", icon: Settings },
  ];

  return (
    <div className="flex h-screen bg-gray-100">
      <aside className="w-64 bg-emerald-900 text-white flex-shrink-0 flex flex-col">
        <div className="p-4 text-2xl font-bold border-b border-emerald-800">Patient Portal</div>
        <nav className="flex-1 py-4">
          <ul className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    prefetch={false}
                    className={`flex items-center gap-3 px-4 py-3 mx-2 rounded-lg transition-colors ${
                      isActive
                        ? "bg-emerald-950 text-white"
                        : "text-emerald-100 hover:bg-emerald-800 hover:text-white"
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
        <div className="p-4 border-t border-emerald-800 space-y-3">
          <div className="flex items-center space-x-2 px-3 py-2 bg-emerald-800 rounded-lg">
            <User className="w-4 h-4 text-emerald-200" />
            <span className="text-sm font-medium truncate">{user?.username || "Patient"}</span>
          </div>
          <Button
            onClick={handleLogout}
            variant="outline"
            className="w-full justify-start text-emerald-900 hover:bg-emerald-50 bg-white"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>
      </aside>
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 flex-shrink-0">
          <div className="flex items-center gap-3">
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
            portal="patient" 
            onRefresh={refreshNotifications}
            onMarkAsRead={markAsRead}
            onMarkAsUnread={markAsUnread}
            onDelete={deleteNotification}
            onDeleteWithResult={deleteNotificationWithResult}
            onMarkAllAsRead={markAllAsRead}
            onDeleteAll={deleteAllNotifications}
            hasMore={hasMore}
            isLoadingMore={isLoadingMore}
            onLoadMore={loadMoreNotifications}
            onReschedule={handleReschedule}
            onCancelAppointment={handleCancelAppointment}
            onEditAppointment={handleReschedule}
            onViewAppointmentSnapshot={handleViewAppointmentSnapshot}
          />
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
        
        {/* Support editing/viewing appointments from notifications */}
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
            appointmentCreationMode={newAppointmentCreationMode}
          />
        )}
      </div>
    </div>
  );
};

export default PatientLayout;
