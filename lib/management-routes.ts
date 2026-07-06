export const STAFF_PORTAL_LOGIN_PATH = "/workspace-portal-auth";
export const MANAGEMENT_LOGOUT_REDIRECT_KEY = "villahermosa-management-logout-redirect";

export const isReceptionistLevelRole = (role?: string | null) => {
  const normalizedRole = String(role || "").toLowerCase();
  return normalizedRole === "receptionist" || normalizedRole === "doctor";
};

export const isManagementRole = (role?: string | null) => {
  const normalizedRole = String(role || "").toLowerCase();
  return normalizedRole === "admin" || isReceptionistLevelRole(normalizedRole);
};

export const getManagementDashboardPath = (role?: string | null) => {
  const normalizedRole = String(role || "").toLowerCase();

  if (normalizedRole === "admin") return "/admin/dashboard";
  if (isReceptionistLevelRole(normalizedRole)) return "/receptionist/dashboard";

  return null;
};
