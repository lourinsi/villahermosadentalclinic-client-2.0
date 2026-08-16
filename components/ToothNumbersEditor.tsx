"use client";

import type { FormEvent } from "react";
import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Plus, X } from "lucide-react";
import {
  getBookingToothNumberEntries,
  normalizeBookingToothNumbers,
} from "./sharedBookingLogic";

const sanitizeToothNumberEntry = (value: string) => String(value || "").replace(/\D/g, "");

const preventNonWholeNumberInput = (event: FormEvent<HTMLInputElement>) => {
  const data = (event.nativeEvent as { data?: string }).data;
  if (data && /\D/.test(data)) event.preventDefault();
};

export interface ToothNumbersEditorProps {
  value?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  className?: string;
  size?: "xs" | "sm" | "md";
  autoFocusFirst?: boolean;
}

export function ToothNumbersEditor({
  value = "",
  onChange,
  disabled = false,
  className = "",
  size = "md",
  autoFocusFirst = false,
}: ToothNumbersEditorProps) {
  const [entries, setEntries] = useState<string[]>(() =>
    getBookingToothNumberEntries(value)
  );

  useEffect(() => {
    // Only update entries if value prop changes and does not match normalized current entries
    const currentNormalized = normalizeBookingToothNumbers(entries);
    const propNormalized = normalizeBookingToothNumbers(getBookingToothNumberEntries(value));
    if (currentNormalized !== propNormalized) {
      setEntries(getBookingToothNumberEntries(value));
    }
  }, [value]);

  const updateEntries = (nextEntries: string[]) => {
    const normalizedEntries = nextEntries.length > 0 ? nextEntries : [""];
    setEntries(normalizedEntries);
    const normalizedString = normalizeBookingToothNumbers(normalizedEntries);
    onChange?.(normalizedString);
  };

  const handleEntryChange = (index: number, val: string) => {
    if (disabled) return;
    const sanitized = sanitizeToothNumberEntry(val);
    const next = entries.map((item, idx) => (idx === index ? sanitized : item));
    updateEntries(next);
  };

  const handleAddBox = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
    setEntries((prev) => [...prev, ""]);
  };

  const handleRemoveBox = (index: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
    if (entries.length <= 1) {
      updateEntries([""]);
      return;
    }
    const next = entries.filter((_, idx) => idx !== index);
    updateEntries(next);
  };

  const isXs = size === "xs";
  const isSmall = size === "sm";

  const boxHeight = isXs ? "h-7" : isSmall ? "h-8" : "h-9.5";
  const inputWidth = isXs ? "w-8" : isSmall ? "w-10" : "w-14";
  const inputFont = isXs ? "text-xs font-semibold" : isSmall ? "text-xs font-bold" : "text-sm font-bold";
  const addBoxSize = isXs ? "h-7 w-7" : isSmall ? "h-8 w-8" : "h-9.5 w-9.5";
  const iconSize = isXs ? "h-3.5 w-3.5" : isSmall ? "h-4 w-4" : "h-4.5 w-4.5";
  const deleteBtnSize = isXs ? "h-4 w-4" : isSmall ? "h-4.5 w-4.5" : "h-5 w-5";
  const deleteIconSize = isXs ? "h-2.5 w-2.5" : isSmall ? "h-2.5 w-2.5" : "h-3 w-3";
  const boxPadding = isXs ? "px-1.5" : isSmall ? "px-2" : "px-2.5";
  const containerGap = isXs ? "gap-1" : isSmall ? "gap-1.5" : "gap-2";
  const innerGap = isXs ? "gap-1" : "gap-1.5";

  return (
    <div
      className={`flex flex-wrap items-center ${containerGap} ${className}`}
      onClick={(e) => e.stopPropagation()}
    >
      {entries.map((entry, index) => (
        <div
          key={index}
          className={`inline-flex ${boxHeight} items-center ${innerGap} rounded-lg border border-blue-200/80 bg-blue-50/80 ${boxPadding} shadow-xs transition-colors focus-within:border-blue-400 focus-within:bg-blue-50 focus-within:ring-1 focus-within:ring-blue-400/30`}
        >
          <Input
            id={index === 0 ? "tooth-number-editor-input-0" : undefined}
            value={entry}
            inputMode="numeric"
            pattern="[0-9]*"
            autoFocus={autoFocusFirst && index === 0}
            onBeforeInput={preventNonWholeNumberInput}
            onChange={(e) => handleEntryChange(index, e.target.value)}
            placeholder="#"
            disabled={disabled}
            className={`h-full ${inputWidth} border-0 bg-transparent px-0 text-center ${inputFont} text-blue-700 shadow-none placeholder:font-medium placeholder:text-blue-300 focus-visible:ring-0 focus-visible:ring-offset-0`}
          />
          <button
            type="button"
            onClick={(e) => handleRemoveBox(index, e)}
            disabled={disabled}
            aria-label={`Clear tooth number ${index + 1}`}
            className={`flex ${deleteBtnSize} shrink-0 items-center justify-center rounded-full bg-blue-200/60 text-blue-600 transition-colors hover:bg-rose-100 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-50`}
          >
            <X className={deleteIconSize} />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={handleAddBox}
        disabled={disabled}
        aria-label="Add tooth number"
        className={`flex ${addBoxSize} shrink-0 items-center justify-center rounded-lg border border-dashed border-blue-300 bg-white text-blue-600 transition-colors hover:border-blue-400 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50`}
      >
        <Plus className={iconSize} />
      </button>
    </div>
  );
}
