"use client";

import { useCallback } from "react";
import { siteContent } from "@/config/site-content";
import { assets } from "@/config/assets";
import { useFunnel } from "@/lib/funnel/funnel-context";
import { CtaButton } from "@/components/ui/cta-button";
import { AssetPlaceholder } from "@/components/ui/asset-placeholder";

export function SolutionSection() {
  const { goToStep } = useFunnel();

  const handleCta = useCallback(() => {
    goToStep("pool-diagnostic");
    setTimeout(() => {
      const el = document.getElementById("funnel-viewport");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }, [goToStep]);

  return (
    <section
      className="w-full bg-brand-surface px-5 py-16 sm:px-6 sm:py-20 md:px-8"
      aria-labelledby="solution-heading"
    >
      <div className="mx-auto max-w-5xl">
        <p className="mb-2 text-center text-sm font-semibold tracking-widest uppercase text-brand-aqua">
          {siteContent.solution.eyebrow}
        </p>
        <h2
          id="solution-heading"
          className="text-center text-2xl font-bold tracking-tight text-brand-navy sm:text-3xl"
        >
          {siteContent.solution.heading}
        </h2>

        <div className="mt-10 grid items-start gap-10 md:grid-cols-2 md:gap-12">
          <div>
            <p className="text-base leading-relaxed text-neutral-700">
              {siteContent.solution.body}
            </p>
            <p className="mt-4 text-base leading-relaxed text-neutral-600">
              {siteContent.solution.supporting}
            </p>

            <h3 className="mt-8 text-lg font-semibold text-brand-navy">
              {siteContent.solution.benefits_heading}
            </h3>
            <ul className="mt-4 space-y-3">
              {siteContent.solution.benefits.map((benefit, i) => (
                <li key={i} className="flex items-start gap-3">
                  <svg
                    className="mt-0.5 h-5 w-5 shrink-0 text-brand-aqua"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                    />
                  </svg>
                  <span className="text-sm text-neutral-700">{benefit}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex items-start justify-center">
            {assets.product_photo.src ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={assets.product_photo.src}
                alt={assets.product_photo.alt}
                className="w-full max-w-sm rounded-xl"
              />
            ) : (
              <AssetPlaceholder
                label={assets.product_photo.placeholder}
                aspect="square"
              />
            )}
          </div>
        </div>

        <p className="mx-auto mt-8 max-w-xl text-center text-sm text-neutral-500">
          {siteContent.solution.qualification}
        </p>

        <div className="mt-6 text-center">
          <CtaButton size="lg" onClick={handleCta}>
            {siteContent.solution.cta}
          </CtaButton>
        </div>
      </div>
    </section>
  );
}
