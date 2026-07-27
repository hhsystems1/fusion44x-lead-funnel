"use client";

import { useCallback, useRef, useState } from "react";
import { faqItems } from "@/config/faq";
import { useFunnel } from "@/lib/funnel/funnel-context";

function FaqAccordionItem({
  id,
  question,
  answer,
  isOpen,
  onToggle,
}: {
  id: string;
  question: string;
  answer: string;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const panelId = `faq-panel-${id}`;
  const buttonId = `faq-button-${id}`;

  return (
    <div className="border-b border-neutral-200 last:border-b-0">
      <h3>
        <button
          id={buttonId}
          aria-expanded={isOpen}
          aria-controls={panelId}
          onClick={onToggle}
          className="flex w-full items-center justify-between gap-4 py-4 text-left text-sm font-medium text-brand-navy transition-colors hover:text-brand-aqua sm:text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-aqua"
        >
          <span>{question}</span>
          <svg
            className={`h-5 w-5 shrink-0 text-neutral-400 transition-transform duration-200 ${
              isOpen ? "rotate-180" : ""
            }`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>
      </h3>
      <div
        id={panelId}
        role="region"
        aria-labelledby={buttonId}
        className="overflow-hidden transition-[grid-template-rows] duration-200 ease-in-out motion-reduce:transition-none"
        style={{
          display: "grid",
          gridTemplateRows: isOpen ? "1fr" : "0fr",
        }}
      >
        <div className="min-h-0 overflow-hidden">
          <p className="pb-4 text-sm leading-relaxed text-neutral-600 sm:text-base">
            {answer}
          </p>
        </div>
      </div>
    </div>
  );
}

export function FaqSection() {
  const [openId, setOpenId] = useState<string | null>(null);
  const { goToStep, state } = useFunnel();
  const sectionRef = useRef<HTMLElement>(null);

  const toggleItem = useCallback((id: string) => {
    setOpenId((prev) => (prev === id ? null : id));
  }, []);

  const handleCtaClick = useCallback(() => {
    goToStep(state.current_step);
    setTimeout(() => {
      const el = document.getElementById("funnel-viewport");
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 50);
  }, [goToStep, state.current_step]);

  return (
    <section
      ref={sectionRef}
      id="faq"
      className="w-full bg-white px-5 py-16 sm:px-6 sm:py-20 md:px-8"
      aria-labelledby="faq-heading"
    >
      <div className="mx-auto max-w-3xl">
        <div className="text-center">
          <h2
            id="faq-heading"
            className="text-2xl font-bold tracking-tight text-brand-navy sm:text-3xl"
          >
            Frequently Asked Questions
          </h2>
        </div>

        <div className="mt-10" role="list">
          {faqItems.map((item) => (
            <FaqAccordionItem
              key={item.id}
              id={item.id}
              question={item.question}
              answer={item.answer}
              isOpen={openId === item.id}
              onToggle={() => toggleItem(item.id)}
            />
          ))}
        </div>

        <div className="mt-10 text-center">
          <button
            onClick={handleCtaClick}
            className="inline-flex items-center justify-center rounded-lg bg-brand-aqua px-8 py-4 text-lg font-semibold text-white shadow-sm shadow-brand-aqua/20 transition-all duration-200 hover:bg-brand-aqua-light focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-aqua"
          >
            Get Your Free Pool Assessment
          </button>
        </div>
      </div>
    </section>
  );
}
