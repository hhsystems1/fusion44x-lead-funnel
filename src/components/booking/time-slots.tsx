"use client";

import { siteContent } from "@/config/site-content";
import type { AvailabilitySlot } from "@/lib/funnel/booking-api";

interface TimeSlotsProps {
  slots: AvailabilitySlot[];
  selectedStart: string | null;
  onSelect: (start: string, end: string) => void;
}

export function TimeSlots({ slots, selectedStart, onSelect }: TimeSlotsProps) {
  if (slots.length === 0) return null;

  return (
    <div>
      <label
        id="time-slots-label"
        className="mb-3 block text-sm font-medium text-brand-navy"
      >
        {siteContent.booking.select_time}
      </label>
      <div
        className="grid grid-cols-2 gap-3 sm:grid-cols-3"
        role="radiogroup"
        aria-labelledby="time-slots-label"
      >
        {slots.map((slot) => {
          const selected = slot.start === selectedStart;
          return (
            <button
              key={slot.start}
              role="radio"
              aria-checked={selected}
              onClick={() => onSelect(slot.start, slot.end)}
              className={`rounded-lg border px-3 py-3 text-center text-sm transition-all duration-150
                ${
                  selected
                    ? "border-brand-aqua bg-brand-aqua text-white shadow-sm shadow-brand-aqua/20"
                    : "border-neutral-200 bg-white text-brand-navy hover:border-brand-aqua/40 hover:bg-brand-aqua-pale"
                }
              `}
            >
              {slot.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
