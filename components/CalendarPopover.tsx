"use client";

import React, { useState, useRef, useEffect } from "react";
import { DateRange } from "react-day-picker";
import { Button } from "./ui/button";
import { Calendar } from "./ui/calendar";
import { Label } from "./ui/label";
import { Keyboard } from "lucide-react";

import ViewMode from "./viewMode";

type Props = {
  viewMode: ViewMode;
  setViewMode: (m: ViewMode) => void;
  selectedDate: Date;
  setSelectedDate: (d: Date) => void;
  dateRange?: DateRange | undefined;
  setDateRange?: (r?: DateRange) => void;
  // includeCart removed - cart view is handled on its own page
  onClose?: () => void;
};

export default function CalendarPopover({ viewMode, setViewMode, selectedDate, setSelectedDate, dateRange, setDateRange, onClose }: Props) {
  const modes = (["day", "week", "month", "custom", "all"] as const);

  const [activeRangeType, setActiveRangeType] = useState<"from" | "to">("from");
  const calendarRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // If the popover is opened to custom mode, focus the calendar container
    if (viewMode === 'custom' && calendarRef.current) {
      // small delay to allow animation/DOM placement
      const t = setTimeout(() => {
        try { calendarRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {}
        try { calendarRef.current?.focus(); } catch (e) {}
      }, 80);
      return () => clearTimeout(t);
    }
    return;
  }, [viewMode]);

  return (
    <div className={`bg-white rounded-2xl overflow-hidden ${viewMode === "custom" ? "min-w-[700px]" : "min-w-[320px]"}`}>
      <div className="p-4">
        <div className="space-y-2">
          <Label className="text-xs font-bold uppercase tracking-wider text-gray-400">View Mode</Label>
          <div className="grid grid-cols-2 gap-2">
            {modes.map((mode) => (
              <Button
                key={mode}
                variant={viewMode === mode ? "brand" : "outline"}
                size="sm"
                className="h-9 capitalize font-medium flex items-center justify-center gap-2"
                onClick={() => {
                  setViewMode(mode);
                  // If selecting custom range, keep the popover open so user can pick start/end dates.
                  if (mode !== 'custom' && onClose) onClose();
                }}
              >
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {viewMode === 'custom' ? (
        <div className="flex flex-col">
          {/* Header: Range Summary and Inputs */}
          <div className="p-6 border-b flex items-start justify-between bg-white">
            <div className="space-y-1">
              <h3 className="text-2xl font-bold text-gray-900">
                {dateRange?.from && dateRange?.to ? (
                  <>{Math.ceil(Math.abs(dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24)) + 1} days range</>
                ) : (
                  "Select dates"
                )}
              </h3>
              <p className="text-sm text-gray-500 font-medium">
                {dateRange?.from ? (
                  <>
                    {dateRange.from.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    {dateRange.to && ` - ${dateRange.to.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`}
                  </>
                ) : (
                  "Choose your appointment period"
                )}
              </p>
            </div>

            <div className="flex items-center gap-0 border rounded-xl overflow-hidden shadow-sm">
              <button 
                onClick={() => setActiveRangeType("from")}
                className={`px-4 py-2 border-r bg-white min-w-[140px] text-left transition-colors ${activeRangeType === "from" ? "ring-2 ring-inset ring-violet-600" : "hover:bg-gray-50"}`}
              >
                <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-0.5 cursor-pointer">Start Dates</div>
                <div className="text-sm font-semibold text-gray-700">
                  {dateRange?.from ? dateRange.from.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' }) : "MM/DD/YYYY"}
                </div>
              </button>
              <button 
                onClick={() => setActiveRangeType("to")}
                className={`px-4 py-2 bg-white min-w-[140px] text-left transition-colors ${activeRangeType === "to" ? "ring-2 ring-inset ring-violet-600" : "hover:bg-gray-50"}`}
              >
                <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-0.5 cursor-pointer">End Date</div>
                <div className="text-sm font-semibold text-gray-700">
                  {dateRange?.to ? dateRange.to.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' }) : "MM/DD/YYYY"}
                </div>
              </button>
            </div>
          </div>

          {/* View Mode Switcher removed to avoid duplication with the main view mode controls */}

          {/* Calendar Content */}
          <div ref={calendarRef} tabIndex={-1} className="p-4 flex justify-center bg-white">
            <Calendar
              mode="range"
              selected={dateRange}
              onSelect={(_range: DateRange | undefined, selectedDay: Date) => {
                const selected = selectedDay;
                if (!selected) return;

                if (activeRangeType === "from") {
                  if (setDateRange) setDateRange({ from: selected, to: dateRange?.to && selected <= dateRange.to ? dateRange.to : undefined });
                  setActiveRangeType("to");
                } else {
                  if (dateRange?.from && selected < dateRange.from) {
                    if (setDateRange) setDateRange({ from: selected, to: undefined });
                    setActiveRangeType("to");
                  } else {
                    if (setDateRange) setDateRange({ from: dateRange?.from || selected, to: selected });
                  }
                }
              }}
              numberOfMonths={2}
              className="border-none shadow-none"
              classNames={{
                months: "flex flex-row gap-8",
                month: "space-y-4",
                month_caption: "flex justify-center pt-1 relative items-center",
                caption_label: "text-sm font-bold text-gray-900",
                nav: "space-x-1 flex items-center",
                button_previous: "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 absolute left-1",
                button_next: "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 absolute right-1",
                month_grid: "w-full border-collapse space-y-1",
                weekdays: "flex",
                weekday: "text-gray-400 rounded-md w-9 font-bold text-[10px] uppercase",
                week: "flex w-full mt-2",
                day: "h-9 w-9 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-full [&:has([aria-selected].day-range-start)]:rounded-l-full first:[&:has([aria-selected])]:rounded-l-full last:[&:has([aria-selected])]:rounded-r-full focus-within:relative focus-within:z-20",
                day_button: "h-9 w-9 p-0 font-bold aria-selected:opacity-100 rounded-full hover:bg-gray-100 transition-colors",
                range_start: "day-range-start bg-violet-600 text-white hover:bg-violet-600 hover:text-white focus:bg-violet-600 focus:text-white",
                range_end: "day-range-end bg-violet-600 text-white hover:bg-violet-600 hover:text-white focus:bg-violet-600 focus:text-white",
                selected: "bg-violet-600 text-white hover:bg-violet-600 hover:text-white focus:bg-violet-600 focus:text-white",
                today: "bg-gray-100 text-gray-900",
                outside: "text-gray-300 opacity-50",
                disabled: "text-gray-300 opacity-50",
                range_middle: "aria-selected:bg-violet-50 aria-selected:text-violet-900 rounded-none",
                hidden: "invisible",
              }}
            />
          </div>

          <div className="p-4 border-t bg-gray-50/30 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="h-10 w-10 text-gray-400 hover:text-violet-600"><Keyboard className="h-5 w-5" /></Button>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="ghost" className="text-sm font-bold text-gray-900 hover:bg-gray-100 underline decoration-2 underline-offset-4" onClick={() => { if (setDateRange) setDateRange(undefined); }}>Clear dates</Button>
              <Button className="bg-violet-600 hover:bg-violet-700 text-white px-6 py-2 rounded-xl font-bold transition-all shadow-md active:scale-95" onClick={() => { if (onClose) onClose(); }}>Close</Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="border-t pt-4 px-4">
          <Label className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3 block">Select Date</Label>
          <div className="p-0 flex justify-center">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date: Date | undefined) => {
                if (date) {
                  setSelectedDate(date);
                  if (onClose) onClose();
                }
              }}
              className="rounded-md border shadow-sm"
              classNames={{ today: "bg-violet-600 text-white rounded-full" }}
            />
          </div>
          <div className="p-4 border-t bg-gray-50/30 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="h-10 w-10 text-gray-400 hover:text-violet-600">
                <Keyboard className="h-5 w-5" />
              </Button>
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                className="text-sm font-bold text-gray-900 hover:bg-gray-100 underline decoration-2 underline-offset-4"
                onClick={() => {
                  if (setDateRange) setDateRange(undefined);
                }}
              >
                Clear dates
              </Button>
              <Button className="bg-violet-600 hover:bg-violet-700 text-white px-6 py-2 rounded-xl font-bold transition-all shadow-md active:scale-95" onClick={() => { if (onClose) onClose(); }}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
