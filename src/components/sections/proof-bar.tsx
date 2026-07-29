"use client";

import { siteContent } from "@/config/site-content";

export function ProofBar() {
  const { proof_line } = siteContent;
  const line = proof_line.customerCountVerified
    ? proof_line.verified_line
    : proof_line.default_line;

  return (
    <section
      aria-label="Trust and proof"
      className="w-full border-b border-neutral-100 bg-white px-5 py-4 sm:px-6 md:px-8"
    >
      <div className="mx-auto max-w-5xl">
        <div className="flex items-center justify-center gap-2 text-sm text-neutral-600">
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
              d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z"
            />
          </svg>
          <span>{line}</span>
        </div>
      </div>
    </section>
  );
}
