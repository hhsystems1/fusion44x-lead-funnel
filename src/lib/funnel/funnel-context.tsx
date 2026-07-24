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
  saveDiagnosticAnswers,
  saveDiagIndex,
  getDiagnosticAnswers,
  getDiagIndex,
  getSessionId,
  getPersistedQuestionAnswer,
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
  submitContact: (data: ContactFormData) => Promise<void>;
  isCurrentQuestionAnswered: () => boolean;
  isDiagValid: () => boolean;
  diagProgress: { current: number; total: number };
}

const FunnelContext = createContext<FunnelContextValue | null>(null);

function loadPersistedState(): Partial<FunnelState> {
  const answers = getDiagnosticAnswers();
  const index = getDiagIndex();
  const sessionId = getSessionId();
  return {
    diagnostic_answers: answers ?? {},
    diag_current_index: index,
    session_id: sessionId,
  };
}

export function FunnelProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(
    funnelReducer,
    { ...createInitialState(), ...loadPersistedState() },
    (s) => s,
  );

  const [tracker, setTracker] = useState<Tracker | null>(null);
  const sessionInitRef = useRef(false);

  useEffect(() => {
    if (sessionInitRef.current) return;
    sessionInitRef.current = true;

    initializeSession().then((result) => {
      if (result) {
        dispatch({ type: "SET_SESSION", session_id: result.session_id });
        const t = createTracker({ session_id: result.session_id });
        setTracker(t);
        t.track(InternalEvents.PAGE_VIEWED, {
          step_id: state.current_step,
        });
      }
    });
  }, [state.current_step]);

  useEffect(() => {
    saveDiagnosticAnswers(state.diagnostic_answers);
  }, [state.diagnostic_answers]);

  useEffect(() => {
    saveDiagIndex(state.diag_current_index);
  }, [state.diag_current_index]);

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
      dispatch({ type: "ANSWER_MULTI_TOGGLE", question_id, code });
      if (tracker) {
        tracker.track(InternalEvents.QUESTION_ANSWERED, {
          step_id: FUNNEL_STEPS.POOL_DIAGNOSTIC,
          question_id,
          answer_code: code,
        });
      }
    },
    [tracker],
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
        } else {
          dispatch({ type: "CONTACT_SUBMIT_ERROR" });
        }
      } catch {
        dispatch({ type: "CONTACT_SUBMIT_ERROR" });
      }
    },
    [state.session_id, state.diagnostic_answers, tracker],
  );

  const value: FunnelContextValue = {
    state,
    dispatch,
    tracker,
    goToStep,
    answerSingle,
    answerMultiToggle,
    diagNext,
    diagBack,
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
