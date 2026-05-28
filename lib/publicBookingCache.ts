import type { Appointment } from "@/hooks/useAppointments";
import {
  CART_APPOINTMENT_STATUS,
  isCartAppointmentStatus,
  normalizeAppointmentStatus,
} from "@/lib/appointment-status";
import { getAppointmentPrice } from "@/lib/appointment-types";
import {
  isPastAppointmentDate,
  normalizePastAppointmentStatus,
} from "@/components/sharedBookingLogic";

const PUBLIC_BOOKING_PATIENTS_KEY = "villahermosa.publicBookingPatients";
const PUBLIC_BOOKING_APPOINTMENTS_KEY = "villahermosa.publicBookingAppointments";
export const PUBLIC_BOOKING_CACHE_EVENT = "villahermosa.publicBookingCache.updated";

export type PublicBookingPatient = {
  id: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  dateOfBirth?: string;
  [key: string]: any;
};

export type PublicBookingAppointment = Omit<Appointment, "paymentStatus"> & {
  paymentStatus?: Appointment["paymentStatus"] | "pay-at-clinic";
  paymentMethod?: string;
  publicToken?: string;
  publicAccessToken?: string;
  publicPatient?: PublicBookingPatient;
  isPublicCache?: boolean;
  cachedAt?: string;
};

