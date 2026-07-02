import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDateToYYYYMMDD(dateInput?: Date | string | null): string {
  if (!dateInput) return "";

  let date: Date;
  if (dateInput instanceof Date) {
    date = dateInput;
  } else {
    const value = String(dateInput).trim();
    const isoDateMatch = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(value);
    if (isoDateMatch) {
      const year = Number(isoDateMatch[1]);
      const month = Number(isoDateMatch[2]);
      const day = Number(isoDateMatch[3]);
      date = new Date(year, month - 1, day);
    } else {
      date = new Date(value);
    }
  }

  if (Number.isNaN(date.getTime())) return "";

  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseDisplayDate(value?: Date | string | null): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;

  const raw = String(value).trim();
  if (!raw) return null;

  const dateOnlyMatch = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(raw);
  if (dateOnlyMatch) {
    const year = Number(dateOnlyMatch[1]);
    const month = Number(dateOnlyMatch[2]);
    const day = Number(dateOnlyMatch[3]);
    const parsed = new Date(year, month - 1, day);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatWordyDate(
  value?: Date | string | null,
  options: { fallback?: string; includeTime?: boolean } = {}
): string {
  const fallback = options.fallback ?? "";
  const parsed = parseDisplayDate(value);
  if (!parsed) return fallback;

  const month = parsed.toLocaleDateString("en-US", { month: "long" });
  const day = String(parsed.getDate()).padStart(2, "0");
  const dateLabel = `${month} ${day} ${parsed.getFullYear()}`;

  if (!options.includeTime) return dateLabel;

  const raw = value instanceof Date ? value.toISOString() : String(value || "");
  const hasTime = value instanceof Date || !/^\d{4}-\d{2}-\d{2}$/.test(raw.trim());
  if (!hasTime) return dateLabel;

  const timeLabel = parsed.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${dateLabel}, ${timeLabel}`;
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
