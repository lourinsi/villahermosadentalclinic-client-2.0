import { Badge } from "./ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger } from "./ui/select";
import { formatAppointmentStatusLabel, isCartAppointmentStatus, normalizeAppointmentStatus } from "@/lib/appointment-status";
import { getAppointmentStatusOptionWithColors } from "@/lib/status-colors";

type StatusOption = { value: string; label?: string; bgColor?: string; textColor?: string };

export function AppointmentStatusSelect({
  value,
  statuses,
  onChange,
  includeDeleted = false,
  triggerClassName = "h-auto w-auto border-0 bg-transparent p-0 shadow-none hover:opacity-80 [&>svg]:ml-2 [&>svg]:text-gray-400",
  badgeClassName = "font-medium capitalize",
}: {
  value?: string | null;
  statuses: StatusOption[];
  onChange: (value: string) => void;
  includeDeleted?: boolean;
  triggerClassName?: string;
  badgeClassName?: string;
}) {
  const normalizedValue = normalizeAppointmentStatus(value) || "scheduled";
  const statusOption = getAppointmentStatusOptionWithColors(normalizedValue, statuses);
  const options = statuses.filter((status) => {
    const normalized = normalizeAppointmentStatus(status.value);
    return !isCartAppointmentStatus(normalized) && (includeDeleted || normalized !== "deleted");
  });

  return (
    <Select value={normalizedValue} onValueChange={onChange}>
      <SelectTrigger className={triggerClassName} onClick={(event) => event.stopPropagation()}>
        <Badge className={`${statusOption.bgColor} ${statusOption.textColor} border-none hover:opacity-80 ${badgeClassName}`}>
          {statusOption.label || formatAppointmentStatusLabel(normalizedValue)}
        </Badge>
      </SelectTrigger>
      <SelectContent>
        {options.map((status) => (
          <SelectItem key={status.value} value={normalizeAppointmentStatus(status.value)}>
            {status.label || formatAppointmentStatusLabel(status.value)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
