/**
 * SHARED APPOINTMENT TYPES CONSTANTS
 * This is the single source of truth for appointment types, prices, and durations
 * Used by both the server and client applications
 */

export const APPOINTMENT_TYPES = [
  "Routine Cleaning",
  "Checkup",
  "Filling",
  "Root Canal",
  "Extraction",
  "Whitening",
  "Other",
  "Dentures",
  "Crowns",
  "Braces",
];

export const OTHER_APPOINTMENT_TYPE_INDEX = 6;

export interface AppointmentTypeOption {
  id: number;
  value: string;
  label: string;
  icon?: string;
  price?: number;
  duration?: number;
  isActive?: boolean;
}

export const APPOINTMENT_TYPE_ICONS: Record<string, string> = {
  "Routine Cleaning": "✨",
  "Checkup": "🔍",
  "Filling": "🦷",
  "Root Canal": "🔬",
  "Extraction": "🦷",
  "Whitening": "💎",
  "Other": "➕",
  "Dentures": "🦷",
  "Crowns": "👑",
  "Braces": "😁",
};

export const APPOINTMENT_PRICES: Record<string, number> = {
  "Routine Cleaning": 1500,
  "Checkup": 500,
  "Filling": 1200,
  "Root Canal": 5000,
  "Extraction": 1500,
  "Whitening": 3000,
  "Other": 0,
  "Dentures": 10000,
  "Crowns": 8000,
  "Braces": 50000,
};

export const APPOINTMENT_TYPE_DURATIONS: Record<string, number> = {
  "Routine Cleaning": 30,
  "Checkup": 30,
  "Filling": 60,
  "Root Canal": 90,
  "Extraction": 60,
  "Whitening": 60,
  "Other": 30,
  "Dentures": 60,
  "Crowns": 90,
  "Braces": 90,
};

export const APPOINTMENT_TYPE_OPTIONS: AppointmentTypeOption[] = APPOINTMENT_TYPES.map((name, id) => ({
  id,
  value: name,
  label: name,
  icon: APPOINTMENT_TYPE_ICONS[name] || "🦷",
  price: APPOINTMENT_PRICES[name] || 0,
  duration: APPOINTMENT_TYPE_DURATIONS[name] || 30,
  isActive: true,
}));

export const getAppointmentTypeName = (typeIndex: number, customType?: string): string => {
  if (typeIndex === OTHER_APPOINTMENT_TYPE_INDEX) {
    return customType || "Other";
  }
  return APPOINTMENT_TYPES[typeIndex] || "Unknown";
};

export const getAppointmentPrice = (typeIndex: number): number => {
  const typeName = APPOINTMENT_TYPES[typeIndex];
  return APPOINTMENT_PRICES[typeName] || 0;
};
