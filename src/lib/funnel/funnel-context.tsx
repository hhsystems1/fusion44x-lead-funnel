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
import type { FunnelState, FunnelStepId, DiagnosticQuestionId } from "@/types/funnel";
import { FUNNEL_STEPS } from "@/types/funnel";
import { InternalEvents } from "@/config/tracking-events";
import { funnelReducer, createInitialState, type FunnelAction } from "./funnel-reducer";
import {
  getDiagnosticAnswers,
  getDiagIndex,
  getSessionId,
  getCurrentStep,
  getLeadId,
  saveDiagnosticAnswers,
  saveDiagIndex,
  saveCurrentStep,
  saveLeadId,
  getPersistedQuestionAnswer,
  saveBookingStep,
} from "./persistence";
import { initializeSession } from "./session";
import { createTracker, type Tracker } from "@/lib/analytics/tracker";
import { submitLead as submitLeadApi, buildLeadPayload } from "./api";
import { validateContactForm, type ContactFormData } from "./contact-validation";
import { diagnosticQuestions } from "@/config/funnel-questions";

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
}

const FunnelContext = createContext<FunnelContextValue | null>(null);

export function FunnelProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(funnelReducer, undefined, createInitialState);

  const [tracker, setTracker] = useState<Tracker | null>(null);
  const sessionInitRef = useRef(false);
  const hasTrackedPageView = useRef(false);
  const hasTrackedDiagStart = useRef(false);
  const hasTrackedContactView = useRef(false);
  const prevQuestionRef = useRef<string | null>(null);

  // Hydrate persisted state after mount
  useEffect(() => {
    const answers = getDiagnosticAnswers();
    const index = getDiagIndex();
    const sessionId = getSessionId();
    const step = getCurrentStep();
    const leadId = getLeadId();
    dispatch({
      type: "HYDRATE",
      payload: {
        ...(answers ? { diagnostic_answers: answers } : {}),
        ...(typeof index === "number" ? { diag_current_index: index } : {}),
        ...(sessionId ? { session_id: sessionId } : {}),
        ...(step ? { current_step: step } : {}),
        ...(leadId ? { lead_id: leadId } : {}),
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
      if (!state.session_id) {
        dispatch({ type: "CONTACT_SUBMIT_ERROR" });
        return;
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

      if (tracker) {
        tracker.track(InternalEvents.CONTACT_SUBMITTED, {
          step_id: FUNNEL_STEPS.CONTACT_INFORMATION,
        });
      }

      try {
        const payload = buildLeadPayload({
          session_id: state.session_id,
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
          });
          dispatch({
            type: "COMPLETE_STEP",
            step: FUNNEL_STEPS.CONTACT_INFORMATION,
          });
          dispatch({ type: "GO_TO_STEP", step: FUNNEL_STEPS.BOOKING });
          saveBookingStep(FUNNEL_STEPS.BOOKING);
        } else {
          dispatch({ type: "CONTACT_SUBMIT_ERROR" });
        }
      } catch {
        dispatch({ type: "CONTACT_SUBMIT_ERROR" });
      }
    },
    [state.session_id, state.diagnostic_answers, tracker],
  );

  const completeDiagnostic = useCallback(() => {
    if (!isDiagValid()) return;

    dispatch({ type: "COMPLETE_DIAGNOSTIC" });

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

    const contactEl = document.getElementById("contact-information");
    if (contactEl) {
      contactEl.scrollIntoView({ behavior: "smooth" });
    }

    dispatch({ type: "GO_TO_STEP", step: FUNNEL_STEPS.CONTACT_INFORMATION });
  }, [state.diagnostic_answers, tracker, isDiagValid]);

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