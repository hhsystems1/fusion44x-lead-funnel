import { describe, it, expect } from "vitest";
import {
  funnelReducer,
  createInitialState,
  type FunnelAction,
} from "@/lib/funnel/funnel-reducer";
import { FUNNEL_STEPS, type FunnelState, type DiagnosticAnswers, type DiagnosticQuestionId } from "@/types/funnel";

function fresh(): FunnelState {
  return { ...createInitialState() };
}

describe("funnelReducer", () => {
  describe("initial state", () => {
    it("starts at hero step", () => {
      const state = fresh();
      expect(state.current_step).toBe(FUNNEL_STEPS.HERO);
    });

    it("has no session_id", () => {
      const state = fresh();
      expect(state.session_id).toBeNull();
    });

    it("has empty diagnostic answers", () => {
      const state = fresh();
      expect(state.diagnostic_answers).toEqual({});
    });

    it("starts at diagnostic index 0", () => {
      const state = fresh();
      expect(state.diag_current_index).toBe(0);
    });

    it("has idle submission_state", () => {
      const state = fresh();
      expect(state.submission_state).toBe("idle");
    });
  });

  describe("GO_TO_STEP", () => {
    it("updates current_step", () => {
      const state = funnelReducer(fresh(), {
        type: "GO_TO_STEP",
        step: FUNNEL_STEPS.POOL_DIAGNOSTIC,
      });
      expect(state.current_step).toBe(FUNNEL_STEPS.POOL_DIAGNOSTIC);
    });
  });

  describe("SET_SESSION", () => {
    it("stores session_id", () => {
      const state = funnelReducer(fresh(), {
        type: "SET_SESSION",
        session_id: "test-session-uuid",
      });
      expect(state.session_id).toBe("test-session-uuid");
    });
  });

  describe("ANSWER_SINGLE", () => {
    it("sets a single-select answer", () => {
      const state = funnelReducer(fresh(), {
        type: "ANSWER_SINGLE",
        question_id: "water-feature",
        code: "pool",
      });
      expect(state.diagnostic_answers.water_feature).toBe("pool");
    });

    it("replaces an existing answer", () => {
      const s1 = funnelReducer(fresh(), {
        type: "ANSWER_SINGLE",
        question_id: "water-feature",
        code: "pool",
      });
      const s2 = funnelReducer(s1, {
        type: "ANSWER_SINGLE",
        question_id: "water-feature",
        code: "spa",
      });
      expect(s2.diagnostic_answers.water_feature).toBe("spa");
    });

    it("does not affect other answers", () => {
      const s1 = funnelReducer(fresh(), {
        type: "ANSWER_SINGLE",
        question_id: "water-feature",
        code: "pool",
      });
      const s2 = funnelReducer(s1, {
        type: "ANSWER_SINGLE",
        question_id: "installation-type",
        code: "in_ground",
      });
      expect(s2.diagnostic_answers.water_feature).toBe("pool");
      expect(s2.diagnostic_answers.installation_type).toBe("in_ground");
    });

    it("maps question_id to correct answer key", () => {
      const tests: {
        qid: string;
        code: string;
        key: keyof DiagnosticAnswers;
      }[] = [
        { qid: "water-feature", code: "pool", key: "water_feature" },
        {
          qid: "installation-type",
          code: "above_ground",
          key: "installation_type",
        },
        { qid: "pool-size", code: "under_10000", key: "pool_size" },
        { qid: "current-treatment", code: "salt", key: "current_treatment" },
        { qid: "primary-goal", code: "clearer_water", key: "primary_goal" },
      ];
      for (const { qid, code, key } of tests) {
        const state = funnelReducer(fresh(), {
          type: "ANSWER_SINGLE",
          question_id: qid as DiagnosticQuestionId,
          code,
        } as FunnelAction);
        expect(state.diagnostic_answers[key]).toBe(code);
      }
    });
  });

  describe("ANSWER_MULTI_TOGGLE", () => {
    it("adds a code to current_issues", () => {
      const state = funnelReducer(fresh(), {
        type: "ANSWER_MULTI_TOGGLE",
        question_id: "current-issues",
        code: "algae",
      });
      expect(state.diagnostic_answers.current_issues).toEqual(["algae"]);
    });

    it("toggles a code out", () => {
      const s1 = funnelReducer(fresh(), {
        type: "ANSWER_MULTI_TOGGLE",
        question_id: "current-issues",
        code: "algae",
      });
      const s2 = funnelReducer(s1, {
        type: "ANSWER_MULTI_TOGGLE",
        question_id: "current-issues",
        code: "algae",
      });
      expect(s2.diagnostic_answers.current_issues).toEqual([]);
    });

    it("adds multiple codes", () => {
      const s1 = funnelReducer(fresh(), {
        type: "ANSWER_MULTI_TOGGLE",
        question_id: "current-issues",
        code: "algae",
      });
      const s2 = funnelReducer(s1, {
        type: "ANSWER_MULTI_TOGGLE",
        question_id: "current-issues",
        code: "cloudy_water",
      });
      expect(s2.diagnostic_answers.current_issues).toEqual([
        "algae",
        "cloudy_water",
      ]);
    });
  });

  describe("DIAG_NEXT / DIAG_BACK", () => {
    it("advances diag_current_index", () => {
      const state = funnelReducer(fresh(), { type: "DIAG_NEXT" });
      expect(state.diag_current_index).toBe(1);
    });

    it("goes back", () => {
      const s1 = funnelReducer(fresh(), { type: "DIAG_NEXT" });
      const s2 = funnelReducer(s1, { type: "DIAG_BACK" });
      expect(s2.diag_current_index).toBe(0);
    });

    it("does not go below 0", () => {
      const state = funnelReducer(fresh(), { type: "DIAG_BACK" });
      expect(state.diag_current_index).toBe(0);
    });
  });

  describe("CONTACT_SUBMIT_START / SUCCESS / DUPLICATE / ERROR", () => {
    it("sets submitting state", () => {
      const state = funnelReducer(fresh(), { type: "CONTACT_SUBMIT_START" });
      expect(state.submission_state).toBe("submitting");
    });

    it("clears validation errors on submit start", () => {
      const s1 = { ...fresh(), validation_errors: { email: "bad" } };
      const s2 = funnelReducer(s1, { type: "CONTACT_SUBMIT_START" });
      expect(s2.validation_errors).toEqual({});
    });

    it("sets success with lead_id", () => {
      const state = funnelReducer(fresh(), {
        type: "CONTACT_SUBMIT_SUCCESS",
        lead_id: "lead-123",
      });
      expect(state.submission_state).toBe("success");
      expect(state.lead_id).toBe("lead-123");
    });

    it("sets duplicate state", () => {
      const state = funnelReducer(fresh(), {
        type: "CONTACT_SUBMIT_DUPLICATE",
      });
      expect(state.submission_state).toBe("duplicate");
    });

    it("sets error state", () => {
      const state = funnelReducer(fresh(), {
        type: "CONTACT_SUBMIT_ERROR",
      });
      expect(state.submission_state).toBe("error");
    });
  });

  describe("validation_errors", () => {
    it("stores validation errors", () => {
      const state = funnelReducer(fresh(), {
        type: "SET_VALIDATION_ERRORS",
        errors: { email: "Invalid email" },
      });
      expect(state.validation_errors).toEqual({ email: "Invalid email" });
    });

    it("clears validation errors", () => {
      const s1 = {
        ...fresh(),
        validation_errors: { email: "Invalid" },
      };
      const s2 = funnelReducer(s1, { type: "CLEAR_VALIDATION_ERRORS" });
      expect(s2.validation_errors).toEqual({});
    });
  });

  describe("COMPLETE_STEP", () => {
    it("adds a completed step", () => {
      const state = funnelReducer(fresh(), {
        type: "COMPLETE_STEP",
        step: FUNNEL_STEPS.HERO,
      });
      expect(state.completed_steps).toContain(FUNNEL_STEPS.HERO);
    });

    it("does not duplicate completed steps", () => {
      const s1 = funnelReducer(fresh(), {
        type: "COMPLETE_STEP",
        step: FUNNEL_STEPS.HERO,
      });
      const s2 = funnelReducer(s1, {
        type: "COMPLETE_STEP",
        step: FUNNEL_STEPS.HERO,
      });
      expect(s2.completed_steps.length).toBe(1);
    });
  });

  describe("RESET", () => {
    it("returns initial state", () => {
      const modified = {
        ...fresh(),
        session_id: "s1",
        lead_id: "l1",
        current_step: FUNNEL_STEPS.CONFIRMATION,
      };
      const state = funnelReducer(modified, { type: "RESET" });
      expect(state.session_id).toBeNull();
      expect(state.lead_id).toBeNull();
      expect(state.current_step).toBe(FUNNEL_STEPS.HERO);
    });
  });
});
