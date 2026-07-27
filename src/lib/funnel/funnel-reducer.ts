import type {
  DiagnosticAnswers,
  DiagnosticQuestionId,
  FunnelState,
  FunnelStepId,
  SubmissionState,
  BookingErrorCode,
} from "@/types/funnel";
import { FUNNEL_STEPS } from "@/types/funnel";

export type FunnelAction =
  | { type: "GO_TO_STEP"; step: FunnelStepId }
  | { type: "SET_SESSION"; session_id: string }
  | { type: "SET_LEAD_ID"; lead_id: string }
  | { type: "HYDRATE"; payload: Partial<FunnelState> }
  | { type: "ANSWER_SINGLE"; question_id: DiagnosticQuestionId; code: string }
  | { type: "ANSWER_MULTI_TOGGLE"; question_id: DiagnosticQuestionId; code: string }
  | { type: "DIAG_NEXT" }
  | { type: "DIAG_BACK" }
  | { type: "DIAG_SET_INDEX"; index: number }
  | { type: "CONTACT_SUBMIT_START" }
  | { type: "CONTACT_SUBMIT_SUCCESS"; lead_id: string; first_name: string; email: string }
  | { type: "CONTACT_SUBMIT_DUPLICATE" }
  | { type: "CONTACT_SUBMIT_ERROR" }
  | { type: "SET_VALIDATION_ERRORS"; errors: Record<string, string> }
  | { type: "CLEAR_VALIDATION_ERRORS" }
  | { type: "COMPLETE_STEP"; step: FunnelStepId }
  | { type: "RESET" }
  | { type: "COMPLETE_DIAGNOSTIC" }
  // Booking actions
  | { type: "SELECT_DATE"; date: string }
  | { type: "SELECT_SLOT"; start: string; end: string }
  | { type: "BOOKING_START" }
  | { type: "BOOKING_SUCCESS"; appointment_id: string; start_time: string; end_time: string }
  | { type: "BOOKING_FAIL"; error_code: BookingErrorCode; api_code?: string }
  | { type: "BOOKING_CONFLICT" }
  | { type: "CLEAR_BOOKING_SELECTION" };

export function createInitialState(): FunnelState {
  return {
    current_step: FUNNEL_STEPS.POOL_DIAGNOSTIC,
    session_id: null,
    lead_id: null,
    first_name: null,
    email: null,
    diagnostic_answers: {},
    completed_steps: [],
    submission_state: "idle",
    validation_errors: {},
    diag_current_index: 0,
    hydration_ready: false,
    selected_date: null,
    selected_slot_start: null,
    selected_slot_end: null,
    appointment_id: null,
    booking_submission_state: "idle",
    booking_error: null,
    booking_error_code: null,
    booking_api_code: null,
  };
}

function setAnswer(
  answers: DiagnosticAnswers,
  question_id: DiagnosticQuestionId,
  code: string,
): DiagnosticAnswers {
  switch (question_id) {
    case "water-feature":
      return { ...answers, water_feature: code as DiagnosticAnswers["water_feature"] };
    case "installation-type":
      return { ...answers, installation_type: code as DiagnosticAnswers["installation_type"] };
    case "pool-size":
      return { ...answers, pool_size: code as DiagnosticAnswers["pool_size"] };
    case "current-treatment":
      return { ...answers, current_treatment: code as DiagnosticAnswers["current_treatment"] };
    case "primary-goal":
      return { ...answers, primary_goal: code as DiagnosticAnswers["primary_goal"] };
    default:
      return answers;
  }
}

function toggleMultiAnswer(
  answers: DiagnosticAnswers,
  code: string,
): DiagnosticAnswers {
  const current = answers.current_issues ?? [];
  const exists = current.includes(code as never);
  const next = exists
    ? current.filter((c) => c !== code)
    : [...current, code as never];
  return { ...answers, current_issues: next };
}

