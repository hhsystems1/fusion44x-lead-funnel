"use client";

import { siteContent } from "@/config/site-content";
import { diagnosticQuestions } from "@/config/funnel-questions";
import { useFunnel } from "@/lib/funnel/funnel-context";
import { getPersistedQuestionAnswer } from "@/lib/funnel/persistence";
import { QuestionCard } from "@/components/ui/question-card";
import { AnswerOption } from "@/components/ui/answer-option";
import { CtaButton } from "@/components/ui/cta-button";
import { ProgressIndicator } from "@/components/ui/progress-indicator";

export function PoolDiagnosticStage() {
  const {
    state,
    answerSingle,
    answerMultiToggle,
    diagNext,
    diagBack,
    completeDiagnostic,
    isCurrentQuestionAnswered,
    isDiagValid,
    diagProgress,
  } = useFunnel();

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
      completeDiagnostic();
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
    <div>
      <div className="text-center">
        <h3
          id="diagnostic-stage-heading"
          className="text-2xl font-bold tracking-tight text-brand-navy sm:text-3xl"
        >
          {siteContent.diagnostic.heading}
        </h3>
        <p className="mt-2 text-sm text-neutral-600">
          {siteContent.diagnostic.subheading}
        </p>
      </div>

      <div className="mt-6">
        <ProgressIndicator
          current={diagProgress.current}
          total={diagProgress.total}
          label={`${siteContent.diagnostic.progress_label} ${diagProgress.current} ${siteContent.diagnostic.of} ${diagProgress.total}`}
        />
      </div>

      <div className="mt-5" onKeyDown={handleKeyDown}>
        <QuestionCard
          title={currentQuestion.title}
          subtitle={currentQuestion.subtitle}
          questionNumber={diagProgress.current}
          totalQuestions={diagProgress.total}
        >
          <div
            className="flex flex-col gap-2.5"
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

      <div className="mt-5 flex items-center justify-between gap-3">
        <div>
          {!isFirst && (
            <CtaButton variant="ghost" size="sm" onClick={diagBack}>
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
    </div>
  );
}
