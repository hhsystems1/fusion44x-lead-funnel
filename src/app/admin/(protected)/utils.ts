import type { DateFilter } from "@/lib/admin/queries";

export function parseFilterParams(
  params: Record<string, string | undefined>,
): DateFilter {
  const filter = params.filter;

  if (filter === "today") return { type: "today" };
  if (filter === "last30") return { type: "last30" };
  if (filter === "custom" && params.from && params.to) {
    return { type: "custom", from: params.from, to: params.to };
  }
  // Default: last 7 days
  return { type: "last7" };
}

export function maskEmail(email: string): string {
  if (!email || !email.includes("@")) return "***";
  const [local, domain] = email.split("@");
  return `${local.substring(0, 2)}***@${domain}`;
}

export function maskPhone(phone: string): string {
  if (!phone) return "***";
  return "***-***-" + phone.slice(-4);
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/New_York",
  });
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "America/New_York",
  });
}

export function formatTimezoneLabel(timezone: string | null | undefined): string {
  if (!timezone) return "Eastern Time";
  const normalized = timezone.trim();
  if (
    normalized === "America/New_York" ||
    normalized === "EST" ||
    normalized === "EDT" ||
    /eastern/i.test(normalized) ||
    /new_york/i.test(normalized)
  ) {
    return "Eastern Time";
  }
  return normalized;
}

export function stepLabel(step: string | null): string {
  if (!step) return "—";
  const labels: Record<string, string> = {
    page_viewed: "Page Viewed",
    diagnostic_started: "Diagnostic Started",
    question_viewed: "Questions",
    diagnostic_completed: "Diagnostic Completed",
    contact_step_viewed: "Contact Viewed",
    lead_created: "Lead Created",
    calendar_viewed: "Booking Viewed",
    time_slot_selected: "Slot Selected",
    booking_completed: "Booking Completed",
    confirmation_viewed: "Confirmation Viewed",
  };
  return labels[step] ?? step;
}
