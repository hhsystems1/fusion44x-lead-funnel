"use client";

import { useCallback } from "react";
import { Logo } from "@/components/ui/logo";
import { useFunnel } from "@/lib/funnel/funnel-context";

export function Header() {
  const { goToStep, state } = useFunnel();

  const handleScheduleClick = useCallback(() => {
    goToStep(state.current_step);
    setTimeout(() => {
      const el = document.getElementById("funnel-viewport");
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 50);
  }, [goToStep, state.current_step]);

  return (
    <header className="relative z-50 w-full border-b border-neutral-200/80 bg-white">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-5 sm:h-16 sm:px-6 md:px-8">
        <Logo className="max-w-[120px] sm:max-w-[140px]" />

        <div className="flex items-center gap-3">
          <a
            href="tel:+17756005305"
            className="hidden items-center gap-1.5 text-sm font-medium text-brand-navy transition-colors hover:text-brand-aqua sm:inline-flex"
            aria-label="Call 775-600-5305"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
              />
            </svg>
            775-600-5305
          </a>

          <a
            href="tel:+17756005305"
            className="flex items-center gap-1.5 text-sm font-medium text-brand-navy transition-colors hover:text-brand-aqua sm:hidden"
            aria-label="Call 775-600-5305"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
              />
            </svg>
          </a>

          <button
            onClick={handleScheduleClick}
            className="inline-flex items-center justify-center rounded-lg bg-brand-aqua px-2 py-1 text-[11px] font-semibold text-white transition-all duration-200 hover:bg-brand-aqua-light focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-aqua sm:px-5 sm:py-2.5 sm:text-sm"
          >
            Schedule a Call
          </button>
        </div>
      </div>
    </header>
  );
}
