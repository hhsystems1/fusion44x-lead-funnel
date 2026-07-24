import { describe, it, expect, beforeEach, vi } from "vitest";

const storage = new Map<string, string>();

const mockLocalStorage = {
  getItem: vi.fn((key: string) => storage.get(key) ?? null),
  setItem: vi.fn((key: string, value: string) => {
    storage.set(key, value);
  }),
  removeItem: vi.fn((key: string) => {
    storage.delete(key);
  }),
  clear: vi.fn(() => storage.clear()),
  get length() {
    return storage.size;
  },
  key: vi.fn((index: number) => Array.from(storage.keys())[index] ?? null),
};

beforeEach(() => {
  storage.clear();
  vi.clearAllMocks();
  globalThis.localStorage = mockLocalStorage as unknown as Storage;
  globalThis.window = {} as unknown as Window & typeof globalThis;
});

import {
  generateAnonymousId,
  getAnonymousId,
  saveSessionId,
  getSessionId,
  saveDiagnosticAnswers,
  getDiagnosticAnswers,
  saveDiagIndex,
  getDiagIndex,
  getPersistedQuestionAnswer,
  clearAllPersistedData,
} from "@/lib/funnel/persistence";

describe("persistence", () => {
  describe("anonymous ID", () => {
    it("generates and persists an anonymous ID", () => {
      const id = generateAnonymousId();
      expect(id).toMatch(/^anon_/);
      expect(getAnonymousId()).toBe(id);
    });

    it("reuses existing anonymous ID", () => {
      storage.set("fusion44x_anonymous_id", "existing-id");
      const id = generateAnonymousId();
      expect(id).toBe("existing-id");
    });
  });

  describe("session ID", () => {
    it("saves and retrieves session ID", () => {
      saveSessionId("session-123");
      expect(getSessionId()).toBe("session-123");
    });

    it("returns null when no session ID stored", () => {
      expect(getSessionId()).toBeNull();
    });
  });

  describe("diagnostic answers", () => {
    it("saves and retrieves answers", () => {
      const answers = { water_feature: "pool" as const };
      saveDiagnosticAnswers(answers);
      expect(getDiagnosticAnswers()).toEqual(answers);
    });

    it("returns null when no answers stored", () => {
      expect(getDiagnosticAnswers()).toBeNull();
    });

    it("round-trips full answers", () => {
      const answers = {
        water_feature: "pool" as const,
        installation_type: "in_ground" as const,
        pool_size: "10000_to_20000" as const,
        current_treatment: "chlorine" as const,
        current_issues: ["algae" as const, "cloudy_water" as const],
        primary_goal: "clearer_water" as const,
      };
      saveDiagnosticAnswers(answers);
      expect(getDiagnosticAnswers()).toEqual(answers);
    });
  });

  describe("diagnostic index", () => {
    it("saves and retrieves index", () => {
      saveDiagIndex(3);
      expect(getDiagIndex()).toBe(3);
    });

    it("defaults to 0", () => {
      expect(getDiagIndex()).toBe(0);
    });
  });

  describe("getPersistedQuestionAnswer", () => {
    it("gets water_feature answer", () => {
      const result = getPersistedQuestionAnswer("water-feature", {
        water_feature: "pool",
      });
      expect(result).toBe("pool");
    });

    it("gets current_issues array", () => {
      const result = getPersistedQuestionAnswer("current-issues", {
        current_issues: ["algae", "cloudy_water"],
      });
      expect(result).toEqual(["algae", "cloudy_water"]);
    });

    it("returns undefined for unanswered question", () => {
      const result = getPersistedQuestionAnswer("water-feature", {});
      expect(result).toBeUndefined();
    });
  });

  describe("clearAllPersistedData", () => {
    it("clears all stored data", () => {
      saveSessionId("s1");
      saveDiagnosticAnswers({ water_feature: "pool" });
      saveDiagIndex(2);
      clearAllPersistedData();
      expect(getSessionId()).toBeNull();
      expect(getDiagnosticAnswers()).toBeNull();
      expect(getDiagIndex()).toBe(0);
    });
  });
});
