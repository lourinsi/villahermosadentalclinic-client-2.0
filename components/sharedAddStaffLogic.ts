"use client";

import { useEffect, useMemo, useState } from "react";
import { apiUrl } from "@/lib/api";

type Toast = { error?: (msg: string) => void; success?: (msg: string) => void };

export type StaffModalStep = "profile" | "role" | "employment" | "credentials";
export type StaffFormMode = "add" | "edit" | "view";

export type AddStaffForm = {
  name: string;
  role: string;
  email: string;
  phone: string;
  department: string;
  employmentType: string;
  hireDate: string;
  baseSalary: number;
  specialization: string;
  licenseNumber: string;
  profilePicture: string;
  status: string;
};

export type AddStaffPayload = AddStaffForm;

export type StaffRecordForModal = Partial<AddStaffForm> & {
  id?: string | number;
};

export interface AddStaffModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  staffMode?: StaffFormMode;
  staff?: StaffRecordForModal | null;
  onStaffAdded?: (staff?: unknown) => void;
  onStaffSaved?: (staff?: unknown) => void;
}

export const emptyStaffForm: AddStaffForm = {
  name: "",
  role: "",
  email: "",
  phone: "",
  department: "",
  employmentType: "",
  hireDate: "",
  baseSalary: 0,
  specialization: "",
  licenseNumber: "",
  profilePicture: "",
  status: "active",
};

export const staffPasswordManagerIgnoreProps = {
  autoComplete: "off",
  "data-lpignore": "true",
  "data-1p-ignore": "true",
  "data-bwignore": "true",
  "data-form-type": "other",
} as const;

export const staffModalSteps: Array<{ id: StaffModalStep; label: string; icon: string }> = [
  { id: "profile", label: "Profile", icon: "1" },
  { id: "role", label: "Role", icon: "2" },
  { id: "employment", label: "Employment", icon: "3" },
  { id: "credentials", label: "Credentials", icon: "4" },
];

export const staffRoleOptions = [
  { value: "dentist", label: "Dentist" },
  { value: "hygienist", label: "Dental Hygienist" },
  { value: "assistant", label: "Dental Assistant" },
  { value: "manager", label: "Office Manager" },
  { value: "receptionist", label: "Receptionist" },
  { value: "other", label: "Other" },
];

export const staffDepartmentOptions = [
  { value: "dentistry", label: "Dentistry" },
  { value: "hygiene", label: "Hygiene" },
  { value: "assistance", label: "Assistance" },
  { value: "administration", label: "Administration" },
];

export const employmentTypeOptions = [
  { value: "fulltime", label: "Full-time" },
  { value: "parttime", label: "Part-time" },
  { value: "contract", label: "Contract" },
];

export const staffStatusOptions = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "onleave", label: "On Leave" },
];

const staffRoleLabels = Object.fromEntries(staffRoleOptions.map((option) => [option.value, option.label]));
const staffDepartmentLabels = Object.fromEntries(staffDepartmentOptions.map((option) => [option.value, option.label]));
const employmentTypeLabels = Object.fromEntries(employmentTypeOptions.map((option) => [option.value, option.label]));
const staffStatusLabels = Object.fromEntries(staffStatusOptions.map((option) => [option.value, option.label]));

const safeToastError = (toast: Toast, message: string) => {
  if (typeof toast.error === "function") toast.error(message);
};

const safeToastSuccess = (toast: Toast, message: string) => {
  if (typeof toast.success === "function") toast.success(message);
};

const normalizeFilterValue = (value?: string) =>
  String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");

export const getDefaultDepartmentForRole = (role?: string) => {
  const normalizedRole = normalizeFilterValue(role);
  if (normalizedRole.includes("dentist")) return "dentistry";
  if (normalizedRole.includes("hygienist")) return "hygiene";
  if (normalizedRole.includes("assistant")) return "assistance";
  if (normalizedRole.includes("manager") || normalizedRole.includes("receptionist")) return "administration";
  return "";
};

export const getOptionLabel = (labels: Record<string, string>, value?: string, fallback = "Not set") => {
  if (!value) return fallback;
  return labels[value] || value;
};

