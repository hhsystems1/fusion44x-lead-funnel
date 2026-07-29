"use client";

import { useEffect, useRef } from "react";
import { siteContent } from "@/config/site-content";
import { assets } from "@/config/assets";

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
      els.forEach((e) => e.style.opacity = "1");
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
      <div className="mx-auto max-w-5xl">
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

        <div className="mt-10 grid items-start gap-8 md:grid-cols-2 md:gap-12">
          <div className="relative mx-auto w-full max-w-sm">
            {assets.product_photo.src ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={assets.product_photo.src}
                alt={assets.product_photo.alt}
                className="w-full rounded-xl"
              />
            ) : (
              <div className="flex aspect-square items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/40">
                Fusion44X
              </div>
            )}

            <div className="absolute inset-0 hidden md:block" aria-hidden="true">
              <svg
                viewBox="0 0 400 400"
                className="h-full w-full"
                fill="none"
              >
                <circle cx="300" cy="60" r="16" className="fill-brand-aqua" />
                <circle cx="120" cy="100" r="16" className="fill-brand-aqua" />
                <circle cx="80" cy="280" r="16" className="fill-brand-aqua" />
                <circle cx="320" cy="180" r="16" className="fill-brand-aqua" />
                <circle cx="280" cy="340" r="16" className="fill-brand-aqua" />
                <circle cx="140" cy="350" r="16" className="fill-brand-aqua" />
              </svg>
            </div>
          </div>

          <div className="grid gap-4">
            {callouts.map((callout) => (
              <div
                key={callout.number}
                className="callout-card flex items-start gap-4 rounded-xl border border-white/10 bg-white/5 p-4 opacity-0 transition-all duration-500 motion-reduce:opacity-100"
                style={{
                  transitionDelay: `${callout.number * 100}ms`,
                }}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-aqua text-sm font-bold text-white">
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

        <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-5">
          {system_facts.map((fact, i) => (
            <div
              key={i}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-3 text-center text-xs text-white/70 sm:px-4 sm:py-3 sm:text-sm"
            >
              {fact}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
