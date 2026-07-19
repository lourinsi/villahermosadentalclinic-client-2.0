"use client";

import React from "react";
import { Eye, History, Stethoscope, Calendar as CalendarIcon, RotateCcw, Pencil, Plus, User, Loader2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

export interface AppointmentActionConfig {
  id: string;
  label: string;
  icon: React.ReactNode;
  disabled?: boolean;
  isLoading?: boolean;
  hidden?: boolean;
  isDangerous?: boolean;
  separator?: boolean;
  onSelect: () => void;
}

export interface AppointmentActionsMenuProps {
  actions: AppointmentActionConfig[];
  triggerVariant?: "outline" | "ghost";
  triggerSize?: "icon" | "sm" | "default";
  triggerClassName?: string;
  contentClassName?: string;
  ariaLabel?: string;
  align?: "start" | "center" | "end";
  triggerIcon?: React.ReactNode;
}

export function AppointmentActionsMenu({
  actions,
  triggerVariant = "outline",
  triggerSize = "icon",
  triggerClassName = "",
  contentClassName = "w-52",
  ariaLabel = "More actions",
  align = "end",
  triggerIcon,
}: AppointmentActionsMenuProps) {
  const visibleActions = actions.filter((action) => !action.hidden);

  if (visibleActions.length === 0) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant={triggerVariant}
          size={triggerSize}
          className={triggerClassName}
          aria-label={ariaLabel}
        >
          {triggerIcon}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className={contentClassName}>
        {visibleActions.map((action, index) => (
          <React.Fragment key={action.id}>
            {action.separator && index > 0 && <DropdownMenuSeparator />}
            <DropdownMenuItem
              onSelect={action.onSelect}
              disabled={action.disabled}
              className={action.isDangerous ? "text-red-600 focus:text-red-600" : undefined}
            >
              {action.isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <span className="mr-2 h-4 w-4 flex items-center justify-center">
                  {action.icon}
                </span>
              )}
              {action.label}
            </DropdownMenuItem>
          </React.Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Helper function to create appointment history snapshot actions
 * Used in AppointmentHistoryView
 */
export function createAppointmentHistoryActions(handlers: {
  onOpen?: () => void;
  onViewHistory?: () => void;
  onChangeTreatment?: () => void;
  onChangeSchedule?: () => void;
  onRepeatSchedule?: () => void;
  onEditPayment?: () => void;
  onAddPayment?: () => void;
  onGoToPatient?: () => void;
  onGoToDoctor?: () => void;
}, state: {
  canChangeTreatment?: boolean;
  isLoadingTreatmentOptions?: boolean;
  canChangeSchedule?: boolean;
  canRepeatSchedule?: boolean;
  isOpeningPaymentEdit?: boolean;
  canGoToPatient?: boolean;
  canGoToDoctor?: boolean;
} = {}): AppointmentActionConfig[] {
  return [
    {
      id: "open",
      label: "Open",
      icon: <Eye className="h-4 w-4" />,
      onSelect: handlers.onOpen || (() => {}),
      hidden: !handlers.onOpen,
    },
    {
      id: "view-history",
      label: "View history",
      icon: <History className="h-4 w-4" />,
      onSelect: handlers.onViewHistory || (() => {}),
      hidden: !handlers.onViewHistory,
    },
    {
      id: "change-treatment",
      label: "Change treatment",
      icon: <Stethoscope className="h-4 w-4" />,
      disabled: !state.canChangeTreatment || state.isLoadingTreatmentOptions,
      isLoading: state.isLoadingTreatmentOptions,
      onSelect: handlers.onChangeTreatment || (() => {}),
      hidden: !handlers.onChangeTreatment,
    },
    {
      id: "change-schedule",
      label: "Change schedule",
      icon: <CalendarIcon className="h-4 w-4" />,
      disabled: !state.canChangeSchedule,
      onSelect: handlers.onChangeSchedule || (() => {}),
      hidden: !handlers.onChangeSchedule,
    },
    {
      id: "repeat-schedule",
      label: "Repeat Schedule",
      icon: <RotateCcw className="h-4 w-4" />,
      disabled: !state.canRepeatSchedule,
      onSelect: handlers.onRepeatSchedule || (() => {}),
      hidden: !handlers.onRepeatSchedule,
    },
    {
      id: "edit-payment",
      label: "Edit payment",
      icon: <Pencil className="h-4 w-4" />,
      disabled: state.isOpeningPaymentEdit,
      isLoading: state.isOpeningPaymentEdit,
      onSelect: handlers.onEditPayment || (() => {}),
      hidden: !handlers.onEditPayment,
    },
    {
      id: "add-payment",
      label: "Add payment",
      icon: <Plus className="h-4 w-4" />,
      onSelect: handlers.onAddPayment || (() => {}),
      hidden: !handlers.onAddPayment,
    },
    {
      id: "separator-navigation",
      label: "",
      icon: null,
      separator: true,
      onSelect: () => {},
      hidden: !handlers.onGoToPatient && !handlers.onGoToDoctor,
    },
    {
      id: "go-to-patient",
      label: "Go to patient",
      icon: <User className="h-4 w-4" />,
      disabled: !state.canGoToPatient,
      onSelect: handlers.onGoToPatient || (() => {}),
      hidden: !handlers.onGoToPatient,
    },
    {
      id: "go-to-doctor",
      label: "Go to doctor",
      icon: <Stethoscope className="h-4 w-4" />,
      disabled: !state.canGoToDoctor,
      onSelect: handlers.onGoToDoctor || (() => {}),
      hidden: !handlers.onGoToDoctor,
    },
  ];
}

/**
 * Helper function to create visit history actions
 * Used in PatientProfile for appointment history
 */
export function createVisitHistoryActions(handlers: {
  onViewDetails?: () => void;
  onViewHistory?: () => void;
  onRecordPayment?: () => void;
  onRestoreAppointment?: () => void;
  onReschedule?: () => void;
  onUpdateTreatment?: () => void;
  onAssignDoctor?: () => void;
}, state: {
  canRestoreAppointment?: boolean;
  canReschedule?: boolean;
  canUpdateTreatment?: boolean;
  canAssignDoctor?: boolean;
  isDoctorUnassigned?: boolean;
} = {}): AppointmentActionConfig[] {
  return [
    {
      id: "view-details",
      label: "View Details",
      icon: <Eye className="h-4 w-4" />,
      onSelect: handlers.onViewDetails || (() => {}),
      hidden: !handlers.onViewDetails,
    },
    {
      id: "view-history",
      label: "View history",
      icon: <History className="h-4 w-4" />,
      onSelect: handlers.onViewHistory || (() => {}),
      hidden: !handlers.onViewHistory,
    },
    {
      id: "record-payment",
      label: "Record Payment",
      icon: <Plus className="h-4 w-4" />,
      onSelect: handlers.onRecordPayment || (() => {}),
      hidden: !handlers.onRecordPayment,
    },
    {
      id: "restore-appointment",
      label: "Restore Appointment",
      icon: <RotateCcw className="h-4 w-4" />,
      disabled: !state.canRestoreAppointment,
      onSelect: handlers.onRestoreAppointment || (() => {}),
      hidden: !state.canRestoreAppointment || !handlers.onRestoreAppointment,
    },
    {
      id: "reschedule",
      label: "Reschedule",
      icon: <CalendarIcon className="h-4 w-4" />,
      disabled: !state.canReschedule,
      onSelect: handlers.onReschedule || (() => {}),
      hidden: !handlers.onReschedule,
    },
    {
      id: "change-treatment",
      label: "Change treatment",
      icon: <Stethoscope className="h-4 w-4" />,
      disabled: !state.canUpdateTreatment,
      onSelect: handlers.onUpdateTreatment || (() => {}),
      hidden: !handlers.onUpdateTreatment,
    },
    {
      id: "assign-doctor",
      label: state.isDoctorUnassigned ? "Assign Doctor" : "Change Doctor",
      icon: <Stethoscope className="h-4 w-4" />,
      disabled: !state.canAssignDoctor,
      onSelect: handlers.onAssignDoctor || (() => {}),
      hidden: !handlers.onAssignDoctor,
    },
  ];
}

/**
 * Helper function to create requests view overflow menu actions
 * Used in RequestsView for secondary appointment actions
 */
export function createRequestsOverflowActions(handlers: {
  onChangeTreatment?: () => void;
  onChangeDoctor?: () => void;
  onReschedule?: () => void;
  onViewDetails?: () => void;
}, state: {
  canChangeTreatment?: boolean;
  canChangeDoctor?: boolean;
  canReschedule?: boolean;
  isDoctorUnassigned?: boolean;
} = {}): AppointmentActionConfig[] {
  return [
    {
      id: "change-treatment",
      label: "Change treatment",
      icon: <Stethoscope className="h-4 w-4" />,
      disabled: !state.canChangeTreatment,
      onSelect: handlers.onChangeTreatment || (() => {}),
      hidden: !handlers.onChangeTreatment,
    },
    {
      id: "change-doctor",
      label: state.isDoctorUnassigned ? "Assign Doctor" : "Change Doctor",
      icon: <Stethoscope className="h-4 w-4" />,
      disabled: !state.canChangeDoctor,
      onSelect: handlers.onChangeDoctor || (() => {}),
      hidden: !handlers.onChangeDoctor,
    },
    {
      id: "reschedule",
      label: "Reschedule",
      icon: <CalendarIcon className="h-4 w-4" />,
      disabled: !state.canReschedule,
      onSelect: handlers.onReschedule || (() => {}),
      hidden: !handlers.onReschedule,
    },
    {
      id: "view-details",
      label: "View Details",
      icon: <Eye className="h-4 w-4" />,
      onSelect: handlers.onViewDetails || (() => {}),
      hidden: !handlers.onViewDetails,
      separator: true,
    },
  ];
}
