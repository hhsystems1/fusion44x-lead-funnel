import { describe, it, expect, beforeEach, vi } from "vitest";

const storage = new Map<string, string>();

const mockLocalStorage = {
  getItem: vi.fn((key: string) => storage.get(key) ?? null),
  setItem: vi.fn((key: string, value: string) => {
    storage.set(key, value);
  }),
  removeItem: vi.fn((key: string) => storage.delete(key)),
  clear: vi.fn(() => storage.clear()),
  get length() {
    return storage.size;
  },
  key: vi.fn((index: number) => Array.from(storage.keys())[index] ?? null),
};

beforeEach(() => {
  storage.clear();
  vi.clearAllMocks();

  vi.stubGlobal("localStorage", mockLocalStorage as unknown as Storage);
  vi.stubGlobal("window", { location: { href: "http://localhost:3000" } });
  vi.stubGlobal("document", { referrer: "http://google.com" });
  vi.stubGlobal("fetch", vi.fn());
});

import { initializeSession } from "@/lib/funnel/session";

describe("initializeSession", () => {
  it("returns existing session_id from storage without calling API", async () => {
    storage.set("fusion44x_session_id", "existing-session-uuid");

    const result = await initializeSession();
    expect(result).toEqual({
      session_id: "existing-session-uuid",
      is_new: false,
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("calls API and stores result for new session", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "new-session-uuid" }),
    } as Response);

    const result = await initializeSession();
    expect(result).toEqual({
      session_id: "new-session-uuid",
      is_new: true,
    });
    expect(storage.get("fusion44x_session_id")).toBe("new-session-uuid");
  });

  it("returns null on network failure", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("Network error"));

    const result = await initializeSession();
    expect(result).toBeNull();
  });

  it("returns null on non-ok response", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 500,
    } as Response);

    const result = await initializeSession();
    expect(result).toBeNull();
  });

  it("sends anonymous_id and page_version in body", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "sid" }),
    } as Response);

    await initializeSession();

    expect(fetch).toHaveBeenCalledWith("/api/funnel-sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: expect.stringContaining("page_version"),
    });

    const body = JSON.parse((vi.mocked(fetch).mock.calls[0][1] as { body: string }).body);
    expect(body).toHaveProperty("anonymous_id");
    expect(body).toHaveProperty("page_version");
    expect(body.page_version).toBe("0.1.0");
  });
});
