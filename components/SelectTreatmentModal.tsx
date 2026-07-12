"use client";

import type { FormEvent, ReactNode } from "react";
import { ClipboardList, Clock, Loader2, Plus, Tag, X } from "lucide-react";
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
import { OTHER_APPOINTMENT_TYPE_INDEX } from "@/lib/appointment-types";
import { ALLOWED_BOOKING_DURATIONS, normalizeBookingDuration } from "./sharedBookingLogic";

type TreatmentOption = {
  id: number;
  label: string;
  value?: string;
  icon?: string;
  price?: number;
  duration?: number;
};

type SelectTreatmentModalProps = {
  children?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  title?: string;
  description?: string;
  treatments?: TreatmentOption[];
  selectedTreatmentId?: number | null;
  currentTreatmentLabel?: string;
  customTreatmentName?: string;
  selectedPrice?: string | number;
  selectedDuration?: string | number;
  toothNumberEntries?: string[];
  onCustomTreatmentNameChange?: (value: string) => void;
  onSelectedPriceChange?: (value: string) => void;
  onSelectedDurationChange?: (value: string) => void;
  onToothNumberEntriesChange?: (entries: string[]) => void;
  onTreatmentSelect?: (treatment: TreatmentOption) => void;
  onSave?: () => void | Promise<void>;
  onCancel?: () => void;
  isSaving?: boolean;
  canSave?: boolean;
  saveLabel?: string;
};

const formatTreatmentCurrency = (amount?: number) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(Number(amount) || 0);

const sanitizeToothNumberEntry = (value: string) => String(value || "").replace(/\D/g, "");

const preventNonWholeNumberInput = (event: FormEvent<HTMLInputElement>) => {
  const data = (event.nativeEvent as { data?: string }).data;
  if (data && /\D/.test(data)) event.preventDefault();
};

