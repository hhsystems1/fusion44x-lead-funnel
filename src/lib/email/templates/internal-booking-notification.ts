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

function formatTimezoneLabel(tz: string): string {
  const normalized = tz?.trim() || "America/New_York";
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
  customerLastName?: string;
  customerEmail: string;
  customerPhone?: string;
  zipCode?: string;
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
  const lastName = params.customerLastName ? escapeHtml(params.customerLastName) : "";
  const fullName = [firstName, lastName].filter(Boolean).join(" ") || firstName;
  const email = escapeHtml(params.customerEmail);
  const phone = params.customerPhone ? escapeHtml(params.customerPhone) : null;
  const zipCode = params.zipCode ? escapeHtml(params.zipCode) : null;
  const dateStr = formatDateInTimezone(params.confirmedStartTime, params.timezone);
  const startTimeStr = formatTimeInTimezone(params.confirmedStartTime, params.timezone);
  const endTimeStr = formatTimeInTimezone(params.confirmedEndTime, params.timezone);
  const tzDisplay = escapeHtml(formatTimezoneLabel(params.timezone));
  const preferredContactMethod = params.preferredContactMethod
    ? escapeHtml(params.preferredContactMethod)
    : null;
  const isContactSubmission = params.notificationType === "contact_submission";

  const phoneLine = phone
    ? `<tr><td style="padding:4px 0;font-size:13px;color:#64748b;width:140px;vertical-align:top">Phone</td><td style="padding:4px 0;font-size:14px;color:#1e293b;font-weight:600">${phone}</td></tr>`
    : "";

  const zipLine = zipCode
    ? `<tr><td style="padding:4px 0;font-size:13px;color:#64748b;width:140px;vertical-align:top">ZIP Code</td><td style="padding:4px 0;font-size:14px;color:#1e293b;font-weight:600">${zipCode}</td></tr>`
    : "";

  const preferredContactLine = preferredContactMethod
    ? `<tr><td style="padding:4px 0;font-size:13px;color:#64748b;width:140px;vertical-align:top">Preferred Contact</td><td style="padding:4px 0;font-size:14px;color:#1e293b;font-weight:600">${preferredContactMethod}</td></tr>`
    : "";

  const diagnosticBlock = params.diagnostic ? buildDiagnosticBlock(params.diagnostic) : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>New Pool Consultation Booked</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:Helvetica,Arial,sans-serif">
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;background-color:#f4f4f5">
<tr>
<td align="center" style="padding:24px 16px">
<table role="presentation" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:8px;overflow:hidden">
<tr>
<td style="padding:32px 24px 16px;text-align:center;background-color:#0d3b66">
<h1 style="margin:0;font-size:22px;font-weight:700;color:#ffffff">${isContactSubmission ? "Lead Submitted — Internal Notification" : "New Pool Consultation Booked"}</h1>
<p style="margin:8px 0 0;font-size:14px;color:#dbeafe">${isContactSubmission ? "A new lead submitted the contact form" : "A new Fusion 44X pool consultation has been scheduled."}</p>
</td>
</tr>
<tr>
<td style="padding:24px">
<p style="margin:0 0 16px;font-size:16px;color:#1e293b">${isContactSubmission ? "A new Fusion 44X lead submitted their contact form and diagnostic answers." : "A new Fusion 44X pool consultation has been scheduled."}</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;background-color:#f8fafc;border-radius:6px;margin-bottom:24px">
<tr>
<td style="padding:16px">
<p style="margin:0 0 12px;font-size:13px;font-weight:700;color:#0d3b66;text-transform:uppercase;letter-spacing:0.04em">Customer</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%">
<tr>
<td style="padding:4px 0;font-size:13px;color:#64748b;width:140px;vertical-align:top">Name</td>
<td style="padding:4px 0;font-size:14px;color:#1e293b;font-weight:600">${fullName}</td>
</tr>
<tr>
<td style="padding:4px 0;font-size:13px;color:#64748b;width:140px;vertical-align:top">Email</td>
<td style="padding:4px 0;font-size:14px;color:#1e293b;font-weight:600">${email}</td>
</tr>
${phoneLine}
${zipLine}
${preferredContactLine}
</table>
</td>
</tr>
</table>
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;background-color:#f8fafc;border-radius:6px;margin-bottom:24px">
<tr>
<td style="padding:16px">
<p style="margin:0 0 12px;font-size:13px;font-weight:700;color:#0d3b66;text-transform:uppercase;letter-spacing:0.04em">Appointment</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%">
<tr>
<td style="padding:4px 0;font-size:13px;color:#64748b;width:140px;vertical-align:top">Date</td>
<td style="padding:4px 0;font-size:14px;color:#1e293b;font-weight:600">${dateStr}</td>
</tr>
<tr>
<td style="padding:4px 0;font-size:13px;color:#64748b;width:140px;vertical-align:top">Time</td>
<td style="padding:4px 0;font-size:14px;color:#1e293b;font-weight:600">${startTimeStr} – ${endTimeStr}</td>
</tr>
<tr>
<td style="padding:4px 0;font-size:13px;color:#64748b;width:140px;vertical-align:top">Time Zone</td>
<td style="padding:4px 0;font-size:14px;color:#1e293b;font-weight:600">${tzDisplay}</td>
</tr>
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

  const primaryGoalRow = diagnostic.primaryGoal
    ? `<tr><td style="padding:4px 0;font-size:13px;color:#64748b;width:140px;vertical-align:top">Primary Goal</td><td style="padding:4px 0;font-size:14px;color:#1e293b;font-weight:600">${escapeHtml(diagnostic.primaryGoal)}</td></tr>`
    : "";

  const propertyRows = [
    ["Water Feature", diagnostic.waterFeature],
    ["Installation Type", diagnostic.installationType],
    ["Pool Size", diagnostic.poolSize],
    ["Current Treatment", diagnostic.currentTreatment],
  ]
    .map(
      ([label, value]) =>
        `<tr><td style="padding:4px 0;font-size:13px;color:#64748b;width:140px;vertical-align:top">${escapeHtml(label)}</td><td style="padding:4px 0;font-size:14px;color:#1e293b;font-weight:600">${escapeHtml(value)}</td></tr>`,
    )
    .join("");

  const issuesRows =
    diagnostic.currentIssues.length > 0
      ? `<tr><td colspan="2" style="padding:10px 0 0;font-size:13px;color:#64748b;font-weight:700">Current Issues</td></tr>${diagnostic.currentIssues
          .map(
            (issue) =>
              `<tr><td colspan="2" style="padding:4px 0;font-size:14px;color:#1e293b;font-weight:600">• ${escapeHtml(issue)}</td></tr>`,
          )
          .join("")}`
      : "";

  return `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;background-color:#f8fafc;border-radius:6px;margin-bottom:24px">
<tr>
<td style="padding:16px">
<p style="margin:0 0 12px;font-size:13px;font-weight:700;color:#0d3b66;text-transform:uppercase;letter-spacing:0.04em">Pool Diagnostic</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%">
${propertyRows}
${primaryGoalRow ? `<tr><td colspan="2" style="padding:10px 0 0;font-size:13px;color:#64748b;font-weight:700">Primary Goal</td></tr>${primaryGoalRow}` : ""}
${issuesRows}
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
  const fullName = [params.customerFirstName, params.customerLastName]
    .filter(Boolean)
    .join(" ") || params.customerFirstName;

  const lines = [
    "New Pool Consultation Booked",
    "",
    "A new Fusion 44X pool consultation has been scheduled.",
    "",
    "Customer",
    `Name:         ${fullName}`,
    `Email:        ${params.customerEmail}`,
  ];

  if (params.customerPhone) {
    lines.push(`Phone:        ${params.customerPhone}`);
  }

  if (params.zipCode) {
    lines.push(`ZIP Code:     ${params.zipCode}`);
  }

  lines.push("", "Appointment", `Date:         ${dateStr}`, `Time:         ${startTimeStr} – ${endTimeStr}`, `Time Zone:    ${formatTimezoneLabel(params.timezone)}`);

  if (params.diagnostic) {
    lines.push(
      "",
      "Pool Diagnostic",
      `Water Feature: ${params.diagnostic.waterFeature}`,
      `Installation Type: ${params.diagnostic.installationType}`,
      `Pool Size: ${params.diagnostic.poolSize}`,
      `Current Treatment: ${params.diagnostic.currentTreatment}`,
      "",
      "Primary Goal",
      params.diagnostic.primaryGoal,
    );
    if (params.diagnostic.currentIssues.length > 0) {
      lines.push("", "Current Issues");
      for (const issue of params.diagnostic.currentIssues) {
        lines.push(issue);
      }
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
