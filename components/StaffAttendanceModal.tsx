"use client";

import { CalendarCheck2, CircleHelp, Minus, Plus, RotateCcw } from "lucide-react";
import type { Attendance } from "@/lib/staff-types";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import { staffPasswordManagerIgnoreProps } from "./sharedAddStaffLogic";
import { formatStaffMonthLabel, getWorkingDaysInMonth } from "./staffModalOptions";

type StaffAttendanceModalProps = {
  open: boolean;
  attendance: Attendance;
  month: string;
  isSaving: boolean;
  onOpenChange: (open: boolean) => void;
  onAttendanceChange: (attendance: Attendance) => void;
  onSave: () => void;
};

type AttendanceNumberField = "hoursWorked" | "overtimeHours" | "daysPresent" | "daysAbsent";

const clampNumber = (value: number) => Math.max(0, Number.isFinite(value) ? value : 0);
const wholeNumber = (value: number) => Math.trunc(clampNumber(value));

export function StaffAttendanceModal({
  open,
  attendance,
  month,
  isSaving,
  onOpenChange,
  onAttendanceChange,
  onSave,
}: StaffAttendanceModalProps) {
  const monthLabel = formatStaffMonthLabel(month);
  const expectedWorkingDays = getWorkingDaysInMonth(month);
  const daysPresent = wholeNumber(Number(attendance.daysPresent) || 0);
  const daysAbsent = wholeNumber(Number(attendance.daysAbsent) || 0);
  const totalTrackedDays = daysPresent + daysAbsent;
  const attendanceRate = totalTrackedDays > 0 ? Math.round((daysPresent / totalTrackedDays) * 1000) / 10 : 0;
  const exceedsWorkingDays = expectedWorkingDays > 0 && totalTrackedDays > expectedWorkingDays;

  const updateAttendance = (updates: Partial<Attendance>) => onAttendanceChange({ ...attendance, ...updates });
  const updateNumber = (field: AttendanceNumberField, value: number) => {
    const nextValue = field === "hoursWorked" || field === "overtimeHours" ? clampNumber(value) : wholeNumber(value);
    updateAttendance({ [field]: nextValue } as Partial<Attendance>);
  };

  const stepNumber = (field: AttendanceNumberField, amount: number) => {
    updateNumber(field, Number(attendance[field]) + amount);
  };

  const addAbsenceDay = () => {
    updateAttendance({
      daysAbsent: daysAbsent + 1,
      daysPresent: Math.max(0, daysPresent - 1),
    });
  };

  const fillExpectedWorkingDays = () => {
    updateAttendance({
      daysPresent: Math.max(0, expectedWorkingDays - daysAbsent),
    });
  };

  const resetCounts = () => {
    updateAttendance({
      hoursWorked: 0,
      overtimeHours: 0,
      daysPresent: 0,
      daysAbsent: 0,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto p-0 sm:max-w-2xl">
        <div className="border-b bg-gray-50 px-6 py-5">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarCheck2 className="h-5 w-5 text-blue-600" />
              Update Attendance
            </DialogTitle>
            <DialogDescription>
              Track a backend monthly attendance summary for {monthLabel}. Save updates when the totals look right.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="space-y-5 px-6 py-5">
          <div className="flex flex-col gap-3 rounded-md border bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-xs font-medium uppercase text-muted-foreground">Staff Member</div>
              <div className="mt-1 font-semibold text-gray-900">{attendance.staffName || "No staff selected"}</div>
              <div className="mt-1 text-sm text-muted-foreground">{monthLabel}</div>
            </div>
            <Badge variant={daysAbsent > 0 ? "destructive" : "secondary"}>
              {daysAbsent} absent {daysAbsent === 1 ? "day" : "days"}
            </Badge>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-md border bg-gray-50 p-3">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                Expected working days
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" aria-label="Expected working days help">
                      <CircleHelp className="h-3.5 w-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[260px]">
                    This helper counts weekdays only. Adjust manually for clinic holidays or custom schedules.
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className="mt-1 text-xl font-semibold">{expectedWorkingDays || "-"}</div>
            </div>
            <div className="rounded-md border bg-gray-50 p-3">
              <div className="text-xs text-muted-foreground">Tracked days</div>
              <div className="mt-1 text-xl font-semibold">{totalTrackedDays}</div>
            </div>
            <div className="rounded-md border bg-gray-50 p-3">
              <div className="text-xs text-muted-foreground">Attendance rate</div>
              <div className="mt-1 text-xl font-semibold">{attendanceRate.toFixed(1)}%</div>
            </div>
          </div>

          {exceedsWorkingDays ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Tracked days are above the weekday estimate for {monthLabel}. This may be correct for extra clinic days,
              but double-check before saving.
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="attendance-hours">Hours Worked</Label>
              <div className="flex gap-2">
                <Input
                  id="attendance-hours"
                  type="number"
                  min="0"
                  step="0.5"
                  {...staffPasswordManagerIgnoreProps}
                  value={attendance.hoursWorked}
                  onChange={(event) => updateNumber("hoursWorked", Number(event.target.value))}
                />
                <Button type="button" variant="outline" size="icon" onClick={() => stepNumber("hoursWorked", -1)} aria-label="Subtract hour">
                  <Minus className="h-4 w-4" />
                </Button>
                <Button type="button" variant="outline" size="icon" onClick={() => stepNumber("hoursWorked", 1)} aria-label="Add hour">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="attendance-overtime">Overtime Hours</Label>
              <div className="flex gap-2">
                <Input
                  id="attendance-overtime"
                  type="number"
                  min="0"
                  step="0.5"
                  {...staffPasswordManagerIgnoreProps}
                  value={attendance.overtimeHours}
                  onChange={(event) => updateNumber("overtimeHours", Number(event.target.value))}
                />
                <Button type="button" variant="outline" size="icon" onClick={() => stepNumber("overtimeHours", -1)} aria-label="Subtract overtime hour">
                  <Minus className="h-4 w-4" />
                </Button>
                <Button type="button" variant="outline" size="icon" onClick={() => stepNumber("overtimeHours", 1)} aria-label="Add overtime hour">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="attendance-present">Days Present</Label>
              <div className="flex gap-2">
                <Input
                  id="attendance-present"
                  type="number"
                  min="0"
                  {...staffPasswordManagerIgnoreProps}
                  value={attendance.daysPresent}
                  onChange={(event) => updateNumber("daysPresent", Number(event.target.value))}
                />
                <Button type="button" variant="outline" size="icon" onClick={() => stepNumber("daysPresent", -1)} aria-label="Subtract present day">
                  <Minus className="h-4 w-4" />
                </Button>
                <Button type="button" variant="outline" size="icon" onClick={() => stepNumber("daysPresent", 1)} aria-label="Add present day">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="attendance-absent">Days Absent</Label>
              <div className="flex gap-2">
                <Input
                  id="attendance-absent"
                  type="number"
                  min="0"
                  {...staffPasswordManagerIgnoreProps}
                  value={attendance.daysAbsent}
                  onChange={(event) => updateNumber("daysAbsent", Number(event.target.value))}
                />
                <Button type="button" variant="outline" size="icon" onClick={() => stepNumber("daysAbsent", -1)} aria-label="Subtract absent day">
                  <Minus className="h-4 w-4" />
                </Button>
                <Button type="button" variant="outline" size="icon" onClick={addAbsenceDay} aria-label="Add absent day">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={fillExpectedWorkingDays} disabled={!expectedWorkingDays}>
              Fill Expected Month
            </Button>
            <Button type="button" variant="outline" onClick={addAbsenceDay}>
              Add Absence
            </Button>
            <Button type="button" variant="ghost" onClick={resetCounts}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Reset Counts
            </Button>
          </div>
        </div>

        <DialogFooter className="border-t px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onSave} disabled={isSaving || !attendance.staffId}>
            {isSaving ? "Saving..." : "Save Attendance"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
