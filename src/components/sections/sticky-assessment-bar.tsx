"use client";

import { useCallback } from "react";
import { useFunnel } from "@/lib/funnel/funnel-context";
import { FUNNEL_STEPS } from "@/types/funnel";

export function StickyAssessmentBar() {
  const { goToStep, state } = useFunnel();

  const handleClick = useCallback(() => {
    goToStep(state.current_step);
    setTimeout(() => {
      const el = document.getElementById("funnel-viewport");
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 50);
  }, [goToStep, state.current_step]);

  if (state.current_step === FUNNEL_STEPS.CONFIRMATION) {
    return null;
  }

  return (
    <div
      className="fixed bottom-0 inset-x-0 z-40 sm:pb-4 sm:px-4 sm:flex sm:justify-center"
      role="complementary"
      aria-label="Free pool assessment"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="flex items-center justify-between gap-4 border-t border-neutral-200 bg-white px-5 py-3 shadow-[0_-2px_10px_rgba(0,0,0,0.08)] sm:w-full sm:max-w-[780px] sm:rounded-xl sm:border sm:border-neutral-200 sm:shadow-lg sm:py-4 sm:px-6">
        <p className="text-sm font-medium text-brand-navy sm:text-base">
          Ready to take your free pool assessment?
        </p>
        <button
          onClick={handleClick}
          className="shrink-0 inline-flex items-center justify-center rounded-lg bg-brand-aqua px-5 py-2.5 text-sm font-semibold text-white transition-all duration-200 hover:bg-brand-aqua-light focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-aqua sm:px-6 sm:py-3 sm:text-base"
        >
          Start Now
        </button>
      </div>
    </div>
  );
}
