"use client";

import {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { DiagnosticAnswers, FunnelState, FunnelStepId, DiagnosticQuestionId, BookingErrorCode } from "@/types/funnel";
import { FUNNEL_STEPS } from "@/types/funnel";
import { InternalEvents } from "@/config/tracking-events";
import { funnelReducer, createInitialState, type FunnelAction } from "./funnel-reducer";
import {
  getDiagnosticAnswers,
  getDiagIndex,
  getSessionId,
  getCurrentStep,
  getLeadId,
  getSelectedDate,
  getSelectedSlotStart,
  getSelectedSlotEnd,
  saveDiagnosticAnswers,
  saveDiagIndex,
  saveCurrentStep,
  saveLeadId,
  saveSelectedDate,
  saveSelectedSlotEnd,
  saveSelectedSlotStart,
  getPersistedQuestionAnswer,
  saveBookingStep,
  clearSessionData,
} from "./persistence";
import { initializeSession } from "./session";
import { createTracker, type Tracker } from "@/lib/analytics/tracker";
import { submitLead as submitLeadApi, buildLeadPayload } from "./api";
import { validateContactForm, type ContactFormData } from "./contact-validation";
import { diagnosticQuestions } from "@/config/funnel-questions";
import { createBookingRequest } from "./booking-api";
import { MetaEvents } from "@/config/tracking-events";

interface FunnelContextValue {
  state: FunnelState;
  dispatch: React.Dispatch<FunnelAction>;
  tracker: Tracker | null;
  goToStep: (step: FunnelStepId) => void;
  answerSingle: (question_id: DiagnosticQuestionId, code: string) => void;
  answerMultiToggle: (question_id: DiagnosticQuestionId, code: string) => void;
  diagNext: () => void;
  diagBack: () => void;
  completeDiagnostic: () => void;
  submitContact: (data: ContactFormData) => Promise<void>;
  isCurrentQuestionAnswered: () => boolean;
  isDiagValid: () => boolean;
  diagProgress: { current: number; total: number };
  selectSlot: (start: string, end: string) => void;
  submitBooking: (event_id: string) => Promise<void>;
  resetFunnel: () => void;
}

function fbqTrack(
  event: string,
  eventId: string,
  params?: Record<string, unknown>,
) {
  if (typeof window !== "undefined" && typeof window.fbq === "function") {
    window.fbq("track", event, params, { eventID: eventId });
  }
}

function isDiagnosticComplete(answers: DiagnosticAnswers | null): boolean {
  if (!answers) return false;
  return (
    !!answers.water_feature &&
    !!answers.installation_type &&
    !!answers.pool_size &&
    !!answers.current_treatment &&
    Array.isArray(answers.current_issues) &&
    answers.current_issues.length > 0 &&
    !!answers.primary_goal
  );
}

const FunnelContext = createContext<FunnelContextValue | null>(null);

export function FunnelProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(funnelReducer, undefined, createInitialState);

  const [tracker, setTracker] = useState<Tracker | null>(null);
  const sessionInitRef = useRef(false);
  const hasTrackedPageView = useRef(false);
  const hasTrackedDiagStart = useRef(false);
  const hasTrackedContactView = useRef(false);
  const hasCompletedDiagnosticRef = useRef(false);
  const prevQuestionRef = useRef<string | null>(null);
  const prevStepRef = useRef<FunnelStepId | null>(null);
  const hasTrackedCalendarView = useRef(false);
  const hasTrackedConfirmationView = useRef(false);
  const bookingCompletedRef = useRef(false);

  // Hydrate persisted state after mount with validation
  useEffect(() => {
    const answers = getDiagnosticAnswers();
    const index = getDiagIndex();
    const sessionId = getSessionId();
    const step = getCurrentStep();
    const leadId = getLeadId();
    const selectedDate = getSelectedDate();
    const selectedSlotStart = getSelectedSlotStart();
    const selectedSlotEnd = getSelectedSlotEnd();

    let validStep = step;

    // Validate: if step requires lead_id but it's missing, reset to diagnostic
    if (
      (step === FUNNEL_STEPS.BOOKING || step === FUNNEL_STEPS.CONFIRMATION) &&
      !leadId
    ) {
      validStep = FUNNEL_STEPS.POOL_DIAGNOSTIC;
    }

    // Validate: if step is confirmation but no appointment data, reset to booking or diagnostic
    if (step === FUNNEL_STEPS.CONFIRMATION && !leadId) {
      validStep = FUNNEL_STEPS.POOL_DIAGNOSTIC;
    }

    // Validate: if step is booking but no session_id, reset to diagnostic
    if (step === FUNNEL_STEPS.BOOKING && !sessionId) {
      validStep = FUNNEL_STEPS.POOL_DIAGNOSTIC;
    }

    // Validate: if step is contact-information but diagnostic is incomplete, reset
    if (step === FUNNEL_STEPS.CONTACT_INFORMATION && !isDiagnosticComplete(answers)) {
      validStep = FUNNEL_STEPS.POOL_DIAGNOSTIC;
    }

    // If resetting, clear the invalid persisted data
    if (validStep !== step) {
      clearSessionData();
    }

    dispatch({
      type: "HYDRATE",
      payload: {
        ...(answers ? { diagnostic_answers: answers } : {}),
        ...(typeof index === "number" ? { diag_current_index: index } : {}),
        ...(sessionId ? { session_id: sessionId } : {}),
        ...(validStep ? { current_step: validStep } : {}),
        ...(leadId ? { lead_id: leadId } : {}),
        ...(validStep === FUNNEL_STEPS.BOOKING && selectedDate ? { selected_date: selectedDate } : {}),
        ...(validStep === FUNNEL_STEPS.BOOKING && selectedSlotStart ? { selected_slot_start: selectedSlotStart } : {}),
        ...(validStep === FUNNEL_STEPS.BOOKING && selectedSlotEnd ? { selected_slot_end: selectedSlotEnd } : {}),
      },
    });
  }, []);

  // Session initialization
  useEffect(() => {
    if (sessionInitRef.current) return;
    sessionInitRef.current = true;

    initializeSession().then((result) => {
      if (result) {
        dispatch({ type: "SET_SESSION", session_id: result.session_id });
        const t = createTracker({ session_id: result.session_id });
        setTracker(t);
      }
    });
  }, []);

  // Track page_viewed after tracker is ready AND hydration is complete
  useEffect(() => {
    if (tracker && !hasTrackedPageView.current && state.hydration_ready) {
      hasTrackedPageView.current = true;
      tracker.track(InternalEvents.PAGE_VIEWED, {
        step_id: state.current_step,
      });
    }
  }, [tracker, state.current_step, state.hydration_ready]);

  // Persist diagnostic answers (only after hydration ready)
  useEffect(() => {
    if (state.hydration_ready) {
      saveDiagnosticAnswers(state.diagnostic_answers);
    }
  }, [state.diagnostic_answers, state.hydration_ready]);

  // Persist diagnostic index (only after hydration ready)
  useEffect(() => {
    if (state.hydration_ready) {
      saveDiagIndex(state.diag_current_index);
    }
  }, [state.diag_current_index, state.hydration_ready]);

  // Persist current step (only after hydration ready)
  useEffect(() => {
    if (state.hydration_ready) {
      saveCurrentStep(state.current_step);
    }
  }, [state.current_step, state.hydration_ready]);

  // Persist lead ID (only after hydration ready)
  useEffect(() => {
    if (state.hydration_ready && state.lead_id) {
      saveLeadId(state.lead_id);
    }
  }, [state.lead_id, state.hydration_ready]);

  // Persist selected date (only after hydration ready)
  useEffect(() => {
    if (state.hydration_ready) {
      saveSelectedDate(state.selected_date);
    }
  }, [state.selected_date, state.hydration_ready]);

  // Persist selected slot (only after hydration ready)
  useEffect(() => {
    if (state.hydration_ready) {
      saveSelectedSlotStart(state.selected_slot_start);
      saveSelectedSlotEnd(state.selected_slot_end);
    }
  }, [state.selected_slot_start, state.selected_slot_end, state.hydration_ready]);

  // Track calendar_viewed
  useEffect(() => {
    if (
      tracker &&
      !hasTrackedCalendarView.current &&
      state.current_step === FUNNEL_STEPS.BOOKING
    ) {
      hasTrackedCalendarView.current = true;
      tracker.track(InternalEvents.CALENDAR_VIEWED, {
        step_id: FUNNEL_STEPS.BOOKING,
      });
    }
  }, [tracker, state.current_step]);

  // Track confirmation_viewed
  useEffect(() => {
    if (
      tracker &&
      !hasTrackedConfirmationView.current &&
      state.current_step === FUNNEL_STEPS.CONFIRMATION
    ) {
      hasTrackedConfirmationView.current = true;
      tracker.track(InternalEvents.CONFIRMATION_VIEWED, {
        step_id: FUNNEL_STEPS.CONFIRMATION,
      });
    }
  }, [tracker, state.current_step]);

  // Track diagnostic_started
  useEffect(() => {
    if (
      tracker &&
      !hasTrackedDiagStart.current &&
      state.current_step === FUNNEL_STEPS.POOL_DIAGNOSTIC
    ) {
      hasTrackedDiagStart.current = true;
      tracker.track(InternalEvents.DIAGNOSTIC_STARTED, {
        step_id: FUNNEL_STEPS.POOL_DIAGNOSTIC,
      });
    }
  }, [tracker, state.current_step]);

  // Track question_viewed on change - ONLY on POOL_DIAGNOSTIC step
  useEffect(() => {
    if (!tracker) return;
    if (state.current_step !== FUNNEL_STEPS.POOL_DIAGNOSTIC) return;
    const q = diagnosticQuestions[state.diag_current_index];
    if (!q) return;
    if (prevQuestionRef.current !== q.id) {
      prevQuestionRef.current = q.id;
      tracker.track(InternalEvents.QUESTION_VIEWED, {
        step_id: FUNNEL_STEPS.POOL_DIAGNOSTIC,
        question_id: q.id,
      });
    }
  }, [tracker, state.diag_current_index, state.current_step]);

  // Track contact_step_viewed
  useEffect(() => {
    if (
      tracker &&
      !hasTrackedContactView.current &&
      state.current_step === FUNNEL_STEPS.CONTACT_INFORMATION
    ) {
      hasTrackedContactView.current = true;
      tracker.track(InternalEvents.CONTACT_STEP_VIEWED, {
        step_id: FUNNEL_STEPS.CONTACT_INFORMATION,
      });
    }
  }, [tracker, state.current_step]);

  // Scroll to funnel viewport on step transitions
  useEffect(() => {
    if (
      (state.current_step === FUNNEL_STEPS.CONTACT_INFORMATION ||
        state.current_step === FUNNEL_STEPS.BOOKING ||
        state.current_step === FUNNEL_STEPS.CONFIRMATION) &&
      prevStepRef.current !== state.current_step
    ) {
      const el = document.getElementById("funnel-viewport");
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
    prevStepRef.current = state.current_step;
  }, [state.current_step]);


  const goToStep = useCallback(
    (step: FunnelStepId) => {
      dispatch({ type: "GO_TO_STEP", step });
    },
    [],
  );

  const answerSingle = useCallback(
    (question_id: DiagnosticQuestionId, code: string) => {
      const prev = getPersistedQuestionAnswer(question_id, state.diagnostic_answers);
      dispatch({ type: "ANSWER_SINGLE", question_id, code });
      if (tracker) {
        if (prev !== undefined && prev !== code) {
          tracker.track(InternalEvents.QUESTION_CHANGED, {
            step_id: FUNNEL_STEPS.POOL_DIAGNOSTIC,
            question_id,
            answer_code: code,
          });
        }
        tracker.track(InternalEvents.QUESTION_ANSWERED, {
          step_id: FUNNEL_STEPS.POOL_DIAGNOSTIC,
          question_id,
          answer_code: code,
        });
      }
    },
    [state.diagnostic_answers, tracker],
  );

  const answerMultiToggle = useCallback(
    (question_id: DiagnosticQuestionId, code: string) => {
      const prev = state.diagnostic_answers.current_issues ?? [];
      const wasSelected = prev.includes(code as never);
      dispatch({ type: "ANSWER_MULTI_TOGGLE", question_id, code });
      if (tracker) {
        if (wasSelected) {
          tracker.track(InternalEvents.QUESTION_CHANGED, {
            step_id: FUNNEL_STEPS.POOL_DIAGNOSTIC,
            question_id,
            answer_code: code,
          });
        } else {
          tracker.track(InternalEvents.QUESTION_ANSWERED, {
            step_id: FUNNEL_STEPS.POOL_DIAGNOSTIC,
            question_id,
            answer_code: code,
          });
        }
      }
    },
    [state.diagnostic_answers, tracker],
  );

  const diagNext = useCallback(() => {
    dispatch({ type: "DIAG_NEXT" });
  }, []);

  const diagBack = useCallback(() => {
    dispatch({ type: "DIAG_BACK" });
  }, []);

  const isCurrentQuestionAnswered = useCallback((): boolean => {
    const q = diagnosticQuestions[state.diag_current_index];
    if (!q) return false;
    const answer = getPersistedQuestionAnswer(q.id, state.diagnostic_answers);
    if (answer === undefined || answer === null) return false;
    if (q.type === "multi-select" && Array.isArray(answer)) {
      return answer.length > 0;
    }
    return typeof answer === "string" && answer.length > 0;
  }, [state.diag_current_index, state.diagnostic_answers]);

  const isDiagValid = useCallback((): boolean => {
    return diagnosticQuestions.every((q) => {
      const answer = getPersistedQuestionAnswer(q.id, state.diagnostic_answers);
      if (q.type === "multi-select") {
        return Array.isArray(answer) && answer.length > 0;
      }
      return typeof answer === "string" && answer.length > 0;
    });
  }, [state.diagnostic_answers]);

  const diagProgress = {
    current: state.diag_current_index + 1,
    total: diagnosticQuestions.length,
  };

  const submitContact = useCallback(
    async (data: ContactFormData) => {
      let sessionId = state.session_id;

      if (!sessionId) {
        const retried = await initializeSession();
        if (retried) {
          sessionId = retried.session_id;
          dispatch({ type: "SET_SESSION", session_id: sessionId });
          if (!tracker) {
            const t = createTracker({ session_id: sessionId });
            setTracker(t);
          }
        } else {
          dispatch({ type: "CONTACT_SUBMIT_ERROR" });
          return;
        }
      }

      const validation = validateContactForm(data as unknown as Record<string, unknown>);
      if (!validation.valid) {
        dispatch({ type: "SET_VALIDATION_ERRORS", errors: validation.errors });
        if (tracker) {
          tracker.track(InternalEvents.VALIDATION_ERROR, {
            step_id: FUNNEL_STEPS.CONTACT_INFORMATION,
            metadata: { fields: Object.keys(validation.errors) },
          });
        }
        return;
      }

      dispatch({ type: "CONTACT_SUBMIT_START" });

      const da = state.diagnostic_answers;
      if (
        !da.water_feature ||
        !da.installation_type ||
        !da.pool_size ||
        !da.current_treatment ||
        !da.current_issues ||
        da.current_issues.length === 0 ||
        !da.primary_goal
      ) {
        console.warn("[submitContact] diagnostic answers incomplete", da);
        dispatch({ type: "CONTACT_SUBMIT_ERROR" });
        return;
      }

      if (tracker) {
        tracker.track(InternalEvents.CONTACT_SUBMITTED, {
          step_id: FUNNEL_STEPS.CONTACT_INFORMATION,
        });
      }

      let metaEventId: string;
      try {
        metaEventId = crypto.randomUUID();
      } catch {
        metaEventId = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      }
      fbqTrack(MetaEvents.CONTACT, metaEventId, {
        content_name: "Lead Contact Form",
      });

      try {
        const payload = buildLeadPayload({
          session_id: sessionId,
          event_id: metaEventId,
          first_name: data.first_name,
          last_name: data.last_name,
          email: data.email,
          phone: data.phone,
          zip_code: data.zip_code,
          preferred_contact_method: data.preferred_contact_method,
          diagnostic_answers: state.diagnostic_answers,
          marketing_consent: data.marketing_consent ?? false,
        });

        const result = await submitLeadApi(payload);

        if (result.duplicate) {
          dispatch({ type: "CONTACT_SUBMIT_DUPLICATE" });
        } else if (result.lead_id) {
          dispatch({
            type: "CONTACT_SUBMIT_SUCCESS",
            lead_id: result.lead_id,
            first_name: data.first_name,
            email: data.email,
          });
          dispatch({
            type: "COMPLETE_STEP",
            step: FUNNEL_STEPS.CONTACT_INFORMATION,
          });
          dispatch({ type: "GO_TO_STEP", step: FUNNEL_STEPS.BOOKING });
          saveBookingStep(FUNNEL_STEPS.BOOKING);
        } else {
          console.warn(
            "[submitContact] API returned non-ok status=%d",
            result.status,
          );
          dispatch({ type: "CONTACT_SUBMIT_ERROR" });
        }
      } catch (err) {
        console.warn("[submitContact] network error", err);
        dispatch({ type: "CONTACT_SUBMIT_ERROR" });
      }
    },
    [state.session_id, state.diagnostic_answers, tracker],
  );

  const completeDiagnostic = useCallback(() => {
    if (!isDiagValid()) return;
    if (state.current_step !== FUNNEL_STEPS.POOL_DIAGNOSTIC) return;
    if (state.completed_steps.includes(FUNNEL_STEPS.POOL_DIAGNOSTIC)) return;
    if (hasCompletedDiagnosticRef.current) return;

    hasCompletedDiagnosticRef.current = true;

    if (tracker) {
      tracker.track(InternalEvents.DIAGNOSTIC_COMPLETED, {
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
    }

    dispatch({ type: "COMPLETE_DIAGNOSTIC" });
  }, [state.current_step, state.completed_steps, state.diagnostic_answers, tracker, isDiagValid]);

  const selectSlot = useCallback(
    (start: string, end: string) => {
      dispatch({ type: "SELECT_SLOT", start, end });
      if (tracker) {
        tracker.track(InternalEvents.TIME_SLOT_SELECTED, {
          step_id: FUNNEL_STEPS.BOOKING,
          metadata: { start_time: start },
        });
      }
    },
    [tracker],
  );

  const mapApiErrorToCode = useCallback(
    (apiCode: string | undefined, httpStatus: number): BookingErrorCode => {
      if (!apiCode) {
        if (httpStatus === 0) return "network_error";
        return "server_error";
      }
      if (apiCode.includes("CONFLICT") || apiCode.includes("UNAVAILABLE") || httpStatus === 409) return "conflict";
      if (apiCode.includes("INPUT") || httpStatus === 422) return "missing_fields";
      if (apiCode === "NETWORK_ERROR" || httpStatus === 0) return "network_error";
      return "server_error";
    },
    [],
  );

  const submitBooking = useCallback(
    async (event_id: string) => {
      if (!state.lead_id || !state.session_id || !state.selected_slot_start) {
        dispatch({ type: "BOOKING_FAIL", error_code: "missing_fields" });
        return;
      }

      if (bookingCompletedRef.current) return;

      dispatch({ type: "BOOKING_START" });
      bookingCompletedRef.current = true;

      fbqTrack(MetaEvents.SCHEDULE, event_id, {
        content_name: "Consultation Booking",
      });

      if (tracker) {
        tracker.track(InternalEvents.BOOKING_STARTED, {
          step_id: FUNNEL_STEPS.BOOKING,
          lead_id: state.lead_id,
        });
      }

      try {
        const result = await createBookingRequest({
          lead_id: state.lead_id,
          session_id: state.session_id,
          start_time: state.selected_slot_start,
          timezone: "America/New_York",
          event_id,
        });

        if (result.error) {
          const httpStatus = result.error.status;
          const apiCode = result.error.code;
          const frontendCode = mapApiErrorToCode(apiCode, httpStatus);

          if (frontendCode === "conflict") {
            dispatch({ type: "BOOKING_CONFLICT" });
          } else {
            dispatch({ type: "BOOKING_FAIL", error_code: frontendCode, api_code: apiCode });
          }

          // Allow retry after failure
          bookingCompletedRef.current = false;

          if (tracker) {
            tracker.track(InternalEvents.BOOKING_FAILED, {
              step_id: FUNNEL_STEPS.BOOKING,
              lead_id: state.lead_id,
              metadata: { reason: frontendCode },
            });
          }
          return;
        }

        dispatch({
          type: "BOOKING_SUCCESS",
          appointment_id: result.appointment_id!,
          start_time: result.start_time!,
          end_time: result.end_time!,
        });

        // bookingCompletedRef stays true permanently — no retry after success

        if (tracker) {
          tracker.track(InternalEvents.BOOKING_COMPLETED, {
            step_id: FUNNEL_STEPS.BOOKING,
            lead_id: state.lead_id,
            metadata: { appointment_id: result.appointment_id },
          });
        }

        dispatch({ type: "COMPLETE_STEP", step: FUNNEL_STEPS.BOOKING });
        dispatch({ type: "GO_TO_STEP", step: FUNNEL_STEPS.CONFIRMATION });
        saveBookingStep(FUNNEL_STEPS.CONFIRMATION);
      } catch {
        dispatch({ type: "BOOKING_FAIL", error_code: "network_error" });
        bookingCompletedRef.current = false;
        if (tracker) {
          tracker.track(InternalEvents.BOOKING_FAILED, {
            step_id: FUNNEL_STEPS.BOOKING,
            lead_id: state.lead_id,
            metadata: { reason: "network_error" },
          });
        }
      }
    },
    [state.lead_id, state.session_id, state.selected_slot_start, tracker, mapApiErrorToCode],
  );

  const resetFunnel = useCallback(() => {
    bookingCompletedRef.current = false;
    clearSessionData();
    dispatch({ type: "RESET" });
    if (tracker) {
      tracker.track(InternalEvents.PAGE_VIEWED, {
        step_id: FUNNEL_STEPS.POOL_DIAGNOSTIC,
      });
    }
  }, [tracker]);

  const value: FunnelContextValue = {
    state,
    dispatch,
    tracker,
    goToStep,
    answerSingle,
    answerMultiToggle,
    diagNext,
    diagBack,
    completeDiagnostic,
    submitContact,
    isCurrentQuestionAnswered,
    isDiagValid,
    diagProgress,
    selectSlot,
    submitBooking,
    resetFunnel,
  };

  return (
    <FunnelContext.Provider value={value}>{children}</FunnelContext.Provider>
  );
}

export function useFunnel(): FunnelContextValue {
  const ctx = useContext(FunnelContext);
  if (!ctx) {
    throw new Error("useFunnel must be used within a FunnelProvider");
  }
  return ctx;
}
