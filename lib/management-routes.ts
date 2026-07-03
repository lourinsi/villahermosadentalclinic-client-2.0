export const getManagementDashboardPath = (role?: string | null) => {
  if (role === "admin") return "/admin/dashboard";
  if (role === "receptionist") return "/receptionist/dashboard";

  return null;
};