export function funnelReducer(
  state: FunnelState,
  action: FunnelAction,
): FunnelState {
  switch (action.type) {
    case "GO_TO_STEP":
      return { ...state, current_step: action.step };

    case "SET_SESSION":
      return { ...state, session_id: action.session_id };

    case "SET_LEAD_ID":
      return { ...state, lead_id: action.lead_id };

    case "HYDRATE":
      return { ...state, ...action.payload, hydration_ready: true };

    case "ANSWER_SINGLE": {
      const answers = setAnswer(
        state.diagnostic_answers,
        action.question_id,
        action.code,
      );
      return { ...state, diagnostic_answers: answers };
    }

    case "ANSWER_MULTI_TOGGLE": {
      const answers = toggleMultiAnswer(
        state.diagnostic_answers,
        action.code,
      );
      return { ...state, diagnostic_answers: answers };
    }

    case "DIAG_NEXT":
      return { ...state, diag_current_index: state.diag_current_index + 1 };

    case "DIAG_BACK":
      return {
        ...state,
        diag_current_index: Math.max(0, state.diag_current_index - 1),
      };

    case "DIAG_SET_INDEX":
      return { ...state, diag_current_index: action.index };

    case "CONTACT_SUBMIT_START":
      return {
        ...state,
        submission_state: "submitting" as SubmissionState,
        validation_errors: {},
      };

    case "CONTACT_SUBMIT_SUCCESS":
      return {
        ...state,
        submission_state: "success" as SubmissionState,
        lead_id: action.lead_id,
        first_name: action.first_name,
        email: action.email,
      };

    case "CONTACT_SUBMIT_DUPLICATE":
      return {
        ...state,
        submission_state: "duplicate" as SubmissionState,
      };

    case "CONTACT_SUBMIT_ERROR":
      return {
        ...state,
        submission_state: "error" as SubmissionState,
      };

    case "SET_VALIDATION_ERRORS":
      return { ...state, validation_errors: action.errors };

    case "CLEAR_VALIDATION_ERRORS":
      return { ...state, validation_errors: {} };

    case "COMPLETE_STEP":
      if (state.completed_steps.includes(action.step)) return state;
      return {
        ...state,
        completed_steps: [...state.completed_steps, action.step],
      };

    case "RESET":
      return createInitialState();

    case "COMPLETE_DIAGNOSTIC": {
      if (state.completed_steps.includes(FUNNEL_STEPS.POOL_DIAGNOSTIC)) {
        return state;
      }
      if (state.current_step !== FUNNEL_STEPS.POOL_DIAGNOSTIC) {
        return state;
      }
      return {
        ...state,
        completed_steps: [...state.completed_steps, FUNNEL_STEPS.POOL_DIAGNOSTIC],
        current_step: FUNNEL_STEPS.CONTACT_INFORMATION,
      };
    }

    // ---------------------------------------------------------------------------
    // Booking actions
    // ---------------------------------------------------------------------------

    case "SELECT_DATE":
      return {
        ...state,
        selected_date: action.date,
        selected_slot_start: null,
        selected_slot_end: null,
        booking_submission_state: "idle",
        booking_error: null,
        booking_error_code: null,
      };

    case "SELECT_SLOT":
      return {
        ...state,
        selected_slot_start: action.start,
        selected_slot_end: action.end,
      };

    case "BOOKING_START":
      return {
        ...state,
        booking_submission_state: "submitting",
        booking_error: null,
        booking_error_code: null,
        booking_api_code: null,
      };

    case "BOOKING_SUCCESS":
      return {
        ...state,
        booking_submission_state: "success",
        appointment_id: action.appointment_id,
        selected_slot_start: action.start_time,
        selected_slot_end: action.end_time,
        booking_error: null,
        booking_error_code: null,
        booking_api_code: null,
      };

    case "BOOKING_FAIL":
      return {
        ...state,
        booking_submission_state: "error",
        booking_error: action.error_code,
        booking_error_code: action.error_code,
        booking_api_code: action.api_code ?? null,
      };

    case "BOOKING_CONFLICT":
      return {
        ...state,
        booking_submission_state: "idle",
        selected_slot_start: null,
        selected_slot_end: null,
        booking_error: null,
        booking_error_code: "conflict",
        booking_api_code: null,
      };

    case "CLEAR_BOOKING_SELECTION":
      return {
        ...state,
        selected_date: null,
        selected_slot_start: null,
        selected_slot_end: null,
        appointment_id: null,
        booking_submission_state: "idle",
        booking_error: null,
        booking_error_code: null,
      };

    default:
      return state;
  }
}
