"use client";

import { useEffect, useRef } from "react";
import { useFunnel } from "@/lib/funnel/funnel-context";
import { siteContent } from "@/config/site-content";
import { BOOKING } from "@/config/booking";
import {
  generateGoogleCalendarUrl,
  generateOutlookWebUrl,
  generateIcsContent,
} from "@/lib/booking/calendar-links";

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: BOOKING.TIMEZONE,
    hour12: true,
  });
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: BOOKING.TIMEZONE,
  });
}

export function ConfirmationStage() {
  const { state } = useFunnel();
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    setTimeout(() => headingRef.current?.focus(), 200);
  }, []);

  if (!state.appointment_id) return null;

  const startTime = state.selected_slot_start ?? "";
  const endTime = state.selected_slot_end ?? "";
  const title = "Fusion 44X Consultation";

  const calTitle = title;
  const calDescription = "Fusion 44X consultation appointment.";

  function handleIcsDownload() {
    const icsContent = generateIcsContent({
      startTime,
      endTime,
      title: calTitle,
      description: calDescription,
    });
    const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "fusion44x-consultation.ics";
    a.click();
    URL.revokeObjectURL(url);
  }

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

      <h3
        ref={headingRef}
        id="confirmation-stage-heading"
        tabIndex={-1}
        className="mt-5 text-2xl font-bold tracking-tight text-brand-navy sm:text-3xl focus:outline-none"
      >
        {siteContent.confirmation.heading}
      </h3>
      <p className="mt-2 text-sm text-neutral-600">
        {siteContent.confirmation.subheading}
      </p>

      <div className="mt-6 rounded-xl border border-neutral-200 bg-white p-5 text-left shadow-sm">
        <h4 className="text-sm font-semibold text-brand-navy">
          {siteContent.confirmation.details_heading}
        </h4>
        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-neutral-500">{siteContent.confirmation.date_label}</dt>
            <dd className="font-medium text-brand-navy">{formatDate(startTime)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-neutral-500">{siteContent.confirmation.time_label}</dt>
            <dd className="font-medium text-brand-navy">
              {formatTime(startTime)} &ndash; {formatTime(endTime)}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-neutral-500">{siteContent.confirmation.timezone_label}</dt>
            <dd className="font-medium text-brand-navy">
              {siteContent.booking.timezone_display}
            </dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-neutral-400">
          {siteContent.confirmation.appointment_ref}: {state.appointment_id.slice(0, 8)}...
        </p>
      </div>

      <div className="mt-6 space-y-2.5">
        <p className="text-sm font-medium text-brand-navy">
          {siteContent.confirmation.add_to_calendar}
        </p>

        <a
          href={generateGoogleCalendarUrl({ startTime, endTime, title: calTitle })}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-neutral-200 bg-white px-4 py-2.5 text-sm font-medium text-brand-navy transition-colors hover:bg-brand-aqua-pale hover:border-brand-aqua/30"
        >
          {siteContent.confirmation.google_calendar}
        </a>

        <a
          href={generateOutlookWebUrl({ startTime, endTime, title: calTitle })}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-neutral-200 bg-white px-4 py-2.5 text-sm font-medium text-brand-navy transition-colors hover:bg-brand-aqua-pale hover:border-brand-aqua/30"
        >
          {siteContent.confirmation.outlook}
        </a>

        <button
          onClick={handleIcsDownload}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-neutral-200 bg-white px-4 py-2.5 text-sm font-medium text-brand-navy transition-colors hover:bg-brand-aqua-pale hover:border-brand-aqua/30"
        >
          {siteContent.confirmation.download_ics}
        </button>
      </div>

      <p className="mt-6 text-xs text-neutral-500">
        {siteContent.confirmation.support_line}{" "}
        <a href={`tel:${siteContent.confirmation.support_phone.replace(/[^+\d]/g, "")}`} className="text-brand-aqua hover:text-brand-aqua-light">
          {siteContent.confirmation.support_phone}
        </a>
      </p>
    </div>
  );
}
