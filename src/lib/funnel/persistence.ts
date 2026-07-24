import type { DiagnosticAnswers, DiagnosticQuestionId, FunnelStepId } from "@/types/funnel";

const ANONYMOUS_ID_KEY = "fusion44x_anonymous_id";
const SESSION_ID_KEY = "fusion44x_session_id";
const ANSWERS_KEY = "fusion44x_diagnostic_answers";
const CURRENT_INDEX_KEY = "fusion44x_diag_index";
const STEP_KEY = "fusion44x_current_step";
const LEAD_ID_KEY = "fusion44x_lead_id";
const BOOKING_STEP_KEY = "fusion44x_booking_step";
const SELECTED_DATE_KEY = "fusion44x_selected_date";
const SELECTED_SLOT_START_KEY = "fusion44x_selected_slot_start";
const SELECTED_SLOT_END_KEY = "fusion44x_selected_slot_end";

type StorageArea = "local" | "session";

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function storage(area: StorageArea): Storage | null {
  if (!isBrowser()) return null;
  try {
    return area === "local" ? localStorage : sessionStorage;
  } catch {
    return null;
  }
}

function getItem(key: string, area: StorageArea): string | null {
  try {
    return storage(area)?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function setItem(key: string, value: string, area: StorageArea): void {
  try {
    storage(area)?.setItem(key, value);
  } catch {
    /* silent */
  }
}

function removeItem(key: string, area: StorageArea): void {
  try {
    storage(area)?.removeItem(key);
  } catch {
    /* silent */
  }
}

// ---------------------------------------------------------------------------
// Anonymous ID (localStorage — persists across sessions for attribution)
// ---------------------------------------------------------------------------

export function generateAnonymousId(): string {
  const existing = getAnonymousId();
  if (existing) return existing;
  const id = crypto.randomUUID
    ? `anon_${crypto.randomUUID()}`
    : `anon_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  setItem(ANONYMOUS_ID_KEY, id, "local");
  return id;
}

export function getAnonymousId(): string | null {
  return getItem(ANONYMOUS_ID_KEY, "local");
}

// ---------------------------------------------------------------------------
// Session ID (sessionStorage — scoped to browser session)
// ---------------------------------------------------------------------------

export function saveSessionId(id: string): void {
  setItem(SESSION_ID_KEY, id, "session");
}

export function getSessionId(): string | null {
  return getItem(SESSION_ID_KEY, "session");
}

// ---------------------------------------------------------------------------
// Diagnostic Answers (sessionStorage)
// ---------------------------------------------------------------------------

export function saveDiagnosticAnswers(answers: DiagnosticAnswers): void {
  setItem(ANSWERS_KEY, JSON.stringify(answers), "session");
}

export function getDiagnosticAnswers(): DiagnosticAnswers | null {
  const raw = getItem(ANSWERS_KEY, "session");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as DiagnosticAnswers;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Diagnostic Index (sessionStorage)
// ---------------------------------------------------------------------------

export function saveDiagIndex(index: number): void {
  setItem(CURRENT_INDEX_KEY, String(index), "session");
}

export function getDiagIndex(): number {
  const raw = getItem(CURRENT_INDEX_KEY, "session");
  return raw ? Number(raw) : 0;
}

// ---------------------------------------------------------------------------
// Current Funnel Step (sessionStorage)
// ---------------------------------------------------------------------------

export function saveCurrentStep(step: FunnelStepId): void {
  setItem(STEP_KEY, step, "session");
}

export function getCurrentStep(): FunnelStepId | null {
  return getItem(STEP_KEY, "session") as FunnelStepId | null;
}

// ---------------------------------------------------------------------------
// Lead ID (sessionStorage)
// ---------------------------------------------------------------------------

export function saveLeadId(id: string): void {
  setItem(LEAD_ID_KEY, id, "session");
}

export function getLeadId(): string | null {
  return getItem(LEAD_ID_KEY, "session");
}

// ---------------------------------------------------------------------------
// Booking Step (sessionStorage)
// ---------------------------------------------------------------------------

export function saveBookingStep(step: FunnelStepId): void {
  setItem(BOOKING_STEP_KEY, step, "session");
}

export function getBookingStep(): FunnelStepId | null {
  return getItem(BOOKING_STEP_KEY, "session") as FunnelStepId | null;
}

// ---------------------------------------------------------------------------
// Selected Date (sessionStorage)
// ---------------------------------------------------------------------------

export function saveSelectedDate(date: string | null): void {
  if (date) {
    setItem(SELECTED_DATE_KEY, date, "session");
  } else {
    removeItem(SELECTED_DATE_KEY, "session");
  }
}

export function getSelectedDate(): string | null {
  return getItem(SELECTED_DATE_KEY, "session");
}

// ---------------------------------------------------------------------------
// Selected Slot (sessionStorage)
// ---------------------------------------------------------------------------

export function saveSelectedSlotStart(start: string | null): void {
  if (start) {
    setItem(SELECTED_SLOT_START_KEY, start, "session");
  } else {
    removeItem(SELECTED_SLOT_START_KEY, "session");
  }
}

export function getSelectedSlotStart(): string | null {
  return getItem(SELECTED_SLOT_START_KEY, "session");
}

export function saveSelectedSlotEnd(end: string | null): void {
  if (end) {
    setItem(SELECTED_SLOT_END_KEY, end, "session");
  } else {
    removeItem(SELECTED_SLOT_END_KEY, "session");
  }
}

export function getSelectedSlotEnd(): string | null {
  return getItem(SELECTED_SLOT_END_KEY, "session");
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

export function clearSessionData(): void {
  removeItem(SESSION_ID_KEY, "session");
  removeItem(ANSWERS_KEY, "session");
  removeItem(CURRENT_INDEX_KEY, "session");
  removeItem(STEP_KEY, "session");
  removeItem(LEAD_ID_KEY, "session");
  removeItem(BOOKING_STEP_KEY, "session");
  removeItem(SELECTED_DATE_KEY, "session");
  removeItem(SELECTED_SLOT_START_KEY, "session");
  removeItem(SELECTED_SLOT_END_KEY, "session");
}