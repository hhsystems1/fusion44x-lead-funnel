import { describe, it, expect } from "vitest";
import { deriveLeadSource } from "@/lib/funnel/source";

describe("deriveLeadSource", () => {
  it("uses utm_source when present", () => {
    expect(
      deriveLeadSource({ utm_source: "facebook", referrer: "https://google.com" }),
    ).toBe("facebook");
  });

  it("lowercases and trims utm_source", () => {
    expect(deriveLeadSource({ utm_source: "  Facebook Ads " })).toBe("facebook ads");
  });

  it("maps google referrer", () => {
    expect(deriveLeadSource({ referrer: "https://www.google.com/search?q=x" })).toBe(
      "google",
    );
  });

  it("maps facebook referrer", () => {
    expect(deriveLeadSource({ referrer: "https://l.facebook.com/l.php" })).toBe(
      "facebook",
    );
  });

  it("maps instagram referrer", () => {
    expect(deriveLeadSource({ referrer: "https://www.instagram.com/fusion44x" })).toBe(
      "instagram",
    );
  });

  it("maps tiktok referrer", () => {
    expect(deriveLeadSource({ referrer: "https://www.tiktok.com/@fusion44x" })).toBe(
      "tiktok",
    );
  });

  it("falls back to direct for unknown referrers", () => {
    expect(deriveLeadSource({ referrer: "https://random-site.example/page" })).toBe(
      "direct",
    );
  });

  it("returns direct for a null session", () => {
    expect(deriveLeadSource(null)).toBe("direct");
  });

  it("returns direct for an empty session", () => {
    expect(deriveLeadSource({})).toBe("direct");
  });

  it("falls back to referrer when utm_source is blank", () => {
    expect(
      deriveLeadSource({ utm_source: "  ", referrer: "https://www.youtube.com/watch" }),
    ).toBe("youtube");
  });

  it("handles a malformed referrer URL", () => {
    expect(deriveLeadSource({ referrer: "not a url" })).toBe("direct");
  });
});
