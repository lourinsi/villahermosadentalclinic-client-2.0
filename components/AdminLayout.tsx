"use client";
import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { apiUrl } from "@/lib/api";
import { getAuthHeaders } from "@/lib/auth-headers";
import { useAuth } from "@/hooks/useAuth.tsx";
import { useBookingModalMode } from "@/hooks/useBookingModalMode";
import { useAdminViewMode } from "@/hooks/useAdminViewMode";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { LogOut, User, LayoutDashboard, Users, Calendar, Shield, Bell, ClipboardList, Stethoscope, DollarSign, Settings, ListChecks, PanelLeftClose, PanelLeftOpen, Menu, X, AlertTriangle, Loader2, History } from "lucide-react";
import { toast } from "sonner";
import NotificationsOpened from "./notificationsOpened";
import AppointmentHistoryView from "./AppointmentHistoryView";
import ApproveRejectDialog from "./ApproveRejectDialog";
import { useNotifications } from "@/hooks/useNotifications";
import { useAppointmentModal } from "@/hooks/useAppointmentModal";
import { useNotificationAppointmentSnapshot } from "@/hooks/useNotificationAppointmentSnapshot";
import { useNotificationApprovalDialog } from "@/hooks/useNotificationApprovalDialog";
import { PatientProfileDraftRedirect } from "./PatientProfileDraftRedirect";
import { MANAGEMENT_LOGOUT_REDIRECT_KEY, STAFF_PORTAL_LOGIN_PATH, isReceptionistLevelRole } from "@/lib/management-routes";

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
  { path: "/treatment-history", label: "Treatment History", icon: History },
  { path: "/patients", label: "Patients", icon: Users },
  { path: "/calendar", label: "Calendar", icon: Calendar },
  { path: "/doctors", label: "Find Doctors", icon: Stethoscope, hideForReceptionist: true },
  { path: "/services", label: "Services", icon: ListChecks },
  { path: "/finance", label: "Finance", icon: DollarSign },
  { path: "/staff", label: "Staff", icon: Shield },
  { path: "/notifications", label: "Notifications", icon: Bell },
  { path: "/settings", label: "Settings", icon: Settings },
];

const DEFAULT_STAFF_PASSWORD = "password";

interface AdminLayoutShellProps {
  children: React.ReactNode;
  portalTitle: string;
  theme: AdminLayoutTheme;
}

