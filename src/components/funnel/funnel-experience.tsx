"use client";

import { useEffect, useRef } from "react";
import { useFunnel } from "@/lib/funnel/funnel-context";
import { FUNNEL_STEPS } from "@/types/funnel";
import { PoolDiagnosticStage } from "@/components/sections/pool-diagnostic-section";
import { ContactStage } from "@/components/sections/contact-section";
import { BookingStage } from "@/components/booking/booking-section";
import { ConfirmationStage } from "@/components/sections/confirmation-stage";

export function FunnelExperience() {
  const { state, resetFunnel } = useFunnel();
  const viewportRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const step = state.current_step;

  useEffect(() => {
    if (
      step === FUNNEL_STEPS.POOL_DIAGNOSTIC ||
      step === FUNNEL_STEPS.CONTACT_INFORMATION ||
      step === FUNNEL_STEPS.BOOKING ||
      step === FUNNEL_STEPS.CONFIRMATION
    ) {
      const el = viewportRef.current;
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      setTimeout(() => {
        headingRef.current?.focus();
      }, 350);
    }
  }, [step]);

  const showStartOver =
    step === FUNNEL_STEPS.BOOKING ||
    step === FUNNEL_STEPS.CONFIRMATION;

  return (
    <section
      id="funnel-viewport"
      ref={viewportRef}
      className="w-full bg-brand-surface px-5 py-12 sm:px-6 sm:py-16 md:px-8"
      aria-live="polite"
    >
      <div className="mx-auto max-w-2xl">
        <h2
          ref={headingRef}
          tabIndex={-1}
          className="sr-only"
        >
          {step === FUNNEL_STEPS.POOL_DIAGNOSTIC && "Pool Assessment"}
          {step === FUNNEL_STEPS.CONTACT_INFORMATION && "Your Information"}
          {step === FUNNEL_STEPS.BOOKING && "Schedule Your Consultation"}
          {step === FUNNEL_STEPS.CONFIRMATION && "Your Consultation Is Confirmed"}
        </h2>

        {step === FUNNEL_STEPS.POOL_DIAGNOSTIC && <PoolDiagnosticStage />}
        {step === FUNNEL_STEPS.CONTACT_INFORMATION && <ContactStage />}
        {step === FUNNEL_STEPS.BOOKING && <BookingStage />}
        {step === FUNNEL_STEPS.CONFIRMATION && <ConfirmationStage />}

        {showStartOver && (
          <div className="mt-6 text-center">
            <button
              onClick={resetFunnel}
              className="text-sm text-neutral-400 underline decoration-neutral-300 underline-offset-2 transition-colors hover:text-neutral-600"
            >
              Start Over
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
