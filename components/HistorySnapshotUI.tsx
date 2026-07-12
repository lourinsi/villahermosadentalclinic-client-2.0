"use client";

import { AlertTriangle, ChevronRight, History } from "lucide-react";
import { Button } from "./ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

export type CurrentFieldChange = { title: string };
export type SnapshotAuditChange = {
  field: string;
  previousValue: string;
  snapshotValue: string;
};

export const createCurrentFieldChange = (
  fieldName: string,
  snapshotValue: unknown,
  currentValue: unknown,
  snapshotLabel?: string,
  currentLabel?: string,
  normalize: (value: unknown) => string = (value) => String(value ?? "").trim().toLowerCase()
): CurrentFieldChange | null => {
  if (currentValue === undefined || normalize(snapshotValue) === normalize(currentValue)) return null;
  return { title: `Current ${fieldName}: ${currentLabel || String(currentValue ?? "").trim() || "Not set"}.` };
};

export const CurrentChangeIndicator = ({ change }: { change?: CurrentFieldChange | null }) => {
  if (!change) return null;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex h-5 w-5 shrink-0 cursor-help items-center justify-center rounded-full bg-amber-100 text-amber-700 ring-1 ring-amber-200" aria-label={change.title} title={change.title}>
          <AlertTriangle className="h-3.5 w-3.5" />
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[260px]">{change.title}</TooltipContent>
    </Tooltip>
  );
};

export function DetailedAuditHistory({ changes, expanded, onExpandedChange, id = "detailed-audit-history-content" }: {
  changes: SnapshotAuditChange[];
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  id?: string;
}) {
  return (
    <section className="overflow-hidden rounded-[1.35rem] border border-slate-200 bg-white shadow-[0_12px_35px_rgba(15,23,42,0.06)]">
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-700 ring-1 ring-violet-100"><History className="h-4 w-4" /></span>
          <div className="min-w-0">
            <h3 className="text-sm font-black uppercase tracking-wide text-violet-700">Detailed Audit History</h3>
            <p className="mt-1 text-xs font-semibold text-slate-500 sm:text-sm">{changes.length === 1 ? "1 change in this snapshot" : `${changes.length} changes in this snapshot`}</p>
          </div>
        </div>
        <Button type="button" variant="ghost" aria-expanded={expanded} aria-controls={id} onClick={() => onExpandedChange(!expanded)} className="h-9 self-start rounded-full px-3 text-xs font-black text-violet-700 hover:bg-violet-50 hover:text-violet-800 sm:self-auto sm:text-sm">
          {expanded ? "Show less" : "Show more"}<ChevronRight className={`ml-1.5 h-4 w-4 transition-transform ${expanded ? "rotate-90" : ""}`} />
        </Button>
      </div>
      {expanded ? (
        <div id={id} className="border-t border-slate-100 bg-violet-50/35 p-3 sm:p-4">
          {changes.length ? <div className="space-y-2">{changes.map((change) => (
            <div key={change.field} className="grid min-w-0 gap-2 rounded-xl border border-violet-100/80 bg-white/85 px-3 py-3 sm:grid-cols-[minmax(8rem,0.7fr)_minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-center sm:gap-3 sm:px-4">
              <p className="break-words text-sm font-black text-slate-600">{change.field}</p>
              <p className="min-w-0 whitespace-pre-wrap break-words text-sm font-semibold leading-5 text-slate-500">{change.previousValue}</p>
              <ChevronRight className="h-4 w-4 shrink-0 rotate-90 text-violet-400 sm:rotate-0" aria-hidden="true" />
              <p className="min-w-0 whitespace-pre-wrap break-words text-sm font-black leading-5 text-violet-800">{change.snapshotValue}</p>
            </div>
          ))}</div> : <p className="rounded-xl border border-violet-100/80 bg-white/85 px-4 py-3 text-sm font-semibold italic text-slate-500">No detailed changes were recorded for this snapshot.</p>}
        </div>
      ) : null}
    </section>
  );
}
