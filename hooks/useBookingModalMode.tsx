'use client';

import { createContext, useContext, useState, ReactNode, useEffect } from 'react';

type BookingModalMode = 'simple' | 'pro';

interface BookingModalModeContextType {
  mode: BookingModalMode;
  setMode: (mode: BookingModalMode) => void;
  toggleMode: () => void;
}

const BookingModalModeContext = createContext<BookingModalModeContextType | undefined>(undefined);

export function BookingModalModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<BookingModalMode>('simple');

  // Load mode from localStorage on mount (hydrate)
  useEffect(() => {
    try {
      const savedMode = localStorage.getItem('bookingModalMode') as BookingModalMode | null;
      if (savedMode && (savedMode === 'simple' || savedMode === 'pro')) {
        setModeState(savedMode);
      }
    } catch (e) {
      // ignore (e.g., during SSR environments)
    }
  }, []);

  const setMode = (newMode: BookingModalMode) => {
    setModeState(newMode);
    localStorage.setItem('bookingModalMode', newMode);
  };

  const toggleMode = () => {
    const newMode = mode === 'simple' ? 'pro' : 'simple';
    setMode(newMode);
  };

  return (
    <BookingModalModeContext.Provider value={{ mode, setMode, toggleMode }}>
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
