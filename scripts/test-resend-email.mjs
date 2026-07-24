#!/usr/bin/env node
/**
 * Manual test script for Resend email provider.
 *
 * Usage:
 *   node --env-file=.env.local scripts/test-resend-email.mjs
 *
 * Requirements:
 *   - TEST_EMAIL_TO environment variable must be set (recipient email)
 *   - EMAIL_PROVIDER=resend must be set
 *   - EMAIL_API_KEY must be set (Resend API key)
 *   - EMAIL_FROM must be set (verified sender)
 *   - EMAIL_REPLY_TO optional (reply-to address)
 *
 * This script sends ONE test booking confirmation email.
 * It does NOT read from or modify production appointment records.
 */

import { createResendEmailProvider } from "../src/lib/email/provider/resend-provider.js";
import { renderBookingConfirmationHtml, renderBookingConfirmationText } from "../src/lib/email/templates/booking-confirmation.js";
import { generateGoogleCalendarUrl, generateOutlookWebUrl, generateIcsContent } from "../src/lib/booking/calendar-links.js";
import { EMAIL_CONFIG } from "../src/config/email.js";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value.trim();
}

async function main() {
  // Require test email recipient
  const testEmailTo = requireEnv("TEST_EMAIL_TO");

  // Check provider is configured
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

  console.log("=== Resend Test Email ===");
  console.log(`Provider: resend`);
  console.log(`From: ${fromAddress}`);
  console.log(`Reply-To: ${replyTo || "(not set)"}`);
  console.log(`To: ${testEmailTo}`);
  console.log("");

  // Build test appointment data
  const startTime = new Date();
  startTime.setHours(startTime.getHours() + 2); // 2 hours from now
  startTime.setMinutes(0, 0, 0);

  const endTime = new Date(startTime);
  endTime.setMinutes(endTime.getMinutes() + 30); // 30 min duration

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

  // Create provider
  const provider = createResendEmailProvider();

  // Prepare input
  const input = {
    recipientEmail: testEmailTo,
    recipientFirstName: "Test",
    appointmentId: "test-appt-" + Date.now(),
    deliveryId: "test-delivery-" + Date.now(),
    confirmedStartTime,
    confirmedEndTime,
    timezone,
    googleCalendarLink,
    outlookCalendarLink,
    icsContent,
    html,
    text,
    replyTo,
  };

  console.log("Sending test email...");

  try {
    const result = await provider.sendBookingConfirmation(input);
    console.log("");
    console.log("=== SUCCESS ===");
    console.log(`Message ID: ${result.messageId}`);
    console.log(`Status: ${result.status}`);
    console.log("");
    console.log("Check the recipient inbox for the test confirmation email.");
  } catch (err) {
    console.error("");
    console.error("=== ERROR ===");
    if (err && typeof err === "object" && "code" in err) {
      console.error(`Code: ${err.code}`);
      console.error(`Retryable: ${err.retryable}`);
      console.error(`Message: ${err.message}`);
    } else if (err instanceof Error) {
      console.error(`Message: ${err.message}`);
    } else {
      console.error(`Unknown error: ${String(err)}`);
    }
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});