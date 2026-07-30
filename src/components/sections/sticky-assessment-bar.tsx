"use client";

import { useCallback, useEffect, useState } from "react";
import { useFunnel } from "@/lib/funnel/funnel-context";
import { FUNNEL_STEPS } from "@/types/funnel";
import { siteContent } from "@/config/site-content";

export function StickyAssessmentBar() {
  const { goToStep, state } = useFunnel();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      const scrollY = window.scrollY;
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      setVisible(scrollY > 5 && scrollY < maxScroll - 120);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleClick = useCallback(() => {
    goToStep(state.current_step);
    setTimeout(() => {
      const el = document.getElementById("funnel-viewport");
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 50);
  }, [goToStep, state.current_step]);

  if (state.current_step === FUNNEL_STEPS.CONFIRMATION || !visible) {
    return null;
  }

  return (
    <div
      className="fixed bottom-0.5 inset-x-0 z-40 px-4 sm:pb-4 sm:flex sm:justify-center"
      role="complementary"
      aria-label="Free pool assessment"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="flex items-center justify-between gap-4 bg-white/75 backdrop-blur-xl border border-white/20 px-5 py-3 shadow-xl rounded-2xl sm:w-full sm:max-w-[780px] sm:py-4 sm:px-6">
        <p className="text-sm font-medium text-brand-navy sm:text-base">
          <span className="sm:hidden">{siteContent.sticky_cta.question_mobile}</span>
          <span className="hidden sm:inline">{siteContent.sticky_cta.question}</span>
        </p>
        <button
          onClick={handleClick}
          className="shrink-0 inline-flex items-center justify-center rounded-lg bg-brand-aqua px-3 py-1.5 text-xs font-semibold text-white transition-all duration-200 hover:bg-brand-aqua-light focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-aqua sm:px-6 sm:py-3 sm:text-base"
        >
          <span className="sm:hidden">Start Now</span>
          <span className="hidden sm:inline">{siteContent.sticky_cta.button}</span>
        </button>
      </div>
    </div>
  );
}
