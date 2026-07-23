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
  size?: "sm" | "md";
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

  const isSmall = size === "sm";
  const boxHeight = isSmall ? "h-9" : "h-11";
  const inputWidth = isSmall ? "w-[3.75rem]" : "w-[4.75rem]";
  const inputFont = isSmall ? "text-xs font-bold" : "text-sm font-black";
  const addBoxSize = isSmall ? "h-9 w-9" : "h-11 w-11";
  const iconSize = isSmall ? "h-4 w-4" : "h-5 w-5";

  return (
    <div
      className={`flex flex-wrap items-center gap-2 ${className}`}
      onClick={(e) => e.stopPropagation()}
    >
      {entries.map((entry, index) => (
        <div
          key={index}
          className={`inline-flex ${boxHeight} items-center gap-1.5 rounded-xl border border-blue-100 bg-blue-50/80 px-2 shadow-sm transition-colors focus-within:border-blue-300 focus-within:bg-blue-50`}
        >
          <Input
            id={index === 0 ? "tooth-number-editor-input-0" : undefined}
            value={entry}
            inputMode="numeric"
            pattern="[0-9]*"
            autoFocus={autoFocusFirst && index === 0}
            onBeforeInput={preventNonWholeNumberInput}
            onChange={(e) => handleEntryChange(index, e.target.value)}
            placeholder="e.g. 18"
            disabled={disabled}
            className={`h-7 ${inputWidth} border-0 bg-transparent px-0 text-center ${inputFont} text-blue-700 shadow-none placeholder:font-medium placeholder:text-blue-300 focus-visible:ring-0 focus-visible:ring-offset-0`}
          />
          <button
            type="button"
            onClick={(e) => handleRemoveBox(index, e)}
            disabled={disabled}
            aria-label={`Clear tooth number ${index + 1}`}
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={handleAddBox}
        disabled={disabled}
        aria-label="Add tooth number"
        className={`flex ${addBoxSize} items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white text-blue-600 transition-colors hover:border-blue-300 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50`}
      >
        <Plus className={iconSize} />
      </button>
    </div>
  );
}
