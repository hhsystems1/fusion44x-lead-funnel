import type { DiagnosticAnswers, DiagnosticQuestionId } from "@/types/funnel";

const ANONYMOUS_ID_KEY = "fusion44x_anonymous_id";
const SESSION_ID_KEY = "fusion44x_session_id";
const ANSWERS_KEY = "fusion44x_diagnostic_answers";
const CURRENT_INDEX_KEY = "fusion44x_diag_index";

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

export function generateAnonymousId(): string {
  const existing = getAnonymousId();
  if (existing) return existing;
  const id = `anon_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  try {
    if (isBrowser()) localStorage.setItem(ANONYMOUS_ID_KEY, id);
  } catch {
    /* storage unavailable — proceed without persistence */
  }
  return id;
}

export function getAnonymousId(): string | null {
  try {
    return isBrowser() ? localStorage.getItem(ANONYMOUS_ID_KEY) : null;
  } catch {
    return null;
  }
}

export function saveSessionId(id: string): void {
  try {
    if (isBrowser()) localStorage.setItem(SESSION_ID_KEY, id);
  } catch {
    /* silent */
  }
}

export function getSessionId(): string | null {
  try {
    return isBrowser() ? localStorage.getItem(SESSION_ID_KEY) : null;
  } catch {
    return null;
  }
}

export function saveDiagnosticAnswers(answers: DiagnosticAnswers): void {
  try {
    if (isBrowser()) {
      localStorage.setItem(ANSWERS_KEY, JSON.stringify(answers));
    }
  } catch {
    /* silent */
  }
}

export function getDiagnosticAnswers(): DiagnosticAnswers | null {
  try {
    if (!isBrowser()) return null;
    const raw = localStorage.getItem(ANSWERS_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as DiagnosticAnswers;
  } catch {
    return null;
  }
}

export function saveDiagIndex(index: number): void {
  try {
    if (isBrowser()) localStorage.setItem(CURRENT_INDEX_KEY, String(index));
  } catch {
    /* silent */
  }
}

export function getDiagIndex(): number {
  try {
    if (!isBrowser()) return 0;
    const raw = localStorage.getItem(CURRENT_INDEX_KEY);
    return raw ? Number(raw) : 0;
  } catch {
    return 0;
  }
}

export function getPersistedQuestionAnswer(
  questionId: DiagnosticQuestionId,
  answers: DiagnosticAnswers,
): string | string[] | undefined {
  switch (questionId) {
    case "water-feature":
      return answers.water_feature;
    case "installation-type":
      return answers.installation_type;
    case "pool-size":
      return answers.pool_size;
    case "current-treatment":
      return answers.current_treatment;
    case "current-issues":
      return answers.current_issues;
    case "primary-goal":
      return answers.primary_goal;
    default:
      return undefined;
  }
}

export function clearAllPersistedData(): void {
  try {
    if (!isBrowser()) return;
    localStorage.removeItem(ANONYMOUS_ID_KEY);
    localStorage.removeItem(SESSION_ID_KEY);
    localStorage.removeItem(ANSWERS_KEY);
    localStorage.removeItem(CURRENT_INDEX_KEY);
  } catch {
    /* silent */
  }
}
