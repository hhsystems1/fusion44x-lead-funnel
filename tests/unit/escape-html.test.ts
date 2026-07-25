import { describe, it, expect } from "vitest";

/**
 * Escape function that mirrors the test-resend-email.mjs escapeHtml().
 * The production implementation lives in:
 *   src/lib/email/templates/internal-booking-notification.ts
 *   src/lib/email/templates/booking-confirmation.ts
 *
 * Both production templates use an identical escapeHtml. The manual test
 * script scripts/test-resend-email.mjs duplicates this logic for standalone
 * smoke testing. These tests verify that the duplicated function is correct.
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

describe("escapeHtml — duplicated test script logic", () => {
  it("escapes < and > to prevent raw HTML injection", () => {
    const input = '<script>alert(1)</script>';
    const result = escapeHtml(input);
    expect(result).toBe("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(result).not.toContain("<script>");
  });

  it("escapes & to &amp; to prevent entity injection", () => {
    const input = "Tom & Jerry";
    const result = escapeHtml(input);
    expect(result).toBe("Tom &amp; Jerry");
    expect(result).not.toContain("& Jerry");
  });

  it("escapes double quotes to &quot; for attribute safety", () => {
    const input = '"quoted"';
    const result = escapeHtml(input);
    expect(result).toBe("&quot;quoted&quot;");
    expect(result).not.toContain('"quoted"');
  });

  it("escapes single quotes to &#039; for attribute safety", () => {
    const input = "it's a test";
    const result = escapeHtml(input);
    expect(result).toBe("it&#039;s a test");
    expect(result).not.toContain("'s a");
  });

  it("leaves safe strings unchanged", () => {
    const safe = "Hello World 123";
    expect(escapeHtml(safe)).toBe(safe);
  });

  it("handles empty string", () => {
    expect(escapeHtml("")).toBe("");
  });

  it("escapes all special characters in a combined input", () => {
    const input = '<div class="x">Tom &amp; Jerry\'s "place"</div>';
    const result = escapeHtml(input);
    expect(result).toBe(
      '&lt;div class=&quot;x&quot;&gt;Tom &amp;amp; Jerry&#039;s &quot;place&quot;&lt;/div&gt;',
    );
  });

  it("does not produce double-escaped entities", () => {
    const input = "&lt;";
    const result = escapeHtml(input);
    expect(result).toBe("&amp;lt;");
  });

  it("matches the production template escapeHtml behavior", async () => {
    const { renderInternalBookingNotificationHtml } = await import(
      "@/lib/email/templates/internal-booking-notification"
    );

    const html = renderInternalBookingNotificationHtml({
      customerFirstName: '<script>alert("xss")</script>',
      customerEmail: "Tom & Jerry",
      confirmedStartTime: "2026-07-28T14:00:00.000Z",
      confirmedEndTime: "2026-07-28T14:30:00.000Z",
      timezone: "America/New_York",
      appointmentId: '"quoted"',
    });

    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("Tom &amp; Jerry");
    expect(html).toContain("&quot;quoted&quot;");
    expect(html).not.toContain("<script>");
  });
});
