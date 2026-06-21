// Re-export shared notification types for single source of truth
export type {
  NotificationType,
  NotificationTypeOption,
  NotificationTypeValue,
} from "../shared/notificationStatuses";

export {
  NOTIFICATION_TYPES,
  getNotificationTypeOption,
  getNotificationTypeLabel,
  getNotificationTypeDescription,
  VALID_NOTIFICATION_TYPES,
  isValidNotificationType,
} from "../shared/notificationStatuses";

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: string; // NotificationType from shared
  createdAt: string;
  isRead: boolean;
  isLog?: boolean; // Marked as true when this is a historical log entry (read-only)
  deleted?: boolean; // Marked as true when this notification is soft-deleted
  deletedAt?: string; // Timestamp when notification was deleted
  updatedAt?: string;
  link?: string;
  metadata?: {
    appointmentId?: string;
    currentStatus?: string;
    patientId?: string;
    patientName?: string;
    patientDateOfBirth?: string;
    patientDob?: string;
    patientBirthDate?: string;
    patientBirthday?: string;
    appointmentDate?: string;
    appointmentTime?: string;
    isRequest?: boolean;
    doctor?: string;
    amount?: number;
    paymentDate?: string;
    paymentId?: string;
    cancellationReason?: string;
    changedFields?: { [key: string]: any };
    changeSummary?: {
      field: string;
      label: string;
      from?: string;
      to?: string;
    }[];
    appointmentSnapshot?: { [key: string]: any };
    logDate?: string;
    isDoctorView?: boolean;
    isAdminView?: boolean;
    isPatientView?: boolean;
  };
}
