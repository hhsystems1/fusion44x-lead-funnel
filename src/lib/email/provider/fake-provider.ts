import "server-only";
import crypto from "node:crypto";
import type { EmailProvider, SendEmailInput, SendEmailResult } from "./types";

export function createFakeEmailProvider(): EmailProvider {
  return {
    name: "fake",
    async sendBookingConfirmation(
      _input: SendEmailInput,
    ): Promise<SendEmailResult> {
      void _input;
      return { messageId: `fake-${crypto.randomUUID()}`, status: "delivered" };
    },
    async sendInternalBookingNotification(
      _input: SendEmailInput,
    ): Promise<SendEmailResult> {
      void _input;
      return { messageId: `fake-${crypto.randomUUID()}`, status: "delivered" };
    },
  };
}