"use client";

import { toast } from "sonner";
import { Calendar, Check, ChevronLeft, ChevronRight, CreditCard, UserPlus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import AddStaffConfirmationDialog from "./AddStaffConfirmationDialog";
import AddStaffPhotoField from "./AddStaffPhotoField";
import {
  AddStaffModalProps,
  employmentTypeOptions,
  getDefaultDepartmentForRole,
  staffDepartmentOptions,
  staffPasswordManagerIgnoreProps,
  staffModalSteps,
  staffRoleOptions,
  staffStatusOptions,
  useSharedAddStaffLogic,
} from "./sharedAddStaffLogic";

export default function ImprovedAddStaffModal(props: AddStaffModalProps) {
  const staffLogic = useSharedAddStaffLogic({ ...props, toast });
  const { form, staffModalStep } = staffLogic;
  const title = staffLogic.isViewMode
    ? "Staff Details"
    : staffLogic.isEditMode
      ? "Edit Staff Member"
      : "Add New Staff Member";

  return (
    <>
      <Dialog open={props.open} onOpenChange={staffLogic.handleOpenChange}>
        <DialogContent className="max-w-2xl max-h-[92vh] overflow-hidden p-0 flex flex-col">
          <DialogHeader className="shrink-0 border-b bg-white p-6">
            <DialogDescription className="sr-only">
              Add a staff member using a guided staff form.
            </DialogDescription>
            <div className="mb-4 flex items-center justify-between">
              {staffModalStep !== "profile" ? (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={staffLogic.handlePreviousStaffStep}
                  disabled={staffLogic.isSaving}
                  className="rounded-full hover:bg-gray-100"
                >
                  <ChevronLeft className="h-5 w-5 text-gray-600" />
                </Button>
              ) : (
                <div className="h-10 w-10" />
              )}

              <DialogTitle className="flex-1 text-center text-2xl font-bold text-gray-900">
                {title}
              </DialogTitle>
              <div className="h-10 w-10" />
            </div>

            <div className="relative mx-auto mt-2 mb-4 flex w-full max-w-xl items-center justify-between px-6">
              <div className="absolute left-6 right-6 top-1/2 z-0 h-0.5 -translate-y-1/2 bg-gray-100">
                <div
                  className="h-full bg-blue-600 transition-all duration-500"
                  style={{ width: staffLogic.staffProgressWidth }}
                />
              </div>

              {staffModalSteps.map((step, index) => {
                const isActive = staffModalStep === step.id;
                const isCompleted = index < staffLogic.activeStaffStepIndex;
                const isClickable = staffLogic.canOpenStaffStep(step.id);

                return (
                  <button
                    key={step.id}
                    type="button"
                    onClick={() => isClickable && staffLogic.setStaffModalStep(step.id)}
                    disabled={!isClickable}
                    className={`relative z-10 flex flex-col items-center outline-none transition-all ${
                      isClickable ? "cursor-pointer hover:opacity-80" : "cursor-not-allowed opacity-60"
                    }`}
                  >
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all duration-300 ${
                        isActive
                          ? "scale-110 border-blue-600 bg-blue-600 text-white shadow-md"
                          : isCompleted
                            ? "border-blue-600 bg-blue-600 text-white"
                            : "border-gray-200 bg-white text-gray-400"
                      }`}
                    >
                      {isCompleted ? <Check className="h-4 w-4" /> : <span className="text-xs font-bold">{step.icon}</span>}
                    </div>
                    <span
                      className={`absolute -bottom-6 text-[9px] font-black uppercase tracking-normal ${
                        isActive ? "text-blue-600" : "text-gray-400"
                      }`}
                    >
                      {step.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto bg-gray-50/30 p-6">
            <div className="mx-auto max-w-xl">
              {staffModalStep === "profile" && (
                <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-100">
                      <UserPlus className="h-5 w-5" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900">Staff Profile</h3>
                  </div>

                  <AddStaffPhotoField
                    id="staff-photo-simple"
                    name={form.name}
                    profilePicture={form.profilePicture}
                    disabled={staffLogic.isSaving || staffLogic.isReadOnly}
                    readOnly={staffLogic.isReadOnly}
                    compact
                    onFileSelect={staffLogic.handleStaffPhotoFile}
                    onRemove={staffLogic.removeStaffPhoto}
                  />

                  <div className="space-y-2">
                    <Label htmlFor="simple-staff-name">Full Name</Label>
                    <Input
                      id="simple-staff-name"
                      placeholder="Enter full name"
                      {...staffPasswordManagerIgnoreProps}
                      value={form.name}
                      disabled={staffLogic.isReadOnly}
                      onChange={(event) => staffLogic.updateForm({ name: event.target.value })}
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="simple-staff-email">Email</Label>
                    <Input
                      id="simple-staff-email"
                      type="email"
                      placeholder="email@smilecare.com"
                      {...staffPasswordManagerIgnoreProps}
                      value={form.email}
                      disabled={staffLogic.isReadOnly}
                      onChange={(event) => staffLogic.updateForm({ email: event.target.value })}
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="simple-staff-phone">Phone Number</Label>
                    <Input
                      id="simple-staff-phone"
                      type="tel"
                      placeholder="+63 900 000 0000"
                      {...staffPasswordManagerIgnoreProps}
                      value={form.phone}
                      disabled={staffLogic.isReadOnly}
                      onChange={(event) => staffLogic.updateForm({ phone: event.target.value })}
                      className="h-11"
                    />
                  </div>
                </div>
              )}

              {staffModalStep === "role" && (
                <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-100">
                      <Users className="h-5 w-5" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900">Role Assignment</h3>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="simple-staff-role">Role/Position</Label>
                    <Select
                      value={form.role}
                      disabled={staffLogic.isReadOnly}
                      onValueChange={(value) =>
                        staffLogic.updateForm({
                          role: value,
                          department: form.department || getDefaultDepartmentForRole(value),
                        })
                      }
                    >
                      <SelectTrigger id="simple-staff-role" className="h-11">
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        {staffRoleOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="simple-staff-department">Department</Label>
                    <Select
                      value={form.department}
                      onValueChange={(value) => staffLogic.updateForm({ department: value })}
                      disabled={staffLogic.isReadOnly}
                    >
                      <SelectTrigger id="simple-staff-department" className="h-11">
                        <SelectValue placeholder="Select department" />
                      </SelectTrigger>
                      <SelectContent>
                        {staffDepartmentOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="simple-staff-employment">Employment Type</Label>
                    <Select
                      value={form.employmentType || "fulltime"}
                      onValueChange={(value) => staffLogic.updateForm({ employmentType: value })}
                      disabled={staffLogic.isReadOnly}
                    >
                      <SelectTrigger id="simple-staff-employment" className="h-11">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {employmentTypeOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {staffModalStep === "employment" && (
                <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-100">
                      <Calendar className="h-5 w-5" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900">Employment Details</h3>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="simple-staff-hire-date">Hire Date</Label>
                    <Input
                      id="simple-staff-hire-date"
                      type="date"
                      {...staffPasswordManagerIgnoreProps}
                      value={form.hireDate}
                      disabled={staffLogic.isReadOnly}
                      onChange={(event) => staffLogic.updateForm({ hireDate: event.target.value })}
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="simple-staff-salary">Base Monthly Salary (PHP)</Label>
                    <Input
                      id="simple-staff-salary"
                      type="number"
                      placeholder="5000"
                      {...staffPasswordManagerIgnoreProps}
                      value={form.baseSalary}
                      disabled={staffLogic.isReadOnly}
                      onChange={(event) => staffLogic.updateForm({ baseSalary: Number(event.target.value) })}
                      className="h-11"
                    />
                  </div>
                  {!staffLogic.isCreateMode ? (
                    <div className="space-y-2">
                      <Label htmlFor="simple-staff-status">Status</Label>
                      <Select
                        value={form.status}
                        onValueChange={(value) => staffLogic.updateForm({ status: value })}
                        disabled={staffLogic.isReadOnly}
                      >
                        <SelectTrigger id="simple-staff-status" className="h-11">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          {staffStatusOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : null}
                </div>
              )}

              {staffModalStep === "credentials" && (
                <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-100">
                      <CreditCard className="h-5 w-5" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900">Credentials</h3>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="simple-staff-specialization">Specialization</Label>
                    <Input
                      id="simple-staff-specialization"
                      placeholder="e.g., General Dentistry"
                      {...staffPasswordManagerIgnoreProps}
                      value={form.specialization}
                      disabled={staffLogic.isReadOnly}
                      onChange={(event) => staffLogic.updateForm({ specialization: event.target.value })}
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="simple-staff-license">License Number</Label>
                    <Input
                      id="simple-staff-license"
                      placeholder="e.g., DDS-12345"
                      {...staffPasswordManagerIgnoreProps}
                      value={form.licenseNumber}
                      disabled={staffLogic.isReadOnly}
                      onChange={(event) => staffLogic.updateForm({ licenseNumber: event.target.value })}
                      className="h-11"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="shrink-0 border-t bg-white p-6 sm:justify-between">
            <Button variant="outline" onClick={() => staffLogic.handleOpenChange(false)} disabled={staffLogic.isSaving}>
              {staffLogic.isReadOnly ? "Close" : "Cancel"}
            </Button>
            <div className="flex gap-2">
              {staffModalStep !== "profile" && (
                <Button variant="outline" onClick={staffLogic.handlePreviousStaffStep} disabled={staffLogic.isSaving}>
                  <ChevronLeft className="mr-2 h-4 w-4" />
                  Previous
                </Button>
              )}
              <Button
                onClick={staffLogic.handleNextStaffStep}
                disabled={staffLogic.isSaving}
                className="min-w-[170px] bg-blue-600 hover:bg-blue-700"
              >
                {staffLogic.isSaving ? "Saving..." : staffLogic.getStaffNextButtonLabel()}
                {staffModalStep !== "credentials" && <ChevronRight className="ml-2 h-4 w-4" />}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AddStaffConfirmationDialog
        open={staffLogic.isConfirmSummaryOpen}
        onOpenChange={staffLogic.handleConfirmSummaryOpenChange}
        staff={staffLogic.staffToAdd}
        summaryRows={staffLogic.addStaffSummaryRows}
        loading={staffLogic.isSaving}
        title={staffLogic.isEditMode ? "Confirm Staff Updates" : "Confirm Staff Member"}
        description={staffLogic.isEditMode ? "Review these changes before saving." : "Review these details before adding the staff member."}
        confirmLabel={staffLogic.isEditMode ? "Confirm & Save" : "Confirm & Add"}
        onConfirm={staffLogic.handleSaveStaff}
      />
    </>
  );
}
