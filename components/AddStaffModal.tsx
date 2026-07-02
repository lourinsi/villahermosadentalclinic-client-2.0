"use client";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
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
  staffDepartmentOptions,
  staffPasswordManagerIgnoreProps,
  staffRoleOptions,
  staffStatusOptions,
  useSharedAddStaffLogic,
} from "./sharedAddStaffLogic";

export default function AddStaffModal(props: AddStaffModalProps) {
  const staffLogic = useSharedAddStaffLogic({ ...props, toast });
  const { form } = staffLogic;
  const title = staffLogic.isViewMode
    ? "Staff Details"
    : staffLogic.isEditMode
      ? "Edit Staff Member"
      : "Add New Staff Member";
  const submitLabel = staffLogic.isEditMode ? "Review Changes" : "Add Staff Member";

  return (
    <>
      <Dialog open={props.open} onOpenChange={staffLogic.handleOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <AddStaffPhotoField
              id="staff-photo-pro"
              name={form.name}
              profilePicture={form.profilePicture}
              disabled={staffLogic.isSaving || staffLogic.isReadOnly}
              readOnly={staffLogic.isReadOnly}
              onFileSelect={staffLogic.handleStaffPhotoFile}
              onRemove={staffLogic.removeStaffPhoto}
            />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="staff-name">Full Name</Label>
                <Input
                  id="staff-name"
                  placeholder="Enter full name"
                  {...staffPasswordManagerIgnoreProps}
                  value={form.name}
                  disabled={staffLogic.isReadOnly}
                  onChange={(event) => staffLogic.updateForm({ name: event.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="staff-role">Role/Position</Label>
                <Select value={form.role} onValueChange={(value) => staffLogic.updateForm({ role: value })} disabled={staffLogic.isReadOnly}>
                  <SelectTrigger id="staff-role">
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
                <Label htmlFor="staff-email">Email</Label>
                <Input
                  id="staff-email"
                  type="email"
                  placeholder="email@smilecare.com"
                  {...staffPasswordManagerIgnoreProps}
                  value={form.email}
                  disabled={staffLogic.isReadOnly}
                  onChange={(event) => staffLogic.updateForm({ email: event.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="staff-phone">Phone Number</Label>
                <Input
                  id="staff-phone"
                  type="tel"
                  placeholder="+63 900 000 0000"
                  {...staffPasswordManagerIgnoreProps}
                  value={form.phone}
                  disabled={staffLogic.isReadOnly}
                  onChange={(event) => staffLogic.updateForm({ phone: event.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="staff-department">Department</Label>
                <Select value={form.department} onValueChange={(value) => staffLogic.updateForm({ department: value })} disabled={staffLogic.isReadOnly}>
                  <SelectTrigger id="staff-department">
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
                <Label htmlFor="staff-employment-type">Employment Type</Label>
                <Select
                  value={form.employmentType}
                  onValueChange={(value) => staffLogic.updateForm({ employmentType: value })}
                  disabled={staffLogic.isReadOnly}
                >
                  <SelectTrigger id="staff-employment-type">
                    <SelectValue placeholder="Select type" />
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
              <div className="space-y-2">
                <Label htmlFor="staff-hire-date">Hire Date</Label>
                <Input
                  id="staff-hire-date"
                  type="date"
                  {...staffPasswordManagerIgnoreProps}
                  value={form.hireDate}
                  disabled={staffLogic.isReadOnly}
                  onChange={(event) => staffLogic.updateForm({ hireDate: event.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="staff-base-salary">Base Monthly Salary (PHP)</Label>
                <Input
                  id="staff-base-salary"
                  type="number"
                  placeholder="5000"
                  {...staffPasswordManagerIgnoreProps}
                  value={form.baseSalary}
                  disabled={staffLogic.isReadOnly}
                  onChange={(event) => staffLogic.updateForm({ baseSalary: Number(event.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="staff-specialization">Specialization</Label>
                <Input
                  id="staff-specialization"
                  placeholder="e.g., General Dentistry"
                  {...staffPasswordManagerIgnoreProps}
                  value={form.specialization}
                  disabled={staffLogic.isReadOnly}
                  onChange={(event) => staffLogic.updateForm({ specialization: event.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="staff-license-number">License Number</Label>
                <Input
                  id="staff-license-number"
                  placeholder="e.g., DDS-12345"
                  {...staffPasswordManagerIgnoreProps}
                  value={form.licenseNumber}
                  disabled={staffLogic.isReadOnly}
                  onChange={(event) => staffLogic.updateForm({ licenseNumber: event.target.value })}
                />
              </div>
              {!staffLogic.isCreateMode ? (
                <div className="space-y-2">
                  <Label htmlFor="staff-status">Status</Label>
                  <Select
                    value={form.status}
                    onValueChange={(value) => staffLogic.updateForm({ status: value })}
                    disabled={staffLogic.isReadOnly}
                  >
                    <SelectTrigger id="staff-status">
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
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => staffLogic.handleOpenChange(false)} disabled={staffLogic.isSaving}>
              {staffLogic.isReadOnly ? "Close" : "Cancel"}
            </Button>
            {!staffLogic.isReadOnly ? (
              <Button
                onClick={staffLogic.openAddStaffConfirmation}
                disabled={staffLogic.isSaving}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {submitLabel}
              </Button>
            ) : null}
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