export const AdminLayoutShell = ({ children, portalTitle, theme }: AdminLayoutShellProps) => {
  const pathname = usePathname();
  const router = useRouter();
  const { logout, user, checkAuth } = useAuth();
  const { mode, toggleMode } = useBookingModalMode();
  const { isReceptionistView, canSwitchAdminView, toggleViewMode } = useAdminViewMode();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = React.useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [isPasswordPromptOpen, setIsPasswordPromptOpen] = React.useState(false);
  const [isChangingDefaultPassword, setIsChangingDefaultPassword] = React.useState(false);
  const [passwordForm, setPasswordForm] = React.useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const managementBasePath = isReceptionistLevelRole(user?.role) ? "/receptionist" : "/admin";
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
  const mustChangePassword = Boolean(user?.mustChangePassword && isReceptionistLevelRole(user?.role));
  const visibleNavItems = navItems.filter((item) => !item.hideForReceptionist || !isReceptionistView);
  const mobilePrimaryNavItems = visibleNavItems.filter((item) =>
    ["Dashboard", "Requests", "Calendar", "Settings"].includes(item.label)
  );
  const activeNavItem = visibleNavItems.find((item) => {
    const itemHref = `${managementBasePath}${item.path}`;
    return pathname === itemHref || pathname.startsWith(`${itemHref}/`);
  }) || visibleNavItems[0];
  const userInitials = String(user?.username || portalTitle || "AD")
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "AD";
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
      try {
        sessionStorage.setItem(MANAGEMENT_LOGOUT_REDIRECT_KEY, STAFF_PORTAL_LOGIN_PATH);
      } catch {
        // Ignore storage failures; the explicit router push below still handles normal logout.
      }
      await logout();
      toast.success("Logged out successfully");
      router.push(STAFF_PORTAL_LOGIN_PATH);
    } catch (error) {
      console.error("Logout error:", error);
      toast.error("Failed to logout");
    }
  };

  const handlePasswordFieldChange =
    (field: "currentPassword" | "newPassword" | "confirmPassword") =>
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setPasswordForm((current) => ({ ...current, [field]: event.target.value }));
    };

  const handleChangeDefaultPassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      toast.error("Please fill in all password fields");
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      toast.error("New password must be at least 6 characters");
      return;
    }

    if (passwordForm.newPassword === DEFAULT_STAFF_PASSWORD) {
      toast.error("Choose a password different from the default password");
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }

    setIsChangingDefaultPassword(true);
    try {
      const response = await fetch(apiUrl("/api/auth/change-password"), {
        method: "POST",
        credentials: "include",
        headers: getAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.message || "Failed to change password");
      }

      if (payload.token) {
        localStorage.setItem("authToken", payload.token);
      }

      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      await checkAuth();
      setIsPasswordPromptOpen(false);
      toast.success("Password changed successfully");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to change password");
    } finally {
      setIsChangingDefaultPassword(false);
    }
  };

  const getNavTourId = (label: string) =>
    `admin-nav-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
  const sidebarWidthClass = isSidebarCollapsed ? "md:!w-20" : "md:!w-20 xl:!w-64";
  const sidebarLabelClass = isSidebarCollapsed ? "md:sr-only" : "md:sr-only xl:not-sr-only";
  const sidebarItemLayoutClass = isSidebarCollapsed
    ? "md:mx-auto md:h-12 md:w-12 md:justify-center md:px-0"
    : "md:mx-auto md:h-12 md:w-12 md:justify-center md:px-0 xl:mx-2 xl:h-auto xl:w-auto xl:justify-start xl:px-4";
  const sidebarFooterLayoutClass = isSidebarCollapsed
    ? "md:!flex md:flex-col md:items-center md:gap-3 md:space-y-0"
    : "md:!flex md:flex-col md:items-center md:gap-3 md:space-y-0 xl:!block xl:space-y-3";

  React.useEffect(() => {
    if (mustChangePassword) {
      setIsPasswordPromptOpen(true);
      return;
    }

    setIsPasswordPromptOpen(false);
    setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
  }, [mustChangePassword]);

  React.useEffect(() => {
    if (!isReceptionistLevelRole(user?.role) || !pathname.startsWith("/admin/")) return;
    router.replace(pathname.replace(/^\/admin/, "/receptionist"));
  }, [pathname, router, user?.role]);

  React.useEffect(() => {
    if (!user?.username || !user?.role || user.role === "patient") return;

    let cancelled = false;

    const showIncompletePatientToast = async () => {
      try {
        await new Promise((resolve) => window.setTimeout(resolve, 500));
        if (cancelled) return;

        const response = await fetch(apiUrl("/api/patients?page=1&limit=1&status=all"), {
          credentials: "include",
          headers: getAuthHeaders(),
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.success || cancelled) return;

        const count = Number(payload?.meta?.incompletePatientCount || 0);
        const patientLabel = count === 1 ? "patient" : "patients";
        const message =
          count > 0
            ? `You have ${count} incomplete ${patientLabel}. Please tend to ${count === 1 ? "this patient" : "them"}.`
            : "You have 0 incomplete patients to tend to.";

        if (count > 0) {
          toast.warning(message, { duration: 8000 });
        } else {
          toast.success(message, { duration: 5000 });
        }
      } catch (error) {
        console.warn("[AdminLayout] Failed to fetch incomplete patient count:", error);
      }
    };

    showIncompletePatientToast();

    return () => {
      cancelled = true;
    };
  }, [user?.role, user?.username]);

  React.useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  return (
    <div className="flex min-h-dvh flex-col bg-gray-50 md:h-screen md:flex-row">
      <header className="sticky top-0 z-40 border-b border-gray-100 bg-white/95 px-4 py-3 shadow-sm backdrop-blur md:hidden">
        <div className="flex items-center gap-4">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Open navigation"
            onClick={() => setIsMobileMenuOpen(true)}
            className="h-11 w-11 rounded-2xl text-gray-900 hover:bg-gray-100"
          >
            <Menu className="h-7 w-7" />
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-2xl font-black tracking-tight text-gray-950">{activeNavItem?.label || portalTitle}</h1>
            <p className="truncate text-sm font-bold text-slate-500">
              Welcome back, <span className="text-violet-600">{user?.username || portalTitle}</span>
            </p>
          </div>
          <div className="relative" data-tour-id="admin-notifications-mobile">
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
          <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-600 text-base font-black text-white shadow-lg shadow-violet-200">
            {userInitials}
            <span className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full border-2 border-white bg-emerald-500" />
            {mustChangePassword && (
              <span
                className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-amber-400 text-amber-950"
                title="Change your default password"
              >
                <AlertTriangle className="h-3 w-3" />
              </span>
            )}
          </div>
        </div>
      </header>

      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            aria-label="Close navigation overlay"
            className="absolute inset-0 bg-slate-950/45"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <div className="relative flex h-full w-[82vw] max-w-sm flex-col rounded-r-[2rem] bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 p-5">
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-violet-600">{portalTitle}</p>
                <p className="mt-1 text-xl font-black text-gray-950">Navigation</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Close navigation"
                onClick={() => setIsMobileMenuOpen(false)}
                className="h-10 w-10 rounded-full"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
            <nav className="sleek-scrollbar min-h-0 flex-1 overflow-y-auto p-4">
              <ul className="space-y-2">
                {visibleNavItems.map((item) => {
                  const Icon = item.icon;
                  const itemHref = `${managementBasePath}${item.path}`;
                  const isActive = pathname === itemHref || pathname.startsWith(`${itemHref}/`);
                  return (
                    <li key={itemHref}>
                      <Link
                        href={itemHref}
                        prefetch={false}
                        data-tour-id={getNavTourId(item.label)}
                        className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-black transition-colors ${
                          isActive
                            ? "bg-violet-600 text-white shadow-lg shadow-violet-100"
                            : "text-slate-600 hover:bg-violet-50 hover:text-violet-700"
                        }`}
                      >
                        <Icon className="h-5 w-5 shrink-0" />
                        <span>{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>
            <div className="space-y-3 border-t border-gray-100 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
              {canSwitchAdminView && (
                <Button onClick={toggleViewMode} variant="outline" className="h-11 w-full justify-start gap-2 rounded-2xl font-bold">
                  {isReceptionistView ? <User className="h-4 w-4" /> : <Shield className="h-4 w-4" />}
                  {isReceptionistView ? "Receptionist view" : "Admin view"}
                </Button>
              )}
              {!isReceptionistView && (
                <Button onClick={toggleMode} variant="outline" className="h-11 w-full justify-start rounded-2xl font-bold">
                  {mode === "simple" ? "Simple booking mode" : "Pro booking mode"}
                </Button>
              )}
              <Button onClick={handleLogout} variant="outline" className="h-11 w-full justify-start gap-2 rounded-2xl font-bold text-rose-600 hover:bg-rose-50 hover:text-rose-700">
                <LogOut className="h-4 w-4" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      )}

      <aside
        data-tour-id="admin-sidebar"
        className={`${theme.sidebar} hidden transition-[width] duration-300 md:flex ${sidebarWidthClass}`}
      >
        <div className={`${theme.title} flex items-center justify-between gap-2 md:!px-3 ${!isSidebarCollapsed ? "xl:!p-4" : ""}`}>
          <span className={`truncate ${sidebarLabelClass}`}>{portalTitle}</span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            onClick={() => setIsSidebarCollapsed((collapsed) => !collapsed)}
            className={`hidden h-8 w-8 shrink-0 rounded-lg border border-white/15 bg-white/10 text-white hover:bg-white/20 hover:text-white md:inline-flex ${
              isSidebarCollapsed ? "md:mx-auto" : ""
            }`}
          >
            {isSidebarCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </Button>
        </div>
        <nav className={`sleek-scrollbar flex-none overflow-x-auto py-2 md:flex-1 md:overflow-y-auto md:px-2 md:py-4 ${!isSidebarCollapsed ? "xl:px-0" : ""}`}>
          <ul className={`flex gap-1 px-2 md:block md:px-0 ${isSidebarCollapsed ? "md:space-y-2" : "md:space-y-2 xl:space-y-1"}`}>
            {visibleNavItems.map((item) => {
              const Icon = item.icon;
              const itemHref = `${managementBasePath}${item.path}`;
              const isActive = pathname === itemHref || pathname.startsWith(`${itemHref}/`);
              return (
                <li key={itemHref} className="shrink-0">
                  <Link
                    href={itemHref}
                    prefetch={false}
                    data-tour-id={getNavTourId(item.label)}
                    title={isSidebarCollapsed ? item.label : undefined}
                    className={`mx-0 flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors md:gap-3 md:py-3 md:text-base ${sidebarItemLayoutClass} ${
                      isActive
                        ? theme.navActive
                        : theme.navInactive
                    }`}
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                    <span className={`whitespace-nowrap ${sidebarLabelClass}`}>{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className={`${theme.footer} ${sidebarFooterLayoutClass}`}>
          <div className={`${theme.userBox} relative md:flex md:h-10 md:w-10 md:justify-center md:space-x-0 md:px-0 ${!isSidebarCollapsed ? "xl:h-auto xl:w-auto xl:justify-start xl:space-x-2 xl:px-3" : ""}`}>
            <User className={theme.userIcon} />
            <span className={`truncate text-sm font-medium ${sidebarLabelClass}`}>{user?.username || portalTitle}</span>
            {mustChangePassword && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span
                    className={`ml-auto inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-300 text-amber-950 shadow-sm ring-1 ring-amber-100 md:absolute md:-right-1 md:-top-1 md:ml-0 md:h-4 md:w-4 ${!isSidebarCollapsed ? "xl:static xl:ml-auto xl:h-5 xl:w-5" : ""}`}
                    tabIndex={0}
                    aria-label="Change your default password"
                  >
                    <AlertTriangle className={`md:h-3 md:w-3 ${!isSidebarCollapsed ? "xl:h-3.5 xl:w-3.5" : ""}`} />
                  </span>
                </TooltipTrigger>
                <TooltipContent side={isSidebarCollapsed ? "right" : "top"}>
                  Change your default password.
                </TooltipContent>
              </Tooltip>
            )}
          </div>
          <Button
            onClick={handleLogout}
            variant="outline"
            className={`${theme.logoutButton} md:!w-10 md:justify-center md:px-0 ${!isSidebarCollapsed ? "xl:!w-full xl:justify-start xl:px-4" : ""}`}
            title={isSidebarCollapsed ? "Logout" : undefined}
          >
            <LogOut className={`h-4 w-4 md:mr-0 ${!isSidebarCollapsed ? "xl:mr-2" : ""}`} />
            <span className={sidebarLabelClass}>Logout</span>
          </Button>
        </div>
      </aside>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <header className="hidden min-h-14 flex-shrink-0 flex-wrap items-center justify-between gap-2 border-b border-gray-200 bg-white px-3 py-2 md:flex md:h-16 md:px-6">
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
            {!isReceptionistView && (
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
            )}
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
        <main className="flex-1 overflow-auto bg-gray-50 p-3 pb-[calc(5.5rem+env(safe-area-inset-bottom))] sm:p-4 sm:pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:p-6">{children}</main>
        <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-100 bg-white/95 px-3 pb-[calc(0.45rem+env(safe-area-inset-bottom))] pt-2 shadow-[0_-12px_30px_rgba(15,23,42,0.08)] backdrop-blur md:hidden">
          <ul className="grid grid-cols-4 gap-1">
            {mobilePrimaryNavItems.map((item) => {
              const Icon = item.icon;
              const itemHref = `${managementBasePath}${item.path}`;
              const isActive = pathname === itemHref || pathname.startsWith(`${itemHref}/`);
              const showBadge = item.label === "Requests" && unreadCount > 0;
              return (
                <li key={itemHref}>
                  <Link
                    href={itemHref}
                    prefetch={false}
                    className={`relative flex h-16 flex-col items-center justify-center gap-1 rounded-2xl text-[11px] font-bold transition-colors ${
                      isActive ? "text-violet-600" : "text-slate-500 hover:bg-violet-50 hover:text-violet-600"
                    }`}
                  >
                    <span className={`flex h-8 w-8 items-center justify-center rounded-xl ${isActive ? "bg-violet-50" : ""}`}>
                      <Icon className="h-6 w-6" />
                    </span>
                    <span>{item.label}</span>
                    {showBadge && (
                      <span className="absolute right-4 top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-black text-white">
                        {unreadCount > 9 ? "9+" : unreadCount}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
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
        
        {/* Booking modal is globally handled by GlobalBookingModalWrapper */}
      </div>
      <Dialog
        open={mustChangePassword && isPasswordPromptOpen}
        onOpenChange={(open) => {
          if (mustChangePassword && !open) {
            setIsPasswordPromptOpen(true);
            return;
          }
          setIsPasswordPromptOpen(open);
        }}
      >
        <DialogContent
          showCloseButton={false}
          className="sm:max-w-md"
          onEscapeKeyDown={(event) => event.preventDefault()}
          onPointerDownOutside={(event) => event.preventDefault()}
        >
          <form onSubmit={handleChangeDefaultPassword} className="space-y-5">
            <DialogHeader>
              <div className="mb-1 flex h-11 w-11 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <DialogTitle>Change your default password</DialogTitle>
              <DialogDescription>
                Your staff account is still using the default password. Change it before continuing.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="default-current-password">Current Password</Label>
                <Input
                  id="default-current-password"
                  type="password"
                  value={passwordForm.currentPassword}
                  onChange={handlePasswordFieldChange("currentPassword")}
                  autoComplete="current-password"
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="default-new-password">New Password</Label>
                <Input
                  id="default-new-password"
                  type="password"
                  value={passwordForm.newPassword}
                  onChange={handlePasswordFieldChange("newPassword")}
                  autoComplete="new-password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="default-confirm-password">Confirm New Password</Label>
                <Input
                  id="default-confirm-password"
                  type="password"
                  value={passwordForm.confirmPassword}
                  onChange={handlePasswordFieldChange("confirmPassword")}
                  autoComplete="new-password"
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleLogout}
                disabled={isChangingDefaultPassword}
              >
                Logout
              </Button>
              <Button type="submit" disabled={isChangingDefaultPassword}>
                {isChangingDefaultPassword && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Change Password
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

interface AdminLayoutProps {
  children: React.ReactNode;
  portalTitle?: string;
  theme?: AdminLayoutTheme;
}

const AdminLayout = ({ children, portalTitle = "Admin", theme = adminLayoutTheme }: AdminLayoutProps) => (
  <AdminLayoutShell portalTitle={portalTitle} theme={theme}>
    <PatientProfileDraftRedirect />
    {children}
  </AdminLayoutShell>
);

export default AdminLayout;
