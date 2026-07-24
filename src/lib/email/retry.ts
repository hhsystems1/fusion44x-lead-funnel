import "server-only";
import type { EmailProvider, ProviderError } from "@/lib/email/provider/types";
import { EMAIL_CONFIG } from "@/config/email";
import { prepareBookingConfirmation } from "@/lib/email/notifications";
import { markEmailDeliveryFailed, markEmailDeliveryProcessing } from "@/lib/email/delivery";

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

  const supabase = (await import("@/lib/supabase")).getServerSupabaseClient();
  const { data: delivery, error } = await supabase
    .from("integration_deliveries")
    .select("*")
    .eq("id", params.deliveryId)
    .single();

  if (error || !delivery) {
    return {
      deliveryId: params.deliveryId,
      status: "skipped",
    };
  }

  const row = delivery as Record<string, unknown>;

  if (row.status === "delivered") {
    return {
      deliveryId: params.deliveryId,
      status: "delivered",
    };
  }

  if (row.status !== "failed" && row.status !== "pending") {
    return {
      deliveryId: params.deliveryId,
      status: "skipped",
    };
  }

  const errorMessage = (row.error_message as string | null) ?? "";
  if (errorMessage && isTerminal(errorMessage)) {
    return {
      deliveryId: params.deliveryId,
      status: "failed",
    };
  }

  const attemptCount = (row.attempt_count as number) ?? 0;
  if (attemptCount >= cfg.maxAttempts) {
    return {
      deliveryId: params.deliveryId,
      status: "failed",
    };
  }

  const appointmentId = row.appointment_id as string;
  const prepared = await prepareBookingConfirmation({ appointmentId });

  if (!prepared) {
    return {
      deliveryId: params.deliveryId,
      status: "skipped",
    };
  }

  await markEmailDeliveryProcessing(params.deliveryId);

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

    await supabase
      .from("integration_deliveries")
      .update({
        status: "delivered" as never,
        provider_message_id: result.messageId,
        delivered_at: new Date().toISOString(),
        last_attempt_at: new Date().toISOString(),
      } as never)
      .eq("id", params.deliveryId);

    return {
      deliveryId: params.deliveryId,
      status: "delivered",
      messageId: result.messageId,
    };
  } catch (err) {
    const error = err as { code?: string; message?: string; retryable?: boolean };
    const safeCode = error?.code ?? "PROVIDER_ERROR";

    await markEmailDeliveryFailed({
      deliveryId: params.deliveryId,
      safeErrorCode: safeCode,
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