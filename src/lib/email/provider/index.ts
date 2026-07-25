export type { EmailProvider, SendEmailInput, SendEmailResult, ProviderError } from "./types";
export { createFakeEmailProvider } from "./fake-provider";
export { createResendEmailProvider } from "./resend-provider";
export { getEmailProvider, type ProviderResult } from "./provider-factory";