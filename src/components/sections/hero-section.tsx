"use client";

import { InternalEvents } from "@/config/tracking-events";
import { siteContent } from "@/config/site-content";
import { useFunnel } from "@/lib/funnel/funnel-context";
import { CtaButton } from "@/components/ui/cta-button";

export function HeroSection() {
  const { goToStep, tracker } = useFunnel();

  function handleCta() {
    tracker?.track(InternalEvents.HERO_CTA_CLICKED, { step_id: "hero" });
    goToStep("pool-diagnostic");
    const el = document.getElementById("pool-diagnostic");
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  }

  return (
    <section
      id="hero"
      className="relative w-full overflow-hidden bg-gradient-to-br from-brand-navy via-brand-blue to-brand-navy px-5 py-20 sm:px-6 sm:py-28 md:px-8"
      aria-labelledby="hero-heading"
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-1/2 -right-1/4 h-[600px] w-[600px] rounded-full bg-brand-aqua/8 blur-3xl" />
        <div className="absolute -bottom-1/3 -left-1/4 h-[500px] w-[500px] rounded-full bg-brand-aqua-light/5 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-3xl text-center">
        <p className="mb-4 text-sm font-semibold tracking-widest uppercase text-brand-aqua-light">
          {siteContent.company.name}
        </p>

        <h1
          id="hero-heading"
          className="text-4xl font-bold tracking-tight text-white sm:text-5xl md:text-6xl"
        >
          {siteContent.hero.heading}
        </h1>

        <p className="mx-auto mt-5 max-w-xl text-lg text-white/70 sm:text-xl">
          {siteContent.hero.subheading}
        </p>

        <div className="mt-8">
          <CtaButton
            size="lg"
            variant="secondary"
            className="border-white/30 bg-white text-brand-navy hover:bg-white/90 hover:border-white/50 shadow-lg shadow-black/20"
            onClick={handleCta}
          >
            {siteContent.hero.cta}
          </CtaButton>
        </div>

        <div className="mt-8 flex items-center justify-center gap-6 text-sm text-white/50">
          <span className="flex items-center gap-1.5">
            <svg className="h-4 w-4 text-brand-aqua-light" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Free diagnostic
          </span>
          <span className="flex items-center gap-1.5">
            <svg className="h-4 w-4 text-brand-aqua-light" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            No obligation
          </span>
          <span className="flex items-center gap-1.5">
            <svg className="h-4 w-4 text-brand-aqua-light" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Expert guidance
          </span>
        </div>

        <p className="mt-4 text-xs text-white/40">
          {siteContent.hero.trust_line}
        </p>
      </div>
    </section>
  );
}
