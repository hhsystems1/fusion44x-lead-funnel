#!/usr/bin/env node
/**
 * Manual test / smoke-test script for Resend email provider.
 *
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │ NOTICE: This is a transport / manual rendering smoke test only.    │
 * │ Production templates remain the source of truth.                   │
 * │ Do NOT use this script as the production rendering implementation. │
 * │ This script duplicates template rendering logic for standalone     │
 * │ testing and must be kept in sync manually.                         │
 * └─────────────────────────────────────────────────────────────────────┘
 *
 * Usage:
 *   node --env-file=.env.local scripts/test-resend-email.mjs
 *   node --env-file=.env.local scripts/test-resend-email.mjs --internal
 *   node scripts/test-resend-email.mjs --self-test
 *
 * Requirements:
 *   - TEST_EMAIL_TO environment variable must be set (recipient email for customer test)
 *   - INTERNAL_BOOKING_NOTIFICATION_TO for internal test
 *   - EMAIL_PROVIDER=resend must be set
 *   - EMAIL_API_KEY must be set (Resend API key)
 *   - EMAIL_FROM must be set (verified sender)
 *   - EMAIL_REPLY_TO optional (reply-to address)
 *
 * This script sends ONE test booking confirmation email.
 * It does NOT read from or modify production appointment records.
 */

import { Resend } from "resend";
import { formatInTimeZone } from "date-fns-tz";

const EMAIL_CONFIG = {
  CONSULTATION_TITLE: "Fusion 44X Pool Consultation",
  REPLY_TO_PLACEHOLDER: "consultations@fusion44x.com",
  COMPANY_NAME: "Fusion 44X",
  SUPPORT_PHONE: "(555) 123-4567",
};

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatDateInTimezone(iso, tz) {
  return formatInTimeZone(new Date(iso), tz, "EEEE, MMMM d, yyyy");
}

function formatTimeInTimezone(iso, tz) {
  return formatInTimeZone(new Date(iso), tz, "h:mm a");
}

function formatTimezoneLabel(tz) {
  const normalized = (tz || "America/New_York").trim();
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

function formatDurationMinutes(startIso, endIso) {
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  return Math.round((end - start) / 60000);
}

function generateGoogleCalendarUrl(params) {
  const start = new Date(params.startTime).toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const end = new Date(params.endTime).toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(params.title)}&dates=${start}/${end}`;
}

function generateOutlookWebUrl(params) {
  return `https://outlook.live.com/calendar/0/deeplink/compose?subject=${encodeURIComponent(params.title)}&startdt=${params.startTime}&enddt=${params.endTime}`;
}

function generateIcsContent(params) {
  const start = new Date(params.startTime).toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const end = new Date(params.endTime).toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const uid = `${Date.now()}-${Math.random().toString(36).substring(2)}@fusion44x.com`;
  
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Fusion 44X//Pool Consultation//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${params.title}`,
    params.organizer ? `ORGANIZER:mailto:${params.organizer}` : "",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean).join("\r\n");
}

