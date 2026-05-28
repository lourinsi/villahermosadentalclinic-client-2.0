"use client";

import { useBookingModalMode } from "@/hooks/useBookingModalMode";
import AddStaffModalPro from "./AddStaffModal";
import AddStaffModalSimple from "./ImprovedAddStaffModal";
import type { AddStaffModalProps } from "./sharedAddStaffLogic";

export default function AddStaffModalWrapper(props: AddStaffModalProps) {
  const { mode } = useBookingModalMode();

  if (mode === "pro") {
    return <AddStaffModalPro {...props} />;
  }

  return <AddStaffModalSimple {...props} />;
}
