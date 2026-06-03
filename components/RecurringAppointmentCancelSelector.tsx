"use client";

import { useMemo } from "react";
import { CalendarDays, Clock, Link2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { formatBookingRecurringDate, type BookingRecurringDeletionItem } from "./sharedBookingLogic";

export type RecurringAppointmentDeletionItem = BookingRecurringDeletionItem;

type RecurringAppointmentCancelSelectorProps = {
  items: RecurringAppointmentDeletionItem[];
  selectedIds: string[];
  onSelectedIdsChange: (ids: string[]) => void;
  formatTimeTo12h: (time: string) => string;
};

export function RecurringAppointmentCancelSelector({
  items,
  selectedIds,
  onSelectedIdsChange,
  formatTimeTo12h,
}: RecurringAppointmentCancelSelectorProps) {
  const rows = useMemo(() => {
    const seen = new Set<string>();
    return items
      .map((item) => {
        const id = String(item.id || "").trim();
        const date = String(item.date || "").trim();
        const time = String(item.time || "").trim();
        if (!date) return null;

        const rowKey = id ? `appointment:${id}` : `date:${date}:${time || "no-time"}`;
        if (seen.has(rowKey)) return null;
        seen.add(rowKey);

        return {
          id: id || undefined,
          date,
          time: time || null,
          status: String(item.status || "").trim() || null,
          label: formatBookingRecurringDate(date) || date,
          rowKey,
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));
  }, [items]);

  const selectedIdSet = useMemo(() => new Set(selectedIds.map(String)), [selectedIds]);
  const selectedCount = rows.filter((row) => row.id && selectedIdSet.has(row.id)).length;

  if (!rows.length) return null;

  const toggleRow = (itemId: string, checked: boolean) => {
    const next = new Set(selectedIdSet);
    if (checked) next.add(itemId);
    else next.delete(itemId);
    onSelectedIdsChange(Array.from(next));
  };

  return (
    <div className="rounded-[1.5rem] border border-red-100 bg-red-50/60 p-4 text-left">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-red-500 shadow-sm">
            <Link2 className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-black text-gray-950">Linked recurring appointments</p>
            <p className="text-xs font-semibold text-gray-500">Select any linked appointments to cancel too.</p>
          </div>
        </div>
        <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-gray-700 shadow-sm">
          {selectedCount} selected
        </span>
      </div>

      <div className="max-h-56 space-y-2 overflow-auto pr-1">
        {rows.map((item, index) => {
          const isSelected = item.id ? selectedIdSet.has(item.id) : false;
          const timeLabel = item.time ? formatTimeTo12h(item.time) : "";

          return (
            <div
              key={item.rowKey}
              className={`flex items-center gap-3 rounded-2xl border px-3 py-3 transition-colors ${
                isSelected ? "border-red-200 bg-white" : "border-transparent bg-white/70"
              }`}
            >
              <Checkbox
                checked={isSelected}
                disabled={!item.id}
                onCheckedChange={(checked) => {
                  if (item.id) toggleRow(item.id, checked === true);
                }}
                aria-label={`${isSelected ? "Selected" : "Not selected"} ${item.label}`}
                className="h-5 w-5 rounded-md border-gray-300 data-[state=checked]:border-red-600 data-[state=checked]:bg-red-600"
              />

              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-2">
                  <CalendarDays className="h-4 w-4 shrink-0 text-gray-400" />
                  <p className="min-w-0 truncate text-sm font-black text-gray-950">{item.label}</p>
                </div>
                <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold text-gray-500">
                  {timeLabel ? (
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {timeLabel}
                    </span>
                  ) : (
                    <span>Linked appointment {index + 1}</span>
                  )}
                  {item.status ? <span className="capitalize">{item.status}</span> : null}
                </div>
              </div>

              <span className={`shrink-0 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest ${
                isSelected ? "bg-red-100 text-red-600" : "bg-gray-100 text-gray-500"
              }`}>
                {isSelected ? "Cancel" : "Keep"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
