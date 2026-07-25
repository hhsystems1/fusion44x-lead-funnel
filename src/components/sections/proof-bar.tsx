"use client";

import { siteContent } from "@/config/site-content";

export function ProofBar() {
  const { proof_bar } = siteContent;
  if (!proof_bar.enabled) return null;

  return (
    <section
      aria-label="Trust and proof"
      className="w-full border-b border-neutral-100 bg-white px-5 py-4 sm:px-6 md:px-8"
    >
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center sm:gap-8">
          {proof_bar.claim && process.env.NODE_ENV === "development" && (
            <p className="text-center text-xs italic text-amber-600 sm:text-left">
              {proof_bar.claim}
            </p>
          )}
          {proof_bar.supporting_items.map((item, i) => (
            <div key={i} className="flex items-center gap-2 text-sm text-neutral-600">
              <svg
                className="h-4 w-4 shrink-0 text-brand-aqua"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              <span>{item}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
