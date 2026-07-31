import { describe, it, expect } from "vitest";
import { parseFilterParams, maskEmail, maskPhone, formatDateTime, formatDate, stepLabel } from "@/app/admin/(protected)/utils";

describe("Admin Dashboard Utilities", () => {
  describe("parseFilterParams", () => {
    it("returns today filter", () => {
      expect(parseFilterParams({ filter: "today" })).toEqual({ type: "today" });
    });

    it("returns last7 filter by default", () => {
      expect(parseFilterParams({})).toEqual({ type: "last7" });
    });

    it("returns last30 filter", () => {
      expect(parseFilterParams({ filter: "last30" })).toEqual({ type: "last30" });
    });

    it("returns custom filter with dates", () => {
      expect(parseFilterParams({ filter: "custom", from: "2026-01-01", to: "2026-01-31" })).toEqual({
        type: "custom",
        from: "2026-01-01",
        to: "2026-01-31",
      });
    });

    it("falls back to last7 when custom has no dates", () => {
      expect(parseFilterParams({ filter: "custom" })).toEqual({ type: "last7" });
    });

    it("falls back to last7 for unknown filter", () => {
      expect(parseFilterParams({ filter: "unknown" })).toEqual({ type: "last7" });
    });
  });

  describe("maskEmail", () => {
    it("masks email correctly", () => {
      expect(maskEmail("alice@example.com")).toBe("al***@example.com");
    });

    it("handles short local part", () => {
      expect(maskEmail("a@test.com")).toBe("a***@test.com");
    });

    it("handles invalid email", () => {
      expect(maskEmail("noemail")).toBe("***");
    });

    it("handles empty string", () => {
      expect(maskEmail("")).toBe("***");
    });
  });

  describe("maskPhone", () => {
    it("masks phone showing last 4 digits", () => {
      expect(maskPhone("+15551234567")).toBe("***-***-4567");
    });

    it("handles empty phone", () => {
      expect(maskPhone("")).toBe("***");
    });
  });

  describe("stepLabel", () => {
    it("returns correct labels for known steps", () => {
      expect(stepLabel("page_viewed")).toBe("Page Viewed");
      expect(stepLabel("diagnostic_started")).toBe("Diagnostic Started");
      expect(stepLabel("diagnostic_completed")).toBe("Diagnostic Completed");
      expect(stepLabel("contact_submitted")).toBe("Contact Submitted");
      expect(stepLabel("booking_completed")).toBe("Booking Completed");
      expect(stepLabel("confirmation_viewed")).toBe("Confirmation Viewed");
    });

    it("returns dash for null", () => {
      expect(stepLabel(null)).toBe("—");
    });

    it("returns raw string for unknown step", () => {
      expect(stepLabel("unknown_step")).toBe("unknown_step");
    });
  });

  describe("formatDateTime", () => {
    it("formats ISO date string", () => {
      const result = formatDateTime("2026-01-15T10:30:00.000Z");
      expect(result).toContain("Jan");
      expect(result).toContain("15");
    });
  });

  describe("formatDate", () => {
    it("formats ISO date string", () => {
      const result = formatDate("2026-01-15T10:30:00.000Z");
      expect(result).toContain("Jan");
      expect(result).toContain("15");
      expect(result).toContain("2026");
    });
  });
});
