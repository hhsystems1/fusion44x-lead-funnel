import type { ReactNode } from "react";

interface QuestionCardProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  questionNumber?: number;
  totalQuestions?: number;
}

export function QuestionCard({
  title,
  subtitle,
  children,
  questionNumber,
  totalQuestions,
}: QuestionCardProps) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
      {questionNumber != null && totalQuestions != null && (
        <p className="mb-2 text-sm font-medium text-neutral-500">
          Question {questionNumber} of {totalQuestions}
        </p>
      )}
      <h3 className="text-xl font-semibold text-neutral-900 sm:text-2xl">
        {title}
      </h3>
      {subtitle && (
        <p className="mt-2 text-neutral-600">{subtitle}</p>
      )}
      <div className="mt-6">{children}</div>
    </div>
  );
}
