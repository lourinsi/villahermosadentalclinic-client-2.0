"use client";

import { useState, type ReactNode } from "react";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import AddStaffModal from "./AddStaffModal";
import { dentalStaffRoleOptions, type StaffRecordForModal } from "./sharedAddStaffLogic";

const addDoctorInitialStaff: StaffRecordForModal = {
  role: "dentist",
  department: "dentistry",
  employmentType: "fulltime",
  specialization: "General Dentistry",
  status: "active",
};

type SelectDoctorModalProps = {
  children: ReactNode;
  className?: string;
  showAddDoctorButton?: boolean;
  addDoctorDisabled?: boolean;
  onDoctorAdded?: (staff?: unknown) => void | Promise<void>;
};

export function SelectDoctorModal({
  children,
  className,
  showAddDoctorButton = true,
  addDoctorDisabled = false,
  onDoctorAdded,
}: SelectDoctorModalProps) {
  const [isAddDoctorOpen, setIsAddDoctorOpen] = useState(false);

  const handleDoctorAdded = (staff?: unknown) => {
    void onDoctorAdded?.(staff);
  };

  return (
    <>
      <div
        data-tour-id="booking-doctor-step"
        className={cn(
          "space-y-5 px-0.5 py-1 animate-in fade-in slide-in-from-bottom-4 sm:space-y-6 sm:px-1",
          className
        )}
      >
        {showAddDoctorButton ? (
          <div className="flex justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsAddDoctorOpen(true)}
              disabled={addDoctorDisabled}
              className="gap-2 border-blue-100 bg-white font-bold text-blue-700 shadow-sm hover:bg-blue-50 hover:text-blue-800"
            >
              <UserPlus className="h-4 w-4" />
              Add Doctor
            </Button>
          </div>
        ) : null}
        {children}
      </div>

      <AddStaffModal
        open={isAddDoctorOpen}
        onOpenChange={setIsAddDoctorOpen}
        staff={addDoctorInitialStaff}
        roleOptions={dentalStaffRoleOptions}
        showCompensationFields={false}
        onStaffAdded={handleDoctorAdded}
      />
    </>
  );
}
