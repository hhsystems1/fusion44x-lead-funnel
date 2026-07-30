"use client";

import { useCallback } from "react";
import {
  Beaker,
  Clock3,
  Infinity,
  RefreshCw,
  RotateCcw,
  TestTube2,
} from "lucide-react";
import { siteContent } from "@/config/site-content";
import { useFunnel } from "@/lib/funnel/funnel-context";
import { CtaButton } from "@/components/ui/cta-button";

const stepIconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Test: TestTube2,
  Add: Beaker,
  Wait: Clock3,
  React: RefreshCw,
  "Test Again": RotateCcw,
};

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
      className="w-full bg-white px-4 py-16 sm:px-6 sm:py-20 md:px-8"
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
          <div className="rounded-xl border border-neutral-200 bg-brand-surface/50 p-4 sm:p-8">
            <h3 className="text-center text-lg font-semibold text-brand-navy sm:text-xl">
              The Traditional Chemical Cycle
            </h3>

            <div className="mx-auto mt-2 w-full max-w-[460px] sm:max-w-[560px]">
              <div className="relative" style={{ aspectRatio: '500/350' }}>
                <span className="sr-only">
                  Traditional chemical cycle:{" "}
                  {chemical_cycle_steps.join(" → ")}.{" "}
                  This cycle repeats endlessly.
                </span>

                {(() => {
                  const N = chemical_cycle_steps.length;
                  const CX = 250, CY = 250;
                  const INNER_R = 80, OUTER_R = 145;
                  const ARROW_R = 145;
                  const SEG_DEG = 56, GAP_DEG = 16;
                  const d2r = (d: number) => (d * Math.PI) / 180;

                  const segs = Array.from({ length: N }, (_, i) => {
                    const center = -90 + i * 360 / N;
                    const sA = center - SEG_DEG / 2;
                    const eA = center + SEG_DEG / 2;
                    const sR = d2r(sA), eR = d2r(eA);

                    const iSx = CX + INNER_R * Math.cos(sR);
                    const iSy = CY + INNER_R * Math.sin(sR);
                    const oSx = CX + OUTER_R * Math.cos(sR);
                    const oSy = CY + OUTER_R * Math.sin(sR);
                    const oEx = CX + OUTER_R * Math.cos(eR);
                    const oEy = CY + OUTER_R * Math.sin(eR);
                    const iEx = CX + INNER_R * Math.cos(eR);
                    const iEy = CY + INNER_R * Math.sin(eR);

                    const path = [
                      `M ${iSx} ${iSy}`,
                      `L ${oSx} ${oSy}`,
                      `A ${OUTER_R} ${OUTER_R} 0 0 1 ${oEx} ${oEy}`,
                      `L ${iEx} ${iEy}`,
                      `A ${INNER_R} ${INNER_R} 0 0 0 ${iSx} ${iSy}`,
                      "Z",
                    ].join(" ");

                    const arrowStart = center + SEG_DEG / 2 + 2;
                    const arrowEnd = center + SEG_DEG / 2 + GAP_DEG - 2;
                    const aS = d2r(arrowStart), aE = d2r(arrowEnd);
                    const aPath = [
                      `M ${CX + ARROW_R * Math.cos(aS)} ${CY + ARROW_R * Math.sin(aS)}`,
                      `A ${ARROW_R} ${ARROW_R} 0 0 1 ${CX + ARROW_R * Math.cos(aE)} ${CY + ARROW_R * Math.sin(aE)}`,
                    ].join(" ");

                    const cR = d2r(center);
                    const cX = CX + (INNER_R + OUTER_R) / 2 * Math.cos(cR);
                    const cY = CY + (INNER_R + OUTER_R) / 2 * Math.sin(cR);

                    return { path, aPath, cX, cY };
                  });

                  return (
                    <svg
                      viewBox="0 75 500 350"
                      className="w-full h-auto"
                      aria-hidden="true"
                    >
                      <defs>
                        <filter id="seg-shadow" x="-10%" y="-10%" width="130%" height="130%">
                          <feDropShadow dx="0" dy="3" stdDeviation="4" flood-color="#0c1e3a" flood-opacity="0.07" />
                        </filter>
                        {segs.map((_, i) => (
                          <marker
                            key={i}
                            id={`a${i}`}
                            viewBox="0 0 10 10"
                            refX="8"
                            refY="5"
                            markerWidth="7"
                            markerHeight="7"
                            orient="auto"
                          >
                            <path d="M 0 0 L 9 5 L 0 10 z" fill="#0096ff" />
                          </marker>
                        ))}
                      </defs>

                      {segs.map((seg, i) => (
                        <path
                          key={i}
                          d={seg.path}
                          fill="#e6f4ff"
                          stroke="#0096ff"
                          strokeWidth="1.5"
                          strokeLinejoin="round"
                          filter="url(#seg-shadow)"
                        />
                      ))}

                      {segs.map((seg, i) => (
                        <path
                          key={`a${i}`}
                          d={seg.aPath}
                          fill="none"
                          stroke="#0096ff"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          markerEnd={`url(#a${i})`}
                        />
                      ))}

                      <circle
                        cx={CX}
                        cy={CY}
                        r="76"
                        fill="white"
                        stroke="#0096ff"
                        strokeWidth="2.5"
                        filter="url(#seg-shadow)"
                      />
                    </svg>
                  );
                })()}

                <div className="pointer-events-none absolute inset-0 flex items-center justify-center select-none">
                  <div className="flex flex-col items-center gap-1">
                    <Infinity className="h-9 w-9 text-brand-aqua" />
                    <span className="text-center text-xs font-bold leading-snug tracking-wider text-brand-navy">
                      THE CYCLE<br />NEVER ENDS
                    </span>
                  </div>
                </div>

                {chemical_cycle_steps.map((step, i) => {
                  const Icon = stepIconMap[step];
                  const N = chemical_cycle_steps.length;
                  const CX = 250, CY = 250;
                  const INNER_R = 80, OUTER_R = 145;
                  const center = -90 + i * 360 / N;
                  const cR = center * Math.PI / 180;
                  const cX = CX + (INNER_R + OUTER_R) / 2 * Math.cos(cR);
                  const cY = CY + (INNER_R + OUTER_R) / 2 * Math.sin(cR);

                  return (
                    <div
                      key={step}
                      className="pointer-events-none absolute select-none"
                      style={{
                        left: `${(cX / 500) * 100}%`,
                        top: `${((cY - 75) / 350) * 100}%`,
                        transform: "translate(-50%, -50%)",
                      }}
                    >
                      <div className="flex flex-col items-center gap-0.5">
                        <span className="text-[8px] font-bold leading-none text-brand-navy sm:text-[10px]">
                          {i + 1}
                        </span>
                        <Icon className="h-3.5 w-3.5 text-brand-aqua sm:h-5 sm:w-5" />
                        <span className="whitespace-nowrap text-[9px] font-semibold text-brand-navy sm:text-[11px]">
                          {step}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
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
