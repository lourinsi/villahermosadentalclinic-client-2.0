export const getAuthHeaders = (baseHeaders: Record<string, string> = {}) => {
  const token =
    typeof window !== "undefined" ? window.localStorage.getItem("authToken") : null;

  if (!token) return baseHeaders;

  return {
    ...baseHeaders,
    Authorization: `Bearer ${token}`,
  };
};
