import "server-only";
import type { EmailProvider, ProviderError } from "@/lib/email/provider/types";
import { EMAIL_CONFIG } from "@/config/email";
import { prepareBookingConfirmation } from "@/lib/email/notifications";
import { findEmailDeliveryById, claimEmailDelivery, markEmailDeliveryDelivered, markEmailDeliveryFailed } from "@/lib/email/delivery";

export interface RetryConfig {
  maxAttempts: number;
  baseBackoffMs: number;
  maxBackoffMs: number;
}

export const EMAIL_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 5,
  baseBackoffMs: 60_000,
  maxBackoffMs: 3_600_000,
};

export const RETRYABLE_CODES: readonly string[] = [
  "PROVIDER_UNAVAILABLE",
  "RATE_LIMITED",
  "TIMEOUT",
  "NETWORK_ERROR",
  "PROVIDER_ERROR",
] as const;

export const TERMINAL_CODES: readonly string[] = [
  "INVALID_RECIPIENT",
  "INVALID_TEMPLATE",
  "PROVIDER_REJECTED",
  "INVALID_CONFIG",
] as const;

export function isRetryable(code: string): boolean {
  return RETRYABLE_CODES.includes(code as typeof RETRYABLE_CODES[number]);
}

export function isTerminal(code: string): boolean {
  return TERMINAL_CODES.includes(code as typeof TERMINAL_CODES[number]);
}

export function getBackoffMs(attempt: number, config?: Partial<RetryConfig>): number {
  const cfg = { ...EMAIL_RETRY_CONFIG, ...config };
  const delay = cfg.baseBackoffMs * Math.pow(2, attempt - 1);
  return Math.min(delay, cfg.maxBackoffMs);
}

export function getNextAttemptTimestamp(attempt: number, config?: Partial<RetryConfig>): string {
  const delayMs = getBackoffMs(attempt, config);
  return new Date(Date.now() + delayMs).toISOString();
}

export interface RetryResult {
  deliveryId: string;
  status: "delivered" | "failed" | "skipped";
  messageId?: string;
  error?: ProviderError;
}

export async function retryFailedEmailDelivery(params: {
  deliveryId: string;
  provider: EmailProvider;
  config?: Partial<RetryConfig>;
}): Promise<RetryResult> {
  const cfg = { ...EMAIL_RETRY_CONFIG, ...params.config };

  // Load the exact delivery by ID
  const delivery = await findEmailDeliveryById(params.deliveryId);
  if (!delivery) {
    return {
      deliveryId: params.deliveryId,
      status: "skipped",
    };
  }

  // Already delivered - idempotent success
  if (delivery.status === "delivered") {
    return {
      deliveryId: params.deliveryId,
      status: "delivered",
    };
  }

  // Terminal states - skip
  if (delivery.status === "dead_letter") {
    return {
      deliveryId: params.deliveryId,
      status: "skipped",
    };
  }

  // Currently processing - skip to avoid concurrent send
  if (delivery.status === "processing") {
    return {
      deliveryId: params.deliveryId,
      status: "skipped",
    };
  }

  // Max attempts reached - skip
  if (delivery.attempt_count >= cfg.maxAttempts) {
    return {
      deliveryId: params.deliveryId,
      status: "skipped",
    };
  }

  // Not yet due for retry
  if (delivery.next_attempt_at && new Date(delivery.next_attempt_at) > new Date()) {
    return {
      deliveryId: params.deliveryId,
      status: "skipped",
    };
  }

  // Terminal error code recorded - skip
  if (delivery.error_message && isTerminal(delivery.error_message)) {
    return {
      deliveryId: params.deliveryId,
      status: "skipped",
    };
  }

  // Must be pending or failed to retry
  if (delivery.status !== "pending" && delivery.status !== "failed") {
    return {
      deliveryId: params.deliveryId,
      status: "skipped",
    };
  }

  // Try to atomically claim for retry
  const claim = await claimEmailDelivery(params.deliveryId, cfg.maxAttempts);
  if (!claim.claimed || !claim.delivery) {
    // Could not claim - another process got it, or not eligible
    return {
      deliveryId: params.deliveryId,
      status: "skipped",
    };
  }

  const appointmentId = claim.delivery.appointment_id;
  const prepared = await prepareBookingConfirmation({ appointmentId });

  // Appointment no longer confirmed or preparation failed
  if (!prepared) {
    await markEmailDeliveryFailed({
      deliveryId: params.deliveryId,
      safeErrorCode: "APPOINTMENT_NOT_CONFIRMED",
      retryable: false,
    });
    return {
      deliveryId: params.deliveryId,
      status: "failed",
      error: { code: "APPOINTMENT_NOT_CONFIRMED", message: "Appointment no longer confirmed", retryable: false },
    };
  }

  // Validate recipient
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(prepared.recipientEmail)) {
    await markEmailDeliveryFailed({
      deliveryId: params.deliveryId,
      safeErrorCode: "INVALID_RECIPIENT",
      retryable: false,
    });
    return {
      deliveryId: params.deliveryId,
      status: "failed",
      error: { code: "INVALID_RECIPIENT", message: "Invalid recipient email", retryable: false },
    };
  }

  try {
    const result = await params.provider.sendBookingConfirmation({
      recipientEmail: prepared.recipientEmail,
      recipientFirstName: prepared.recipientFirstName,
      appointmentId: prepared.appointmentId,
      confirmedStartTime: prepared.confirmedStartTime,
      confirmedEndTime: prepared.confirmedEndTime,
      timezone: prepared.timezone,
      googleCalendarLink: "",
      outlookCalendarLink: "",
      icsContent: "",
      replyTo: EMAIL_CONFIG.REPLY_TO_PLACEHOLDER,
    });

    await markEmailDeliveryDelivered({
      deliveryId: params.deliveryId,
      providerMessageId: result.messageId,
    });

    return {
      deliveryId: params.deliveryId,
      status: "delivered",
      messageId: result.messageId,
    };
  } catch (err) {
    const error = err as { code?: string; message?: string; retryable?: boolean };
    const safeCode = error?.code ?? "PROVIDER_ERROR";
    const retryable = error?.retryable !== false;

    await markEmailDeliveryFailed({
      deliveryId: params.deliveryId,
      safeErrorCode: safeCode,
      retryable,
    });

    return {
      deliveryId: params.deliveryId,
      status: "failed",
      error: {
        code: safeCode,
        message: error?.message ?? "Email provider error",
        retryable: isRetryable(safeCode),
      },
    };
  }
}