"use client";

import { useEffect, useRef } from "react";
import {
  Droplets,
  Gauge,
  Pipette,
  Shield,
  Timer,
} from "lucide-react";
import { siteContent } from "@/config/site-content";
import { assets } from "@/config/assets";

const factIcons = [
  Droplets,   // Hydrogen bubbles
  Gauge,      // pH range
  Timer,      // Pump runtime
  Shield,     // Annual probe replacement
  Pipette,    // Compatible with many systems
];

function useIntersectionAnimation(
  ref: React.RefObject<HTMLElement | null>,
  selector: string,
) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const els = el.querySelectorAll<HTMLElement>(selector);
    if (els.length === 0) return;

    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (prefersReduced) {
      els.forEach((e) => (e.style.opacity = "1"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("animate-fade-in");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 },
    );

    els.forEach((e) => observer.observe(e));
    return () => observer.disconnect();
  }, [ref, selector]);
}

export function HowFusion44xWorksSection() {
  const sectionRef = useRef<HTMLElement>(null);
  useIntersectionAnimation(sectionRef, ".callout-card");

  const { callouts, system_facts } = siteContent.how_fusion44x_works;

  return (
    <section
      id="how-it-works"
      ref={sectionRef}
      className="w-full bg-brand-navy px-5 py-16 sm:px-6 sm:py-20 md:px-8"
      aria-labelledby="hiw-product-heading"
    >
      <div className="mx-auto max-w-6xl">
        <div className="text-center">
          <p className="mb-2 text-sm font-semibold tracking-widest uppercase text-brand-aqua-light">
            {siteContent.how_fusion44x_works.eyebrow}
          </p>
          <h2
            id="hiw-product-heading"
            className="text-2xl font-bold tracking-tight text-white sm:text-3xl"
          >
            {siteContent.how_fusion44x_works.heading}
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-white/60">
            {siteContent.how_fusion44x_works.subheading}
          </p>
        </div>

        <div className="mt-10 md:flex md:items-start md:gap-8 lg:gap-12">
          <div className="md:w-1/2 md:shrink-0">
            {assets.how_it_works_reference.src ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={assets.how_it_works_reference.src}
                alt={
                  assets.how_it_works_reference.alt
                }
                className="w-full h-auto rounded-xl object-contain"
              />
            ) : (
              <div className="flex aspect-[1122/1402] max-w-sm items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/40">
                Fusion44X System Diagram
              </div>
            )}
          </div>

          <div className="relative mt-6 md:mt-0 md:w-1/2">
            <div
              className="absolute left-0 top-2 bottom-2 w-px bg-gradient-to-b from-brand-aqua/50 via-brand-aqua/20 to-transparent hidden md:block"
              aria-hidden="true"
            />
            <div className="space-y-3 md:pl-8 lg:pl-10">
              {callouts.map((callout) => (
                <div
                  key={callout.number}
                  className="callout-card relative flex items-start gap-4 rounded-xl border border-white/10 bg-white/5 p-4 opacity-0 transition-all duration-500 motion-reduce:opacity-100"
                  style={{
                    transitionDelay: `${callout.number * 100}ms`,
                  }}
                >
                  <div
                    className="absolute left-0 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 md:block"
                    aria-hidden="true"
                  >
                    <div className="h-2.5 w-2.5 rounded-full bg-brand-aqua shadow-[0_0_6px_rgba(8,145,178,0.5)]" />
                  </div>
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-aqua/20 text-sm font-bold text-brand-aqua-light">
                    {callout.number}
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold text-white">
                      {callout.title}
                    </h3>
                    <p className="mt-0.5 text-sm text-white/60">
                      {callout.text}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
          {system_facts.map((fact, i) => {
            const Icon = factIcons[i] ?? null;
            return (
              <div
                key={i}
                className="flex flex-col items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-4 text-center"
              >
                {Icon && (
                  <Icon
                    className="h-5 w-5 text-brand-aqua-light"
                    aria-hidden="true"
                    strokeWidth={1.5}
                  />
                )}
                <span className="text-xs leading-relaxed text-white/70 sm:text-sm">
                  {fact}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
