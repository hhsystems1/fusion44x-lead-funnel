import { z } from "zod";

// =============================================================================
// Public environment variables — browser-safe (NEXT_PUBLIC_*)
// =============================================================================

const publicEnvSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_SUPABASE_URL: z.string().default(""),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().default(""),
  NEXT_PUBLIC_META_PIXEL_ID: z.string().optional(),
});

function parsePublicEnv(): z.infer<typeof publicEnvSchema> {
  const result = publicEnvSchema.safeParse({
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_META_PIXEL_ID: process.env.NEXT_PUBLIC_META_PIXEL_ID,
  });

  if (!result.success) {
    if (typeof window === "undefined") {
      for (const issue of result.error.issues) {
        console.warn("[env] %s: %s", issue.path.join("."), issue.message);
      }
    }
    return {
      NEXT_PUBLIC_SITE_URL:
        process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
      NEXT_PUBLIC_SUPABASE_ANON_KEY:
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
      NEXT_PUBLIC_META_PIXEL_ID: process.env.NEXT_PUBLIC_META_PIXEL_ID,
    };
  }

  return result.data;
}

export const publicEnv = parsePublicEnv();

// =============================================================================
// Server-only environment validation — per-integration
// =============================================================================

function requireVar(key: string, hint: string): string {
  const value = process.env[key];
  if (!value || value.trim() === "") {
    throw new Error(
      `[env] ${key} is not set.\n` +
        `  Required when: ${hint}\n` +
        `  Set in: .env.local (local), Vercel env vars (production)\n` +
        `  Reference: .env.example`,
    );
  }
  return value;
}

export interface SupabaseServerEnv {
  url: string;
  serviceRoleKey: string;
}

export interface MetaCapiEnv {
  accessToken: string;
}

export interface GoogleCalendarEnv {
  calendarId: string;
  serviceAccountEmail: string;
  serviceAccountPrivateKey: string;
}

export interface EmailEnv {
  apiKey: string;
  fromAddress: string;
}

export function requireSupabaseServerEnv(): SupabaseServerEnv {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    requireVar(
      "NEXT_PUBLIC_SUPABASE_URL",
      "using Supabase server client (getServerClient)",
    );
  return {
    url,
    serviceRoleKey: requireVar(
      "SUPABASE_SERVICE_ROLE_KEY",
      "using Supabase server client (getServerClient)",
    ),
  };
}

export function requireMetaCapiEnv(): MetaCapiEnv {
  return {
    accessToken: requireVar(
      "META_CAPI_ACCESS_TOKEN",
      "sending Meta Conversions API events",
    ),
  };
}

export function requireGoogleCalendarEnv(): GoogleCalendarEnv {
  return {
    calendarId: requireVar(
      "GOOGLE_CALENDAR_ID",
      "using Google Calendar booking provider",
    ),
    serviceAccountEmail: requireVar(
      "GOOGLE_SERVICE_ACCOUNT_EMAIL",
      "using Google Calendar booking provider",
    ),
    serviceAccountPrivateKey: requireVar(
      "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY",
      "using Google Calendar booking provider",
    ),
  };
}

export function requireEmailEnv(): EmailEnv {
  return {
    apiKey: requireVar(
      "EMAIL_API_KEY",
      "sending email notifications",
    ),
    fromAddress: requireVar(
      "EMAIL_FROM",
      "sending email notifications",
    ),
  };
}

export function getBookingTimezone(): string {
  return process.env.BOOKING_TIMEZONE || "America/New_York";
}

// =============================================================================
// Admin Dashboard Authentication
// =============================================================================

export interface AdminAuthEnv {
  username: string;
  password: string;
  sessionSecret: string;
}

export function requireAdminAuthEnv(): AdminAuthEnv {
  return {
    username: requireVar(
      "ADMIN_DASHBOARD_USERNAME",
      "accessing the admin dashboard",
    ),
    password: requireVar(
      "ADMIN_DASHBOARD_PASSWORD",
      "accessing the admin dashboard",
    ),
    sessionSecret: requireVar(
      "ADMIN_DASHBOARD_SESSION_SECRET",
      "securing admin dashboard sessions (generate a random 32+ char string)",
    ),
  };
}
