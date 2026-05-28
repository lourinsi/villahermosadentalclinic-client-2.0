"use client";

import { createContext, useContext, useState, ReactNode, useCallback, useMemo } from "react";
import { Appointment } from "./useAppointments";

export interface Payment {
  id?: string;
  patientId?: string;
  appointmentId?: string;
  amount: number;
  date: string;
  method: string;
  transactionId?: string;
  notes?: string;
  [key: string]: string | number | boolean | null | undefined; // Allow for other properties
}

interface PaymentModalContextType {
  isPaymentModalOpen: boolean;
  isPatientPaymentModalOpen: boolean;
  appointmentId: string | null;
  patientId: string | null;
  patientName: string | null;
  appointments: Appointment[];
  paymentId: string | null;
  paymentData: Payment | null;
  initialRecord: Partial<Payment> | null;
  openPaymentModal: (patientId: string, patientName: string, appointments: Appointment[], appointmentId?: string | null) => void;
  // Open the payment modal for a single appointment (admin-facing helper)
  openPaymentFor: (appointment?: Appointment | null, patientId?: string | null, patientName?: string | null) => void;
  // New: open the patient payment modal with a single appointment object (optional). Prefer this API.
  openPatientPaymentFor: (appointment?: Appointment | null) => void;
  openEditPaymentModal: (paymentId: string, paymentData: any, patientId?: string | null, appointments?: Appointment[]) => void;
  closePaymentModal: () => void;
}

const PaymentModalContext = createContext<PaymentModalContextType | undefined>(undefined);

export const PaymentModalProvider = ({ children }: { children: ReactNode }) => {
  const [isPaymentModalOpen, setPaymentModalOpen] = useState(false);
  const [isPatientPaymentModalOpen, setPatientPaymentModalOpen] = useState(false);
  const [appointmentId, setAppointmentId] = useState<string | null>(null);
  const [patientId, setPatientId] = useState<string | null>(null);
  const [patientName, setPatientName] = useState<string | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [paymentData, setPaymentData] = useState<Payment | null>(null);
  const [initialRecord, setInitialRecord] = useState<Partial<Payment> | null>(null);

  const openPaymentModal = useCallback((pId: string, pName: string, apts: Appointment[], aptId: string | null = null, initRecord: Partial<Payment> | null = null) => {
    setPatientId(pId);
    setPatientName(pName);
    setAppointments(apts);
    setAppointmentId(aptId != null ? String(aptId) : null);
    setPaymentId(null);
    setPaymentData(null);
    setInitialRecord(initRecord || null);
    setPaymentModalOpen(true);
  }, []);

  const openPaymentFor = useCallback((appointment?: Appointment | null, pId?: string | null, pName?: string | null) => {
    setPatientId(pId || null);
    setPatientName(pName || null);
    setAppointments(appointment ? [appointment] : []);
    setAppointmentId(appointment?.id != null ? String(appointment.id) : null);
    setPaymentId(null);
    setPaymentData(null);
    setPaymentModalOpen(true);
  }, []);

  const openPatientPaymentFor = useCallback((appointment?: Appointment | null) => {
    // Prefer passing a single appointment to the modal to avoid races with global refresh
    setAppointments(appointment ? [appointment] : []);
    setAppointmentId(appointment?.id != null ? String(appointment.id) : null);
    setPatientPaymentModalOpen(true);
  }, []);

  const openEditPaymentModal = useCallback((pId: string, pData: any, pIdParam?: string | null, apts?: Appointment[]) => {
    // Debug: trace edit modal opens
    try {
      // eslint-disable-next-line no-console
      console.log("[usePaymentModal] openEditPaymentModal", { pId, pData, pIdParam, aptsLength: apts?.length });
    } catch (e) {}
    setPaymentId(pId != null ? String(pId) : null);
    setPaymentData(pData);
    setAppointmentId(pData?.appointmentId != null ? String(pData.appointmentId) : null);
    setPatientId(pIdParam || (pData?.patientId != null ? String(pData.patientId) : null) || null);
    setPatientName(null);
    setAppointments(apts || []);
    // Open modal on next tick to ensure paymentId/paymentData state is flushed
    setTimeout(() => setPaymentModalOpen(true), 0);
  }, []);

  const closePaymentModal = useCallback(() => {
    setPaymentModalOpen(false);
    setPatientPaymentModalOpen(false);
    setAppointmentId(null);
    setPatientId(null);
    setPatientName(null);
    setAppointments([]);
    setPaymentId(null);
    setPaymentData(null);
    setInitialRecord(null);
  }, []);

  const value = useMemo(() => ({
    isPaymentModalOpen,
    isPatientPaymentModalOpen,
    appointmentId,
    patientId,
    patientName,
    appointments,
    paymentId,
    paymentData,
    initialRecord,
    openPaymentModal,
  openPaymentFor,
    openEditPaymentModal,
  openPatientPaymentFor,
    closePaymentModal,
  }), [
    isPaymentModalOpen,
    isPatientPaymentModalOpen,
    appointmentId,
    patientId,
    patientName,
    appointments,
    paymentId,
    paymentData,
    initialRecord,
    openPaymentModal,
  openPaymentFor,
  openPatientPaymentFor,
    openEditPaymentModal,
    closePaymentModal,
  ]);

  return (
    <PaymentModalContext.Provider value={value}>
      {children}
    </PaymentModalContext.Provider>
  );
};

export const usePaymentModal = () => {
  const context = useContext(PaymentModalContext);
  if (context === undefined) {
    throw new Error("usePaymentModal must be used within a PaymentModalProvider");
  }
  return context;
};