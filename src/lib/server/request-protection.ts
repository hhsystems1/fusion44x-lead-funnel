import { NextRequest } from "next/server";
import crypto from "node:crypto";

const MAX_BODY_BYTES = 50_000;

export async function readJsonBody(
  request: NextRequest,
): Promise<unknown> {
  const text = await request.text();

  if (text.length > MAX_BODY_BYTES) {
    throw new BodyTooLargeError(
      `Request body exceeds ${MAX_BODY_BYTES.toLocaleString()} bytes`,
    );
  }

  if (text.length === 0) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new JsonParseError("Request body is not valid JSON");
  }
}

export class BodyTooLargeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BodyTooLargeError";
  }
}

export class JsonParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "JsonParseError";
  }
}

export function extractClientIp(request: NextRequest): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const ip = forwarded.split(",")[0].trim();
    if (ip) return ip;
  }

  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp;

  return null;
}

export function generateRequestId(): string {
  return crypto.randomUUID();
}

export interface RateLimiterConfig {
  maxRequests: number;
  windowMs: number;
}

const ipMap = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(
  ip: string | null,
  config: RateLimiterConfig,
): { allowed: boolean; remaining: number; resetAt: number } {
  const key = ip ?? "unknown";
  const now = Date.now();
  let entry = ipMap.get(key);

  if (!entry || now >= entry.resetAt) {
    entry = { count: 0, resetAt: now + config.windowMs };
    ipMap.set(key, entry);
  }

  entry.count++;
  const remaining = Math.max(0, config.maxRequests - entry.count);

  if (entry.count > config.maxRequests) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  return { allowed: true, remaining, resetAt: entry.resetAt };
}

export function getRateRemaining(
  ip: string | null,
  config: RateLimiterConfig,
): number {
  const key = ip ?? "unknown";
  const now = Date.now();
  const entry = ipMap.get(key);

  if (!entry || now >= entry.resetAt) return config.maxRequests;

  return Math.max(0, config.maxRequests - entry.count);
}

export function createPublicError(status: number, message: string) {
  return { error: { status, message } };
}
