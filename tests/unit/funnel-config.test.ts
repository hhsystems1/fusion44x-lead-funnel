import { describe, it, expect } from "vitest";
import {
  DIAGNOSTIC_QUESTION_IDS,
  FUNNEL_STEPS,
  FUNNEL_STEP_ORDER,
  WATER_FEATURE_CODES,
  INSTALLATION_TYPE_CODES,
  POOL_SIZE_CODES,
  CURRENT_TREATMENT_CODES,
  CURRENT_ISSUES_CODES,
  PRIMARY_GOAL_CODES,
  type DiagnosticQuestionId,
} from "@/types/funnel";
import { diagnosticQuestions } from "@/config/funnel-questions";

describe("FUNNEL_STEP_ORDER", () => {
  it("contains every FUNNEL_STEPS value exactly once", () => {
    const stepValues = Object.values(FUNNEL_STEPS);
    expect(FUNNEL_STEP_ORDER.length).toBe(stepValues.length);
    for (const step of stepValues) {
      expect(FUNNEL_STEP_ORDER).toContain(step);
    }
  });

  it("has no duplicate entries", () => {
    const unique = new Set(FUNNEL_STEP_ORDER);
    expect(unique.size).toBe(FUNNEL_STEP_ORDER.length);
  });
});

describe("diagnosticQuestions config", () => {
  it("has a matching config entry for every DIAGNOSTIC_QUESTION_IDS value", () => {
    const configuredIds = new Set(
      diagnosticQuestions.map((q) => q.id),
    );
    for (const id of Object.values(DIAGNOSTIC_QUESTION_IDS)) {
      expect(configuredIds.has(id)).toBe(true);
    }
  });

  it("has every config id in DIAGNOSTIC_QUESTION_IDS", () => {
    const validIds = new Set(
      Object.values(DIAGNOSTIC_QUESTION_IDS),
    );
    for (const q of diagnosticQuestions) {
      expect(validIds.has(q.id)).toBe(true);
    }
  });

  it("has no duplicate question IDs", () => {
    const ids = diagnosticQuestions.map((q) => q.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it("has at least one option per question", () => {
    for (const q of diagnosticQuestions) {
      expect(q.options.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("has no duplicate option codes within a question", () => {
    for (const q of diagnosticQuestions) {
      const codes = q.options.map((o) => o.code);
      const unique = new Set(codes);
      expect(unique.size).toBe(codes.length);
    }
  });

  it("has a display label on every option", () => {
    for (const q of diagnosticQuestions) {
      for (const opt of q.options) {
        expect(typeof opt.label).toBe("string");
        expect(opt.label.length).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it("has stable option codes matching the typed constants", () => {
    const codeSets: Record<DiagnosticQuestionId, readonly string[]> = {
      "water-feature": WATER_FEATURE_CODES,
      "installation-type": INSTALLATION_TYPE_CODES,
      "pool-size": POOL_SIZE_CODES,
      "current-treatment": CURRENT_TREATMENT_CODES,
      "current-issues": CURRENT_ISSUES_CODES,
      "primary-goal": PRIMARY_GOAL_CODES,
    };

    for (const q of diagnosticQuestions) {
      const expected = codeSets[q.id];
      const actual = q.options.map((o) => o.code);
      expect(actual).toEqual([...expected]);
    }
  });
});

describe("question type consistency", () => {
  it("marks current-issues as multi-select", () => {
    const issues = diagnosticQuestions.find(
      (q) => q.id === "current-issues",
    );
    expect(issues?.type).toBe("multi-select");
  });

  it("marks all other questions as single-select", () => {
    for (const q of diagnosticQuestions) {
      if (q.id === "current-issues") continue;
      expect(q.type).toBe("single-select");
    }
  });
});

describe("answer code uniqueness across the config", () => {
  it("has no collision with 'other' or 'not_sure' across questions", () => {
    const allCodes = diagnosticQuestions.flatMap((q) =>
      q.options.map((o) => o.code),
    );
    const counts = new Map<string, number>();
    for (const code of allCodes) {
      counts.set(code, (counts.get(code) ?? 0) + 1);
    }
    // 'other' appears in 2 questions (issues + treatment) which is expected
    const duplicates = [...counts.entries()].filter(
      ([, count]) => count > 1,
    );
    const expectedCrossQuestionCodes = new Set(["other", "not_sure"]);
    for (const [code] of duplicates) {
      // 'current-treatment' has 'other' and 'not_sure'; 'current-issues' has 'other';
      // 'installation-type' and 'pool-size' have 'not_sure'
      // These are valid cross-question overlaps
      expect(expectedCrossQuestionCodes.has(code)).toBe(true);
    }
  });
});
