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
];

export const APPOINTMENT_PRICES: Record<string, number> = {
  "Routine Cleaning": 1500,
  "Checkup": 500,
  "Filling": 1200,
  "Root Canal": 5000,
  "Extraction": 1500,
  "Whitening": 3000,
  "Other": 0,
};

export const APPOINTMENT_TYPE_DURATIONS: Record<string, number> = {
  "Routine Cleaning": 30,
  "Checkup": 30,
  "Filling": 60,
  "Root Canal": 90,
  "Extraction": 60,
  "Whitening": 60,
  "Other": 30,
};

export const getAppointmentTypeName = (typeIndex: number, customType?: string): string => {
  // Type 6 (index) is the "Other" type
  if (typeIndex === 6) {
    return customType || "Other";
  }
  // For types 0-5, return the standard type name
  return APPOINTMENT_TYPES[typeIndex] || "Unknown";
};

export const getAppointmentPrice = (typeIndex: number): number => {
  const typeName = APPOINTMENT_TYPES[typeIndex];
  return APPOINTMENT_PRICES[typeName] || 0;
};
