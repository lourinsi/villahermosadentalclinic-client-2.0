export interface Staff {
  id?: string;
  name: string;
  role: string;
  department: string;
  email: string;
  phone: string;
  hireDate: string;
  baseSalary: number;
  status: string;
  employmentType: string;
  specialization: string;
  licenseNumber: string;
  profilePicture?: string;
  bio?: string;
  createdAt?: Date;
  updatedAt?: Date;
  deleted?: boolean;
  deletedAt?: Date;
}

export interface StaffFinancialRecord {
  id: string;
  staffId: string;
  staffName: string;
  type: string;
  amount: number;
  date: string;
  status: string;
  notes: string;
  repaymentSchedule: string;
}

export interface StaffFinancialRecordForm {
  staffId: string;
  type: string;
  amount: number;
  date: string;
  status: string;
  notes: string;
  repaymentSchedule: string;
}

export interface Attendance {
  id?: string;
  staffId: string;
  staffName: string;
  date?: string;
  status?: string;
  hoursWorked: number;
  daysPresent: number;
  daysAbsent: number;
  overtimeHours: number;
}
