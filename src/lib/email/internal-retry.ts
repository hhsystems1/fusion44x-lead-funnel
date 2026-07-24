import "server-only";
import type { EmailProvider, ProviderError } from "@/lib/email/provider/types";
import { prepareInternalBookingNotification } from "@/lib/email/internal-notifications";
import { findInternalEmailDeliveryById, claimInternalEmailDelivery, markInternalEmailDeliveryDelivered, markInternalEmailDeliveryFailed } from "@/lib/email/internal-delivery";
import { buildInternalBookingNotificationSendInput } from "@/lib/email/internal-send-input";

export interface RetryConfig {
  maxAttempts: number;
  baseBackoffMs: number;
  maxBackoffMs: number;
}

const INTERNAL_EMAIL_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 5,
  baseBackoffMs: 60_000,
  maxBackoffMs: 3_600_000,
};

export interface RetryResult {
  deliveryId: string;
  status: "delivered" | "failed" | "skipped";
  messageId?: string;
  error?: ProviderError;
}

export async function retryFailedInternalEmailDelivery(params: {
  deliveryId: string;
  provider: EmailProvider;
  config?: Partial<RetryConfig>;
}): Promise<RetryResult> {
  const cfg = { ...INTERNAL_EMAIL_RETRY_CONFIG, ...params.config };

  // Load the exact delivery by ID
  const delivery = await findInternalEmailDeliveryById(params.deliveryId);
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
  if (delivery.error_message && (delivery.error_message === "INVALID_RECIPIENT" || delivery.error_message === "INVALID_TEMPLATE" || delivery.error_message === "PROVIDER_REJECTED" || delivery.error_message === "INVALID_CONFIG")) {
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
  const claim = await claimInternalEmailDelivery(params.deliveryId, cfg.maxAttempts);
  if (!claim.claimed || !claim.delivery) {
    // Could not claim - another process got it, or not eligible
    return {
      deliveryId: params.deliveryId,
      status: "skipped",
    };
  }

  const appointmentId = claim.delivery.appointment_id;
  const prepared = await prepareInternalBookingNotification({ appointmentId });

  // Appointment no longer confirmed or preparation failed
  if (!prepared) {
    await markInternalEmailDeliveryFailed({
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
    await markInternalEmailDeliveryFailed({
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
    const sendInput = buildInternalBookingNotificationSendInput(prepared, params.deliveryId);
    const result = await params.provider.sendInternalBookingNotification(sendInput);

    await markInternalEmailDeliveryDelivered({
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

    await markInternalEmailDeliveryFailed({
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
        retryable,
      },
    };
  }
}