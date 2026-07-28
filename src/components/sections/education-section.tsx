"use client";

import { useCallback } from "react";
import { siteContent } from "@/config/site-content";
import { useFunnel } from "@/lib/funnel/funnel-context";
import { CtaButton } from "@/components/ui/cta-button";

export function EducationSection() {
  const { goToStep } = useFunnel();

  const handleCta = useCallback(() => {
    goToStep("pool-diagnostic");
    setTimeout(() => {
      const el = document.getElementById("funnel-viewport");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }, [goToStep]);

  const { problems } = siteContent.education;

  return (
    <section className="w-full bg-white px-5 py-16 sm:px-6 sm:py-20 md:px-8" aria-labelledby="education-heading">
      <div className="mx-auto max-w-5xl">
        <div className="text-center">
          <h2
            id="education-heading"
            className="text-2xl font-bold tracking-tight text-brand-navy sm:text-3xl"
          >
            {siteContent.education.heading}
          </h2>
          <p className="mt-3 text-neutral-600">
            {siteContent.education.subheading}
          </p>
        </div>

        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          {problems.map((problem, i) => (
            <div
              key={i}
              className="rounded-xl border border-neutral-200 bg-brand-surface/50 p-6"
            >
              <h3 className="text-base font-semibold text-brand-navy">
                {problem.heading}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-neutral-600">
                {problem.text}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-10 text-center">
          <CtaButton size="lg" onClick={handleCta}>
            {siteContent.education.cta}
          </CtaButton>
        </div>
      </div>
    </section>
  );
}
