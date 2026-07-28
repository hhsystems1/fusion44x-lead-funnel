import { vi, describe, it, expect } from "vitest";

// Mock "server-only" before importing the module
vi.mock("server-only", () => ({}));

// We need to mock getServerSupabaseClient since resolveDateRange doesn't use it
// but the import chain pulls it in
vi.mock("@/lib/supabase", () => ({
  getServerSupabaseClient: () => ({
    from: () => ({}),
  }),
}));

import { resolveDateRange } from "@/lib/admin/queries";

describe("resolveDateRange", () => {
  it("resolves today filter", () => {
    const { from, to } = resolveDateRange({ type: "today" });
    const now = new Date();
    expect(from.getHours()).toBe(0);
    expect(from.getMinutes()).toBe(0);
    expect(from.getSeconds()).toBe(0);
    expect(to.getDate()).toBe(now.getDate());
  });

  it("resolves last7 filter", () => {
    const { from } = resolveDateRange({ type: "last7" });
    const expected = new Date();
    expected.setDate(expected.getDate() - 7);
    expected.setHours(0, 0, 0, 0);
    expect(from.toISOString().split("T")[0]).toBe(
      expected.toISOString().split("T")[0],
    );
  });

  it("resolves last30 filter", () => {
    const { from } = resolveDateRange({ type: "last30" });
    const expected = new Date();
    expected.setDate(expected.getDate() - 30);
    expected.setHours(0, 0, 0, 0);
    expect(from.toISOString().split("T")[0]).toBe(
      expected.toISOString().split("T")[0],
    );
  });

  it("resolves custom filter", () => {
    const { from, to } = resolveDateRange({
      type: "custom",
      from: "2026-01-01",
      to: "2026-01-15",
    });
    expect(from.toISOString().startsWith("2026-01-01")).toBe(true);
    expect(to.toISOString().startsWith("2026-01-15")).toBe(true);
  });
});
