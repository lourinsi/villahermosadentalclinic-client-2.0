"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { ClipboardList, Loader2, Plus, Tag, X } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { OTHER_APPOINTMENT_TYPE_INDEX } from "@/lib/appointment-types";
import { getBookingDiscountedPrice, getBookingPriceBeforeDiscount } from "./sharedBookingLogic";
import type { TreatmentSelectionDraft, TreatmentSelectionSection } from "./universalSelectModalDrafts";

type TreatmentOption = {
  id: number;
  label: string;
  value?: string;
  icon?: string;
  price?: number;
};

export type SelectTreatmentModalSection = TreatmentSelectionSection;

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
  discount?: string | number;
  treatmentNotes?: string;
  toothNumberEntries?: string[];
  treatmentSections?: SelectTreatmentModalSection[];
  /** Preferred scalable API: one complete treatment draft, emitted once on Save. */
  draft?: TreatmentSelectionDraft;
  onSaveDraft?: (draft: TreatmentSelectionDraft) => void | Promise<void>;
  onCustomTreatmentNameChange?: (value: string, sectionIndex?: number) => void;
  onSelectedPriceChange?: (value: string, sectionIndex?: number) => void;
  onDiscountChange?: (value: string) => void;
  onTreatmentNotesChange?: (value: string) => void;
  onToothNumberEntriesChange?: (entries: string[], sectionIndex?: number) => void;
  onTreatmentSelect?: (treatment: TreatmentOption, sectionIndex?: number) => void;
  onTreatmentSectionsChange?: (sections: SelectTreatmentModalSection[]) => void;
  allowAddTreatment?: boolean;
  allowRemoveTreatment?: boolean;
  disabledTreatmentIds?: Array<number | string>;
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
  discount = "0",
  treatmentNotes = "",
  toothNumberEntries,
  treatmentSections,
  draft,
  onSaveDraft,
  onCustomTreatmentNameChange,
  onSelectedPriceChange,
  onDiscountChange,
  onTreatmentNotesChange,
  onToothNumberEntriesChange,
  onTreatmentSelect,
  onTreatmentSectionsChange,
  allowAddTreatment = false,
  allowRemoveTreatment = false,
  disabledTreatmentIds,
  onSave,
  onCancel,
  isSaving = false,
  canSave = true,
  saveLabel = "Save Treatment",
}: SelectTreatmentModalProps) {
  const isDraftMode = Boolean(draft && onSaveDraft);
  const [isPriceEditable, setIsPriceEditable] = useState(false);
  const [editingFinalPrice, setEditingFinalPrice] = useState("");
  const [localDraft, setLocalDraft] = useState<TreatmentSelectionDraft>(() => draft || {
    sections: [],
    toothNumberEntries: [""],
    manualPrice: String(selectedPrice ?? "0"),
    discount: String(discount ?? "0"),
    treatmentNotes: treatmentNotes || "",
  });

  const wasOpenRef = useRef(false);
  useEffect(() => {
    const justOpened = Boolean(open) && !wasOpenRef.current;
    wasOpenRef.current = Boolean(open);
    if (!justOpened || !draft) return;
    setLocalDraft({
      sections: draft.sections || [],
      toothNumberEntries: draft.toothNumberEntries?.length ? draft.toothNumberEntries : [""],
      manualPrice: String(draft.manualPrice ?? "0"),
      discount: String(draft.discount ?? "0"),
      treatmentNotes: draft.treatmentNotes || "",
    });
  }, [open, draft]);

  const sections: SelectTreatmentModalSection[] = isDraftMode
    ? localDraft.sections
    :
    Array.isArray(treatmentSections) && treatmentSections.length > 0
      ? treatmentSections
      : [
          {
            selectedTreatmentId,
            currentTreatmentLabel,
            customTreatmentName,
            selectedPrice,
          },
        ];
  const isMultiSectionMode = Array.isArray(treatmentSections);

  const updateSections = (nextSections: SelectTreatmentModalSection[]) => {
    if (isDraftMode) {
      setLocalDraft((current) => ({ ...current, sections: nextSections }));
      return;
    }
    if (onTreatmentSectionsChange) {
      onTreatmentSectionsChange(nextSections);
      return;
    }

    if (!isMultiSectionMode && nextSections.length > 0) {
      const firstSection = nextSections[0];
      onCustomTreatmentNameChange?.(firstSection.customTreatmentName || "");
      onSelectedPriceChange?.(String(firstSection.selectedPrice ?? ""));
      onToothNumberEntriesChange?.(toothNumberEntries || [""]);
      if (firstSection.selectedTreatmentId !== undefined && firstSection.selectedTreatmentId !== null) {
        const treatment = treatments.find((option) => option.id === firstSection.selectedTreatmentId);
        if (treatment) onTreatmentSelect?.(treatment);
      }
    }
  };

  const getSectionLabel = (section: SelectTreatmentModalSection, index: number) => {
    return `Treatment ${index + 1}`;
  };

  const updateSectionValue = (
    sectionIndex: number,
    sectionPatch: Partial<SelectTreatmentModalSection>
  ) => {
    const nextSections = sections.map((section, index) =>
      index === sectionIndex ? { ...section, ...sectionPatch } : section
    );
    updateSections(nextSections);
  };

  const handleSectionTreatmentSelect = (sectionIndex: number, treatment: TreatmentOption) => {
    const defaultPrice = treatment.price ?? 0;
    const nextSections = sections.map((section, index) =>
      index === sectionIndex
        ? {
            ...section,
            selectedTreatmentId: treatment.id,
            selectedPrice: String(Math.max(0, Number(section.selectedPrice ?? defaultPrice) || defaultPrice)),
            customTreatmentName:
              treatment.id === OTHER_APPOINTMENT_TYPE_INDEX
                ? String(section.customTreatmentName || "").trim() || section.currentTreatmentLabel || ""
                : "",
          }
        : section
    );
    updateSections(nextSections);
    onTreatmentSelect?.(treatment, sectionIndex);
  };

  const handleSectionCustomTreatmentNameChange = (sectionIndex: number, value: string) => {
    updateSectionValue(sectionIndex, { customTreatmentName: value });
  };

  const handleSectionSelectedPriceChange = (sectionIndex: number, value: string) => {
    if (isDraftMode) {
      setLocalDraft((current) => ({
        ...current,
        manualPrice: value,
        sections: current.sections.map((section, index) =>
          index === sectionIndex ? { ...section, selectedPrice: value } : section
        ),
      }));
      return;
    }
    updateSectionValue(sectionIndex, { selectedPrice: value });
    onSelectedPriceChange?.(value, sectionIndex);
  };

  const handleAddTreatment = () => {
    if (!allowAddTreatment) return;
    updateSections([
      ...sections,
      {
        selectedTreatmentId: null,
        currentTreatmentLabel: "",
        customTreatmentName: "",
        selectedPrice: "0",
      },
    ]);
  };

  const handleRemoveTreatment = (sectionIndex: number) => {
    if (!allowRemoveTreatment || sections.length <= 1) return;
    updateSections(sections.filter((_, index) => index !== sectionIndex));
  };

  const isSectionValid = (section: SelectTreatmentModalSection) => {
    const treatment = treatments.find((t) => t.id === section.selectedTreatmentId);
    if (!treatment) return false;
    if (treatment.id === OTHER_APPOINTMENT_TYPE_INDEX && !String(section.customTreatmentName || "").trim()) return false;
    const priceValue = section.selectedPrice === undefined || section.selectedPrice === null ? (treatment.price ?? 0) : Number(section.selectedPrice);
    if (!Number.isFinite(priceValue) || priceValue < 0) return false;
    return true;
  };

  const allAssignedSectionsValid = sections
    .filter((section) => section.selectedTreatmentId !== null && section.selectedTreatmentId !== undefined)
    .every(isSectionValid);

  if (open === undefined) {
    return (
      <div data-tour-id="booking-treatment-step" className="mx-auto max-w-5xl space-y-2.5 animate-in fade-in slide-in-from-bottom-4 sm:space-y-4">
        {children}
      </div>
    );
  }

  const getSectionTreatment = (section: SelectTreatmentModalSection) =>
    treatments.find((treatment) => treatment.id === section.selectedTreatmentId) || null;

  const getSectionPriceValue = (section: SelectTreatmentModalSection) =>
    section.selectedPrice === undefined || section.selectedPrice === null
      ? String(getSectionTreatment(section)?.price ?? 0)
      : String(section.selectedPrice);

  const isSectionCustomTreatment = (section: SelectTreatmentModalSection) =>
    getSectionTreatment(section)?.id === OTHER_APPOINTMENT_TYPE_INDEX;

  const activeSection = sections[0] || { selectedPrice: isDraftMode ? localDraft.manualPrice : selectedPrice };
  const selectedTreatment = getSectionTreatment(activeSection);
  const selectedPriceValue = isDraftMode ? localDraft.manualPrice : getSectionPriceValue(activeSection);
  const basePrice = Math.max(0, Number(selectedPriceValue) || 0);
  const currentDiscount = isDraftMode ? localDraft.discount : discount;
  const discountAmount = Math.max(0, Number(currentDiscount) || 0);
  const hasDiscount = discountAmount > 0;
  const discountedPrice = getBookingDiscountedPrice(basePrice, discountAmount);
  const canEditPrice = (isDraftMode || Boolean(onSelectedPriceChange || onTreatmentSectionsChange)) && !isSaving;
  const beginFinalPriceEdit = () => {
    setEditingFinalPrice(String(discountedPrice));
    setIsPriceEditable(true);
  };
  const commitFinalPriceEdit = () => {
    const parsedPrice = Number(editingFinalPrice);
    if (!editingFinalPrice.trim() || !Number.isFinite(parsedPrice) || parsedPrice < 0) {
      setEditingFinalPrice(String(discountedPrice));
    }
    setIsPriceEditable(false);
  };
  const treatmentLabels = sections.map((section) => {
    const sectionTreatment = getSectionTreatment(section);
    const isCustom = sectionTreatment?.id === OTHER_APPOINTMENT_TYPE_INDEX;
    if (isCustom) {
      return section.customTreatmentName?.trim() || sectionTreatment?.label || "Custom Treatment";
    }
    return sectionTreatment?.label || "No treatment selected";
  });
  const resolvedToothNumberEntries = isDraftMode
    ? (localDraft.toothNumberEntries.length > 0 ? localDraft.toothNumberEntries : [""])
    :
    toothNumberEntries && toothNumberEntries.length > 0
      ? toothNumberEntries
      : [""];
  const filledToothNumbers = resolvedToothNumberEntries.map((entry) => entry.trim()).filter(Boolean);
  const isCustomTreatment = isSectionCustomTreatment(activeSection);
  const canEditToothNumbers = isDraftMode || Boolean(onToothNumberEntriesChange || onTreatmentSectionsChange);
  const showToothNumberField = canEditToothNumbers;

  const updateToothNumberEntries = (nextEntries: string[]) => {
    const normalizedEntries = nextEntries.length > 0 ? nextEntries : [""];

    if (isDraftMode) {
      setLocalDraft((current) => ({ ...current, toothNumberEntries: normalizedEntries }));
      return;
    }

    if (onToothNumberEntriesChange) {
      onToothNumberEntriesChange(normalizedEntries);
    }
  };

  const handleToothNumberChange = (entryIndex: number, value: string) => {
    if (!canEditToothNumbers) return;
    const sanitizedValue = sanitizeToothNumberEntry(value);
    const nextEntries = resolvedToothNumberEntries.map((entry, currentIndex) =>
      currentIndex === entryIndex ? sanitizedValue : entry
    );
    updateToothNumberEntries(nextEntries);
  };

  const handleAddToothNumber = () => {
    if (!canEditToothNumbers) return;
    updateToothNumberEntries([...resolvedToothNumberEntries, ""]);
  };

  const handleRemoveToothNumber = (entryIndex: number) => {
    if (!canEditToothNumbers) return;
    const currentEntries = resolvedToothNumberEntries;
    if (currentEntries.length <= 1) {
      updateToothNumberEntries([""]);
      return;
    }

    const nextEntries = currentEntries.filter((_, currentIndex) => currentIndex !== entryIndex);
    updateToothNumberEntries(nextEntries);
  };

  const resolvedCanSave =
    canSave &&
    allAssignedSectionsValid &&
    !isSaving;

  const unassignedTreatmentCount = sections.filter((section) => !section.selectedTreatmentId).length;
  const submitButtonTitle = unassignedTreatmentCount > 0
    ? `${unassignedTreatmentCount} unassigned treatment${unassignedTreatmentCount === 1 ? "" : "s"}`
    : undefined;

  const handleSave = () => {
    const savedSections = sections.filter((section) => section.selectedTreatmentId !== null && section.selectedTreatmentId !== undefined);
    if (isDraftMode) {
      void onSaveDraft?.({
        ...localDraft,
        sections: savedSections,
        manualPrice: selectedPriceValue,
      });
      return;
    }
    if (isMultiSectionMode && onTreatmentSectionsChange) {
      onTreatmentSectionsChange(savedSections);
    }
    void onSave?.();
  };
  const hasTreatmentSidebar = isDraftMode || Boolean(onDiscountChange || onTreatmentNotesChange);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="w-[calc(100vw-1.25rem)] sm:w-full sm:max-w-4xl overflow-hidden rounded-[2rem] border border-gray-100 bg-white p-0 shadow-2xl"
      >
        {/* Universal icon header */}
        <DialogHeader className="border-b border-gray-100 px-5 pb-5 pt-5 text-left sm:px-7 sm:pt-7">
          <div className="flex items-center gap-5">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[1.25rem] bg-blue-600 text-white shadow-xl shadow-blue-100 ring-4 ring-blue-50">
              <ClipboardList className="h-7 w-7" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="truncate text-2xl font-black tracking-tight text-gray-900">
                {title}
              </DialogTitle>
              {description ? (
                <DialogDescription className="mt-1 text-sm font-bold text-gray-400">
                  {description}
                </DialogDescription>
              ) : null}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onCancel ? onCancel() : onOpenChange?.(false)}
              disabled={isSaving}
              className="h-10 w-10 shrink-0 rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              aria-label="Close treatment modal"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </DialogHeader>

        <div data-tour-id="booking-treatment-step" className="max-h-[72dvh] space-y-4 overflow-y-auto bg-gray-50/70 px-5 py-6 custom-scrollbar sm:px-7">
          {sections.map((section, sectionIndex) => {
            const sectionTreatment = getSectionTreatment(section);
            const sectionIsCustomTreatment = isSectionCustomTreatment(section);

            return (
              <div key={sectionIndex} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
                <div className="flex items-center justify-between gap-3 border-b border-gray-100 pb-3">
                  <div>
                    <p className="text-sm font-black text-gray-700">
                      {getSectionLabel(section, sectionIndex)}
                    </p>
                  </div>
                  {allowRemoveTreatment && sections.length > 1 ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveTreatment(sectionIndex)}
                      disabled={isSaving}
                      className="text-red-500 hover:bg-red-50"
                    >
                      Remove
                    </Button>
                  ) : null}
                </div>

                <Select
                      value={section.selectedTreatmentId === null || section.selectedTreatmentId === undefined ? "" : String(section.selectedTreatmentId)}
                      onValueChange={(value) => {
                        const treatment = treatments.find((option) => String(option.id) === value);
                        if (treatment) handleSectionTreatmentSelect(sectionIndex, treatment);
                      }}
                    >
                      <SelectTrigger className="mt-3 h-auto min-h-[4.25rem] rounded-xl border border-blue-100 bg-blue-50/30 px-3 py-2.5 text-left shadow-none hover:bg-blue-50/60 focus:ring-2 focus:ring-blue-200 focus:ring-offset-0 sm:min-h-[5.25rem] sm:rounded-2xl sm:px-4 sm:py-3">
                        {sectionTreatment ? (
                          <div className="flex min-w-0 items-center gap-3 pr-2">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-lg text-blue-600 shadow-inner sm:h-12 sm:w-12 sm:text-xl">
                              {sectionTreatment.icon || <ClipboardList className="h-5 w-5 text-blue-600" />}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-black text-gray-900 sm:text-base">{sectionTreatment.label}</p>
                              <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs font-semibold text-gray-500">
                                <span className="inline-flex items-center gap-1.5">
                                  <Tag className="h-4 w-4 text-blue-600" />
                                  <span className="text-[0.72em]">{"\u20b1"}</span>{Number(sectionTreatment.price || 0).toLocaleString()}
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
                          const isOther = treatment.id === OTHER_APPOINTMENT_TYPE_INDEX;
                          const isSelectedByOtherSection = sections.some(
                            (section, currentIndex) =>
                              currentIndex !== sectionIndex &&
                              section.selectedTreatmentId !== undefined &&
                              section.selectedTreatmentId !== null &&
                              section.selectedTreatmentId === treatment.id
                          );
                          const isDisabled =
                            disabledTreatmentIds?.includes(treatment.id) ||
                            disabledTreatmentIds?.includes(String(treatment.id)) ||
                            isSelectedByOtherSection;

                          return (
                            <SelectItem
                              key={treatment.id}
                              value={String(treatment.id)}
                              className={`rounded-xl px-3 py-3 text-slate-900 focus:bg-blue-50 ${isDisabled ? "opacity-50 bg-slate-100 text-slate-500" : "hover:bg-blue-50"}`}
                              disabled={isDisabled}
                            >
                              <div className="flex min-w-0 items-center gap-3">
                                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-base text-blue-700">
                                  {treatment.icon || <ClipboardList className="h-4 w-4" />}
                                </span>
                                <span className="min-w-0">
                                  <span className="block truncate text-sm font-black">{treatment.label}</span>
                                  <span className="block truncate text-xs font-semibold text-slate-500">
                                    {isOther ? "Custom treatment" : formatTreatmentCurrency(treatment.price)}
                                  </span>
                                </span>
                              </div>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>

                  {sectionIsCustomTreatment ? (
                    <div className="space-y-2 rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
                      <Label htmlFor={`visit-custom-treatment-name-${sectionIndex}`} className="text-sm font-black text-slate-800">
                        Custom Treatment Name
                      </Label>
                      <Input
                        id={`visit-custom-treatment-name-${sectionIndex}`}
                        value={section.customTreatmentName || ""}
                        onChange={(event) => handleSectionCustomTreatmentNameChange(sectionIndex, event.target.value)}
                        placeholder="Type treatment name"
                        className="h-12 rounded-xl border-blue-100 bg-blue-50/30 font-bold text-slate-900 shadow-none focus-visible:ring-blue-200"
                      />
                    </div>
                  ) : null}

              </div>
            );
          })}
          {allowAddTreatment ? (
            <div className="rounded-xl border border-dashed border-blue-100 bg-white p-4 text-center shadow-sm">
              <Button type="button" variant="outline" className="rounded-xl" onClick={handleAddTreatment} disabled={isSaving}>
                <Plus className="mr-2 h-4 w-4" />
                Add treatment
              </Button>
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
                      id={index === 0 ? `visit-tooth-number-${index}` : undefined}
                      value={toothNumber}
                      inputMode="numeric"
                      pattern="[0-9]*"
                      onBeforeInput={preventNonWholeNumberInput}
                      onChange={(event) => handleToothNumberChange(index, event.target.value)}
                      placeholder="e.g. 18"
                      disabled={!canEditToothNumbers || isSaving}
                      className="h-8 w-[4.75rem] border-0 bg-transparent px-0 text-center text-sm font-black text-blue-700 shadow-none placeholder:font-medium placeholder:text-blue-300 focus-visible:ring-0 focus-visible:ring-offset-0"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveToothNumber(index)}
                      disabled={!canEditToothNumbers || isSaving}
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
                  disabled={!canEditToothNumbers || isSaving}
                  aria-label="Add tooth number"
                  className="flex h-11 w-11 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white text-blue-600 transition-colors hover:border-blue-300 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Plus className="h-5 w-5" />
                </button>
              </div>
              <p className="mt-3 text-xs font-semibold text-slate-500">
                Select one or more teeth for this appointment.
              </p>
            </div>
          ) : null}



          <div className="overflow-hidden rounded-xl border border-gray-200/80 bg-white shadow-sm sm:rounded-2xl lg:grid lg:grid-cols-[0.95fr_1fr]">
            <div className={`relative overflow-hidden p-3.5 sm:p-5 ${hasTreatmentSidebar ? "border-b border-gray-200/80 lg:border-b-0 lg:border-r" : ""}`}>
              <div className="relative z-10 flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                  <ClipboardList className="h-[18px] w-[18px]" />
                </div>
                <h3 className="text-base font-black text-gray-900">Treatment Summary</h3>
              </div>

              <div className="relative z-10 mt-3 grid gap-3 border-t border-gray-200 pt-3 sm:mt-4 sm:grid-cols-2 sm:gap-4 sm:pt-4 lg:grid-cols-1">
                <div>
                  <p className="text-xs font-semibold text-gray-500">Service</p>
                  <p className="mt-1 text-sm font-black text-gray-900">{treatmentLabels.join(", ")}</p>
                </div>

                <div>
                  <p className="text-xs font-semibold text-gray-500">Tooth No./s</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {filledToothNumbers.length > 0 ? (
                      filledToothNumbers.map((toothNumber, index) => (
                        <span key={`${toothNumber}-${index}`} className="inline-flex h-7 items-center rounded-lg border border-blue-100 bg-blue-50 px-2.5 text-xs font-black text-blue-700">
                          Tooth {toothNumber}
                        </span>
                      ))
                    ) : (
                      <span className="text-sm font-semibold text-gray-400">No teeth selected</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="relative z-10 mt-3 border-t border-dashed border-gray-200 pt-3 sm:mt-4 sm:pt-4">
                {hasDiscount && (
                  <p className="mt-2 text-sm font-bold text-gray-400 line-through">&#8369;{basePrice.toLocaleString()}</p>
                )}
                <div className="mt-1.5 flex items-center text-blue-600">
                  <span className="mr-2 text-2xl font-black sm:text-3xl">&#8369;</span>
                  {isPriceEditable && canEditPrice ? (
                    <input
                      id="visit-treatment-price"
                      type="number"
                      min={0}
                      step={1}
                      inputMode="decimal"
                      value={editingFinalPrice}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(event) => {
                        const nextFinalPrice = event.target.value;
                        setEditingFinalPrice(nextFinalPrice);
                        if (!nextFinalPrice.trim()) return;

                        const parsedPrice = Number(nextFinalPrice);
                        if (!Number.isFinite(parsedPrice) || parsedPrice < 0) return;

                        const nextBasePrice = String(getBookingPriceBeforeDiscount(parsedPrice, discountAmount));
                        if (isDraftMode || isMultiSectionMode) {
                          handleSectionSelectedPriceChange(0, nextBasePrice);
                        } else {
                          onSelectedPriceChange?.(nextBasePrice);
                        }
                      }}
                      onFocus={(event) => event.currentTarget.select()}
                      onBlur={commitFinalPriceEdit}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") event.currentTarget.blur();
                        if (event.key === "Escape") {
                          setEditingFinalPrice(String(discountedPrice));
                          setIsPriceEditable(false);
                        }
                      }}
                      className="w-[130px] appearance-none border-b-2 border-blue-200 bg-transparent p-0 text-3xl font-black text-blue-600 outline-none ring-0 transition-all placeholder:text-blue-200 focus:border-blue-500 sm:w-[160px] sm:text-4xl [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                      placeholder={String(discountedPrice)}
                      autoFocus
                    />
                  ) : canEditPrice ? (
                    <button
                      type="button"
                      onClick={beginFinalPriceEdit}
                      className="cursor-text text-left text-3xl font-black tracking-tight text-blue-600 underline decoration-blue-200 decoration-2 underline-offset-8 transition hover:decoration-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-4 sm:text-4xl"
                      aria-label={`Edit final treatment price, currently ${discountedPrice}`}
                    >
                      {discountedPrice.toLocaleString()}
                    </button>
                  ) : (
                    <span className="text-3xl font-black tracking-tight sm:text-4xl">
                      {discountedPrice.toLocaleString()}
                    </span>
                  )}
                </div>
              </div>

              <div className="pointer-events-none absolute bottom-4 right-4 hidden h-16 w-16 items-center justify-center rounded-full bg-blue-50 text-3xl text-blue-600 md:flex">
                🦷
              </div>
            </div>

            {hasTreatmentSidebar ? (
              <div className="space-y-3 bg-slate-50/70 p-4 sm:p-5">
                <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:rounded-2xl">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                      <Tag className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <Label htmlFor="visit-treatment-discount" className="text-xs font-semibold text-slate-500">Discount</Label>
                      <div className="mt-0.5 flex items-center gap-2">
                        <span className="text-sm font-black text-slate-950">₱</span>
                        <Input
                          id="visit-treatment-discount"
                          type="number"
                          min={0}
                          value={isDraftMode ? localDraft.discount : discount}
                          onChange={(event) => {
                            if (isDraftMode) {
                              setLocalDraft((current) => ({ ...current, discount: event.target.value }));
                            } else {
                              onDiscountChange?.(event.target.value);
                            }
                          }}
                          disabled={!(isDraftMode || onDiscountChange) || isSaving}
                          className="h-7 flex-1 border-0 bg-transparent px-0 text-lg font-black text-slate-950 shadow-none focus-visible:ring-0"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <Label htmlFor="visit-treatment-notes" className="text-sm font-black text-slate-800">
                    Treatment Notes <span className="font-semibold text-slate-500">(Optional)</span>
                  </Label>
                  <div className="relative mt-2">
                    <Textarea
                      id="visit-treatment-notes"
                      value={isDraftMode ? localDraft.treatmentNotes : treatmentNotes}
                      onChange={(event) => {
                        if (isDraftMode) {
                          setLocalDraft((current) => ({ ...current, treatmentNotes: event.target.value }));
                        } else {
                          onTreatmentNotesChange?.(event.target.value);
                        }
                      }}
                      disabled={!(isDraftMode || onTreatmentNotesChange) || isSaving}
                      maxLength={250}
                      placeholder="Add any notes or special instructions..."
                      className="min-h-[5.75rem] resize-none rounded-xl border-slate-200 bg-white px-3 py-3 pr-14 text-sm font-semibold text-slate-700 shadow-sm focus-visible:ring-2 focus-visible:ring-blue-200 sm:rounded-2xl"
                    />
                    <span className="pointer-events-none absolute bottom-3 right-4 text-xs font-semibold text-slate-500">
                      {(isDraftMode ? localDraft.treatmentNotes : treatmentNotes).length} / 250
                    </span>
                  </div>
                </div>
              </div>
            ) : null}

          </div>
        </div>

        <DialogFooter className="gap-3 border-t border-gray-100 bg-gray-50/70 px-5 py-4 sm:px-7">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isSaving}
            className="h-12 flex-1 rounded-2xl border-gray-200 bg-white text-sm font-black text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="h-12 flex-1 rounded-2xl bg-blue-600 text-sm font-black text-white shadow-lg shadow-blue-100 hover:bg-blue-700"
            onClick={handleSave}
            disabled={!resolvedCanSave}
            title={submitButtonTitle}
          >
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {isSaving ? "Saving..." : saveLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
