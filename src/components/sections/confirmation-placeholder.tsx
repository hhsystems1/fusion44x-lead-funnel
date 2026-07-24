"use client";

import { useFunnel } from "@/lib/funnel/funnel-context";
import { siteContent } from "@/config/site-content";
import { SectionContainer } from "@/components/ui/section-container";
import { BookingSuccess } from "@/components/booking/booking-success";

export function ConfirmationPlaceholder() {
  const { state, tracker } = useFunnel();

  if (state.appointment_id) {
    return (
      <SectionContainer id="confirmation" background="dark">
        <div className="mx-auto max-w-xl">
          <BookingSuccess
            appointmentId={state.appointment_id}
            startTime={state.selected_slot_start ?? ""}
            endTime={state.selected_slot_end ?? ""}
            tracker={tracker}
          />
        </div>
      </SectionContainer>
    );
  }

  return (
    <SectionContainer id="confirmation" background="dark">
      <div className="text-center">
        <h2
          id="confirmation-heading"
          className="text-2xl font-bold tracking-tight sm:text-3xl"
        >
          {siteContent.confirmation.heading}
        </h2>
        <p className="mt-4 text-lg text-neutral-300">
          {siteContent.confirmation.subheading}
        </p>
        <div className="mt-8 text-left">
          <h3 className="mb-4 text-lg font-semibold text-white">
            {siteContent.confirmation.what_happens_next}
          </h3>
          <ol className="space-y-3">
            {siteContent.confirmation.steps.map((step, i) => (
              <li key={i} className="flex items-start gap-3 text-neutral-300">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/20 text-sm text-white">
                  {i + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </SectionContainer>
  );
}