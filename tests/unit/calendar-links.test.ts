import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  generateGoogleCalendarUrl,
  generateOutlookWebUrl,
  generateIcsContent,
} from "@/lib/booking/calendar-links";

const params = {
  startTime: "2026-07-28T14:00:00.000Z",
  endTime: "2026-07-28T14:30:00.000Z",
  title: "Fusion 44X Consultation",
  description: "Fusion 44X consultation appointment.",
};

describe("generateGoogleCalendarUrl", () => {
  it("generates a valid Google Calendar URL", () => {
    const url = generateGoogleCalendarUrl(params);
    expect(url).toContain("calendar.google.com");
    expect(url).toContain("action=TEMPLATE");
    expect(url).toContain("Fusion+44X+Consultation");
  });

  it("includes start and end dates in correct format", () => {
    const url = generateGoogleCalendarUrl(params);
    expect(url).toContain("dates=");
  });

  it("encodes special characters in title", () => {
    const url = generateGoogleCalendarUrl({
      ...params,
      title: "Fusion 44X Consultation & Meeting",
    });
    expect(url).toContain("Fusion+44X+Consultation+%26+Meeting");
  });

  it("includes timezone parameter", () => {
    const url = generateGoogleCalendarUrl(params);
    expect(url).toContain("ctz=");
  });
});

describe("generateOutlookWebUrl", () => {
  it("generates a valid Outlook web URL", () => {
    const url = generateOutlookWebUrl(params);
    expect(url).toContain("outlook.live.com");
    expect(url).toContain("deeplink/compose");
  });

  it("includes subject and body", () => {
    const url = generateOutlookWebUrl(params);
    expect(url).toContain("Fusion+44X+Consultation");
    expect(url).toContain("startdt=");
    expect(url).toContain("enddt=");
  });
});

describe("generateIcsContent", () => {
  beforeEach(() => {
    vi.stubGlobal("crypto", {
      randomUUID: vi.fn(() => "test-uuid-123"),
    });
  });

  it("produces valid ICS content", () => {
    const ics = generateIcsContent(params);
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("END:VCALENDAR");
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("END:VEVENT");
  });

  it("includes DTSTART and DTEND", () => {
    const ics = generateIcsContent(params);
    expect(ics).toContain("DTSTART:");
    expect(ics).toContain("DTEND:");
  });

  it("includes SUMMARY", () => {
    const ics = generateIcsContent(params);
    expect(ics).toContain(`SUMMARY:${params.title}`);
  });

  it("includes UID", () => {
    const ics = generateIcsContent(params);
    expect(ics).toContain("UID:");
  });

  it("includes DESCRIPTION when provided", () => {
    const ics = generateIcsContent(params);
    expect(ics).toContain("DESCRIPTION:");
  });

  it("does not include DESCRIPTION when not provided", () => {
    const ics = generateIcsContent({
      ...params,
      description: undefined,
    });
    expect(ics).not.toContain("DESCRIPTION:");
  });

  it("uses CRLF line endings", () => {
    const ics = generateIcsContent(params);
    expect(ics).toContain("\r\n");
  });

  it("includes ORGANIZER when provided", () => {
    const ics = generateIcsContent({
      ...params,
      organizer: "team@fusion44x.com",
    });
    expect(ics).toContain("ORGANIZER");
    expect(ics).toContain("team@fusion44x.com");
  });
});