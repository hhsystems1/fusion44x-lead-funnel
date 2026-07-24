import { describe, it, expect, vi, beforeEach } from "vitest";
import { createInitialState, funnelReducer } from "./funnel-reducer";
import { FUNNEL_STEPS } from "@/types/funnel";

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
  globalThis.crypto = { randomUUID: vi.fn(() => "crypto-uuid-123") } as unknown as Crypto;
});

describe("funnelReducer HYDRATE action", () => {
  it("restores all persisted fields", () => {
    const state = funnelReducer(createInitialState(), {
      type: "HYDRATE",
      payload: {
        current_step: FUNNEL_STEPS.POOL_DIAGNOSTIC,
        session_id: "session-abc",
        lead_id: "lead-xyz",
        diagnostic_answers: { water_feature: "pool" },
        diag_current_index: 2,
      },
    });
    expect(state.current_step).toBe(FUNNEL_STEPS.POOL_DIAGNOSTIC);
    expect(state.session_id).toBe("session-abc");
    expect(state.lead_id).toBe("lead-xyz");
    expect(state.diagnostic_answers).toEqual({ water_feature: "pool" });
    expect(state.diag_current_index).toBe(2);
    expect(state.hydration_ready).toBe(true);
  });

  it("restores diag_current_index of 0 correctly", () => {
    const state = funnelReducer(createInitialState(), {
      type: "HYDRATE",
      payload: { diag_current_index: 0 },
    });
    expect(state.diag_current_index).toBe(0);
    expect(state.hydration_ready).toBe(true);
  });

  it("leaves defaults intact when payload is empty", () => {
    const initial = createInitialState();
    const state = funnelReducer(initial, {
      type: "HYDRATE",
      payload: {},
    });
    expect(state.current_step).toBe(initial.current_step);
    expect(state.session_id).toBeNull();
    expect(state.lead_id).toBeNull();
    expect(state.diagnostic_answers).toEqual({});
    expect(state.hydration_ready).toBe(true);
  });

  it("sets hydration_ready to true", () => {
    const state = funnelReducer(createInitialState(), {
      type: "HYDRATE",
      payload: { current_step: FUNNEL_STEPS.BOOKING },
    });
    expect(state.hydration_ready).toBe(true);
  });
});