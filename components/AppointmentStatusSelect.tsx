import { Badge } from "./ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger } from "./ui/select";
import {
  formatAppointmentStatusLabel,
  isCartAppointmentStatus,
  normalizeAppointmentStatus,
  isStatusAllowedForAppointment,
  isPastAppointmentDate,
  isFullyPaidAppointmentStatus,
} from "@/lib/appointment-status";
import { getAppointmentStatusOptionWithColors } from "@/lib/status-colors";

type StatusOption = { value: string; label?: string; bgColor?: string; textColor?: string };

export function AppointmentStatusSelect({
  value,
  statuses,
  onChange,
  includeDeleted = false,
  appointmentDate,
  paymentStatus,
  disabled = false,
  triggerClassName = "h-auto w-auto border-0 bg-transparent p-0 shadow-none hover:opacity-80 [&>svg]:ml-2 [&>svg]:text-gray-400",
  badgeClassName = "font-medium capitalize",
}: {
  value?: string | null;
  statuses: StatusOption[];
  onChange: (value: string) => void;
  includeDeleted?: boolean;
  appointmentDate?: string | Date | null;
  paymentStatus?: string | null;
  disabled?: boolean;
  triggerClassName?: string;
  badgeClassName?: string;
}) {
  const normalizedValue = normalizeAppointmentStatus(value) || "scheduled";
  const statusOption = getAppointmentStatusOptionWithColors(normalizedValue, statuses);
  const options = statuses.filter((status) => {
    const normalized = normalizeAppointmentStatus(status.value);
    if (isCartAppointmentStatus(normalized)) return false;
    if (!includeDeleted && normalized === "deleted") return false;
    return true;
  });

  return (
    <Select value={normalizedValue} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className={triggerClassName} onClick={(event) => event.stopPropagation()}>
        <Badge className={`${statusOption.bgColor} ${statusOption.textColor} border-none hover:opacity-80 ${badgeClassName}`}>
          {statusOption.label || formatAppointmentStatusLabel(normalizedValue)}
        </Badge>
      </SelectTrigger>
      <SelectContent>
        {options.map((status) => {
          const normVal = normalizeAppointmentStatus(status.value);
            const isAllowed =
              appointmentDate !== undefined && appointmentDate !== null
                ? isStatusAllowedForAppointment(normVal, appointmentDate, paymentStatus, includeDeleted) || normVal === normalizedValue
                : true;

            // Always allow manual completion or cancellation regardless of date/payment
            if (normVal === "completed" || normVal === "cancelled") {
              // ensure it's enabled
            }

            let disabled = !isAllowed;
            let title: string | undefined = undefined;

            const isPast = appointmentDate !== undefined && appointmentDate !== null && isPastAppointmentDate(appointmentDate);
            const isFullyPaid = isFullyPaidAppointmentStatus(paymentStatus);

            // Allow transitioning from `completed` to `tbd` explicitly.
            if (normVal === "tbd" && normalizedValue === "completed") {
              // treat as allowed even if past/unpaid
              // this enables the UI to perform the manual override
              // backend lifecycle may still adjust, but UI shouldn't block it
              // so mark isAllowed true here
              // eslint-disable-next-line no-unused-vars
              const _allowCompletedToTbd = true;
            }

            // Prevent selecting TBD for past appointments that are not fully paid,
            // but allow it when the current status is `completed` (manual override allowed).
            if (normVal === "tbd" && isPast && !isFullyPaid && normalizedValue !== "completed") {
              disabled = true;
              title = "TBD is auto-converted to Overdue for past unpaid or partially-paid appointments.";
            }

            // Prevent selecting Overdue when already fully paid (in which case backend uses TBD)
            if (normVal === "overdue" && isFullyPaid) {
              disabled = true;
              title = "Overdue is not valid for fully-paid appointments (system converts it to TBD).";
            }

            // Always allow manual completion/cancellation
            if (normVal === "completed" || normVal === "cancelled") {
              disabled = false;
              title = undefined;
            }

            // If the item is disabled but has no specific title, provide a contextual tooltip so users know why.
            if (disabled && !title) {
              if (appointmentDate !== undefined && appointmentDate !== null && isPast) {
                title = "This status is restricted for past appointments by lifecycle rules.";
              } else if (paymentStatus !== undefined && paymentStatus !== null && !isFullyPaid) {
                title = "This status is restricted based on the appointment's payment status.";
              } else {
                title = "This status cannot be selected for this appointment.";
              }
            }

            return (
              <SelectItem key={status.value} value={normVal} disabled={disabled} title={title}>
                {status.label || formatAppointmentStatusLabel(status.value)}
              </SelectItem>
            );
        })}
      </SelectContent>
    </Select>
  );
}

