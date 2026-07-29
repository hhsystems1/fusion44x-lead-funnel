"use client";

import { useCallback } from "react";
import { siteContent } from "@/config/site-content";
import { assets } from "@/config/assets";
import { useFunnel } from "@/lib/funnel/funnel-context";
import { CtaButton } from "@/components/ui/cta-button";
import { AssetPlaceholder } from "@/components/ui/asset-placeholder";

interface HeroSectionProps {
  onHowItWorksClick: () => void;
}

export function HeroSection({ onHowItWorksClick }: HeroSectionProps) {
  const { goToStep } = useFunnel();

  const handlePrimaryCta = useCallback(() => {
    goToStep("pool-diagnostic");
    setTimeout(() => {
      const el = document.getElementById("funnel-viewport");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }, [goToStep]);

  return (
    <section
      id="hero"
      className="relative w-full bg-gradient-to-br from-brand-navy via-brand-blue to-brand-navy px-5 py-16 sm:px-6 sm:py-24 md:px-8"
      aria-labelledby="hero-heading"
    >
      <div className="mx-auto max-w-5xl">
        <div className="grid items-center gap-10 md:grid-cols-2 md:gap-12">
          <div className="text-center md:text-left">
            <p className="mb-3 text-sm font-semibold tracking-widest uppercase text-brand-aqua-light">
              {siteContent.hero.eyebrow}
            </p>
            <h1
              id="hero-heading"
              className="text-3xl font-bold tracking-tight text-white sm:text-4xl md:text-5xl"
            >
              {siteContent.hero.heading}
            </h1>
            <p className="mx-auto mt-4 max-w-lg text-base text-white/70 sm:text-lg md:mx-0">
              {siteContent.hero.subheading}
            </p>
            <p className="mx-auto mt-2 max-w-lg text-sm italic text-white/50 sm:text-sm md:mx-0">
              {siteContent.hero.supporting_line}
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center md:justify-start">
              <CtaButton
                size="lg"
                onClick={handlePrimaryCta}
                className="w-full sm:w-auto"
              >
                {siteContent.hero.cta_primary}
              </CtaButton>
              <button
                onClick={onHowItWorksClick}
                className="inline-flex items-center justify-center rounded-lg border border-white/20 px-6 py-3 text-base font-medium text-white/80 transition-colors hover:border-white/40 hover:text-white"
              >
                {siteContent.hero.cta_secondary}
              </button>
            </div>
            <p className="mx-auto mt-6 max-w-lg text-center text-xs text-white/40 md:mx-0 md:text-left">
              {siteContent.hero.trust_line}
            </p>
          </div>
          <div className="hidden md:block">
            {assets.hero_video.src ? (
              <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black">
                <iframe
                  src={`https://player.vimeo.com/video/${assets.hero_video.src}?background=1`}
                  className="absolute inset-0 h-full w-full"
                  allow="autoplay; fullscreen"
                />
              </div>
            ) : assets.hero_image.src ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={assets.hero_image.src}
                alt={assets.hero_image.alt}
                className="w-full rounded-xl"
              />
            ) : (
              <AssetPlaceholder
                label={assets.hero_image.placeholder}
                aspect="video"
              />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
