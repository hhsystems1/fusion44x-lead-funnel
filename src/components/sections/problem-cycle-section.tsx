"use client";

import { useCallback } from "react";
import { siteContent } from "@/config/site-content";
import { useFunnel } from "@/lib/funnel/funnel-context";
import { CtaButton } from "@/components/ui/cta-button";

function ProblemIcon({ index }: { index: number }) {
  const icons = [
    // Recurring Algae - water/refresh
    <svg key={0} className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.627 48.627 0 0 1 12 20.904a48.627 48.627 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.57 50.57 0 0 0-2.658-.813A59.905 59.905 0 0 1 12 3.493a59.902 59.902 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342" />
    </svg>,
    // Constant Chemical Balancing - flask/droplet
    <svg key={1} className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 3.104v5.714a2.25 2.25 0 0 1-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 0 1 4.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0 1 12 15a9.065 9.065 0 0 0-6.23.693L5 14.5m14.8.8 1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0 1 12 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
    </svg>,
    // Harsh-Feeling Water - eye/water drop
    <svg key={2} className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
    </svg>,
    // Questions About Water - shield/check
    <svg key={3} className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
    </svg>,
  ];
  return <>{icons[index] ?? null}</>;
}

export function ProblemCycleSection() {
  const { goToStep } = useFunnel();

  const handleCta = useCallback(() => {
    goToStep("pool-diagnostic");
    setTimeout(() => {
      const el = document.getElementById("funnel-viewport");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }, [goToStep]);

  const { problems, chemical_cycle_steps, chemical_examples, belief_line } =
    siteContent.problem_cycle;

  return (
    <section
      className="w-full bg-white px-5 py-16 sm:px-6 sm:py-20 md:px-8"
      aria-labelledby="problem-cycle-heading"
    >
      <div className="mx-auto max-w-5xl">
        <div className="text-center">
          <p className="mb-2 text-sm font-semibold tracking-widest uppercase text-brand-aqua">
            {siteContent.problem_cycle.eyebrow}
          </p>
          <h2
            id="problem-cycle-heading"
            className="text-2xl font-bold tracking-tight text-brand-navy sm:text-3xl"
          >
            {siteContent.problem_cycle.heading}
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-neutral-600">
            {siteContent.problem_cycle.subheading}
          </p>
        </div>

        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          {problems.map((problem, i) => (
            <div
              key={i}
              className="flex gap-4 rounded-xl border border-neutral-200 bg-brand-surface/50 p-6"
            >
              <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-aqua/10 text-brand-aqua">
                <ProblemIcon index={i} />
              </div>
              <div>
                <h3 className="text-base font-semibold text-brand-navy">
                  {problem.heading}
                </h3>
                <p className="mt-1 text-sm leading-relaxed text-neutral-600">
                  {problem.text}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-14">
          <div className="rounded-xl border border-neutral-200 bg-brand-surface/50 p-6 sm:p-8">
            <h3 className="text-center text-lg font-semibold text-brand-navy sm:text-xl">
              The Traditional Chemical Cycle
            </h3>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-2 sm:gap-3">
              {chemical_cycle_steps.map((step, i) => (
                <div key={i} className="flex items-center gap-2 sm:gap-3">
                  <span className="inline-flex items-center justify-center rounded-lg bg-brand-aqua/10 px-3 py-1.5 text-sm font-medium text-brand-aqua sm:px-4 sm:py-2">
                    {step}
                  </span>
                  {i < chemical_cycle_steps.length - 1 && (
                    <svg
                      className="hidden h-5 w-5 text-neutral-300 sm:block"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-neutral-500">
              {chemical_examples.map((ex, i) => (
                <span key={i} className="inline-flex items-center gap-1">
                  <span className="h-1 w-1 rounded-full bg-neutral-300" />
                  {ex}
                </span>
              ))}
            </div>

            <p className="mx-auto mt-6 max-w-xl text-center text-sm italic text-neutral-500">
              {belief_line}
            </p>
          </div>
        </div>

        <div className="mt-10 text-center">
          <CtaButton size="lg" onClick={handleCta}>
            {siteContent.problem_cycle.cta}
          </CtaButton>
        </div>
      </div>
    </section>
  );
}
