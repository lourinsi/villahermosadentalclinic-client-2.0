"use client";

import React, { useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface DoctorCalendarProps {
  selectedDate: Date;
  onSelect: (date: Date) => void;
  disabled?: (date: Date) => boolean;
}

export function DoctorCalendar({
  selectedDate,
  onSelect,
  disabled
}: DoctorCalendarProps) {
  const [viewDate, setViewDate] = React.useState(new Date(selectedDate));

  // Sync viewDate when selectedDate changes from outside (e.g. "Today" button)
  React.useEffect(() => {
    setViewDate(new Date(selectedDate));
  }, [selectedDate]);

  const daysInMonth = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const days = new Date(year, month + 1, 0).getDate();
    
    const calendarDays = [];
    // Previous month filler
    for (let i = 0; i < firstDay; i++) {
      calendarDays.push(null);
    }
    // Current month days
    for (let i = 1; i <= days; i++) {
      calendarDays.push(new Date(year, month, i));
    }
    return calendarDays;
  }, [viewDate]);

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newDate = new Date(viewDate);
    newDate.setMonth(viewDate.getMonth() + (direction === 'next' ? 1 : -1));
    // Set to the 1st of the month to avoid overflow issues (e.g. March 31 -> Feb 31 -> March 3)
    newDate.setDate(1);
    setViewDate(newDate);
    onSelect(newDate);
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear();
  };

  const isSelected = (date: Date) => {
    return date.getDate() === selectedDate.getDate() &&
      date.getMonth() === selectedDate.getMonth() &&
      date.getFullYear() === selectedDate.getFullYear();
  };

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-6 px-1">
        <button
          onClick={() => navigateMonth('prev')}
          className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors border border-gray-100"
        >
          <ChevronLeft className="h-4 w-4 text-gray-600" />
        </button>
        <h2 className="font-bold text-gray-900">
          {viewDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
        </h2>
        <button
          onClick={() => navigateMonth('next')}
          className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors border border-gray-100"
        >
          <ChevronRight className="h-4 w-4 text-gray-600" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-2">
        {['Su', 'M', 'T', 'W', 'Th', 'F', 'S'].map(day => (
          <div key={day} className="text-center text-[10px] font-bold text-gray-400 uppercase py-2">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {daysInMonth.map((date, i) => {
          if (!date) return <div key={`empty-${i}`} className="aspect-square" />;

          const isDisabled = disabled?.(date);
          const active = isSelected(date);
          const today = isToday(date);

          return (
            <button
              key={date.toISOString()}
              disabled={isDisabled}
              onClick={() => onSelect(date)}
              className={cn(
                "aspect-square flex items-center justify-center rounded-xl text-sm font-medium transition-all",
                isDisabled ? "text-gray-200 cursor-not-allowed" : "hover:bg-blue-50 hover:text-blue-600",
                active ? "bg-blue-600 text-white hover:bg-blue-700 hover:text-white shadow-md scale-105" : "text-gray-700",
                today && !active ? "text-blue-600 font-bold bg-blue-50/50" : ""
              )}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}
