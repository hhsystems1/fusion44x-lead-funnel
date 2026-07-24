"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFunnel } from "@/lib/funnel/funnel-context";
import { fetchAvailability, type AvailabilitySlot } from "@/lib/funnel/booking-api";
import { BOOKING } from "@/config/booking";
import { siteContent } from "@/config/site-content";
import { SectionContainer } from "@/components/ui/section-container";
import { DatePicker } from "./date-picker";
import { TimeSlots } from "./time-slots";
import { ReviewConfirm } from "./review-confirm";
import { BookingSuccess } from "./booking-success";

type BookingStep = "date" | "slots" | "review" | "success";

export function BookingSection() {
  const { state, dispatch, selectSlot, submitBooking, tracker } = useFunnel();

  const [bookingStep, setBookingStep] = useState<BookingStep>("date");
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(state.selected_date ?? "");
  const conflictHandledRef = useRef(false);

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

  const handleBackToSlots = useCallback(() => {
    setBookingStep("date");
    dispatch({ type: "CLEAR_BOOKING_SELECTION" });
  }, [dispatch]);

  const handleRetry = useCallback(() => {
    if (selectedDate) loadSlots(selectedDate);
  }, [selectedDate, loadSlots]);

  const handleConfirm = useCallback(() => {
    submitBooking(crypto.randomUUID?.() ?? `${Date.now()}_${Math.random().toString(36).slice(2)}`);
  }, [submitBooking]);

  useEffect(() => {
    if (state.booking_submission_state === "success") {
      setTimeout(() => setBookingStep("success"), 0);
    }
  }, [state.booking_submission_state]);

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

  if (bookingStep === "success" && state.appointment_id) {
    return (
      <SectionContainer id="booking" background="light">
        <BookingSuccess
          appointmentId={state.appointment_id}
          startTime={state.selected_slot_start ?? ""}
          endTime={state.selected_slot_end ?? ""}
          tracker={tracker}
        />
      </SectionContainer>
    );
  }

  return (
    <SectionContainer id="booking" background="light">
      <div className="mx-auto max-w-xl">
        <h2
          id="booking-heading"
          className="text-center text-2xl font-bold tracking-tight sm:text-3xl"
        >
          {siteContent.booking.heading}
        </h2>
        <p className="mt-3 text-center text-neutral-600">
          {siteContent.booking.subheading}
        </p>
        <p className="mt-1 text-center text-sm text-neutral-400">
          {siteContent.booking.timezone_label} {BOOKING.TIMEZONE}
        </p>

        {bookingStep === "date" && (
          <div className="mt-8">
            <DatePicker
              selectedDate={selectedDate}
              onDateChange={handleDateChange}
            />
          </div>
        )}

        {(bookingStep === "slots" || bookingStep === "review") && (
          <div className="mt-8">
            <div className="mb-6">
              <button
                onClick={handleBackToSlots}
                className="text-sm text-neutral-500 underline hover:text-neutral-800"
              >
                &larr; {siteContent.booking.select_date}
              </button>
            </div>

            {slotsLoading && (
              <div className="py-12 text-center text-neutral-500">
                {siteContent.booking.loading_slots}
              </div>
            )}

            {slotsError && !slotsLoading && (
              <div className="py-12 text-center">
                <p className="text-red-600">{siteContent.booking.loading_error}</p>
                <button
                  onClick={handleRetry}
                  className="mt-4 rounded bg-neutral-900 px-6 py-2 text-sm text-white hover:bg-neutral-800"
                >
                  {siteContent.booking.try_again}
                </button>
              </div>
            )}

            {!slotsLoading && !slotsError && slots.length === 0 && bookingStep === "slots" && (
              <div className="py-12 text-center text-neutral-500">
                <p>{siteContent.booking.no_slots}</p>
                <p className="mt-1 text-sm">{siteContent.booking.no_slots_sub}</p>
              </div>
            )}

            {!slotsLoading && !slotsError && slots.length > 0 && bookingStep === "slots" && (
              <TimeSlots
                slots={slots}
                selectedStart={state.selected_slot_start}
                onSelect={handleSlotSelect}
              />
            )}

            {bookingStep === "review" && state.selected_slot_start && state.selected_slot_end && (
              <ReviewConfirm
                selectedDate={selectedDate}
                startTime={state.selected_slot_start}
                endTime={state.selected_slot_end}
                submissionState={state.booking_submission_state}
                error={state.booking_error}
                onConfirm={handleConfirm}
              />
            )}
          </div>
        )}
      </div>
    </SectionContainer>
  );
}