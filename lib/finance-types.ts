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
  type: string;
  method: string;
  appointmentId?: string;
  appointmentType?: string;
  appointmentDate?: string;
  doctor?: string;
  transactionId?: string;
  notes?: string;
  status?: string;
}
