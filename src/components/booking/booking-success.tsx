"use client";

import { useCallback, useRef } from "react";
import type { Tracker } from "@/lib/analytics/tracker";
import { InternalEvents } from "@/config/tracking-events";
import { siteContent } from "@/config/site-content";
import {
  generateGoogleCalendarUrl,
  generateOutlookWebUrl,
  generateIcsContent,
} from "@/lib/booking/calendar-links";

interface BookingSuccessProps {
  appointmentId: string;
  startTime: string;
  endTime: string;
  tracker: Tracker | null;
}

export function BookingSuccess({
  appointmentId,
  startTime,
  endTime,
  tracker,
}: BookingSuccessProps) {
  const hasTrackedAddToCalendar = useRef<Set<string>>(new Set());

  const title = "Fusion 44X Consultation";

  const trackCalendarClick = useCallback(
    (provider: string) => {
      const key = `${provider}_${appointmentId}`;
      if (hasTrackedAddToCalendar.current.has(key)) return;
      hasTrackedAddToCalendar.current.add(key);
      tracker?.track(InternalEvents.ADD_TO_CALENDAR_CLICKED, {
        step_id: undefined,
        metadata: { provider },
      });
    },
    [tracker, appointmentId],
  );

  const handleGoogleClick = useCallback(() => {
    trackCalendarClick("google");
  }, [trackCalendarClick]);

  const handleOutlookClick = useCallback(() => {
    trackCalendarClick("outlook");
  }, [trackCalendarClick]);

  const handleIcsDownload = useCallback(() => {
    trackCalendarClick("ics");
    const icsContent = generateIcsContent({
      startTime,
      endTime,
      title,
      description: "Fusion 44X consultation appointment.",
    });
    const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `fusion44x-consultation.ics`;
    a.click();
    URL.revokeObjectURL(url);
  }, [startTime, endTime, title, trackCalendarClick]);

  return (
    <div className="text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
        <svg
          className="h-8 w-8 text-green-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 13l4 4L19 7"
          />
        </svg>
      </div>

      <h2 className="mt-6 text-2xl font-bold tracking-tight sm:text-3xl">
        {siteContent.booking.success_heading}
      </h2>
      <p className="mt-3 text-neutral-600">
        {siteContent.booking.success_subheading}
      </p>
      <p className="mt-2 text-sm text-neutral-500">
        {siteContent.booking.success_message}
      </p>

      <p className="mt-4 text-xs text-neutral-400">
        {siteContent.booking.appointment_ref}: {appointmentId.slice(0, 8)}...
      </p>

      <div className="mt-8 space-y-3">
        <p className="text-sm font-medium text-neutral-700">
          {siteContent.booking.add_to_calendar}
        </p>

        <a
          href={generateGoogleCalendarUrl({ startTime, endTime, title })}
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleGoogleClick}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-neutral-300 bg-white px-4 py-2.5 text-sm text-neutral-700 transition-colors hover:bg-neutral-50"
        >
          {siteContent.booking.google_calendar}
        </a>

        <a
          href={generateOutlookWebUrl({ startTime, endTime, title })}
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleOutlookClick}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-neutral-300 bg-white px-4 py-2.5 text-sm text-neutral-700 transition-colors hover:bg-neutral-50"
        >
          {siteContent.booking.outlook}
        </a>

        <button
          onClick={handleIcsDownload}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-neutral-300 bg-white px-4 py-2.5 text-sm text-neutral-700 transition-colors hover:bg-neutral-50"
        >
          {siteContent.booking.download_ics}
        </button>
      </div>
    </div>
  );
}