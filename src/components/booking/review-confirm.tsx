"use client";

import type { SubmissionState } from "@/types/funnel";
import { BOOKING } from "@/config/booking";
import { siteContent } from "@/config/site-content";
import { formatDateLabel } from "@/lib/booking/slots";

interface ReviewConfirmProps {
  selectedDate: string;
  startTime: string;
  endTime: string;
  submissionState: SubmissionState;
  error: string | null;
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

export function ReviewConfirm({
  selectedDate,
  startTime,
  endTime,
  submissionState,
  error,
  onConfirm,
}: ReviewConfirmProps) {
  const isSubmitting = submissionState === "submitting";

  return (
    <div className="rounded-xl border border-neutral-300 bg-white p-6">
      <h3 className="text-lg font-semibold text-neutral-900">
        {siteContent.booking.review_heading}
      </h3>

      <dl className="mt-4 space-y-3">
        <div className="flex justify-between">
          <dt className="text-neutral-500">{siteContent.booking.review_date}</dt>
          <dd className="font-medium text-neutral-900">
            {formatDateLabel(selectedDate)}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-neutral-500">{siteContent.booking.review_time}</dt>
          <dd className="font-medium text-neutral-900">
            {formatTime(startTime)} &ndash; {formatTime(endTime)}
          </dd>
        </div>
      </dl>

      <p className="mt-2 text-xs text-neutral-400">
        {siteContent.booking.timezone_label} {BOOKING.TIMEZONE}
      </p>

      {error === "conflict" && (
        <p className="mt-4 text-sm text-red-600">
          {siteContent.booking.conflict}
        </p>
      )}

      {error && error !== "conflict" && (
        <p className="mt-4 text-sm text-red-600">
          {siteContent.contact.error_required}
        </p>
      )}

      <button
        onClick={onConfirm}
        disabled={isSubmitting}
        className="mt-6 w-full rounded-lg bg-neutral-900 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSubmitting ? siteContent.booking.confirming : siteContent.booking.confirm}
      </button>
    </div>
  );
}