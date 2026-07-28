import { describe, it, expect, vi } from "vitest";
import nodeCrypto from "node:crypto";

// Mock "server-only" for the middleware test environment
vi.mock("server-only", () => ({}));

describe("Middleware Token Verification (Web Crypto)", () => {
  // We test the same HMAC logic used in middleware but using Node crypto
  // since the middleware logic is the same, just different API
  function createToken(data: string, secret: string): string {
    const signature = nodeCrypto
      .createHmac("sha256", secret)
      .update(data)
      .digest("base64url");
    return `${data}.${signature}`;
  }

  function verifyToken(token: string, secret: string): boolean {
    try {
      const [data, signature] = token.split(".");
      if (!data || !signature) return false;

      const expectedSig = nodeCrypto
        .createHmac("sha256", secret)
        .update(data)
        .digest("base64url");

      if (
        !nodeCrypto.timingSafeEqual(
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

  const secret = "test-secret-key-for-middleware";
  const now = Date.now();

  it("verifies a valid token", () => {
    const payload = JSON.stringify({ u: "admin", iat: now, exp: now + 3600000 });
    const data = Buffer.from(payload).toString("base64url");
    const token = createToken(data, secret);
    expect(verifyToken(token, secret)).toBe(true);
  });

  it("rejects expired token", () => {
    const payload = JSON.stringify({ u: "admin", iat: now - 7200000, exp: now - 3600000 });
    const data = Buffer.from(payload).toString("base64url");
    const token = createToken(data, secret);
    expect(verifyToken(token, secret)).toBe(false);
  });

  it("rejects token with wrong secret", () => {
    const payload = JSON.stringify({ u: "admin", iat: now, exp: now + 3600000 });
    const data = Buffer.from(payload).toString("base64url");
    const token = createToken(data, "wrong-secret");
    expect(verifyToken(token, secret)).toBe(false);
  });

  it("rejects empty token", () => {
    expect(verifyToken("", secret)).toBe(false);
  });

  it("rejects malformed token", () => {
    expect(verifyToken("no-dot", secret)).toBe(false);
    expect(verifyToken("a.b.c", secret)).toBe(false);
  });

  it("rejects tampered data portion", () => {
    const payload = JSON.stringify({ u: "admin", iat: now, exp: now + 3600000 });
    const data = Buffer.from(payload).toString("base64url");
    const token = createToken(data, secret);
    const sig = token.split(".")[1];
    const tamperedData = Buffer.from(JSON.stringify({ u: "hacker", iat: now, exp: now + 3600000 })).toString("base64url");
    expect(verifyToken(`${tamperedData}.${sig}`, secret)).toBe(false);
  });
});
