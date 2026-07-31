import { describe, it, expect } from "vitest";
import { diagnosticQuestions } from "@/config/funnel-questions";
import { answerLabel, answerLabels } from "@/lib/funnel/answer-labels";

describe("answerLabel", () => {
  it("resolves every question option code to its label", () => {
    for (const question of diagnosticQuestions) {
      for (const option of question.options) {
        expect(answerLabel(question.id, option.code)).toBe(option.label);
      }
    }
  });

  it("resolves the same code differently per question", () => {
    expect(answerLabel("current-treatment", "other")).toBe("Another system");
    expect(answerLabel("current-issues", "other")).toBe("Other issues");
    expect(answerLabel("installation-type", "not_sure")).toBe("I\u2019m not sure");
  });

  it("falls back to the raw code for unknown codes", () => {
    expect(answerLabel("pool-size", "unknown_code")).toBe("unknown_code");
  });

  it("returns an em dash for nullish input", () => {
    expect(answerLabel("pool-size", null)).toBe("\u2014");
    expect(answerLabel("pool-size", undefined)).toBe("\u2014");
    expect(answerLabel("pool-size", "")).toBe("\u2014");
  });

  it("returns the raw code for unknown question ids", () => {
    expect(answerLabel("not-a-question", "pool")).toBe("pool");
  });
});

describe("answerLabels", () => {
  it("maps multi-select codes to labels", () => {
    expect(
      answerLabels("current-issues", [
        "chemical_smell",
        "children_pet_concerns",
      ]),
    ).toEqual(["Strong chemical smell", "Concerns about children or pets"]);
  });

  it("returns an empty array for empty or nullish input", () => {
    expect(answerLabels("current-issues", [])).toEqual([]);
    expect(answerLabels("current-issues", null)).toEqual([]);
    expect(answerLabels("current-issues", undefined)).toEqual([]);
  });
});
