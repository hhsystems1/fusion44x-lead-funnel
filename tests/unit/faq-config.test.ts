import { describe, it, expect } from "vitest";
import { faqItems, type FaqItem } from "@/config/faq";

describe("FAQ configuration", () => {
  it("contains at least one item", () => {
    expect(faqItems.length).toBeGreaterThan(0);
  });

  it("has unique IDs for every item", () => {
    const ids = faqItems.map((item) => item.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it("every item has a non-empty question", () => {
    for (const item of faqItems) {
      expect(typeof item.question).toBe("string");
      expect(item.question.length).toBeGreaterThan(0);
    }
  });

  it("every item has a non-empty answer", () => {
    for (const item of faqItems) {
      expect(typeof item.answer).toBe("string");
      expect(item.answer.length).toBeGreaterThan(0);
    }
  });

  it("covers all required question topics", () => {
    const questions = faqItems.map((item) => item.question.toLowerCase());
    const requiredTopics = [
      "what is fusion",
      "another pool chemical",
      "families choose",
      "existing pool equipment",
      "chlorine or salt",
      "who can install",
      "eliminate every pool",
      "which fusion44x system",
      "consultation",
    ];
    for (const topic of requiredTopics) {
      const found = questions.some((q) => q.includes(topic));
      expect(found).toBe(true);
    }
  });

  it("does not make unsupported health, safety, chemical-elimination, cost-savings, or technical claims", () => {
    const banned = [
      "eliminates all chemicals",
      "100% chemical-free",
      "zero chemicals",
      "saves you money",
      "guaranteed savings",
      "cures",
      "FDA approved",
      "proven to cure",
      "kills 100%",
      "eliminates all bacteria",
      "completely safe for",
      "no maintenance needed",
      "maintenance free",
    ];
    for (const item of faqItems) {
      const lowerAnswer = item.answer.toLowerCase();
      for (const claim of banned) {
        expect(lowerAnswer).not.toContain(claim);
      }
    }
  });

  it("each item matches FaqItem shape", () => {
    for (const item of faqItems) {
      expect(item).toHaveProperty("id");
      expect(item).toHaveProperty("question");
      expect(item).toHaveProperty("answer");
      expect(typeof (item as FaqItem).id).toBe("string");
      expect(typeof (item as FaqItem).question).toBe("string");
      expect(typeof (item as FaqItem).answer).toBe("string");
    }
  });
});
