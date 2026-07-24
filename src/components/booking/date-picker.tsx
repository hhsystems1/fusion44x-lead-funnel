"use client";

import { useMemo } from "react";
import { BOOKING, BLOCKED_DATES, WORKING_DAYS } from "@/config/booking";
import { siteContent } from "@/config/site-content";

interface DatePickerProps {
  selectedDate: string;
  onDateChange: (date: string) => void;
}

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDisplayDate(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00`);
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function isDateDisabled(dateStr: string): boolean {
  if (BLOCKED_DATES.includes(dateStr)) return true;
  const d = new Date(`${dateStr}T12:00:00`);
  const dayOfWeek = d.getDay();
  if (!WORKING_DAYS.includes(dayOfWeek)) return true;
  return false;
}

export function DatePicker({ selectedDate, onDateChange }: DatePickerProps) {
  const dates = useMemo(() => {
    const result: string[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = 0; i < BOOKING.BOOKING_WINDOW_DAYS; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      result.push(formatDate(d));
    }
    return result;
  }, []);

  if (dates.length === 0) return null;

  return (
    <div>
      <label
        id="date-picker-label"
        className="mb-3 block text-sm font-medium text-neutral-700"
      >
        {siteContent.booking.select_date}
      </label>
      <div
        className="flex gap-2 overflow-x-auto pb-2"
        role="radiogroup"
        aria-labelledby="date-picker-label"
      >
        {dates.map((date) => {
          const disabled = isDateDisabled(date);
          const selected = date === selectedDate;
          return (
            <button
              key={date}
              role="radio"
              aria-checked={selected}
              disabled={disabled}
              onClick={() => onDateChange(date)}
              className={`shrink-0 rounded-lg border px-4 py-3 text-center text-sm transition-colors
                ${
                  selected
                    ? "border-neutral-900 bg-neutral-900 text-white"
                    : "border-neutral-300 bg-white text-neutral-700 hover:border-neutral-400"
                }
                ${disabled ? "cursor-not-allowed opacity-40" : "cursor-pointer"}
              `}
            >
              {formatDisplayDate(date)}
            </button>
          );
        })}
      </div>
    </div>
  );
}