"use client";

import { useFunnel } from "@/lib/funnel/funnel-context";
import { siteContent } from "@/config/site-content";
import { SectionContainer } from "@/components/ui/section-container";

export function BookingPlaceholder() {
  const { state } = useFunnel();

  if (!state.lead_id) return null;

  return (
    <SectionContainer id="booking" background="light">
      <div className="text-center">
        <h2
          id="booking-heading"
          className="text-2xl font-bold tracking-tight sm:text-3xl"
        >
          {siteContent.booking_placeholder.heading}
        </h2>
        <p className="mt-3 text-neutral-600">
          {siteContent.booking_placeholder.subheading}
        </p>
        <div className="mt-8 flex items-center justify-center rounded-xl border-2 border-dashed border-neutral-300 bg-neutral-100 p-8">
          <p className="text-center text-sm text-neutral-500">
            {siteContent.booking_placeholder.message}
          </p>
        </div>
      </div>
    </SectionContainer>
  );
}
