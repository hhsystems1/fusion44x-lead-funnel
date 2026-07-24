"use client";

import { useEffect, useRef } from "react";
import { siteContent } from "@/config/site-content";
import { diagnosticQuestions } from "@/config/funnel-questions";
import { InternalEvents } from "@/config/tracking-events";
import { FUNNEL_STEPS } from "@/types/funnel";
import { useFunnel } from "@/lib/funnel/funnel-context";
import { getPersistedQuestionAnswer } from "@/lib/funnel/persistence";
import { SectionContainer } from "@/components/ui/section-container";
import { QuestionCard } from "@/components/ui/question-card";
import { AnswerOption } from "@/components/ui/answer-option";
import { CtaButton } from "@/components/ui/cta-button";
import { ProgressIndicator } from "@/components/ui/progress-indicator";

export function PoolDiagnosticSection() {
  const {
    state,
    answerSingle,
    answerMultiToggle,
    diagNext,
    diagBack,
    isCurrentQuestionAnswered,
    isDiagValid,
    diagProgress,
    tracker,
  } = useFunnel();

  const hasTrackedStart = useRef(false);
  const hasTrackedView = useRef(false);

  useEffect(() => {
    if (!hasTrackedStart.current) {
      tracker?.track(InternalEvents.DIAGNOSTIC_STARTED, {
        step_id: FUNNEL_STEPS.POOL_DIAGNOSTIC,
      });
      hasTrackedStart.current = true;
    }
  }, [tracker]);

  useEffect(() => {
    if (!hasTrackedView.current) {
      const q = diagnosticQuestions[state.diag_current_index];
      if (q) {
        tracker?.track(InternalEvents.QUESTION_VIEWED, {
          step_id: FUNNEL_STEPS.POOL_DIAGNOSTIC,
          question_id: q.id,
        });
        hasTrackedView.current = true;
      }
    }
  }, [state.diag_current_index, tracker]);

  const currentQuestion = diagnosticQuestions[state.diag_current_index];
  if (!currentQuestion) return null;

  const isLast = state.diag_current_index === diagnosticQuestions.length - 1;
  const isFirst = state.diag_current_index === 0;

  function handleSelect(code: string) {
    if (currentQuestion.type === "multi-select") {
      answerMultiToggle(currentQuestion.id, code);
    } else {
      answerSingle(currentQuestion.id, code);
    }
  }

  function handleNext() {
    if (isLast) {
      tracker?.track(InternalEvents.DIAGNOSTIC_COMPLETED, {
        step_id: FUNNEL_STEPS.POOL_DIAGNOSTIC,
        metadata: {
          total_questions: diagnosticQuestions.length,
          answered: diagnosticQuestions.filter((q) => {
            const a = getPersistedQuestionAnswer(q.id, state.diagnostic_answers);
            return q.type === "multi-select"
              ? Array.isArray(a) && a.length > 0
              : typeof a === "string" && a.length > 0;
          }).length,
        },
      });
      const contactEl = document.getElementById("contact-information");
      if (contactEl) {
        contactEl.scrollIntoView({ behavior: "smooth" });
      }
    } else {
      diagNext();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleNext();
    }
  }

  const currentAnswer = getPersistedQuestionAnswer(
    currentQuestion.id,
    state.diagnostic_answers,
  );

  return (
    <SectionContainer id="pool-diagnostic" background="light">
      <div className="text-center">
        <h2
          id="diagnostic-heading"
          className="text-2xl font-bold tracking-tight sm:text-3xl"
        >
          {siteContent.diagnostic.heading}
        </h2>
        <p className="mt-3 text-neutral-600">
          {siteContent.diagnostic.subheading}
        </p>
      </div>

      <div className="mt-8">
        <ProgressIndicator
          current={diagProgress.current}
          total={diagProgress.total}
          label={`${siteContent.diagnostic.progress_label} ${diagProgress.current} ${siteContent.diagnostic.of} ${diagProgress.total}`}
        />
      </div>

      <div className="mt-6" onKeyDown={handleKeyDown}>
        <QuestionCard
          title={currentQuestion.title}
          subtitle={currentQuestion.subtitle}
          questionNumber={diagProgress.current}
          totalQuestions={diagProgress.total}
        >
          <div
            className="flex flex-col gap-3"
            role={currentQuestion.type === "single-select" ? "radiogroup" : "group"}
            aria-label={currentQuestion.title}
          >
            {currentQuestion.options.map((option) => (
              <AnswerOption
                key={option.code}
                code={option.code}
                label={option.label}
                selected={
                  currentQuestion.type === "multi-select"
                    ? Array.isArray(currentAnswer) &&
                      currentAnswer.includes(option.code as never)
                    : currentAnswer === option.code
                }
                type={
                  currentQuestion.type === "multi-select" ? "multi" : "single"
                }
                onSelect={handleSelect}
              />
            ))}
          </div>
        </QuestionCard>
      </div>

      <div className="mt-6 flex items-center justify-between">
        <div>
          {!isFirst && (
            <CtaButton variant="ghost" onClick={diagBack}>
              {siteContent.diagnostic.back}
            </CtaButton>
          )}
        </div>
        <div>
          {isLast ? (
            <CtaButton
              variant="primary"
              onClick={handleNext}
              disabled={!isDiagValid()}
            >
              {siteContent.diagnostic.complete}
            </CtaButton>
          ) : (
            <CtaButton
              variant="primary"
              onClick={handleNext}
              disabled={!isCurrentQuestionAnswered()}
            >
              {siteContent.diagnostic.next}
            </CtaButton>
          )}
        </div>
      </div>
    </SectionContainer>
  );
}