export const getStaffRoleLabel = (value?: string, fallback = "Not selected") =>
  getOptionLabel(staffRoleLabels, value, fallback);

export const getStaffDepartmentLabel = (value?: string, fallback = "Not set") =>
  getOptionLabel(staffDepartmentLabels, value, fallback);

export const getEmploymentTypeLabel = (value?: string, fallback = "Not set") =>
  getOptionLabel(employmentTypeLabels, value, fallback);

export const getStaffStatusLabel = (value?: string, fallback = "Active") =>
  getOptionLabel(staffStatusLabels, value, fallback);

export const formatStaffCurrency = (amount?: number) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(Number(amount) || 0);

export const formatStaffDate = (value?: string) => {
  if (!value) return "Not set";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

export const getStaffInitials = (name?: string) => {
  const initials = String(name || "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return initials || "ST";
};

const normalizeOptionValue = (value: unknown, options: Array<{ value: string; label: string }>) => {
  const rawValue = String(value || "").trim();
  if (!rawValue) return "";

  const normalizedValue = normalizeFilterValue(rawValue);
  const option = options.find(
    (item) => normalizeFilterValue(item.value) === normalizedValue || normalizeFilterValue(item.label) === normalizedValue
  );

  return option?.value || rawValue;
};

export const staffRecordToForm = (staff?: StaffRecordForModal | null): AddStaffForm => {
  if (!staff) return emptyStaffForm;

  return {
    name: String(staff.name || ""),
    role: normalizeOptionValue(staff.role, staffRoleOptions),
    email: String(staff.email || ""),
    phone: String(staff.phone || ""),
    department: normalizeOptionValue(staff.department, staffDepartmentOptions),
    employmentType: normalizeOptionValue(staff.employmentType, employmentTypeOptions),
    hireDate: String(staff.hireDate || ""),
    baseSalary: Number(staff.baseSalary) || 0,
    specialization: String(staff.specialization || ""),
    licenseNumber: String(staff.licenseNumber || ""),
    profilePicture: String(staff.profilePicture || ""),
    status: normalizeOptionValue(staff.status || "active", staffStatusOptions) || "active",
  };
};

export const buildStaffPayload = (staff: AddStaffForm): AddStaffPayload => ({
  ...staff,
  name: staff.name.trim(),
  email: staff.email.trim(),
  phone: staff.phone.trim(),
  department: staff.department || getDefaultDepartmentForRole(staff.role),
  employmentType: staff.employmentType || "fulltime",
  baseSalary: Number(staff.baseSalary) || 0,
  specialization: staff.specialization.trim(),
  licenseNumber: staff.licenseNumber.trim(),
  profilePicture: staff.profilePicture.trim(),
  status: staff.status || "active",
});

export const getAddStaffSummaryRows = (staff: AddStaffPayload) => [
  { label: "Full Name", value: staff.name || "Not provided" },
  { label: "Role", value: getStaffRoleLabel(staff.role) },
  { label: "Email", value: staff.email || "Not provided" },
  { label: "Phone", value: staff.phone || "Not provided" },
  { label: "Department", value: getStaffDepartmentLabel(staff.department) },
  { label: "Employment Type", value: getEmploymentTypeLabel(staff.employmentType) },
  { label: "Hire Date", value: formatStaffDate(staff.hireDate) },
  { label: "Base Monthly Salary", value: formatStaffCurrency(staff.baseSalary) },
  { label: "Specialization", value: staff.specialization || "Not provided" },
  { label: "License Number", value: staff.licenseNumber || "Not provided" },
  { label: "Status", value: getStaffStatusLabel(staff.status) },
  { label: "Photo", value: staff.profilePicture ? "Added" : "Not added" },
];

const MAX_STAFF_PHOTO_UPLOAD_BYTES = 8 * 1024 * 1024;
const TARGET_STAFF_PHOTO_DATA_URL_LENGTH = 70_000;

const loadImageElement = (dataUrl: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not load image."));
    image.src = dataUrl;
  });

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read the selected image."));
    reader.readAsDataURL(file);
  });

