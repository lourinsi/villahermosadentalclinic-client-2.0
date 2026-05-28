import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDateToYYYYMMDD(date: Date): string {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseBackendDateToLocal(dateString: string): Date {
  // Assuming backend sends dates in YYYY-MM-DD format
  const date = new Date(dateString + 'T00:00:00');
  return date;
}

/**
 * Calculate age in whole years from a birth date string or Date.
 * Returns `null` when `dob` is missing or invalid.
 */
export function calculateAgeFromDOB(dob?: string | Date | null): number | null {
  if (!dob) return null;

  let birth: Date;
  if (typeof dob === "string") {
    const raw = dob.trim();
    const normalized = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T00:00:00` : raw;
    birth = new Date(normalized);
  } else {
    birth = new Date(dob);
  }

  if (Number.isNaN(birth.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}
