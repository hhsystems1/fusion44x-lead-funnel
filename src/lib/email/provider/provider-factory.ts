import "server-only";
import type { EmailProvider } from "./types";
import { createResendEmailProvider } from "./resend-provider";

export type ProviderResult =
  | { provider: EmailProvider; name: string }
  | { provider: null; name: null };

export function getEmailProvider(): ProviderResult {
  const providerName = process.env.EMAIL_PROVIDER?.trim().toLowerCase();

  if (!providerName) {
    return { provider: null, name: null };
  }

  if (providerName === "resend") {
    return { provider: createResendEmailProvider(), name: "resend" };
  }

  throw new Error(
    `[email] Unknown EMAIL_PROVIDER "${providerName}". ` +
    `Supported values: "resend"`,
  );
}