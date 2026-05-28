import { apiUrl } from "@/lib/api";
import {
  CART_APPOINTMENT_STATUS,
  CART_APPOINTMENT_STATUS_LABEL,
  normalizeAppointmentStatus,
} from "@/lib/appointment-status";
import {
  DEFAULT_APPOINTMENT_STATUS_OPTIONS,
  applyDefaultAppointmentStatusColors,
  getDefaultAppointmentStatusColors,
} from "@/lib/status-colors";
import { useEffect, useState, useCallback } from 'react';

export interface AppointmentStatusOption {
  key: number;
  value: string;
  label: string;
  description: string;
  bgColor?: string;
  textColor?: string;
}

interface UseAppointmentStatusesReturn {
  statuses: AppointmentStatusOption[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  getStatusColors: (status: string) => { bgColor: string; textColor: string };
}

const normalizeStatusOptions = (options: AppointmentStatusOption[]): AppointmentStatusOption[] => {
  const byValue = new Map<string, AppointmentStatusOption>();

  for (const status of options) {
    const value = normalizeAppointmentStatus(status.value);
    const isCartStatus = value === CART_APPOINTMENT_STATUS;
    if (byValue.has(value)) continue;

    byValue.set(value, applyDefaultAppointmentStatusColors({
      ...status,
      value,
      label: isCartStatus ? CART_APPOINTMENT_STATUS_LABEL : status.label,
      description: isCartStatus
        ? "In the patient's appointment cart awaiting checkout"
        : status.description,
    }));
  }

  return Array.from(byValue.values());
};

/**
 * Hook to fetch appointment statuses from backend
 * Falls back to frontend config if backend is unavailable
 */
export const useAppointmentStatuses = (): UseAppointmentStatusesReturn => {
  const [statuses, setStatuses] = useState<AppointmentStatusOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const getStatusColors = useCallback((status: string): { bgColor: string; textColor: string } => {
    const normalizedStatus = normalizeAppointmentStatus(status);
    const statusOption = statuses.find(s => normalizeAppointmentStatus(s.value) === normalizedStatus);
    if (statusOption?.bgColor && statusOption?.textColor) {
      return {
        bgColor: statusOption.bgColor,
        textColor: statusOption.textColor
      };
    }
    return getDefaultAppointmentStatusColors(normalizedStatus);
  }, [statuses]);

  const fetchStatuses = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(apiUrl('/api/statuses/appointments'), {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch appointment statuses: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.success && Array.isArray(data.data)) {
        setStatuses(normalizeStatusOptions(data.data));
        setError(null);
      } else {
        throw new Error('Invalid response format from server');
      }
    } catch (err) {
      console.error('Error fetching appointment statuses:', err);
      
      setStatuses(normalizeStatusOptions(DEFAULT_APPOINTMENT_STATUS_OPTIONS));
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatuses();
  }, [fetchStatuses]);

  return {
    statuses,
    isLoading,
    error,
    refetch: fetchStatuses,
    getStatusColors
  };
};
