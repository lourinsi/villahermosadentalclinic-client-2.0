'use client';

import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { useAdminViewMode } from '@/hooks/useAdminViewMode';

type BookingModalMode = 'simple' | 'pro';

interface BookingModalModeContextType {
  mode: BookingModalMode;
  setMode: (mode: BookingModalMode) => void;
  toggleMode: () => void;
}

const BookingModalModeContext = createContext<BookingModalModeContextType | undefined>(undefined);
const STORAGE_KEY = 'bookingModalMode';

export function BookingModalModeProvider({ children }: { children: ReactNode }) {
  const { isReceptionistView } = useAdminViewMode();
  const [mode, setModeState] = useState<BookingModalMode>('simple');

  // Receptionist view is always simple; admins keep their saved preference.
  useEffect(() => {
    if (isReceptionistView) {
      setModeState('simple');
      return;
    }

    try {
      const savedMode = localStorage.getItem(STORAGE_KEY) as BookingModalMode | null;
      if (savedMode && (savedMode === 'simple' || savedMode === 'pro')) {
        setModeState(savedMode);
      }
    } catch (e) {
      // ignore (e.g., during SSR environments)
    }
  }, [isReceptionistView]);

  const setMode = (newMode: BookingModalMode) => {
    if (isReceptionistView) {
      setModeState('simple');
      return;
    }

    setModeState(newMode);
    localStorage.setItem(STORAGE_KEY, newMode);
  };

  const toggleMode = () => {
    if (isReceptionistView) {
      setModeState('simple');
      return;
    }

    const newMode = mode === 'simple' ? 'pro' : 'simple';
    setMode(newMode);
  };
  const effectiveMode: BookingModalMode = isReceptionistView ? 'simple' : mode;

  return (
    <BookingModalModeContext.Provider value={{ mode: effectiveMode, setMode, toggleMode }}>
      {children}
    </BookingModalModeContext.Provider>
  );
}

export function useBookingModalMode() {
  const context = useContext(BookingModalModeContext);
  if (!context) {
    throw new Error('useBookingModalMode must be used within BookingModalModeProvider');
  }
  return context;
}
