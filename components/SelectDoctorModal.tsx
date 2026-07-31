"use client";

import { useState, type ReactNode } from "react";
import { CheckCircle, Loader2, Stethoscope, UserPlus, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import AddStaffModal from "./AddStaffModal";
import { dentalStaffRoleOptions, type StaffRecordForModal } from "./sharedAddStaffLogic";
import type { DoctorSelectionDraft } from "./universalSelectModalDrafts";

const addDoctorInitialStaff: StaffRecordForModal = {
  role: "dentist",
  department: "dentistry",
  employmentType: "fulltime",
  specialization: "General Dentistry",
  status: "active",
};

/** Resolve a URL or base64 image source string to a displayable src, or return empty string. */
function resolveImageSource(source?: string): string {
  if (!source) return "";
  if (source.startsWith("http") || source.startsWith("data:") || source.startsWith("/")) return source;
  return "";
}

function getInitials(name: string): string {
  return (name || "")
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "?";
}

export type DoctorSelectItem = {
  id?: string | number;
  name: string;
  specialization?: string;
  role?: string;
  profilePicture?: string;
  profilePictureUrl?: string;
  /** Optional pre-resolved avatar URL. */
  avatar?: string;
  /** Optional label override (falls back to name). */
  label?: string;
  /** Optional value override (falls back to name). */
  value?: string;
};

type SelectDoctorModalProps = {
  /** Inline content mode, retained for the booking wizard. */
  children?: ReactNode;
  className?: string;
  /** Dialog mode props. Supply both `open` and `onOpenChange` to render the universal picker. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  title?: string;
  description?: string;
  doctors?: DoctorSelectItem[];
  isLoading?: boolean;
  isSaving?: boolean;
  selectedValue?: string;
  /** Preferred scalable API: one selected-doctor draft emitted after selection. */
  draft?: DoctorSelectionDraft<DoctorSelectItem>;
  onSaveDraft?: (draft: DoctorSelectionDraft<DoctorSelectItem>) => void | Promise<void>;
  showAddDoctorButton?: boolean;
  addDoctorDisabled?: boolean;
  onDoctorAdded?: (staff?: unknown) => void | Promise<void>;
  onSelect?: (doctor: DoctorSelectItem) => void | Promise<void>;
};

/**
 * Universal doctor picker.
 *
 * With `open` and `onOpenChange`, renders the shared selection dialog used by
 * all appointment views. Without them, it retains the inline wrapper used by
 * the booking wizard's doctor step.
 */
export function SelectDoctorModal({
  children,
  className,
  open,
  onOpenChange,
  title = "Assign Doctor",
  description = "Select the dentist for this appointment.",
  doctors = [],
  isLoading = false,
  isSaving = false,
  selectedValue,
  draft,
  onSaveDraft,
  showAddDoctorButton = true,
  addDoctorDisabled = false,
  onDoctorAdded,
  onSelect,
}: SelectDoctorModalProps) {
  const [isAddDoctorOpen, setIsAddDoctorOpen] = useState(false);
  const isDialogMode = typeof open === "boolean" && typeof onOpenChange === "function";
  const addDoctorIsDisabled = isSaving || addDoctorDisabled;
  const resolvedSelectedValue = draft?.doctor ? (draft.doctor.value || draft.doctor.name) : selectedValue;

  const handleSelect = async (doctor: DoctorSelectItem) => {
    if (onSaveDraft) {
      await onSaveDraft({ doctor });
      onOpenChange?.(false);
      return;
    }
    await onSelect?.(doctor);
  };

  const handleDoctorAdded = (staff?: unknown) => {
    void onDoctorAdded?.(staff);
  };

  if (!isDialogMode) {
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
                disabled={addDoctorIsDisabled}
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

  return (
    <>
      <Dialog open={open} onOpenChange={(nextOpen) => !isSaving && onOpenChange(nextOpen)}>
        <DialogContent
          showCloseButton={false}
          className="w-[calc(100vw-1.25rem)] overflow-hidden rounded-[2rem] border border-gray-100 bg-white p-0 shadow-2xl sm:w-full sm:max-w-[560px]"
        >
          <DialogHeader className="border-b border-gray-100 px-5 pb-5 pt-5 text-left sm:px-7 sm:pt-7">
            <div className="flex items-center gap-5">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[1.25rem] bg-blue-600 text-white shadow-xl shadow-blue-100 ring-4 ring-blue-50">
                <Stethoscope className="h-7 w-7" />
              </div>
              <div className="min-w-0 flex-1">
                <DialogTitle className="truncate text-2xl font-black tracking-tight text-gray-900">
                  {title}
                </DialogTitle>
                <DialogDescription className="mt-1 text-sm font-bold text-gray-400">
                  {description}
                </DialogDescription>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => onOpenChange(false)}
                disabled={isSaving}
                className="h-10 w-10 shrink-0 rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                aria-label="Close doctor selector"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </DialogHeader>

          <div className="max-h-[72dvh] overflow-y-auto px-5 py-6 custom-scrollbar sm:px-7">
            <div className="space-y-6">
              {showAddDoctorButton ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsAddDoctorOpen(true)}
                  disabled={addDoctorIsDisabled}
                  className="h-12 w-full gap-2 rounded-2xl border-2 text-[11px] font-black uppercase tracking-widest shadow-sm transition-all hover:border-gray-200 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <UserPlus className="h-4 w-4" />
                  Add doctor
                </Button>
              ) : null}

              {isLoading ? (
                <div className="flex min-h-40 items-center justify-center rounded-2xl border border-gray-100 bg-white text-sm font-bold text-gray-400 shadow-sm">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin text-blue-600" />
                  Loading doctors
                </div>
              ) : doctors.length === 0 ? (
                <div className="rounded-2xl border border-gray-100 bg-gray-50 p-6 text-center shadow-sm">
                  <p className="text-sm font-black text-gray-900">No doctors available</p>
                  <p className="mt-1 text-xs font-semibold text-gray-400">
                    Add a doctor record first, then assign this appointment.
                  </p>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {doctors.map((doctor) => {
                    const key = String(doctor.id ?? doctor.name);
                    const label = doctor.label || doctor.name;
                    const value = doctor.value || doctor.name;
                    const isSelected = resolvedSelectedValue !== undefined && resolvedSelectedValue === value;
                    const avatarSrc = doctor.avatar || resolveImageSource(doctor.profilePicture || doctor.profilePictureUrl);

                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => void handleSelect(doctor)}
                        disabled={isSaving}
                        className={`group flex min-h-[6.5rem] items-center gap-4 rounded-2xl border bg-white p-4 text-left shadow-sm transition-all disabled:cursor-not-allowed disabled:opacity-70 ${
                          isSelected
                            ? "border-blue-400 ring-2 ring-blue-200"
                            : "border-gray-100 hover:border-blue-200 hover:shadow-md"
                        }`}
                      >
                        <Avatar className="h-14 w-14 shrink-0 rounded-2xl border border-blue-50 shadow-sm">
                          {avatarSrc ? <AvatarImage src={avatarSrc} alt={label} className="object-cover" /> : null}
                          <AvatarFallback className="rounded-2xl bg-blue-50 text-sm font-black text-blue-700">
                            {getInitials(label)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-black leading-tight text-gray-900">{label}</p>
                          <p className="mt-1 line-clamp-2 text-xs font-semibold leading-snug text-gray-400">
                            {doctor.specialization || doctor.role || "Dental specialist"}
                          </p>
                        </div>
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500 transition-colors group-hover:bg-blue-600 group-hover:text-white">
                          {isSaving ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <CheckCircle className={`h-4 w-4 ${isSelected ? "text-blue-600" : ""}`} />
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
