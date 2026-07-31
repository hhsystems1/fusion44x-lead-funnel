// =============================================================================
// Lead source derivation
// =============================================================================
// Sources a lead from the funnel session attribution. UTM source wins when
// present; otherwise the referrer hostname is mapped to a known channel.
// Falls back to "direct" when nothing is available.

const REFERRER_SOURCES: Array<[RegExp, string]> = [
  [/google\./i, "google"],
  [/bing\./i, "bing"],
  [/facebook\./i, "facebook"],
  [/instagram\./i, "instagram"],
  [/tiktok\./i, "tiktok"],
  [/youtube\./i, "youtube"],
  [/meta\./i, "meta"],
  [/pinterest\./i, "pinterest"],
  [/linkedin\./i, "linkedin"],
  [/x\.com|twitter\./i, "twitter"],
];

export interface SourceSessionInfo {
  utm_source?: string | null;
  referrer?: string | null;
}

export function deriveLeadSource(
  session: SourceSessionInfo | null | undefined,
): string {
  const utm = session?.utm_source?.trim();
  if (utm) {
    return utm.toLowerCase().slice(0, 128);
  }

  const referrer = session?.referrer?.trim();
  if (referrer) {
    try {
      const hostname = new URL(referrer).hostname;
      for (const [pattern, source] of REFERRER_SOURCES) {
        if (pattern.test(hostname)) return source;
      }
    } catch {
      // Not a parseable URL — fall through to direct
    }
  }

  return "direct";
}
