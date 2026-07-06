export const STAFF_PORTAL_LOGIN_PATH = "/workspace-portal-auth";
export const MANAGEMENT_LOGOUT_REDIRECT_KEY = "villahermosa-management-logout-redirect";

export const getManagementDashboardPath = (role?: string | null) => {
  if (role === "admin") return "/admin/dashboard";
  if (role === "receptionist") return "/receptionist/dashboard";

  return null;
};
