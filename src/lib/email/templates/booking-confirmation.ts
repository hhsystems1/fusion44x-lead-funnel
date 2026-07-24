import "server-only";
import { formatInTimeZone } from "date-fns-tz";
import { EMAIL_CONFIG } from "@/config/email";

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

export interface BookingConfirmationTemplateParams {
  recipientFirstName: string;
  confirmedStartTime: string;
  confirmedEndTime: string;
  timezone: string;
  googleCalendarLink: string;
  outlookCalendarLink: string;
  icsContent: string;
}

export function renderBookingConfirmationHtml(
  params: BookingConfirmationTemplateParams,
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
  const gcalHref = escapeHtml(params.googleCalendarLink);
  const ocalHref = escapeHtml(params.outlookCalendarLink);
  const icsDataUri = `data:text/calendar;charset=utf-8,${encodeURIComponent(params.icsContent)}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Booking Confirmed</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:Helvetica,Arial,sans-serif">
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;background-color:#f4f4f5">
<tr>
<td align="center" style="padding:24px 16px">
<table role="presentation" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:8px;overflow:hidden">
<tr>
<td style="padding:32px 24px 16px;text-align:center;background-color:#1e3a5f">
<h1 style="margin:0;font-size:22px;font-weight:700;color:#ffffff">${title}</h1>
<p style="margin:8px 0 0;font-size:14px;color:#cbd5e1">Your consultation is confirmed</p>
</td>
</tr>
<tr>
<td style="padding:24px">
<p style="margin:0 0 16px;font-size:16px;color:#1e293b">Hello ${firstName},</p>
<p style="margin:0 0 16px;font-size:15px;color:#475569;line-height:1.6">Your Fusion 44X pool consultation has been confirmed. We look forward to speaking with you.</p>
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
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:24px">
<tr>
<td align="center" style="padding:4px">
<a href="${gcalHref}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:12px 24px;background-color:#1e3a5f;color:#ffffff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:600;min-width:180px;text-align:center">Add to Google Calendar</a>
</td>
</tr>
<tr>
<td align="center" style="padding:4px">
<a href="${ocalHref}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:12px 24px;background-color:#0078d4;color:#ffffff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:600;min-width:180px;text-align:center">Add to Outlook Calendar</a>
</td>
</tr>
<tr>
<td align="center" style="padding:4px">
<a href="${icsDataUri}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:12px 24px;border:2px solid #1e3a5f;color:#1e3a5f;text-decoration:none;border-radius:6px;font-size:14px;font-weight:600;min-width:180px;text-align:center">Add to Apple / Other Calendar</a>
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

export function renderBookingConfirmationText(
  params: BookingConfirmationTemplateParams,
): string {
  const dateStr = formatDateInTimezone(params.confirmedStartTime, params.timezone);
  const startTimeStr = formatTimeInTimezone(params.confirmedStartTime, params.timezone);
  const endTimeStr = formatTimeInTimezone(params.confirmedEndTime, params.timezone);
  const durationMin = formatDurationMinutes(
    params.confirmedStartTime,
    params.confirmedEndTime,
  );

  return [
    `${EMAIL_CONFIG.CONSULTATION_TITLE} — Confirmed`,
    "",
    `Hello ${params.recipientFirstName},`,
    "",
    "Your Fusion 44X pool consultation has been confirmed.",
    "",
    `Date:     ${dateStr}`,
    `Time:     ${startTimeStr} – ${endTimeStr}`,
    `Duration: ${durationMin} minutes`,
    `Timezone: ${params.timezone}`,
    "",
    "Add to your calendar:",
    `Google Calendar: ${params.googleCalendarLink}`,
    `Outlook Calendar: ${params.outlookCalendarLink}`,
    `Apple/Other: Download the attached .ics file or use the link above.`,
    "",
    "If you need to reschedule or have any questions, please contact us.",
    "",
    `${EMAIL_CONFIG.COMPANY_NAME}`,
    `${EMAIL_CONFIG.SUPPORT_PHONE}`,
  ].join("\n");
}