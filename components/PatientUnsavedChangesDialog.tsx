"use client";

import React from "react";
import { ArrowRight, CheckCircle2, FileWarning, Loader2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type PatientChangeMap = Record<string, { old: any; new: any }>;

const summarizeValue = (label: string, value: any) => {
  if (label.toLowerCase().includes("photo")) {
    return value ? "Photo selected" : "No photo";
  }

  if (value === undefined || value === null || value === "") return "Blank";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return Number.isFinite(value) ? value.toLocaleString() : String(value);
  if (Array.isArray(value)) return `${value.length} ${value.length === 1 ? "item" : "items"}`;
  if (typeof value === "object") return "Updated";

  const text = String(value);
  if (text.startsWith("data:image/")) return "Image selected";
  return text.length > 160 ? `${text.slice(0, 157)}...` : text;
};

const normalizeSummary = (label: string, value: any) => summarizeValue(label, value).trim().toLowerCase();

const formatChangeLabel = (label: string) =>
  label.replace(/\b\w+/g, (word) => {
    if (word.length <= 2 && word.toUpperCase() === word) return word;
    return `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`;
  });

export const getVisiblePatientChanges = (changes: PatientChangeMap): PatientChangeMap =>
  Object.fromEntries(
    Object.entries(changes).filter(([field, change]) => normalizeSummary(field, change.old) !== normalizeSummary(field, change.new))
  );

interface PatientUnsavedChangesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  changes: PatientChangeMap;
  primaryLabel: string;
  secondaryLabel: string;
  cancelLabel: string;
  onPrimary: () => Promise<void> | void;
  onSecondary: () => Promise<void> | void;
  onCancel?: () => void;
  loading?: boolean;
}

export default function PatientUnsavedChangesDialog({
  open,
  onOpenChange,
  title,
  description,
  changes,
  primaryLabel,
  secondaryLabel,
  cancelLabel,
  onPrimary,
  onSecondary,
  onCancel,
  loading = false,
}: PatientUnsavedChangesDialogProps) {
  const entries = Object.entries(getVisiblePatientChanges(changes));
  const reviewedLabel = `${entries.length} change${entries.length === 1 ? "" : "s"} reviewed`;

  if (entries.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !loading && onOpenChange(nextOpen)}>
      <DialogContent
        className="max-h-[calc(100dvh-2rem)] w-[min(920px,calc(100vw-2rem))] max-w-none overflow-x-hidden overflow-y-auto rounded-[28px] border border-slate-200 bg-white p-0 shadow-2xl"
        showCloseButton={false}
      >
        <button
          type="button"
          onClick={() => !loading && onOpenChange(false)}
          disabled={loading}
          className="absolute right-8 top-8 z-10 flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 disabled:pointer-events-none disabled:opacity-50"
          aria-label="Close"
        >
          <X className="h-7 w-7" />
        </button>
        <div className="space-y-8 p-6 sm:p-9 lg:p-12">
          <DialogHeader className="grid gap-6 pr-8 text-left sm:grid-cols-[104px_minmax(0,1fr)] sm:items-start">
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-violet-100 text-violet-600">
              <FileWarning className="h-11 w-11" />
            </div>
            <div className="space-y-4">
              <DialogTitle className="text-3xl font-black leading-tight text-slate-950 sm:whitespace-nowrap lg:text-4xl">
                {title}
              </DialogTitle>
              <DialogDescription className="max-w-2xl text-lg font-medium leading-8 text-slate-500 lg:text-xl">
                {description}
              </DialogDescription>
            </div>
          </DialogHeader>

          <div className="inline-flex items-center gap-3 rounded-xl bg-violet-50 px-5 py-3 text-lg font-bold text-violet-600">
            <CheckCircle2 className="h-6 w-6" />
            {reviewedLabel}
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="overflow-x-auto">
              <div className="min-w-[760px]">
                <div className="grid grid-cols-[minmax(320px,1fr)_140px_32px_140px] items-center gap-4 border-b border-slate-200 px-8 py-5 text-sm font-black uppercase tracking-wide text-slate-500">
                  <div>Change</div>
                  <div className="text-center">Before</div>
                  <ArrowRight className="h-4 w-4 justify-self-center text-slate-500" />
                  <div className="text-center">After</div>
                </div>
                <div className="max-h-[min(38vh,430px)] overflow-y-auto px-8 [scrollbar-color:#cbd5e1_transparent] [scrollbar-width:thin]">
                  {entries.map(([field, change]) => (
                    <div
                      key={field}
                      className="grid grid-cols-[minmax(320px,1fr)_140px_32px_140px] items-center gap-4 border-b border-slate-100 py-7 last:border-b-0"
                    >
                      <div className="pr-4 text-lg font-semibold leading-7 text-slate-950">
                        {formatChangeLabel(field)}
                      </div>
                      <div className="inline-flex min-h-11 items-center justify-center rounded-lg bg-slate-50 px-4 text-base font-semibold text-slate-600">
                        <span className="mr-1 text-slate-400">Before:</span>
                        {summarizeValue(field, change.old)}
                      </div>
                      <ArrowRight className="h-5 w-5 justify-self-center text-slate-500" />
                      <div className="inline-flex min-h-11 items-center justify-center rounded-lg bg-violet-50 px-4 text-base font-bold text-violet-600">
                        <span className="mr-1 text-violet-400">After:</span>
                        {summarizeValue(field, change.new)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-5 pt-2 sm:grid-cols-[1fr_1.35fr_1.1fr]">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                onCancel?.();
                onOpenChange(false);
              }}
              disabled={loading}
              className="h-14 rounded-xl border-slate-200 bg-white text-lg font-bold text-slate-700 hover:bg-slate-50"
            >
              {cancelLabel}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onSecondary}
              disabled={loading}
              className="h-14 rounded-xl border-red-200 bg-white text-lg font-bold text-red-500 hover:border-red-300 hover:bg-red-50 hover:text-red-600"
            >
              {secondaryLabel}
            </Button>
            <Button
              type="button"
              variant="brand"
              onClick={onPrimary}
              disabled={loading}
              className="h-14 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-lg font-bold text-white shadow-lg shadow-violet-200 hover:from-violet-700 hover:to-purple-700"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {primaryLabel}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
