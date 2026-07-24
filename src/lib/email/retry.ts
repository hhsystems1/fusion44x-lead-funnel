import "server-only";
import type { EmailProvider, ProviderError } from "@/lib/email/provider/types";
import { EMAIL_CONFIG } from "@/config/email";
import { prepareBookingConfirmation } from "@/lib/email/notifications";
import { markEmailDeliveryFailed, markEmailDeliveryDelivered, claimEmailDelivery, findEmailDelivery } from "@/lib/email/delivery";

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

  const delivery = await findEmailDelivery("", "");
  if (!delivery) {
    return {
      deliveryId: params.deliveryId,
      status: "skipped",
    };
  }

  // Try to claim the delivery for retry
  const claim = await claimEmailDelivery(params.deliveryId, cfg.maxAttempts);
  if (!claim.claimed) {
    // Not eligible for retry (delivered, dead_letter, max attempts, not due)
    return {
      deliveryId: params.deliveryId,
      status: "skipped",
    };
  }

  const appointmentId = claim.delivery?.appointment_id;
  if (!appointmentId) {
    return {
      deliveryId: params.deliveryId,
      status: "skipped",
    };
  }

  const prepared = await prepareBookingConfirmation({ appointmentId });

  if (!prepared) {
    return {
      deliveryId: params.deliveryId,
      status: "skipped",
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