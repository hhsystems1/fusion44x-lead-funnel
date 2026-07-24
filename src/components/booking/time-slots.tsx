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
        className="mb-3 block text-sm font-medium text-neutral-700"
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
              className={`rounded-lg border px-3 py-3 text-center text-sm transition-colors
                ${
                  selected
                    ? "border-neutral-900 bg-neutral-900 text-white"
                    : "border-neutral-300 bg-white text-neutral-700 hover:border-neutral-400"
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