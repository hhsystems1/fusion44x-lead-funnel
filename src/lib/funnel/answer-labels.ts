import { diagnosticQuestions } from "@/config/funnel-questions";

type QuestionLabels = Record<string, string>;

const QUESTION_LABELS: Record<string, QuestionLabels> = buildQuestionLabels();

function buildQuestionLabels(): Record<string, QuestionLabels> {
  const map: Record<string, QuestionLabels> = {};
  for (const question of diagnosticQuestions) {
    const codes: QuestionLabels = {};
    for (const option of question.options) {
      codes[option.code] = option.label;
    }
    map[question.id] = codes;
  }
  return map;
}

export function answerLabel(
  questionId: string,
  code: string | null | undefined,
): string {
  if (!code) return "\u2014";
  if (questionId === "pool-size") {
    const normalizedCode = code === "average" ? "medium" : code;
    const mapped = QUESTION_LABELS[questionId]?.[normalizedCode];
    if (mapped) return mapped;
  }

  const direct = QUESTION_LABELS[questionId]?.[code];
  if (direct) return direct;

  if (questionId === "pool-size" && code === "average") return "Medium";

  return code;
}

export function answerLabels(
  questionId: string,
  codes: readonly string[] | null | undefined,
): string[] {
  if (!codes || codes.length === 0) return [];
  return codes.map((code) => answerLabel(questionId, code));
}
