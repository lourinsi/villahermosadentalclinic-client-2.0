"use client";

import { create } from "zustand";

interface RegistrationModalStore {
  isRegistrationModalOpen: boolean;
  openRegistrationModal: () => void;
  closeRegistrationModal: () => void;
}

export const useRegistrationModal = create<RegistrationModalStore>((set) => ({
  isRegistrationModalOpen: false,
  openRegistrationModal: () => set({ isRegistrationModalOpen: true }),
  closeRegistrationModal: () => set({ isRegistrationModalOpen: false }),
}));
