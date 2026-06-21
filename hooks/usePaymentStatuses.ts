import { apiUrl } from "@/lib/api";
import {
  DEFAULT_PAYMENT_STATUS_OPTIONS,
  applyDefaultPaymentStatusColors,
  getDefaultPaymentStatusColors,
  normalizePaymentStatus,
} from "@/lib/status-colors";
import { useEffect, useState, useCallback } from 'react';

export interface PaymentStatusOption {
  key: number;
  value: string;
  label: string;
  description: string;
  bgColor?: string;
  textColor?: string;
}

interface UsePaymentStatusesReturn {
  statuses: PaymentStatusOption[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  getPaymentStatusColors: (status: string) => { bgColor: string; textColor: string };
}

const HIDDEN_PAYMENT_STATUS_VALUES = new Set(["pay-at-clinic"]);

const normalizePaymentStatusOptions = (options: PaymentStatusOption[]): PaymentStatusOption[] => {
  const byValue = new Map<string, PaymentStatusOption>();

  for (const status of [...options, ...DEFAULT_PAYMENT_STATUS_OPTIONS]) {
    const value = normalizePaymentStatus(status.value);
    if (!value || HIDDEN_PAYMENT_STATUS_VALUES.has(value) || byValue.has(value)) continue;

    byValue.set(value, applyDefaultPaymentStatusColors({
      ...status,
      value,
    }));
  }

  return Array.from(byValue.values());
};

/**
 * Hook to fetch payment statuses from backend
 * Falls back to frontend config if backend is unavailable
 */
export const usePaymentStatuses = (): UsePaymentStatusesReturn => {
  const [statuses, setStatuses] = useState<PaymentStatusOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const getPaymentStatusColors = useCallback((status: string): { bgColor: string; textColor: string } => {
    const normalizedStatus = normalizePaymentStatus(status);
    const statusOption = statuses.find(s => normalizePaymentStatus(s.value) === normalizedStatus);
    if (statusOption?.bgColor && statusOption?.textColor) {
      return {
        bgColor: statusOption.bgColor,
        textColor: statusOption.textColor
      };
    }
    return getDefaultPaymentStatusColors(normalizedStatus);
  }, [statuses]);

  const fetchStatuses = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(apiUrl('/api/statuses/payments'), {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch payment statuses: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.success && Array.isArray(data.data)) {
        setStatuses(normalizePaymentStatusOptions(data.data));
        setError(null);
      } else {
        throw new Error('Invalid response format from server');
      }
    } catch (err) {
      console.error('Error fetching payment statuses:', err);
      
      setStatuses(normalizePaymentStatusOptions([]));
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
    getPaymentStatusColors
  };
};
