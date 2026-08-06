import "server-only";
import { formatInTimeZone } from "date-fns-tz";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatDateInTimezone(iso: string, tz: string): string {
  return formatInTimeZone(new Date(iso), tz, "EEEE, MMMM d, yyyy");
}

function formatTimeInTimezone(iso: string, tz: string): string {
  return formatInTimeZone(new Date(iso), tz, "h:mm a");
}

export interface InternalDiagnosticLabels {
  waterFeature: string;
  installationType: string;
  poolSize: string;
  currentTreatment: string;
  primaryGoal: string;
  currentIssues: string[];
}

export interface InternalBookingNotificationParams {
  customerFirstName: string;
  customerEmail: string;
  customerPhone?: string;
  preferredContactMethod?: string;
  confirmedStartTime: string;
  confirmedEndTime: string;
  timezone: string;
  appointmentId: string;
  googleCalendarEventId?: string;
  diagnostic?: InternalDiagnosticLabels;
  notificationType?: "contact_submission" | "booking_confirmation";
}

export function renderInternalBookingNotificationHtml(
  params: InternalBookingNotificationParams,
): string {
  const firstName = escapeHtml(params.customerFirstName);
  const email = escapeHtml(params.customerEmail);
  const phone = params.customerPhone ? escapeHtml(params.customerPhone) : null;
  const dateStr = formatDateInTimezone(params.confirmedStartTime, params.timezone);
  const startTimeStr = formatTimeInTimezone(params.confirmedStartTime, params.timezone);
  const endTimeStr = formatTimeInTimezone(params.confirmedEndTime, params.timezone);
  const tzDisplay = escapeHtml(params.timezone);
  const appointmentId = escapeHtml(params.appointmentId);
  const gcalEventId = params.googleCalendarEventId
    ? escapeHtml(params.googleCalendarEventId)
    : null;
  const preferredContactMethod = params.preferredContactMethod
    ? escapeHtml(params.preferredContactMethod)
    : null;
  const isContactSubmission = params.notificationType === "contact_submission";

  const phoneLine = phone
    ? `<tr><td style="padding:4px 0;font-size:13px;color:#64748b;width:120px;vertical-align:top">Phone</td><td style="padding:4px 0;font-size:14px;color:#1e293b;font-weight:600">${phone}</td></tr>`
    : "";

  const gcalLine = gcalEventId
    ? `<tr><td style="padding:4px 0;font-size:13px;color:#64748b;width:120px;vertical-align:top">GCal Event ID</td><td style="padding:4px 0;font-size:13px;color:#1e293b;font-family:monospace">${gcalEventId}</td></tr>`
    : "";

  const preferredContactLine = preferredContactMethod
    ? `<tr><td style="padding:4px 0;font-size:13px;color:#64748b;width:120px;vertical-align:top">Preferred Contact</td><td style="padding:4px 0;font-size:14px;color:#1e293b;font-weight:600">${preferredContactMethod}</td></tr>`
    : "";

  const diagnosticBlock = params.diagnostic ? buildDiagnosticBlock(params.diagnostic) : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>New Booking Notification</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:Helvetica,Arial,sans-serif">
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;background-color:#f4f4f5">
<tr>
<td align="center" style="padding:24px 16px">
<table role="presentation" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:8px;overflow:hidden">
<tr>
<td style="padding:32px 24px 16px;text-align:center;background-color:#7c2d12">
<h1 style="margin:0;font-size:22px;font-weight:700;color:#ffffff">${isContactSubmission ? "Lead Submitted — Internal Notification" : "New Booking — Internal Notification"}</h1>
<p style="margin:8px 0 0;font-size:14px;color:#fed7aa">${isContactSubmission ? "A new lead submitted the contact form" : "A consultation has been confirmed"}</p>
</td>
</tr>
<tr>
<td style="padding:24px">
<p style="margin:0 0 16px;font-size:16px;color:#1e293b">${isContactSubmission ? "A new Fusion 44X lead submitted their contact form and diagnostic answers." : "A new Fusion 44X pool consultation has been booked."}</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;background-color:#f8fafc;border-radius:6px;margin-bottom:24px">
<tr>
<td style="padding:16px">
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%">
<tr>
<td style="padding:4px 0;font-size:13px;color:#64748b;width:120px;vertical-align:top">Customer</td>
<td style="padding:4px 0;font-size:14px;color:#1e293b;font-weight:600">${firstName}</td>
</tr>
<tr>
<td style="padding:4px 0;font-size:13px;color:#64748b;width:120px;vertical-align:top">Email</td>
<td style="padding:4px 0;font-size:14px;color:#1e293b;font-weight:600">${email}</td>
</tr>
${phoneLine}
${preferredContactLine}
${isContactSubmission ? "" : `<tr>
<td style="padding:4px 0;font-size:13px;color:#64748b;width:120px;vertical-align:top">Date</td>
<td style="padding:4px 0;font-size:14px;color:#1e293b;font-weight:600">${dateStr}</td>
</tr>
<tr>
<td style="padding:4px 0;font-size:13px;color:#64748b;width:120px;vertical-align:top">Time</td>
<td style="padding:4px 0;font-size:14px;color:#1e293b;font-weight:600">${startTimeStr} – ${endTimeStr}</td>
</tr>
<tr>
<td style="padding:4px 0;font-size:13px;color:#64748b;width:120px;vertical-align:top">Timezone</td>
<td style="padding:4px 0;font-size:14px;color:#1e293b;font-weight:600">${tzDisplay}</td>
</tr>
<tr>
<td style="padding:4px 0;font-size:13px;color:#64748b;width:120px;vertical-align:top">Appointment ID</td>
<td style="padding:4px 0;font-size:13px;color:#1e293b;font-family:monospace">${appointmentId}</td>
</tr>
${gcalLine}`}
</table>
</td>
</tr>
</table>
${diagnosticBlock}
<p style="margin:0 0 16px;font-size:14px;color:#475569;line-height:1.6">${isContactSubmission ? "This notification is for internal tracking only. The customer has received a separate confirmation email." : "This notification is for internal tracking only. The customer has received a separate confirmation email with calendar links."}</p>
</td>
</tr>
<tr>
<td style="padding:16px 24px;background-color:#f8fafc;border-top:1px solid #e2e8f0">
<p style="margin:0;font-size:13px;color:#64748b;text-align:center">Fusion 44X Internal System</p>
</td>
</tr>
</table>
</td>
</tr>
</table>
</body>
</html>`;
}

function buildDiagnosticBlock(
  diagnostic: InternalDiagnosticLabels | undefined,
): string {
  if (!diagnostic) return "";

  const rows = [
    ["Water Feature", diagnostic.waterFeature],
    ["Installation Type", diagnostic.installationType],
    ["Pool Size", diagnostic.poolSize],
    ["Current Treatment", diagnostic.currentTreatment],
    ["Primary Goal", diagnostic.primaryGoal],
  ]
    .map(
      ([label, value]) =>
        `<tr><td style="padding:4px 0;font-size:13px;color:#64748b;width:120px;vertical-align:top">${escapeHtml(label)}</td><td style="padding:4px 0;font-size:14px;color:#1e293b;font-weight:600">${escapeHtml(value)}</td></tr>`,
    )
    .join("");

  const issuesLine =
    diagnostic.currentIssues.length > 0
      ? `<tr><td style="padding:4px 0;font-size:13px;color:#64748b;width:120px;vertical-align:top">Current Issues</td><td style="padding:4px 0;font-size:14px;color:#1e293b;font-weight:600">${diagnostic.currentIssues.map(escapeHtml).join(", ")}</td></tr>`
      : "";

  return `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;background-color:#f8fafc;border-radius:6px;margin-bottom:24px">
<tr>
<td style="padding:16px">
<p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#7c2d12;text-transform:uppercase;letter-spacing:0.04em">Pool Diagnostic</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%">
${rows}
${issuesLine}
</table>
</td>
</tr>
</table>`;
}

export function renderInternalBookingNotificationText(
  params: InternalBookingNotificationParams,
): string {
  const dateStr = formatDateInTimezone(params.confirmedStartTime, params.timezone);
  const startTimeStr = formatTimeInTimezone(params.confirmedStartTime, params.timezone);
  const endTimeStr = formatTimeInTimezone(params.confirmedEndTime, params.timezone);

  const lines = [
    "New Booking — Internal Notification",
    "",
    "A new Fusion 44X pool consultation has been booked.",
    "",
    `Customer:     ${params.customerFirstName}`,
    `Email:        ${params.customerEmail}`,
  ];

  if (params.customerPhone) {
    lines.push(`Phone:        ${params.customerPhone}`);
  }

  lines.push(
    `Date:         ${dateStr}`,
    `Time:         ${startTimeStr} – ${endTimeStr}`,
    `Timezone:     ${params.timezone}`,
    `Appointment:  ${params.appointmentId}`,
  );

  if (params.googleCalendarEventId) {
    lines.push(`GCal Event ID: ${params.googleCalendarEventId}`);
  }

  if (params.diagnostic) {
    lines.push(
      "",
      "Pool Diagnostic",
      `Water Feature:     ${params.diagnostic.waterFeature}`,
      `Installation Type: ${params.diagnostic.installationType}`,
      `Pool Size:         ${params.diagnostic.poolSize}`,
      `Current Treatment: ${params.diagnostic.currentTreatment}`,
      `Primary Goal:      ${params.diagnostic.primaryGoal}`,
    );
    if (params.diagnostic.currentIssues.length > 0) {
      lines.push(
        `Current Issues:    ${params.diagnostic.currentIssues.join(", ")}`,
      );
    }
  }

  lines.push(
    "",
    "This notification is for internal tracking only.",
    params.notificationType === "contact_submission"
      ? "The customer has received a separate confirmation email."
      : "The customer has received a separate confirmation email with calendar links.",
    "",
    "Fusion 44X Internal System",
  );

  return lines.join("\n");
}
