"use client";

import { siteContent } from "@/config/site-content";

export function HowFusionWorksSection() {

  const { fusion_intro, benefits, how_fusion_works } = siteContent;

  return (
    <>
      {/* Fusion44X Introduction */}
      <section
        className="w-full bg-white px-5 py-16 sm:px-6 sm:py-20 md:px-8"
        aria-labelledby="fusion-intro-heading"
      >
        <div className="mx-auto max-w-3xl text-center">
          <p className="mb-3 text-sm font-semibold tracking-widest uppercase text-brand-aqua">
            {fusion_intro.eyebrow}
          </p>
          <h2
            id="fusion-intro-heading"
            className="text-2xl font-bold tracking-tight text-brand-navy sm:text-3xl"
          >
            {fusion_intro.heading}
          </h2>
          <p className="mt-4 text-neutral-600">{fusion_intro.body}</p>
          <p className="mt-4 text-neutral-600">{fusion_intro.body2}</p>
          <p className="mt-4 text-neutral-600">{fusion_intro.body3}</p>
          <p className="mt-6 text-base font-semibold text-brand-navy">
            {fusion_intro.core_statement}
          </p>
        </div>
      </section>

      {/* Benefits Section */}
      <section
        className="w-full bg-brand-surface px-5 py-16 sm:px-6 sm:py-20 md:px-8"
        aria-labelledby="benefits-heading"
      >
        <div className="mx-auto max-w-5xl">
          <h2
            id="benefits-heading"
            className="text-center text-2xl font-bold tracking-tight text-brand-navy sm:text-3xl"
          >
            {benefits.heading}
          </h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {benefits.items.map((item, i) => (
              <div
                key={i}
                className="rounded-xl border border-neutral-200 bg-white p-6"
              >
                <h3 className="text-base font-semibold text-brand-navy">
                  {item.heading}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-neutral-600">
                  {item.text}
                </p>
              </div>
            ))}
          </div>
          <p className="mx-auto mt-8 max-w-2xl text-center text-sm text-neutral-500">
            {benefits.qualification}
          </p>
        </div>
      </section>

      {/* How Fusion44X Works Steps */}
      <section
        className="w-full bg-white px-5 py-16 sm:px-6 sm:py-20 md:px-8"
        aria-labelledby="how-fusion-steps-heading"
      >
        <div className="mx-auto max-w-5xl">
          <div className="text-center">
            <p className="mb-3 text-sm font-semibold tracking-widest uppercase text-brand-aqua">
              {how_fusion_works.eyebrow}
            </p>
            <h2
              id="how-fusion-steps-heading"
              className="text-2xl font-bold tracking-tight text-brand-navy sm:text-3xl"
            >
              {how_fusion_works.heading}
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-neutral-600">
              {how_fusion_works.subheading}
            </p>
          </div>

          <div className="mt-10 grid gap-6 sm:grid-cols-2">
            {how_fusion_works.steps.map((step, i) => (
              <div
                key={i}
                className="flex gap-4 rounded-xl border border-neutral-200 bg-brand-surface/50 p-6"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-aqua text-sm font-bold text-white">
                  {i + 1}
                </div>
                <div>
                  <h3 className="text-base font-semibold text-brand-navy">
                    {step.heading}
                  </h3>
                  <p className="mt-1 text-sm text-neutral-600">
                    {step.text}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
