import { createHash } from "node:crypto";

function normalizeAndHash(value: string): string {
  return createHash("sha256")
    .update(value.trim().toLowerCase())
    .digest("hex");
}

export function hashEmail(email: string): string {
  return normalizeAndHash(email);
}

export function hashPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return createHash("sha256")
    .update(digits)
    .digest("hex");
}

export function hashName(name: string): string {
  return normalizeAndHash(name);
}

export function hashZipCode(zip: string): string {
  return normalizeAndHash(zip);
}
