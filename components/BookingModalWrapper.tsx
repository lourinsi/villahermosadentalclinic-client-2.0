'use client';

/**
 * BookingModalWrapper
 * 
 * Conditionally renders either the ImprovedBookingModal (default/simple mode)
 * or the original BookingModal (Pro mode).
 * 
 * Uses BookingModalModeContext to get the current mode setting.
 */

import { useBookingModalMode } from '@/hooks/useBookingModalMode';
import BookingModalSimple from './ImprovedBookingModal';
import BookingModalPro from './BookingModal';
import type { BookingCreationMode, BookingMode } from './sharedBookingLogic';

export interface BookingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultDate?: Date;
  defaultTime?: string;
  doctorName?: string;
  defaultPatientId?: string;
  onBooked?: (apt?: any) => void;
  onDeleted?: (apt?: any) => void;
  appointmentToEdit?: any;
  title?: string;
  bookingMode?: BookingMode;
  appointmentCreationMode?: BookingCreationMode;
}

export default function BookingModalWrapper(props: BookingModalProps) {
  const { mode } = useBookingModalMode();

  // Use ImprovedBookingModal by default (simple mode)
  // Switch to original BookingModal when Pro mode is enabled
  if (mode === 'pro') {
    return <BookingModalPro {...props} />;
  }

  return <BookingModalSimple {...props} />;
}
