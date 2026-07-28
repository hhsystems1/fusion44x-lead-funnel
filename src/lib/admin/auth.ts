import "server-only";

import crypto from "node:crypto";
import { requireAdminAuthEnv } from "@/lib/env";

const SESSION_COOKIE = "admin_session";
const SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

// In-memory rate limiter for failed login attempts
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

export function getAdminSessionConfig() {
  return {
    cookieName: SESSION_COOKIE,
    maxAgeMs: SESSION_MAX_AGE_MS,
  };
}

export function verifyCredentials(
  username: string,
  password: string,
): boolean {
  const env = requireAdminAuthEnv();

  // Use constant-time comparison via HMAC to prevent timing attacks
  function safeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    const hmacA = crypto
      .createHmac("sha256", "compare")
      .update(a)
      .digest();
    const hmacB = crypto
      .createHmac("sha256", "compare")
      .update(b)
      .digest();
    return crypto.timingSafeEqual(hmacA, hmacB);
  }

  return safeEqual(username, env.username) && safeEqual(password, env.password);
}

export function createSessionToken(username: string): string {
  const env = requireAdminAuthEnv();
  const payload = JSON.stringify({
    u: username,
    iat: Date.now(),
    exp: Date.now() + SESSION_MAX_AGE_MS,
  });
  const data = Buffer.from(payload).toString("base64url");
  const signature = crypto
    .createHmac("sha256", env.sessionSecret)
    .update(data)
    .digest("base64url");
  return `${data}.${signature}`;
}

export function verifySessionToken(token: string): boolean {
  try {
    const env = requireAdminAuthEnv();
    const [data, signature] = token.split(".");
    if (!data || !signature) return false;

    const expectedSig = crypto
      .createHmac("sha256", env.sessionSecret)
      .update(data)
      .digest("base64url");

    if (
      !crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSig),
      )
    ) {
      return false;
    }

    const payload = JSON.parse(Buffer.from(data, "base64url").toString());
    if (typeof payload.exp !== "number" || Date.now() > payload.exp) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

export function checkLoginRateLimit(
  ip: string,
): { allowed: boolean; remaining: number } {
  const now = Date.now();
  let entry = loginAttempts.get(ip);

  if (!entry || now >= entry.resetAt) {
    entry = { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
    loginAttempts.set(ip, entry);
  }

  entry.count++;
  const remaining = Math.max(0, RATE_LIMIT_MAX - entry.count);

  return { allowed: entry.count <= RATE_LIMIT_MAX, remaining };
}

export function resetLoginRateLimit(ip: string): void {
  loginAttempts.delete(ip);
}
