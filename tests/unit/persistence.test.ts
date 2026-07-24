import { describe, it, expect, beforeEach, vi } from "vitest";

const localStore = new Map<string, string>();
const sessionStore = new Map<string, string>();

const mockLocalStorage = {
  getItem: vi.fn((key: string) => localStore.get(key) ?? null),
  setItem: vi.fn((key: string, value: string) => { localStore.set(key, value); }),
  removeItem: vi.fn((key: string) => { localStore.delete(key); }),
  clear: vi.fn(() => localStore.clear()),
  get length() { return localStore.size; },
  key: vi.fn((index: number) => Array.from(localStore.keys())[index] ?? null),
};

const mockSessionStorage = {
  getItem: vi.fn((key: string) => sessionStore.get(key) ?? null),
  setItem: vi.fn((key: string, value: string) => { sessionStore.set(key, value); }),
  removeItem: vi.fn((key: string) => { sessionStore.delete(key); }),
  clear: vi.fn(() => sessionStore.clear()),
  get length() { return sessionStore.size; },
  key: vi.fn((index: number) => Array.from(sessionStore.keys())[index] ?? null),
};

beforeEach(() => {
  localStore.clear();
  sessionStore.clear();
  vi.clearAllMocks();
  globalThis.localStorage = mockLocalStorage as unknown as Storage;
  globalThis.sessionStorage = mockSessionStorage as unknown as Storage;
  globalThis.window = {} as unknown as Window & typeof globalThis;
  vi.stubGlobal("crypto", { randomUUID: vi.fn(() => "crypto-uuid-123") });
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
  saveCurrentStep,
  getCurrentStep,
  saveLeadId,
  getLeadId,
  getPersistedQuestionAnswer,
  clearSessionData,
} from "@/lib/funnel/persistence";

describe("persistence", () => {
  describe("anonymous ID (localStorage)", () => {
    it("generates and persists using crypto.randomUUID", () => {
      const id = generateAnonymousId();
      expect(id).toBe("anon_crypto-uuid-123");
      expect(getAnonymousId()).toBe(id);
      expect(localStore.get("fusion44x_anonymous_id")).toBe(id);
    });

    it("reuses existing anonymous ID", () => {
      localStore.set("fusion44x_anonymous_id", "existing-id");
      const id = generateAnonymousId();
      expect(id).toBe("existing-id");
    });
  });

  describe("session ID (sessionStorage)", () => {
    it("saves and retrieves session ID", () => {
      saveSessionId("session-123");
      expect(getSessionId()).toBe("session-123");
      expect(sessionStore.get("fusion44x_session_id")).toBe("session-123");
    });

    it("returns null when no session ID stored", () => {
      expect(getSessionId()).toBeNull();
    });

    it("does not persist across cleared sessionStorage", () => {
      saveSessionId("s1");
      sessionStore.clear();
      expect(getSessionId()).toBeNull();
    });
  });

  describe("diagnostic answers (sessionStorage)", () => {
    it("saves and retrieves answers", () => {
      const answers = { water_feature: "pool" as const };
      saveDiagnosticAnswers(answers);
      expect(getDiagnosticAnswers()).toEqual(answers);
      expect(sessionStore.has("fusion44x_diagnostic_answers")).toBe(true);
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

  describe("diagnostic index (sessionStorage)", () => {
    it("saves and retrieves index", () => {
      saveDiagIndex(3);
      expect(getDiagIndex()).toBe(3);
    });

    it("defaults to 0", () => {
      expect(getDiagIndex()).toBe(0);
    });
  });

  describe("current step (sessionStorage)", () => {
    it("saves and retrieves step", () => {
      saveCurrentStep("pool-diagnostic");
      expect(getCurrentStep()).toBe("pool-diagnostic");
    });

    it("returns null when not set", () => {
      expect(getCurrentStep()).toBeNull();
    });
  });

  describe("lead ID (sessionStorage)", () => {
    it("saves and retrieves lead ID", () => {
      saveLeadId("lead-456");
      expect(getLeadId()).toBe("lead-456");
    });

    it("returns null when not set", () => {
      expect(getLeadId()).toBeNull();
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

describe("clearSessionData", () => {
  it("clears sessionStorage data but keeps anonymous ID", () => {
    localStore.set("fusion44x_anonymous_id", "anon-test");
    saveSessionId("s1");
    saveDiagnosticAnswers({ water_feature: "pool" });
    saveDiagIndex(2);
    saveCurrentStep("booking");
    saveLeadId("lead-1");

    clearSessionData();

    expect(getSessionId()).toBeNull();
    expect(getDiagnosticAnswers()).toBeNull();
    expect(getDiagIndex()).toBe(0);
    expect(getCurrentStep()).toBeNull();
    expect(getLeadId()).toBeNull();
    expect(getAnonymousId()).toBe("anon-test");
  });
});
});