const canvasToDataUrl = (
  image: HTMLImageElement,
  maxDimension: number,
  quality: number
) => {
  const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth || image.width, image.naturalHeight || image.height));
  const width = Math.max(1, Math.round((image.naturalWidth || image.width) * scale));
  const height = Math.max(1, Math.round((image.naturalHeight || image.height) * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Could not prepare image for upload.");
  }

  context.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", quality);
};

const compressStaffPhoto = async (file: File) => {
  const originalDataUrl = await readFileAsDataUrl(file);
  const image = await loadImageElement(originalDataUrl);
  const dimensions = [384, 320, 256, 192];
  const qualities = [0.82, 0.74, 0.66, 0.58, 0.5];
  let smallestDataUrl = "";

  for (const dimension of dimensions) {
    for (const quality of qualities) {
      const dataUrl = canvasToDataUrl(image, dimension, quality);
      if (!smallestDataUrl || dataUrl.length < smallestDataUrl.length) {
        smallestDataUrl = dataUrl;
      }
      if (dataUrl.length <= TARGET_STAFF_PHOTO_DATA_URL_LENGTH) {
        return dataUrl;
      }
    }
  }

  return smallestDataUrl;
};

type UseSharedAddStaffLogicArgs = AddStaffModalProps & {
  toast: Toast;
};

