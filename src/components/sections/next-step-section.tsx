"use client";

import { useCallback } from "react";
import { siteContent } from "@/config/site-content";
import { useFunnel } from "@/lib/funnel/funnel-context";
import { CtaButton } from "@/components/ui/cta-button";

export function NextStepSection() {
  const { goToStep } = useFunnel();

  const handleCta = useCallback(() => {
    goToStep("pool-diagnostic");
    setTimeout(() => {
      const el = document.getElementById("funnel-viewport");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }, [goToStep]);

  const { steps } = siteContent.next_step;

  return (
    <section
      className="w-full bg-white px-5 py-16 sm:px-6 sm:py-20 md:px-8"
      aria-labelledby="next-step-heading"
    >
      <div className="mx-auto max-w-4xl">
        <div className="text-center">
          <p className="mb-2 text-sm font-semibold tracking-widest uppercase text-brand-aqua">
            {siteContent.next_step.eyebrow}
          </p>
          <h2
            id="next-step-heading"
            className="text-2xl font-bold tracking-tight text-brand-navy sm:text-3xl"
          >
            {siteContent.next_step.heading}
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-neutral-600">
            {siteContent.next_step.subheading}
          </p>
        </div>

        <div className="mt-10 grid gap-6 sm:grid-cols-3">
          {steps.map((step, i) => (
            <div
              key={i}
              className="relative rounded-xl border border-neutral-200 bg-brand-surface/50 p-6 text-center"
            >
              <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-brand-aqua text-lg font-bold text-white">
                {i + 1}
              </span>
              <h3 className="mt-4 text-base font-semibold text-brand-navy">
                {step.heading}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-neutral-600">
                {step.text}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-10 text-center">
          <CtaButton size="lg" onClick={handleCta}>
            {siteContent.next_step.cta}
          </CtaButton>
        </div>
      </div>
    </section>
  );
}
