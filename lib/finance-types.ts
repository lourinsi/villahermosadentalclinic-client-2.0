export interface FinanceRecord {
  id?: string;
  patientId?: string;
  type: string;
  amount: number;
  date: string; // YYYY-MM-DD
  description?: string;
  method?: string;
  category?: string;
  notes?: string;
  createdAt?: string | Date;
  updatedAt?: string | Date;
  deleted?: boolean;
  deletedAt?: string | Date;
}

export interface Revenue {
  month: string;
  revenue: number;
  expenses: number;
  profit: number;
}

export interface ExpenseBreakdown {
  category: string;
  amount: number;
  percentage: number;
  color: string;
}

export interface RecentTransaction {
  id?: string;
  date: string;
  description: string;
  amount: number;
  paymentAmount?: number;
  type: string;
  method: string;
  appointmentId?: string;
  appointmentSnapshot?: any;
  paymentDate?: string;
  logDate?: string;
  createdAt?: string | Date;
  updatedAt?: string | Date;
  appointmentType?: string;
  appointmentDate?: string;
  doctor?: string;
  doctorName?: string;
  transactionId?: string;
  paymentId?: string;
  paymentRecordId?: string;
  notes?: string;
  status?: string;
  patientId?: string;
  patientName?: string;
  previousBalance?: number | null;
  newBalance?: number | null;
  currentAppointmentBalance?: number | null;
  currentAppointmentTotalPaid?: number | null;
  currentAppointmentPrice?: number | null;
  currentAppointmentDiscount?: number | null;
  currentPaymentStatus?: string | null;
  changedBy?: string;
  changedByName?: string;
  deleted?: boolean;
  deletedAt?: string | Date | null;
  paymentDeleted?: boolean;
  paymentDeletedAt?: string | Date | null;
  appointmentDeleted?: boolean;
  appointmentDeletedAt?: string | Date | null;
  source?: string;
}