const makeCacheId = (prefix: string) =>
  `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

const emitPublicBookingCacheChanged = () => {
  if (typeof window === "undefined") return;

  window.dispatchEvent(new CustomEvent(PUBLIC_BOOKING_CACHE_EVENT));
};

const normalizePublicBookingAppointment = (
  appointment: PublicBookingAppointment,
  now: Date = new Date()
): PublicBookingAppointment => {
  const status =
    normalizeAppointmentStatus(appointment.status) || CART_APPOINTMENT_STATUS;
  const shouldRestrictPastStatus = isPastAppointmentDate(appointment.date, now);
  const nextStatus = shouldRestrictPastStatus
    ? normalizePastAppointmentStatus(status)
    : status;

  return {
    ...appointment,
    status: nextStatus,
    updatedAt:
      nextStatus !== status
        ? new Date().toISOString()
        : appointment.updatedAt,
  };
};

const normalizePublicPatient = (patient: PublicBookingPatient): PublicBookingPatient => ({
  ...patient,
  id: String(patient.id),
  name:
    patient.name ||
    `${patient.firstName || ""} ${patient.lastName || ""}`.trim() ||
    "Patient",
});

export function getCachedPublicBookingPatients(): PublicBookingPatient[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(PUBLIC_BOOKING_PATIENTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function cachePublicBookingPatient(patient: PublicBookingPatient) {
  if (typeof window === "undefined" || !patient?.id) return undefined;

  const normalized = normalizePublicPatient(patient);

  const existing = getCachedPublicBookingPatients();
  const next = [
    normalized,
    ...existing.filter((cached) => String(cached.id) !== String(normalized.id)),
  ];

  window.localStorage.setItem(PUBLIC_BOOKING_PATIENTS_KEY, JSON.stringify(next));
  emitPublicBookingCacheChanged();
  return normalized;
}

export function createCachedPublicBookingPatient(
  patient: Omit<PublicBookingPatient, "id"> & { id?: string }
) {
  const existing = getCachedPublicBookingPatients();
  const matchingPatient = existing.find((cached) => {
    const cachedEmail = String(cached.email || "").trim().toLowerCase();
    const nextEmail = String(patient.email || "").trim().toLowerCase();
    const cachedPhone = String(cached.phone || "").trim();
    const nextPhone = String(patient.phone || "").trim();

    return Boolean(
      (nextEmail && cachedEmail === nextEmail) ||
        (nextPhone && cachedPhone === nextPhone)
    );
  });

  const publicPatient = normalizePublicPatient({
    ...matchingPatient,
    ...patient,
    id: matchingPatient?.id || patient.id || makeCacheId("public_patient"),
  });

  cachePublicBookingPatient(publicPatient);
  return publicPatient;
}

export function getCachedPublicBookingAppointments(): PublicBookingAppointment[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(PUBLIC_BOOKING_APPOINTMENTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    const now = new Date();
    let changed = false;
    const appointments = parsed.map((appointment) => {
      const normalized = normalizePublicBookingAppointment(
        appointment as PublicBookingAppointment,
        now
      );
      if (
        normalizeAppointmentStatus(appointment.status) !==
          normalizeAppointmentStatus(normalized.status) ||
        appointment.updatedAt !== normalized.updatedAt
      ) {
        changed = true;
      }
      return normalized;
    });

    if (changed) {
      window.localStorage.setItem(
        PUBLIC_BOOKING_APPOINTMENTS_KEY,
        JSON.stringify(appointments)
      );
    }

    return appointments;
  } catch {
    return [];
  }
}

export function cachePublicBookingAppointment(
  appointment: PublicBookingAppointment
) {
  if (typeof window === "undefined" || !appointment?.id) return undefined;

  const existing = getCachedPublicBookingAppointments();
  const normalized = normalizePublicBookingAppointment({
    ...appointment,
    id: String(appointment.id),
    patientId: String(appointment.patientId),
    status: normalizeAppointmentStatus(appointment.status) || CART_APPOINTMENT_STATUS,
    paymentStatus: appointment.paymentStatus || "unpaid",
    cachedAt: appointment.cachedAt || new Date().toISOString(),
    isPublicCache: true,
  });
  const next = [
    normalized,
    ...existing.filter((cached) => String(cached.id) !== String(normalized.id)),
  ];

  window.localStorage.setItem(
    PUBLIC_BOOKING_APPOINTMENTS_KEY,
    JSON.stringify(next)
  );
  emitPublicBookingCacheChanged();
  return normalized;
}

export function deleteCachedPublicBookingAppointment(id: string) {
  if (typeof window === "undefined") return;

  const next = getCachedPublicBookingAppointments().filter(
    (appointment) => String(appointment.id) !== String(id)
  );
  window.localStorage.setItem(
    PUBLIC_BOOKING_APPOINTMENTS_KEY,
    JSON.stringify(next)
  );
  emitPublicBookingCacheChanged();
}

export function getCachedPublicCartAppointments() {
  return getCachedPublicBookingAppointments().filter(
    (appointment) => String(appointment.status || "").toLowerCase() !== "cancelled"
  );
}

export function getCachedPublicCalendarAppointments() {
  return getCachedPublicBookingAppointments().filter((appointment) => {
    const status = String(appointment.status || "").toLowerCase();
    return status === "scheduled" || status === "reserved" || status === "tbd";
  });
}

export function getCachedPublicBlockingAppointments() {
  return getCachedPublicBookingAppointments().filter((appointment) => {
    const status = String(appointment.status || "").toLowerCase();
    return status !== "cancelled" && !isCartAppointmentStatus(status);
  });
}

const timeToMinutes = (time: string) => {
  const [hours, minutes] = String(time || "").split(":").map(Number);
  return (hours || 0) * 60 + (minutes || 0);
};

const normalizeDoctorName = (doctor?: string) =>
  String(doctor || "").replace(/^Dr\.\s+/i, "").toLowerCase().trim();

function hasCachedPublicBookingConflict(
  appointment: Pick<PublicBookingAppointment, "date" | "time" | "duration" | "doctor" | "patientId">
) {
  const nextDoctor = normalizeDoctorName(appointment.doctor);
  const nextStart = timeToMinutes(appointment.time);
  const nextEnd = nextStart + (Number(appointment.duration) || 30);

  return getCachedPublicBookingAppointments().some((cached) => {
    const status = String(cached.status || "").toLowerCase();
    if (status === "cancelled" || isCartAppointmentStatus(status)) return false;
    if (cached.date !== appointment.date) return false;

    const sameDoctor =
      nextDoctor && normalizeDoctorName(cached.doctor) === nextDoctor;
    const samePatient =
      appointment.patientId && String(cached.patientId) === String(appointment.patientId);
    if (!sameDoctor && !samePatient) return false;

    const cachedStart = timeToMinutes(cached.time);
    const cachedEnd = cachedStart + (Number(cached.duration) || 30);
    return nextStart < cachedEnd && nextEnd > cachedStart;
  });
}

export async function createPublicBookingAppointment({
  patient,
  date,
  time,
  duration,
  type,
  customType,
  doctor,
  notes,
  price,
  discount = 0,
  status = CART_APPOINTMENT_STATUS,
  paymentStatus = "unpaid",
  paymentMethod,
  totalPaid = 0,
  balance,
}: {
  patient: PublicBookingPatient;
  date: string;
  time: string;
  duration: number;
  type: number;
  customType?: string;
  doctor: string;
  notes?: string;
  price?: number;
  discount?: number;
  status?: string;
  paymentStatus?: PublicBookingAppointment["paymentStatus"];
  paymentMethod?: string;
  totalPaid?: number;
  balance?: number;
}) {
  const nameParts = String(patient.name || "").trim().split(/\s+/);
  const firstName = patient.firstName || nameParts[0] || "Patient";
  const lastName = patient.lastName || nameParts.slice(1).join(" ") || "Guest";
  const publicPatient = cachePublicBookingPatient({
    ...patient,
    firstName,
    lastName,
  }) || normalizePublicPatient({ ...patient, firstName, lastName });
  const appointmentPrice = price ?? getAppointmentPrice(type);
  const appointmentBalance =
    balance ?? Math.max(0, appointmentPrice - discount - totalPaid);
  const appointment: PublicBookingAppointment = {
    id: makeCacheId("public_apt"),
    patientId: publicPatient.id,
    patientName: `${firstName} ${lastName}`.trim(),
    email: publicPatient.email || "",
    phone: publicPatient.phone || "",
    date,
    time,
    duration,
    type,
    customType: customType || "",
    price: appointmentPrice,
    discount,
    doctor,
    notes: notes || "",
    status,
    paymentStatus,
    paymentMethod,
    totalPaid,
    balance: appointmentBalance,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    publicPatient,
    isPublicCache: true,
  };

  if (hasCachedPublicBookingConflict(appointment)) {
    throw new Error(
      "This public cart already has a booking that conflicts with the selected schedule."
    );
  }

  return cachePublicBookingAppointment(appointment);
}
