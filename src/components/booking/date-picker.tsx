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

function formatDayOfWeek(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00`);
  return d.toLocaleDateString("en-US", { weekday: "short" });
}

function formatMonthDay(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00`);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function isDateDisabled(dateStr: string): boolean {
  if (BLOCKED_DATES.includes(dateStr)) return true;
  const d = new Date(`${dateStr}T12:00:00`);
  const dayOfWeek = d.getDay();
  if (!WORKING_DAYS.includes(dayOfWeek)) return true;
  return false;
}

function isToday(dateStr: string): boolean {
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, "0");
  const d = String(today.getDate()).padStart(2, "0");
  return dateStr === `${y}-${m}-${d}`;
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
        className="mb-3 block text-sm font-medium text-brand-navy"
      >
        {siteContent.booking.select_date}
      </label>
      <div
        className="grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-6"
        role="radiogroup"
        aria-labelledby="date-picker-label"
      >
        {dates.map((date) => {
          const disabled = isDateDisabled(date);
          const selected = date === selectedDate;
          const today = isToday(date);
          return (
            <button
              key={date}
              role="radio"
              aria-checked={selected}
              disabled={disabled}
              onClick={() => onDateChange(date)}
              className={`flex flex-col items-center rounded-lg border px-2 py-2.5 text-center text-xs transition-all duration-150 sm:text-sm
                ${
                  selected
                    ? "border-brand-aqua bg-brand-aqua text-white shadow-sm shadow-brand-aqua/20"
                    : "border-neutral-200 bg-white text-brand-navy hover:border-brand-aqua/40 hover:bg-brand-aqua-pale"
                }
                ${disabled ? "cursor-not-allowed opacity-40" : "cursor-pointer"}
              `}
            >
              <span className={`text-[10px] font-medium ${selected ? "text-white/70" : "text-neutral-400"}`}>
                {formatDayOfWeek(date)}
              </span>
              <span className="mt-0.5 font-semibold">
                {formatMonthDay(date)}
              </span>
              {today && !selected && (
                <span className="mt-0.5 text-[10px] font-medium text-brand-aqua">Today</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
