"use client";

import { useCallback } from "react";
import { siteContent } from "@/config/site-content";
import { useFunnel } from "@/lib/funnel/funnel-context";
import { CtaButton } from "@/components/ui/cta-button";

export function ChemicalCycleSection() {
  const { goToStep } = useFunnel();

  const handleCta = useCallback(() => {
    goToStep("pool-diagnostic");
    setTimeout(() => {
      const el = document.getElementById("funnel-viewport");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }, [goToStep]);

  const { chemical_cycle } = siteContent;

  return (
    <section
      className="w-full bg-brand-surface px-5 py-16 sm:px-6 sm:py-20 md:px-8"
      aria-labelledby="chemical-cycle-heading"
    >
      <div className="mx-auto max-w-5xl">
        <div className="text-center">
          <p className="mb-3 text-sm font-semibold tracking-widest uppercase text-brand-aqua">
            {chemical_cycle.eyebrow}
          </p>
          <h2
            id="chemical-cycle-heading"
            className="text-2xl font-bold tracking-tight text-brand-navy sm:text-3xl"
          >
            {chemical_cycle.heading}
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-neutral-600">
            {chemical_cycle.body}
          </p>
        </div>

        <div className="mt-10 grid gap-3 sm:grid-cols-2 md:grid-cols-4">
          {chemical_cycle.items.map((item, i) => (
            <div
              key={i}
              className="flex items-center justify-center rounded-lg border border-neutral-200 bg-white px-4 py-3 text-sm font-medium text-brand-navy shadow-sm"
            >
              {item}
            </div>
          ))}
        </div>

        <div className="mt-8 text-center">
          <p className="text-neutral-600">
            {chemical_cycle.follow_up}
          </p>
          <p className="mx-auto mt-4 max-w-2xl text-base font-medium text-brand-navy italic">
            {chemical_cycle.belief_question}
          </p>
        </div>

        <div className="mt-8 text-center">
          <CtaButton size="lg" onClick={handleCta}>
            {chemical_cycle.cta}
          </CtaButton>
        </div>
      </div>
    </section>
  );
}
