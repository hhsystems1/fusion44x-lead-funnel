"use client";

import { InternalEvents } from "@/config/tracking-events";
import { siteContent } from "@/config/site-content";
import { useFunnel } from "@/lib/funnel/funnel-context";
import { SectionContainer } from "@/components/ui/section-container";
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
    <SectionContainer
      id="hero"
      background="dark"
      className="min-h-[80vh] flex items-center"
    >
      <div className="flex flex-col items-center text-center">
        <h1
          id="hero-heading"
          className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl"
        >
          {siteContent.hero.heading}
        </h1>
        <p className="mt-4 max-w-xl text-lg text-neutral-300 sm:text-xl">
          {siteContent.hero.subheading}
        </p>
        <CtaButton
          size="lg"
          variant="secondary"
          className="mt-8"
          onClick={handleCta}
        >
          {siteContent.hero.cta}
        </CtaButton>
      </div>
    </SectionContainer>
  );
}
