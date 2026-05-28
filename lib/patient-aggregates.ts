import { formatDateToYYYYMMDD, parseBackendDateToLocal } from "@/lib/utils";
import { isCartAppointmentStatus, normalizeAppointmentStatus } from "@/lib/appointment-status";

export type PatientAggregateSource = {
  id?: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  lastVisit?: string | null;
  balance?: number | string | null;
};

export type PatientAggregateAppointment = {
  id?: string;
  patientId?: string | null;
  patientName?: string | null;
  date?: string | null;
  time?: string | null;
  status?: string | null;
  paymentStatus?: string | null;
  balance?: number | string | null;
  price?: number | string | null;
  discount?: number | string | null;
  totalPaid?: number | string | null;
  deleted?: boolean | null;
};

export type PatientAppointmentSummary = {
  balance: number;
  appointmentBalance: number;
  storedBalance: number;
  status: "active" | "inactive" | "overdue";
  lastVisit: string;
  nextAppointment: string | null;
  overdueAppointmentCount: number;
};

const toFiniteNumber = (value: unknown): number => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
};

const dateOnly = (value?: string | null): string => String(value || "").split(" ")[0];

const getPatientName = (patient: PatientAggregateSource) =>
  (patient.name || [patient.firstName, patient.lastName].filter(Boolean).join(" ")).trim();

export const appointmentBelongsToPatient = (
  appointment: PatientAggregateAppointment,
  patient: PatientAggregateSource
) => {
  const patientId = String(patient.id || "");
  const patientName = getPatientName(patient);

  return (
    (patientId && String(appointment.patientId || "") === patientId) ||
    (patientName && String(appointment.patientName || "") === patientName)
  );
};

export const getPatientAppointments = <T extends PatientAggregateAppointment>(
  appointments: T[],
  patient: PatientAggregateSource
): T[] => appointments.filter((appointment) => appointmentBelongsToPatient(appointment, patient));

export const isBillableAppointment = (appointment: PatientAggregateAppointment) => {
  if (appointment.deleted) return false;

  const status = normalizeAppointmentStatus(appointment.status);
  return status !== "cancelled" && !isCartAppointmentStatus(status);
};

export const getAppointmentOutstandingBalance = (appointment: PatientAggregateAppointment) => {
  if (!isBillableAppointment(appointment)) return 0;

  const explicitBalance = toFiniteNumber(appointment.balance);
  if (appointment.balance !== undefined && appointment.balance !== null) {
    return Math.max(0, explicitBalance);
  }

  const price = toFiniteNumber(appointment.price);
  const discount = toFiniteNumber(appointment.discount);
  const totalPaid = toFiniteNumber(appointment.totalPaid);

  return Math.max(0, price - discount - totalPaid);
};

export const getOverdueAppointmentCount = (appointments: PatientAggregateAppointment[]) =>
  appointments.filter((appointment) => {
    if (!isBillableAppointment(appointment)) return false;
    return String(appointment.paymentStatus || "").toLowerCase() === "overdue";
  }).length;

const getLatestCompletedVisit = (appointments: PatientAggregateAppointment[]) => {
  const completedDates = appointments
    .filter((appointment) => normalizeAppointmentStatus(appointment.status) === "completed")
    .map((appointment) => dateOnly(appointment.date))
    .filter(Boolean)
    .sort((a, b) => b.localeCompare(a));

  return completedDates[0] || "";
};

export const getNextAppointmentDate = (
  appointments: PatientAggregateAppointment[],
  today = new Date()
) => {
  const todayStr = formatDateToYYYYMMDD(today);

  const upcoming = appointments
    .filter((appointment) => {
      const status = normalizeAppointmentStatus(appointment.status);
      const appointmentDate = dateOnly(appointment.date);

      return (
        appointmentDate >= todayStr &&
        status !== "completed" &&
        status !== "cancelled" &&
        !isCartAppointmentStatus(status)
      );
    })
    .sort((a, b) => {
      const aDate = dateOnly(a.date);
      const bDate = dateOnly(b.date);
      if (aDate !== bDate) return aDate.localeCompare(bDate);
      return String(a.time || "").localeCompare(String(b.time || ""));
    });

  return upcoming[0]?.date ? dateOnly(upcoming[0].date) : null;
};

export const buildPatientAppointmentSummary = (
  patient: PatientAggregateSource,
  patientAppointments: PatientAggregateAppointment[],
  now = new Date()
): PatientAppointmentSummary => {
  const appointmentBalance = patientAppointments.reduce(
    (sum, appointment) => sum + getAppointmentOutstandingBalance(appointment),
    0
  );
  const storedBalance = Math.max(0, toFiniteNumber(patient.balance));
  const balance = appointmentBalance > 0 ? appointmentBalance : storedBalance;
  const overdueAppointmentCount = getOverdueAppointmentCount(patientAppointments);
  const lastVisitFromAppointments = getLatestCompletedVisit(patientAppointments);
  const storedLastVisit = dateOnly(patient.lastVisit);
  const lastVisit =
    lastVisitFromAppointments && storedLastVisit
      ? [lastVisitFromAppointments, storedLastVisit].sort((a, b) => b.localeCompare(a))[0]
      : lastVisitFromAppointments || storedLastVisit || "";

  let status: PatientAppointmentSummary["status"] = "active";
  if (overdueAppointmentCount > 0) {
    status = "overdue";
  } else if (lastVisit) {
    const lastVisitDate = parseBackendDateToLocal(lastVisit);
    const oneYearAgo = new Date(now);
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    if (lastVisitDate < oneYearAgo) {
      status = "inactive";
    }
  }

  return {
    balance,
    appointmentBalance,
    storedBalance,
    status,
    lastVisit,
    nextAppointment: getNextAppointmentDate(patientAppointments, now),
    overdueAppointmentCount,
  };
};