export function useSharedAddStaffLogic({
  open,
  onOpenChange,
  staffMode = "add",
  staff,
  onStaffAdded,
  onStaffSaved,
  toast,
}: UseSharedAddStaffLogicArgs) {
  const [form, setForm] = useState<AddStaffForm>(() => staffRecordToForm(staff));
  const [staffModalStep, setStaffModalStep] = useState<StaffModalStep>("profile");
  const [isConfirmSummaryOpen, setIsConfirmSummaryOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const isCreateMode = staffMode === "add";
  const isEditMode = staffMode === "edit";
  const isViewMode = staffMode === "view";
  const isReadOnly = isViewMode;
  const staffId = staff?.id != null ? String(staff.id) : "";

  const activeStaffStepIndex = Math.max(0, staffModalSteps.findIndex((step) => step.id === staffModalStep));
  const staffProgressWidth =
    staffModalSteps.length > 1 ? `${(activeStaffStepIndex / (staffModalSteps.length - 1)) * 100}%` : "0%";
  const staffToAdd = useMemo(() => buildStaffPayload(form), [form]);
  const addStaffSummaryRows = useMemo(() => getAddStaffSummaryRows(staffToAdd), [staffToAdd]);

  useEffect(() => {
    if (!open) return;
    setForm(staffRecordToForm(staff));
    setStaffModalStep("profile");
    setIsConfirmSummaryOpen(false);
  }, [open, staff, staffMode]);

  const updateForm = (updates: Partial<AddStaffForm>) => {
    if (isReadOnly) return;
    setForm((current) => ({ ...current, ...updates }));
  };

  const resetForm = () => {
    setForm(staffRecordToForm(staff));
    setStaffModalStep("profile");
    setIsConfirmSummaryOpen(false);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && isSaving) return;
    onOpenChange(nextOpen);
    if (!nextOpen) resetForm();
  };

  const handleConfirmSummaryOpenChange = (nextOpen: boolean) => {
    if (!isSaving) setIsConfirmSummaryOpen(nextOpen);
  };

  const validateNewStaffForm = () => {
    if (!form.name.trim() || !form.role || !form.email.trim()) {
      safeToastError(toast, "Name, role, and email are required");
      return false;
    }
    return true;
  };

  const isStaffStepComplete = (stepId: StaffModalStep) => {
    if (stepId === "profile") return Boolean(form.name.trim() && form.email.trim());
    if (stepId === "role") return Boolean(form.role);
    return true;
  };

  const canOpenStaffStep = (stepId: StaffModalStep) => {
    if (isSaving) return false;
    if (isViewMode) return true;
    const targetIndex = staffModalSteps.findIndex((step) => step.id === stepId);
    if (targetIndex <= activeStaffStepIndex) return true;
    return staffModalSteps.slice(0, targetIndex).every((step) => isStaffStepComplete(step.id));
  };

  const validateStaffStep = () => {
    if (staffModalStep === "profile" && !isStaffStepComplete("profile")) {
      safeToastError(toast, "Full name and email are required");
      return false;
    }
    if (staffModalStep === "role" && !isStaffStepComplete("role")) {
      safeToastError(toast, "Role is required");
      return false;
    }
    return true;
  };

  const getStaffNextButtonLabel = () => {
    if (isViewMode) return staffModalStep === "credentials" ? "Close" : "Next";
    if (staffModalStep === "profile") return "Next: Role";
    if (staffModalStep === "role") return "Next: Employment";
    if (staffModalStep === "employment") return "Next: Credentials";
    return isEditMode ? "Review Changes" : "Confirm";
  };

  const openAddStaffConfirmation = () => {
    if (isViewMode) return false;
    if (!validateNewStaffForm()) return false;
    setIsConfirmSummaryOpen(true);
    return true;
  };

  const handleNextStaffStep = () => {
    if (!isViewMode && !validateStaffStep()) return false;
    const nextStep = staffModalSteps[activeStaffStepIndex + 1];
    if (nextStep) {
      setStaffModalStep(nextStep.id);
      return true;
    }
    if (isViewMode) {
      handleOpenChange(false);
      return true;
    }
    return openAddStaffConfirmation();
  };

  const handlePreviousStaffStep = () => {
    const previousStep = staffModalSteps[activeStaffStepIndex - 1];
    if (previousStep) setStaffModalStep(previousStep.id);
  };

  const handleStaffPhotoFile = async (file?: File | null) => {
    if (isReadOnly) return;
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      safeToastError(toast, "Please choose an image file.");
      return;
    }

    if (file.size > MAX_STAFF_PHOTO_UPLOAD_BYTES) {
      safeToastError(toast, "Please choose an image smaller than 8 MB.");
      return;
    }

    try {
      const compressedDataUrl = await compressStaffPhoto(file);
      updateForm({ profilePicture: compressedDataUrl });
    } catch (error) {
      console.error("Error preparing staff photo:", error);
      safeToastError(toast, "Could not read the selected image.");
    }
  };

  const removeStaffPhoto = () => {
    if (isReadOnly) return;
    updateForm({ profilePicture: "" });
  };

  const handleSaveStaff = async () => {
    if (isViewMode) return false;
    if (!validateNewStaffForm()) return false;
    if (isEditMode && !staffId) {
      safeToastError(toast, "Missing staff member to update.");
      return false;
    }

    setIsSaving(true);
    try {
      const response = await fetch(apiUrl(isEditMode ? `/api/staff/${staffId}` : "/api/staff"), {
        method: isEditMode ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(staffToAdd),
      });

      const result = await response.json().catch(() => null);
      if (!response.ok || result?.success === false) {
        if (response.status === 413) {
          safeToastError(toast, "The staff photo is still too large. Please choose a smaller image.");
          return false;
        }
        safeToastError(toast, result?.message || (isEditMode ? "Failed to update staff member." : "Failed to add staff member."));
        return false;
      }

      safeToastSuccess(toast, isEditMode ? "Staff member updated successfully!" : "Staff member added successfully!");
      setIsConfirmSummaryOpen(false);
      onOpenChange(false);
      resetForm();
      onStaffAdded?.(result?.data);
      onStaffSaved?.(result?.data);
      return true;
    } catch (error) {
      console.error(isEditMode ? "Error updating staff member:" : "Error adding staff member:", error);
      safeToastError(toast, "An unexpected error occurred.");
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  return {
    open,
    form,
    staffMode,
    isCreateMode,
    isEditMode,
    isViewMode,
    isReadOnly,
    staffToAdd,
    addStaffSummaryRows,
    staffModalStep,
    activeStaffStepIndex,
    staffProgressWidth,
    isConfirmSummaryOpen,
    isSaving,
    updateForm,
    setStaffModalStep,
    handleOpenChange,
    handleConfirmSummaryOpenChange,
    handleNextStaffStep,
    handlePreviousStaffStep,
    handleStaffPhotoFile,
    removeStaffPhoto,
    handleSaveStaff,
    handleAddStaff: handleSaveStaff,
    openAddStaffConfirmation,
    getStaffNextButtonLabel,
    canOpenStaffStep,
  };
}