export function SelectTreatmentModal({
  children,
  open,
  onOpenChange,
  title = "Select Treatment",
  description,
  treatments = [],
  selectedTreatmentId,
  currentTreatmentLabel,
  customTreatmentName = "",
  selectedPrice,
  selectedDuration: selectedDurationInput,
  toothNumberEntries,
  onCustomTreatmentNameChange,
  onSelectedPriceChange,
  onSelectedDurationChange,
  onToothNumberEntriesChange,
  onTreatmentSelect,
  onSave,
  onCancel,
  isSaving = false,
  canSave = true,
  saveLabel = "Save Treatment",
}: SelectTreatmentModalProps) {
  if (open === undefined) {
    return (
      <div data-tour-id="booking-treatment-step" className="mx-auto max-w-5xl space-y-2.5 animate-in fade-in slide-in-from-bottom-4 sm:space-y-4">
        {children}
      </div>
    );
  }

  const selectedTreatment = treatments.find((treatment) => treatment.id === selectedTreatmentId) || null;
  const isCustomTreatment = selectedTreatment?.id === OTHER_APPOINTMENT_TYPE_INDEX;
  const selectedPriceValue =
    selectedPrice === undefined || selectedPrice === null
      ? String(selectedTreatment?.price ?? 0)
      : String(selectedPrice);
  const selectedPriceNumber = Math.max(0, Number(selectedPriceValue) || 0);
  const selectedDuration = normalizeBookingDuration(selectedDurationInput ?? selectedTreatment?.duration ?? 30);
  const canEditDuration = Boolean(onSelectedDurationChange && selectedTreatment);
  const showToothNumberField = Boolean(toothNumberEntries || onToothNumberEntriesChange);
  const resolvedToothNumberEntries = toothNumberEntries && toothNumberEntries.length > 0 ? toothNumberEntries : [""];
  const filledToothNumbers = resolvedToothNumberEntries.map((entry) => entry.trim()).filter(Boolean);
  const updateToothNumberEntries = (nextEntries: string[]) => {
    onToothNumberEntriesChange?.(nextEntries.length > 0 ? nextEntries : [""]);
  };
  const handleToothNumberChange = (index: number, value: string) => {
    const sanitizedValue = sanitizeToothNumberEntry(value);
    updateToothNumberEntries(
      resolvedToothNumberEntries.map((entry, entryIndex) =>
        entryIndex === index ? sanitizedValue : entry
      )
    );
  };
  const handleAddToothNumber = () => {
    updateToothNumberEntries([...resolvedToothNumberEntries, ""]);
  };
  const handleRemoveToothNumber = (index: number) => {
    if (resolvedToothNumberEntries.length <= 1) {
      updateToothNumberEntries([""]);
      return;
    }

    updateToothNumberEntries(
      resolvedToothNumberEntries.filter((_, entryIndex) => entryIndex !== index)
    );
  };
  const resolvedCanSave =
    canSave &&
    Boolean(selectedTreatment) &&
    (!isCustomTreatment || customTreatmentName.trim()) &&
    Number.isFinite(Number(selectedPriceValue)) &&
    Number(selectedPriceValue) >= 0 &&
    !isSaving;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-4xl">
        <div className="border-b border-slate-100 px-5 py-5 sm:px-6">
          <DialogHeader className="pr-8">
            <DialogTitle className="text-xl font-black text-slate-950">{title}</DialogTitle>
            {description ? (
              <DialogDescription className="font-semibold text-slate-500">
                {description}
              </DialogDescription>
            ) : null}
          </DialogHeader>
        </div>

        <div data-tour-id="booking-treatment-step" className="max-h-[72dvh] space-y-4 overflow-y-auto bg-slate-50/70 px-4 py-5 custom-scrollbar sm:px-6">
          {currentTreatmentLabel ? (
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-black uppercase tracking-widest text-slate-500">Current Treatment</p>
              <p className="mt-1 text-sm font-black text-slate-950">{currentTreatmentLabel}</p>
            </div>
          ) : null}

          <div className="rounded-xl border border-blue-100 bg-white p-3.5 shadow-sm sm:p-5">
            <Label className="text-sm font-black text-slate-800">Treatment Service</Label>
            <Select
              value={selectedTreatmentId === null || selectedTreatmentId === undefined ? "" : String(selectedTreatmentId)}
              onValueChange={(value) => {
                const treatment = treatments.find((option) => String(option.id) === value);
                if (treatment) onTreatmentSelect?.(treatment);
              }}
            >
              <SelectTrigger className="mt-2.5 h-auto min-h-[4.25rem] rounded-xl border border-blue-100 bg-blue-50/30 px-4 py-3 text-left shadow-none hover:bg-blue-50/60 focus:ring-2 focus:ring-blue-200 sm:min-h-[4.75rem]">
                {selectedTreatment ? (
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-lg shadow-sm ring-1 ring-blue-100">
                      {selectedTreatment.icon || <ClipboardList className="h-5 w-5 text-blue-600" />}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-base font-black text-slate-950">{selectedTreatment.label}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-bold text-slate-500">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5 text-blue-500" />
                          {selectedDuration} mins
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Tag className="h-3.5 w-3.5 text-emerald-500" />
                          {formatTreatmentCurrency(selectedTreatment.price)}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <SelectValue placeholder="Choose a treatment service" />
                )}
              </SelectTrigger>
              <SelectContent className="max-h-[18rem] rounded-2xl border-blue-100 bg-white p-2 shadow-xl">
                {treatments.map((treatment) => {
                  const duration = Number(treatment.duration || 0) || 30;
                  const isOther = treatment.id === OTHER_APPOINTMENT_TYPE_INDEX;

                  return (
                    <SelectItem
                      key={treatment.id}
                      value={String(treatment.id)}
                      className="rounded-xl px-3 py-3 text-slate-900 focus:bg-blue-50"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-base text-blue-700">
                          {treatment.icon || <ClipboardList className="h-4 w-4" />}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-black">{treatment.label}</span>
                          <span className="block truncate text-xs font-semibold text-slate-500">
                            {isOther ? "Custom treatment" : `${duration} mins - ${formatTreatmentCurrency(treatment.price)}`}
                          </span>
                        </span>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {isCustomTreatment ? (
            <div className="space-y-2 rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
              <Label htmlFor="visit-custom-treatment-name" className="text-sm font-black text-slate-800">
                Custom Treatment Name
              </Label>
              <Input
                id="visit-custom-treatment-name"
                value={customTreatmentName}
                onChange={(event) => onCustomTreatmentNameChange?.(event.target.value)}
                placeholder="Type treatment name"
                className="h-12 rounded-xl border-blue-100 bg-blue-50/30 font-bold text-slate-900 shadow-none focus-visible:ring-blue-200"
              />
            </div>
          ) : null}

          {showToothNumberField ? (
            <div className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm sm:p-5">
              <div className="flex items-center justify-between gap-4">
                <Label htmlFor="visit-tooth-number-0" className="text-sm font-black text-slate-800">
                  Tooth No./s
                </Label>
                <div className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xl text-blue-600 sm:flex">
                  #
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2.5">
                {resolvedToothNumberEntries.map((toothNumber, index) => (
                  <div key={index} className="inline-flex h-11 items-center gap-1.5 rounded-xl border border-blue-100 bg-blue-50/80 px-2.5 shadow-sm">
                    <Input
                      id={index === 0 ? "visit-tooth-number-0" : undefined}
                      value={toothNumber}
                      inputMode="numeric"
                      pattern="[0-9]*"
                      onBeforeInput={preventNonWholeNumberInput}
                      onChange={(event) => handleToothNumberChange(index, event.target.value)}
                      placeholder="e.g. 18"
                      disabled={!onToothNumberEntriesChange || isSaving}
                      className="h-8 w-[4.75rem] border-0 bg-transparent px-0 text-center text-sm font-black text-blue-700 shadow-none placeholder:font-medium placeholder:text-blue-300 focus-visible:ring-0 focus-visible:ring-offset-0"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveToothNumber(index)}
                      disabled={!onToothNumberEntriesChange || isSaving}
                      aria-label={`Clear tooth number ${index + 1}`}
                      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={handleAddToothNumber}
                  disabled={!onToothNumberEntriesChange || isSaving}
                  aria-label="Add tooth number"
                  className="flex h-11 w-11 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white text-blue-600 transition-colors hover:border-blue-300 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Plus className="h-5 w-5" />
                </button>
              </div>
              <p className="mt-3 text-xs font-semibold text-slate-500">
                Select one or more teeth for this treatment.
              </p>
            </div>
          ) : null}

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm sm:rounded-2xl lg:grid lg:grid-cols-[0.95fr_1fr]">
            <div className="border-b border-slate-100 p-4 sm:p-5 lg:border-b-0 lg:border-r">
              <div className="flex items-center gap-2 text-sm font-black text-slate-800">
                <ClipboardList className="h-4 w-4 text-blue-600" />
                Treatment Summary
              </div>
              <p className="mt-3 text-xs font-black uppercase tracking-widest text-slate-400">Selected Service</p>
              <p className="mt-1 text-lg font-black text-slate-950">
                {isCustomTreatment ? customTreatmentName.trim() || selectedTreatment?.label || "Custom Treatment" : selectedTreatment?.label || "No treatment selected"}
              </p>

              {showToothNumberField ? (
                <div className="mt-5 border-t border-slate-100 pt-4">
                  <p className="text-xs font-black uppercase tracking-widest text-slate-400">Tooth No./s</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {filledToothNumbers.length > 0 ? (
                      filledToothNumbers.map((toothNumber, index) => (
                        <span key={`${toothNumber}-${index}`} className="inline-flex h-7 items-center rounded-lg border border-blue-100 bg-blue-50 px-2.5 text-xs font-black text-blue-700">
                          Tooth {toothNumber}
                        </span>
                      ))
                    ) : (
                      <span className="text-sm font-semibold text-slate-400">No teeth selected</span>
                    )}
                  </div>
                </div>
              ) : null}

              <div className="mt-5">
                <Label htmlFor="visit-treatment-price" className="text-xs font-black uppercase tracking-widest text-slate-500">
                  Manual Price
                </Label>
                <div className="mt-2 flex items-center rounded-2xl border border-blue-100 bg-blue-50/40 px-3 py-2 focus-within:ring-2 focus-within:ring-blue-200">
                  <span className="shrink-0 text-xl font-black text-blue-600">{"\u20b1"}</span>
                  <Input
                    id="visit-treatment-price"
                    type="number"
                    min={0}
                    step={1}
                    inputMode="decimal"
                    value={selectedPriceValue}
                    onChange={(event) => onSelectedPriceChange?.(event.target.value)}
                    disabled={!onSelectedPriceChange || isSaving}
                    className="h-12 border-0 bg-transparent text-right text-3xl font-black text-blue-600 shadow-none focus-visible:ring-0"
                  />
                </div>
              </div>
            </div>

            <div className="grid content-start gap-3 bg-slate-50/70 p-4 sm:grid-cols-2 sm:p-5">
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-black uppercase tracking-widest text-slate-400">Duration</p>
                <div className="mt-2 flex items-center gap-2 text-lg font-black text-slate-950">
                  <Clock className="h-4 w-4 shrink-0 text-blue-600" />
                  {canEditDuration ? (
                    <Select
                      value={String(selectedDuration)}
                      onValueChange={(value) => onSelectedDurationChange?.(String(normalizeBookingDuration(value)))}
                      disabled={isSaving}
                    >
                      <SelectTrigger className="h-auto min-h-0 border-0 bg-transparent px-0 py-0 text-left text-lg font-black text-slate-950 shadow-none focus:ring-0 focus:ring-offset-0">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        {ALLOWED_BOOKING_DURATIONS.map((duration) => (
                          <SelectItem key={duration} value={String(duration)}>
                            {duration} mins
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <span>{selectedDuration} mins</span>
                  )}
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-black uppercase tracking-widest text-slate-400">Catalog Price</p>
                <p className="mt-2 flex items-center gap-2 text-lg font-black text-slate-950">
                  <Tag className="h-4 w-4 text-emerald-600" />
                  {formatTreatmentCurrency(selectedTreatment?.price)}
                </p>
              </div>
              <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4 sm:col-span-2">
                <p className="text-xs font-black uppercase tracking-widest text-blue-500">Estimated Cost</p>
                <p className="mt-2 text-2xl font-black text-blue-700">{formatTreatmentCurrency(selectedPriceNumber)}</p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="border-t border-slate-100 px-5 py-4 sm:px-6">
          <Button type="button" variant="outline" className="rounded-xl" onClick={onCancel} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            type="button"
            className="rounded-xl bg-blue-600 hover:bg-blue-700"
            onClick={() => void onSave?.()}
            disabled={!resolvedCanSave}
          >
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {isSaving ? "Saving..." : saveLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
