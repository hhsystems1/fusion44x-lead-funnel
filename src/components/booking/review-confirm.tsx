"use client";

import type { BookingErrorCode } from "@/types/funnel";
import { BOOKING } from "@/config/booking";
import { siteContent } from "@/config/site-content";
import { formatDateLabel } from "@/lib/booking/slots";

interface ReviewConfirmProps {
  selectedDate: string;
  startTime: string;
  endTime: string;
  firstName: string | null;
  email: string | null;
  submissionState: string;
  errorCode: BookingErrorCode | null;
  onConfirm: () => void;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: BOOKING.TIMEZONE,
    hour12: true,
  });
}

const BOOKING_ERROR_MESSAGES: Record<BookingErrorCode, string> = {
  missing_fields: siteContent.booking.error_missing_fields,
  conflict: siteContent.booking.conflict,
  server_error: siteContent.booking.error_server_error,
  network_error: siteContent.booking.error_network_error,
  unknown_error: siteContent.booking.error_unknown_error,
};

const BOOKING_ERROR_DEBUG_CODES: Record<BookingErrorCode, string> = {
  missing_fields: "BOOKING_MISSING_FIELDS",
  conflict: "BOOKING_CONFLICT",
  server_error: "BOOKING_SERVER_ERROR",
  network_error: "BOOKING_NETWORK_ERROR",
  unknown_error: "BOOKING_UNKNOWN_ERROR",
};

export function ReviewConfirm({
  selectedDate,
  startTime,
  endTime,
  firstName,
  email,
  submissionState,
  errorCode,
  onConfirm,
}: ReviewConfirmProps) {
  const isSubmitting = submissionState === "submitting";

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-brand-navy">
        {siteContent.booking.review_heading}
      </h3>

      <dl className="mt-4 space-y-3">
        {firstName && (
          <div className="flex justify-between gap-4">
            <dt className="shrink-0 text-neutral-500">{siteContent.booking.review_name}</dt>
            <dd className="truncate text-right font-medium text-brand-navy">{firstName}</dd>
          </div>
        )}
        {email && (
          <div className="flex justify-between gap-4">
            <dt className="shrink-0 text-neutral-500">{siteContent.booking.review_email}</dt>
            <dd className="min-w-0 truncate text-right font-medium text-brand-navy break-all">{email}</dd>
          </div>
        )}
        <div className="flex justify-between gap-4">
          <dt className="shrink-0 text-neutral-500">{siteContent.booking.review_date}</dt>
          <dd className="text-right font-medium text-brand-navy">
            {formatDateLabel(selectedDate)}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="shrink-0 text-neutral-500">{siteContent.booking.review_time}</dt>
          <dd className="text-right font-medium text-brand-navy">
            {formatTime(startTime)} &ndash; {formatTime(endTime)}
          </dd>
        </div>
      </dl>

      <p className="mt-2 text-xs text-neutral-400">
        {siteContent.booking.timezone_label} {siteContent.booking.timezone_display}
      </p>

      {errorCode && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm text-red-700">
            {BOOKING_ERROR_MESSAGES[errorCode]}
          </p>
          {process.env.NODE_ENV === "development" && (
            <p className="mt-1 font-mono text-xs text-red-400">
              Error reference: {BOOKING_ERROR_DEBUG_CODES[errorCode]}
            </p>
          )}
        </div>
      )}

      <button
        onClick={onConfirm}
        disabled={isSubmitting}
        className="mt-5 w-full rounded-lg bg-brand-aqua px-6 py-3 text-sm font-semibold text-white transition-all duration-200 hover:bg-brand-aqua-light disabled:cursor-not-allowed disabled:opacity-50 shadow-sm shadow-brand-aqua/20"
      >
        {isSubmitting ? siteContent.booking.confirming : siteContent.booking.confirm}
      </button>
    </div>
  );
}