function renderBookingConfirmationHtml(params) {
  const firstName = escapeHtml(params.recipientFirstName);
  const dateStr = formatDateInTimezone(params.confirmedStartTime, params.timezone);
  const startTimeStr = formatTimeInTimezone(params.confirmedStartTime, params.timezone);
  const endTimeStr = formatTimeInTimezone(params.confirmedEndTime, params.timezone);
  const durationMin = formatDurationMinutes(params.confirmedStartTime, params.confirmedEndTime);
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
<td style="padding:4px 0;font-size:14px;color:#1e293b;font-weight:600">${startTimeStr} \u2013 ${endTimeStr}</td>
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
<p style="margin:0;font-size:13px;color:#64748b;text-align:center">${company} \u00b7 ${phone}</p>
</td>
</tr>
</table>
</td>
</tr>
</table>
</body>
</html>`;
}

function renderBookingConfirmationText(params) {
  const dateStr = formatDateInTimezone(params.confirmedStartTime, params.timezone);
  const startTimeStr = formatTimeInTimezone(params.confirmedStartTime, params.timezone);
  const endTimeStr = formatTimeInTimezone(params.confirmedEndTime, params.timezone);
  const durationMin = formatDurationMinutes(params.confirmedStartTime, params.confirmedEndTime);

  return [
    `${EMAIL_CONFIG.CONSULTATION_TITLE} \u2014 Confirmed`,
    "",
    `Hello ${params.recipientFirstName},`,
    "",
    "Your Fusion 44X pool consultation has been confirmed.",
    "",
    `Date:     ${dateStr}`,
    `Time:     ${startTimeStr} \u2013 ${endTimeStr}`,
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

function renderInternalBookingNotificationHtml(params) {
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
  const preferredContactMethod = params.preferredContactMethod ? escapeHtml(params.preferredContactMethod) : null;

  const phoneLine = phone
    ? `<tr><td style="padding:4px 0;font-size:13px;color:#64748b;width:140px;vertical-align:top">Phone</td><td style="padding:4px 0;font-size:14px;color:#1e293b;font-weight:600">${phone}</td></tr>`
    : "";

  const zipLine = zipCode
    ? `<tr><td style="padding:4px 0;font-size:13px;color:#64748b;width:140px;vertical-align:top">ZIP Code</td><td style="padding:4px 0;font-size:14px;color:#1e293b;font-weight:600">${zipCode}</td></tr>`
    : "";

  const preferredContactLine = preferredContactMethod
    ? `<tr><td style="padding:4px 0;font-size:13px;color:#64748b;width:140px;vertical-align:top">Preferred Contact</td><td style="padding:4px 0;font-size:14px;color:#1e293b;font-weight:600">${preferredContactMethod}</td></tr>`
    : "";

  const diagnosticRows = params.diagnostic ? buildDiagnosticRows(params.diagnostic) : "";

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
<h1 style="margin:0;font-size:22px;font-weight:700;color:#ffffff">New Pool Consultation Booked</h1>
<p style="margin:8px 0 0;font-size:14px;color:#dbeafe">A new Fusion 44X pool consultation has been scheduled.</p>
</td>
</tr>
<tr>
<td style="padding:24px">
<p style="margin:0 0 16px;font-size:16px;color:#1e293b">A new Fusion 44X pool consultation has been scheduled.</p>
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
${diagnosticRows}
<p style="margin:0 0 16px;font-size:14px;color:#475569;line-height:1.6">This notification is for internal tracking only. The customer has received a separate confirmation email with calendar links.</p>
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

function buildDiagnosticRows(diagnostic) {
  const propertyRows = [
    ["Water Feature", diagnostic.waterFeature],
    ["Installation Type", diagnostic.installationType],
    ["Pool Size", diagnostic.poolSize],
    ["Current Treatment", diagnostic.currentTreatment],
  ]
    .map(([label, value]) => `<tr><td style="padding:4px 0;font-size:13px;color:#64748b;width:140px;vertical-align:top">${escapeHtml(label)}</td><td style="padding:4px 0;font-size:14px;color:#1e293b;font-weight:600">${escapeHtml(value)}</td></tr>`)
    .join("");

  const primaryGoalRow = diagnostic.primaryGoal
    ? `<tr><td colspan="2" style="padding:10px 0 0;font-size:13px;color:#64748b;font-weight:700">Primary Goal</td></tr><tr><td colspan="2" style="padding:4px 0;font-size:14px;color:#1e293b;font-weight:600">${escapeHtml(diagnostic.primaryGoal)}</td></tr>`
    : "";

  const issuesRows = diagnostic.currentIssues && diagnostic.currentIssues.length > 0
    ? `<tr><td colspan="2" style="padding:10px 0 0;font-size:13px;color:#64748b;font-weight:700">Current Issues</td></tr>${diagnostic.currentIssues.map((issue) => `<tr><td colspan="2" style="padding:4px 0;font-size:14px;color:#1e293b;font-weight:600">• ${escapeHtml(issue)}</td></tr>`).join("")}`
    : "";

  return `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;background-color:#f8fafc;border-radius:6px;margin-bottom:24px">
<tr>
<td style="padding:16px">
<p style="margin:0 0 12px;font-size:13px;font-weight:700;color:#0d3b66;text-transform:uppercase;letter-spacing:0.04em">Pool Diagnostic</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%">
${propertyRows}
${primaryGoalRow}
${issuesRows}
</table>
</td>
</tr>
</table>`;
}

function renderInternalBookingNotificationText(params) {
  const dateStr = formatDateInTimezone(params.confirmedStartTime, params.timezone);
  const startTimeStr = formatTimeInTimezone(params.confirmedStartTime, params.timezone);
  const endTimeStr = formatTimeInTimezone(params.confirmedEndTime, params.timezone);
  const fullName = [params.customerFirstName, params.customerLastName].filter(Boolean).join(" ") || params.customerFirstName;

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

  lines.push(
    "",
    "Appointment",
    `Date:         ${dateStr}`,
    `Time:         ${startTimeStr} – ${endTimeStr}`,
    `Time Zone:    ${formatTimezoneLabel(params.timezone)}`,
  );

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

    if (params.diagnostic.currentIssues && params.diagnostic.currentIssues.length > 0) {
      lines.push("", "Current Issues");
      for (const issue of params.diagnostic.currentIssues) {
        lines.push(issue);
      }
    }
  }

  lines.push(
    "",
    "This notification is for internal tracking only.",
    "The customer has received a separate confirmation email with calendar links.",
    "",
    "Fusion 44X Internal System",
  );

  return lines.join("\n");
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value.trim();
}

async function sendCustomerTest() {
  const testEmailTo = requireEnv("TEST_EMAIL_TO");

  if (process.env.EMAIL_PROVIDER !== "resend") {
    console.error("Error: EMAIL_PROVIDER must be set to 'resend'");
    process.exit(1);
  }

  const apiKey = process.env.EMAIL_API_KEY;
  if (!apiKey) {
    console.error("Error: EMAIL_API_KEY not set");
    process.exit(1);
  }

  const fromAddress = requireEnv("EMAIL_FROM");
  const replyTo = process.env.EMAIL_REPLY_TO?.trim() || undefined;

  console.log("=== Resend Test Email (Customer) ===");
  console.log(`Provider: resend`);
  console.log(`From: ${fromAddress}`);
  console.log(`Reply-To: ${replyTo || "(not set)"}`);
  console.log(`To: ${testEmailTo}`);
  console.log("");

  const startTime = new Date();
  startTime.setHours(startTime.getHours() + 2);
  startTime.setMinutes(0, 0, 0);

  const endTime = new Date(startTime);
  endTime.setMinutes(endTime.getMinutes() + 30);

  const confirmedStartTime = startTime.toISOString();
  const confirmedEndTime = endTime.toISOString();
  const timezone = "America/New_York";

  const googleCalendarLink = generateGoogleCalendarUrl({
    startTime: confirmedStartTime,
    endTime: confirmedEndTime,
    title: EMAIL_CONFIG.CONSULTATION_TITLE,
  });

  const outlookCalendarLink = generateOutlookWebUrl({
    startTime: confirmedStartTime,
    endTime: confirmedEndTime,
    title: EMAIL_CONFIG.CONSULTATION_TITLE,
  });

  const icsContent = generateIcsContent({
    startTime: confirmedStartTime,
    endTime: confirmedEndTime,
    title: EMAIL_CONFIG.CONSULTATION_TITLE,
    organizer: EMAIL_CONFIG.REPLY_TO_PLACEHOLDER,
  });

  const html = renderBookingConfirmationHtml({
    recipientFirstName: "Test",
    confirmedStartTime,
    confirmedEndTime,
    timezone,
    googleCalendarLink,
    outlookCalendarLink,
    icsContent,
  });

  const text = renderBookingConfirmationText({
    recipientFirstName: "Test",
    confirmedStartTime,
    confirmedEndTime,
    timezone,
    googleCalendarLink,
    outlookCalendarLink,
    icsContent,
  });

  const resend = new Resend(apiKey);

  console.log("Sending test email...");

  try {
    const response = await resend.emails.send({
      from: fromAddress,
      to: testEmailTo,
      replyTo,
      subject: "Booking Confirmed: Test's Fusion 44X Pool Consultation",
      html,
      text,
      headers: {
        "Idempotency-Key": `test-customer-${Date.now()}`,
      },
      attachments: [
        {
          filename: "fusion-44x-consultation.ics",
          content: icsContent,
          contentType: "text/calendar",
        },
      ],
    });

    if (response.error) {
      console.error("");
      console.error("=== ERROR ===");
      console.error(`Message: ${response.error.message}`);
      if (response.error.statusCode) {
        console.error(`Status: ${response.error.statusCode}`);
      }
      process.exit(1);
    }

    console.log("");
    console.log("=== SUCCESS ===");
    console.log(`Message ID: ${response.data?.id}`);
    console.log(`Status: delivered`);
    console.log("");
    console.log("Check the recipient inbox for the test confirmation email.");
  } catch (err) {
    console.error("");
    console.error("=== ERROR ===");
    if (err instanceof Error) {
      console.error(`Message: ${err.message}`);
    } else {
      console.error(`Unknown error: ${String(err)}`);
    }
    process.exit(1);
  }
}

async function sendInternalTest() {
  const internalEmailTo = requireEnv("INTERNAL_BOOKING_NOTIFICATION_TO");

  if (process.env.EMAIL_PROVIDER !== "resend") {
    console.error("Error: EMAIL_PROVIDER must be set to 'resend'");
    process.exit(1);
  }

  const apiKey = process.env.EMAIL_API_KEY;
  if (!apiKey) {
    console.error("Error: EMAIL_API_KEY not set");
    process.exit(1);
  }

  const fromAddress = requireEnv("EMAIL_FROM");

  console.log("=== Resend Test Email (Internal) ===");
  console.log(`Provider: resend`);
  console.log(`From: ${fromAddress}`);
  console.log(`To: ${internalEmailTo}`);
  console.log("");

  const startTime = new Date();
  startTime.setHours(startTime.getHours() + 2);
  startTime.setMinutes(0, 0, 0);

  const endTime = new Date(startTime);
  endTime.setMinutes(endTime.getMinutes() + 30);

  const confirmedStartTime = startTime.toISOString();
  const confirmedEndTime = endTime.toISOString();
  const timezone = "America/New_York";
  const appointmentId = `test-appt-${Date.now()}`;
  const googleCalendarEventId = `gcal-event-${Date.now()}`;

  const html = renderInternalBookingNotificationHtml({
    customerFirstName: "Alicia",
    customerLastName: "Johnson",
    customerEmail: "customer@example.com",
    customerPhone: "(555) 123-4567",
    zipCode: "12345",
    confirmedStartTime,
    confirmedEndTime,
    timezone,
    appointmentId,
    googleCalendarEventId,
    diagnostic: {
      waterFeature: "In-ground Pool",
      installationType: "New Build",
      poolSize: "18x36",
      currentTreatment: "Salt Water Chlorine Generator",
      primaryGoal: "Healthier water and less maintenance",
      currentIssues: ["Green tint", "Cloudy water"],
    },
  });

  const text = renderInternalBookingNotificationText({
    customerFirstName: "Alicia",
    customerLastName: "Johnson",
    customerEmail: "customer@example.com",
    customerPhone: "(555) 123-4567",
    zipCode: "12345",
    confirmedStartTime,
    confirmedEndTime,
    timezone,
    appointmentId,
    googleCalendarEventId,
    diagnostic: {
      waterFeature: "In-ground Pool",
      installationType: "New Build",
      poolSize: "18x36",
      currentTreatment: "Salt Water Chlorine Generator",
      primaryGoal: "Healthier water and less maintenance",
      currentIssues: ["Green tint", "Cloudy water"],
    },
  });

  const resend = new Resend(apiKey);

  console.log("Sending test internal notification...");

  try {
    const response = await resend.emails.send({
      from: fromAddress,
      to: internalEmailTo,
      subject: `Internal: New Booking \u2014 Test (${appointmentId})`,
      html,
      text,
      headers: {
        "Idempotency-Key": `test-internal-${Date.now()}`,
      },
    });

    if (response.error) {
      console.error("");
      console.error("=== ERROR ===");
      console.error(`Message: ${response.error.message}`);
      if (response.error.statusCode) {
        console.error(`Status: ${response.error.statusCode}`);
      }
      process.exit(1);
    }

    console.log("");
    console.log("=== SUCCESS ===");
    console.log(`Message ID: ${response.data?.id}`);
    console.log(`Status: delivered`);
    console.log("");
    console.log("Check the recipient inbox for the test internal notification.");
  } catch (err) {
    console.error("");
    console.error("=== ERROR ===");
    if (err instanceof Error) {
      console.error(`Message: ${err.message}`);
    } else {
      console.error(`Unknown error: ${String(err)}`);
    }
    process.exit(1);
  }
}

function runSelfTest() {
  let passed = 0;
  let failed = 0;

  function assert(condition, label) {
    if (condition) {
      console.log(`  PASS: ${label}`);
      passed++;
    } else {
      console.error(`  FAIL: ${label}`);
      failed++;
    }
  }

  console.log("=== escapeHtml self-test ===\n");

  // XSS vector
  const xss = "<script>alert(1)</script>";
  const xssEscaped = escapeHtml(xss);
  assert(xssEscaped === "&lt;script&gt;alert(1)&lt;/script&gt;", "escapes <script> tags");
  assert(!xssEscaped.includes("<script>"), "no raw <script> in output");

  // Ampersand
  const amp = "Tom & Jerry";
  const ampEscaped = escapeHtml(amp);
  assert(ampEscaped === "Tom &amp; Jerry", "escapes & to &amp;");
  assert(!ampEscaped.includes("& Jerry"), "no raw & in output");

  // Double quotes
  const dq = '"quoted"';
  const dqEscaped = escapeHtml(dq);
  assert(dqEscaped === "&quot;quoted&quot;", "escapes double quotes");
  assert(!dqEscaped.includes('"quoted"'), "no raw double quotes in output");

  // Single quotes
  const sq = "it's a test";
  const sqEscaped = escapeHtml(sq);
  assert(sqEscaped === "it&#039;s a test", "escapes single quote to &#039;");
  assert(!sqEscaped.includes("'s a"), "no raw single quote in output");

  // Combined
  const combined = '<div class="x">Tom &amp; Jerry\'s "place"</div>';
  const combinedEscaped = escapeHtml(combined);
  assert(
    combinedEscaped === "&lt;div class=&quot;x&quot;&gt;Tom &amp;amp; Jerry&#039;s &quot;place&quot;&lt;/div&gt;",
    "escapes all special characters in combined input"
  );

  // No-op for safe strings
  const safe = "Hello World 123";
  assert(escapeHtml(safe) === safe, "leaves safe strings unchanged");

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

async function main() {
  const isInternal = process.argv.includes("--internal");
  const isSelfTest = process.argv.includes("--self-test");

  if (isSelfTest) {
    runSelfTest();
    return;
  }

  if (isInternal) {
    await sendInternalTest();
  } else {
    await sendCustomerTest();
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
