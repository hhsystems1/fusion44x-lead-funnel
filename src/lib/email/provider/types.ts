import "server-only";

export interface SendEmailInput {
  recipientEmail: string;
  recipientFirstName: string;
  appointmentId: string;
  deliveryId: string;
  confirmedStartTime: string;
  confirmedEndTime: string;
  timezone: string;
  googleCalendarLink: string;
  outlookCalendarLink: string;
  icsContent: string;
  html: string;
  text: string;
  replyTo?: string;
}

export interface SendEmailResult {
  messageId: string;
  status: "delivered";
}

export interface ProviderError {
  code: string;
  message: string;
  retryable: boolean;
}

export interface EmailProvider {
  readonly name: string;
  sendBookingConfirmation(input: SendEmailInput): Promise<SendEmailResult>;
  sendInternalBookingNotification(input: SendEmailInput): Promise<SendEmailResult>;
}