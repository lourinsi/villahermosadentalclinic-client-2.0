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
