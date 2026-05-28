const DEFAULT_API_URL =
  process.env.NODE_ENV === "production"
    ? "https://villahermosadentalclinic-server.onrender.com"
    : "http://localhost:3001";

export const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL || DEFAULT_API_URL
).replace(/\/+$/, "");

export function apiUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
}
