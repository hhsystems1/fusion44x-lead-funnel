export function generateGoogleCalendarUrl(params: {
  startTime: string;
  endTime: string;
  title: string;
  description?: string;
  location?: string;
}): string {
  const base = "https://calendar.google.com/calendar/render?action=TEMPLATE";
  const url = new URL(base);
  url.searchParams.set("text", params.title);
  url.searchParams.set("dates", `${formatGCalDate(params.startTime)}/${formatGCalDate(params.endTime)}`);
  if (params.description) url.searchParams.set("details", params.description);
  if (params.location) url.searchParams.set("location", params.location);
  url.searchParams.set("ctz", "America/New_York");
  return url.toString();
}

export function generateOutlookWebUrl(params: {
  startTime: string;
  endTime: string;
  title: string;
  description?: string;
  location?: string;
}): string {
  const base = "https://outlook.live.com/calendar/0/deeplink/compose";
  const url = new URL(base);
  url.searchParams.set("body", params.description ?? "");
  url.searchParams.set("subject", params.title);
  url.searchParams.set("startdt", params.startTime);
  url.searchParams.set("enddt", params.endTime);
  if (params.location) url.searchParams.set("location", params.location);
  url.searchParams.set("path", "/calendar/action/compose&rru=addevent");
  return url.toString();
}

export function generateIcsContent(params: {
  startTime: string;
  endTime: string;
  title: string;
  description?: string;
  location?: string;
  organizer?: string;
}): string {
  const formatIcsDt = (iso: string): string => {
    const d = new Date(iso);
    return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  };

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Fusion44X//Booking//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)}@fusion44x.com`,
    `DTSTART:${formatIcsDt(params.startTime)}`,
    `DTEND:${formatIcsDt(params.endTime)}`,
    `SUMMARY:${params.title}`,
  ];

  if (params.description) {
    lines.push(`DESCRIPTION:${params.description.replace(/\n/g, "\\n")}`);
  }
  if (params.location) {
    lines.push(`LOCATION:${params.location}`);
  }
  if (params.organizer) {
    lines.push(`ORGANIZER;CN=${params.organizer}:mailto:${params.organizer}`);
  }

  lines.push("END:VEVENT", "END:VCALENDAR");
  return lines.join("\r\n");
}

function formatGCalDate(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}