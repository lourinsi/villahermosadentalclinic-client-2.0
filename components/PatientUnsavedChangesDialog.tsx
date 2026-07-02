"use client";

import React from "react";
import { Loader2, Save, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
  const entries = Object.entries(changes);

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !loading && onOpenChange(nextOpen)}>
      <DialogContent className="max-h-[88vh] max-w-2xl overflow-hidden p-0" showCloseButton={!loading}>
        <DialogHeader className="border-b border-slate-100 px-6 py-5">
          <DialogTitle className="text-xl font-bold text-slate-900">{title}</DialogTitle>
          <DialogDescription className="text-sm font-medium text-slate-500">
            {description}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[52vh] overflow-y-auto px-6 py-4">
          {entries.length > 0 ? (
            <div className="space-y-3">
              {entries.map(([field, change]) => (
                <div key={field} className="rounded-lg border border-slate-200 bg-slate-50/70 p-3">
                  <div className="text-xs font-black uppercase tracking-wide text-slate-500">{field}</div>
                  <div className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
                    <div className="rounded-md bg-white p-2 ring-1 ring-slate-200">
                      <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Before</div>
                      <div className="mt-1 break-words font-semibold text-slate-600">
                        {summarizeValue(field, change.old)}
                      </div>
                    </div>
                    <div className="rounded-md bg-white p-2 ring-1 ring-violet-100">
                      <div className="text-[10px] font-bold uppercase tracking-wide text-violet-500">After</div>
                      <div className="mt-1 break-words font-semibold text-slate-900">
                        {summarizeValue(field, change.new)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm font-semibold text-slate-500">
              Unsaved patient changes are pending.
            </div>
          )}
        </div>

        <DialogFooter className="border-t border-slate-100 px-6 py-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              onCancel?.();
              onOpenChange(false);
            }}
            disabled={loading}
            className="gap-2"
          >
            <X className="h-4 w-4" />
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={onSecondary}
            disabled={loading}
            className="gap-2"
          >
            <Trash2 className="h-4 w-4" />
            {secondaryLabel}
          </Button>
          <Button type="button" variant="brand" onClick={onPrimary} disabled={loading} className="gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {primaryLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
