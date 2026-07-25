"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFunnel } from "@/lib/funnel/funnel-context";
import { fetchAvailability, type AvailabilitySlot } from "@/lib/funnel/booking-api";
import { BOOKING } from "@/config/booking";
import { siteContent } from "@/config/site-content";
import { DatePicker } from "./date-picker";
import { TimeSlots } from "./time-slots";
import { ReviewConfirm } from "./review-confirm";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorMessage } from "@/components/ui/error-message";

type BookingStep = "date" | "slots" | "review";

export function BookingStage() {
  const { state, dispatch, selectSlot, submitBooking } = useFunnel();
  const headingRef = useRef<HTMLHeadingElement>(null);

  const [bookingStep, setBookingStep] = useState<BookingStep>("date");
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(state.selected_date ?? "");
  const conflictHandledRef = useRef(false);

  useEffect(() => {
    setTimeout(() => headingRef.current?.focus(), 100);
  }, []);

  const loadSlots = useCallback(async (date: string) => {
    setSlotsLoading(true);
    setSlotsError(null);
    const result = await fetchAvailability(date, BOOKING.TIMEZONE);
    if (result.error) {
      setSlotsError(result.error.message);
      setSlots([]);
    } else {
      setSlots(result.slots);
    }
    setSlotsLoading(false);
  }, []);

  const handleDateChange = useCallback(
    (date: string) => {
      setSelectedDate(date);
      dispatch({ type: "SELECT_DATE", date });
      setBookingStep("slots");
      loadSlots(date);
    },
    [dispatch, loadSlots],
  );

  const handleSlotSelect = useCallback(
    (start: string, end: string) => {
      selectSlot(start, end);
      setBookingStep("review");
    },
    [selectSlot],
  );

  const handleBackToDates = useCallback(() => {
    setBookingStep("date");
    dispatch({ type: "CLEAR_BOOKING_SELECTION" });
  }, [dispatch]);

  const handleBackToSlots = useCallback(() => {
    setBookingStep("slots");
    dispatch({ type: "CLEAR_BOOKING_SELECTION" });
  }, [dispatch]);

  const handleRetry = useCallback(() => {
    if (selectedDate) loadSlots(selectedDate);
  }, [selectedDate, loadSlots]);

  const handleConfirm = useCallback(() => {
    submitBooking(crypto.randomUUID?.() ?? `${Date.now()}_${Math.random().toString(36).slice(2)}`);
  }, [submitBooking]);

  useEffect(() => {
    if (state.booking_error === "conflict" && !conflictHandledRef.current) {
      conflictHandledRef.current = true;
      setTimeout(() => {
        setBookingStep("slots");
        if (selectedDate) loadSlots(selectedDate);
      }, 0);
    }
    if (state.booking_error !== "conflict") {
      conflictHandledRef.current = false;
    }
  }, [state.booking_error, selectedDate, loadSlots]);

  const shouldRender = useMemo(() => state.lead_id && state.session_id, [state.lead_id, state.session_id]);
  if (!shouldRender) return null;

  return (
    <div>
      <div className="text-center">
        <h3
          ref={headingRef}
          id="booking-stage-heading"
          tabIndex={-1}
          className="text-2xl font-bold tracking-tight text-brand-navy sm:text-3xl focus:outline-none"
        >
          {siteContent.booking.heading}
        </h3>
        <p className="mt-2 text-sm text-neutral-600">
          {siteContent.booking.subheading}
        </p>
        <p className="mt-1 text-xs text-neutral-400">
          {siteContent.booking.timezone_label} {siteContent.booking.timezone_display}
        </p>
      </div>

      <div className="mt-6">
        {bookingStep === "date" && (
          <DatePicker
            selectedDate={selectedDate}
            onDateChange={handleDateChange}
          />
        )}

        {bookingStep === "slots" && (
          <div>
            <div className="mb-5">
              <button
                onClick={handleBackToDates}
                className="text-sm text-brand-aqua hover:text-brand-aqua-light transition-colors"
              >
                &larr; {siteContent.booking.select_date}
              </button>
            </div>

            {slotsLoading && (
              <LoadingState message={siteContent.booking.loading_slots} />
            )}

            {slotsError && !slotsLoading && (
              <div className="py-8 text-center">
                <ErrorMessage message={siteContent.booking.loading_error} />
                <button
                  onClick={handleRetry}
                  className="mt-4 rounded-lg bg-brand-aqua px-6 py-2 text-sm font-medium text-white hover:bg-brand-aqua-light transition-colors"
                >
                  {siteContent.booking.try_again}
                </button>
              </div>
            )}

            {!slotsLoading && !slotsError && slots.length === 0 && (
              <div className="py-10 text-center text-neutral-500">
                <p>{siteContent.booking.no_slots}</p>
                <p className="mt-1 text-sm">{siteContent.booking.no_slots_sub}</p>
              </div>
            )}

            {!slotsLoading && !slotsError && slots.length > 0 && (
              <TimeSlots
                slots={slots}
                selectedStart={state.selected_slot_start}
                onSelect={handleSlotSelect}
              />
            )}
          </div>
        )}

        {bookingStep === "review" && state.selected_slot_start && state.selected_slot_end && (
          <div>
            <div className="mb-5">
              <button
                onClick={handleBackToSlots}
                className="text-sm text-brand-aqua hover:text-brand-aqua-light transition-colors"
              >
                &larr; {siteContent.booking.select_time}
              </button>
            </div>
            <ReviewConfirm
              selectedDate={selectedDate}
              startTime={state.selected_slot_start}
              endTime={state.selected_slot_end}
              firstName={state.first_name}
              email={state.email}
              submissionState={state.booking_submission_state}
              error={state.booking_error}
              onConfirm={handleConfirm}
            />
          </div>
        )}
      </div>
    </div>
  );
}
