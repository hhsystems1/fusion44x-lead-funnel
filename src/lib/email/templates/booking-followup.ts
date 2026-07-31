import "server-only";
import { formatInTimeZone } from "date-fns-tz";
import { EMAIL_CONFIG } from "@/config/email";
import type { InternalDiagnosticLabels } from "@/lib/email/templates/internal-booking-notification";

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

function formatDurationMinutes(startIso: string, endIso: string): number {
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  return Math.round((end - start) / 60000);
}

export interface BookingFollowUpTemplateParams {
  recipientFirstName: string;
  confirmedStartTime: string;
  confirmedEndTime: string;
  timezone: string;
  diagnostic?: InternalDiagnosticLabels;
}

export function renderBookingFollowUpHtml(
  params: BookingFollowUpTemplateParams,
): string {
  const firstName = escapeHtml(params.recipientFirstName);
  const dateStr = formatDateInTimezone(params.confirmedStartTime, params.timezone);
  const startTimeStr = formatTimeInTimezone(params.confirmedStartTime, params.timezone);
  const endTimeStr = formatTimeInTimezone(params.confirmedEndTime, params.timezone);
  const durationMin = formatDurationMinutes(
    params.confirmedStartTime,
    params.confirmedEndTime,
  );
  const tzDisplay = escapeHtml(params.timezone);
  const title = escapeHtml(EMAIL_CONFIG.CONSULTATION_TITLE);
  const company = escapeHtml(EMAIL_CONFIG.COMPANY_NAME);
  const phone = escapeHtml(EMAIL_CONFIG.SUPPORT_PHONE);
  const diagnosticBlock = buildDiagnosticBlock(params.diagnostic);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Get Ready for Your Consultation</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:Helvetica,Arial,sans-serif">
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;background-color:#f4f4f5">
<tr>
<td align="center" style="padding:24px 16px">
<table role="presentation" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:8px;overflow:hidden">
<tr>
<td style="padding:32px 24px 16px;text-align:center;background-color:#1e3a5f">
<h1 style="margin:0;font-size:22px;font-weight:700;color:#ffffff">${title}</h1>
<p style="margin:8px 0 0;font-size:14px;color:#cbd5e1">Get ready for your consultation</p>
</td>
</tr>
<tr>
<td style="padding:24px">
<p style="margin:0 0 16px;font-size:16px;color:#1e293b">Hello ${firstName},</p>
<p style="margin:0 0 16px;font-size:15px;color:#475569;line-height:1.6">Your Fusion 44X pool consultation is all set. Here's a recap of your details and a few things that will help us make the most of our time together.</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;background-color:#f8fafc;border-radius:6px;margin-bottom:24px">
<tr>
<td style="padding:16px">
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%">
<tr>
<td style="padding:4px 0;font-size:13px;color:#64748b;width:100px;vertical-align:top">Date</td>
<td style="padding:4px 0;font-size:14px;color:#1e293b;font-weight:600">${dateStr}</td>
</tr>
<tr>
<td style="padding:4px 0;font-size:13px;color:#64748b;width:100px;vertical-align:top">Time</td>
<td style="padding:4px 0;font-size:14px;color:#1e293b;font-weight:600">${startTimeStr} – ${endTimeStr}</td>
</tr>
<tr>
<td style="padding:4px 0;font-size:13px;color:#64748b;width:100px;vertical-align:top">Duration</td>
<td style="padding:4px 0;font-size:14px;color:#1e293b;font-weight:600">${durationMin} minutes</td>
</tr>
<tr>
<td style="padding:4px 0;font-size:13px;color:#64748b;width:100px;vertical-align:top">Timezone</td>
<td style="padding:4px 0;font-size:14px;color:#1e293b;font-weight:600">${tzDisplay}</td>
</tr>
</table>
</td>
</tr>
</table>
${diagnosticBlock}
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:24px">
<tr>
<td style="padding:16px;background-color:#eff6ff;border-radius:6px">
<p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#1e3a5f;text-transform:uppercase;letter-spacing:0.04em">What to Expect</p>
<p style="margin:0;font-size:14px;color:#475569;line-height:1.6">During your consultation we'll walk through your pool goals, review the options that fit your setup, and answer any questions you have. A few minutes before your call, please have your current pool routine or any product labels handy — they help us tailor our recommendations to your specific situation.</p>
</td>
</tr>
</table>
<p style="margin:0 0 16px;font-size:14px;color:#475569;line-height:1.6">If you need to reschedule or have any questions, please contact us.</p>
</td>
</tr>
<tr>
<td style="padding:16px 24px;background-color:#f8fafc;border-top:1px solid #e2e8f0">
<p style="margin:0;font-size:13px;color:#64748b;text-align:center">${company} &middot; ${phone}</p>
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
<p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#1e3a5f;text-transform:uppercase;letter-spacing:0.04em">Your Details</p>
<p style="margin:0 0 8px;font-size:13px;color:#64748b">A quick recap of what you told us:</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%">
${rows}
${issuesLine}
</table>
</td>
</tr>
</table>`;
}

export function renderBookingFollowUpText(
  params: BookingFollowUpTemplateParams,
): string {
  const dateStr = formatDateInTimezone(params.confirmedStartTime, params.timezone);
  const startTimeStr = formatTimeInTimezone(params.confirmedStartTime, params.timezone);
  const endTimeStr = formatTimeInTimezone(params.confirmedEndTime, params.timezone);
  const durationMin = formatDurationMinutes(
    params.confirmedStartTime,
    params.confirmedEndTime,
  );

  const lines = [
    `${EMAIL_CONFIG.CONSULTATION_TITLE} — Get Ready`,
    "",
    `Hello ${params.recipientFirstName},`,
    "",
    "Your Fusion 44X pool consultation is all set.",
    "",
    `Date:     ${dateStr}`,
    `Time:     ${startTimeStr} – ${endTimeStr}`,
    `Duration: ${durationMin} minutes`,
    `Timezone: ${params.timezone}`,
  ];

  if (params.diagnostic) {
    lines.push(
      "",
      "Your Details",
      "A quick recap of what you told us:",
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
    "What to Expect",
    "We'll walk through your pool goals, review the options that fit your setup, and answer any questions you have. Please have your current pool routine or any product labels handy.",
    "",
    "If you need to reschedule or have any questions, please contact us.",
    "",
    EMAIL_CONFIG.COMPANY_NAME,
    EMAIL_CONFIG.SUPPORT_PHONE,
  );

  return lines.join("\n");
}
