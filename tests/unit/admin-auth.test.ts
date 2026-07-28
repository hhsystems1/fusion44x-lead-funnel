import { describe, it, expect, beforeEach, vi } from "vitest";

// We test the auth module by importing directly.
// Since it imports "server-only", we mock that import.
vi.mock("server-only", () => ({}));

// We need to set env vars before importing auth
const originalEnv = process.env;

beforeEach(() => {
  process.env = { ...originalEnv };
  process.env.ADMIN_DASHBOARD_USERNAME = "testadmin";
  process.env.ADMIN_DASHBOARD_PASSWORD = "testpassword123";
  process.env.ADMIN_DASHBOARD_SESSION_SECRET = "a-very-secure-session-secret-key-for-testing";
});

// Dynamic import after env is set
async function getAuthModule() {
  vi.resetModules();
  process.env.ADMIN_DASHBOARD_USERNAME = "testadmin";
  process.env.ADMIN_DASHBOARD_PASSWORD = "testpassword123";
  process.env.ADMIN_DASHBOARD_SESSION_SECRET = "a-very-secure-session-secret-key-for-testing";
  return await import("@/lib/admin/auth");
}

describe("Admin Authentication", () => {
  describe("verifyCredentials", () => {
    it("accepts correct credentials", async () => {
      const { verifyCredentials } = await getAuthModule();
      expect(verifyCredentials("testadmin", "testpassword123")).toBe(true);
    });

    it("rejects wrong username", async () => {
      const { verifyCredentials } = await getAuthModule();
      expect(verifyCredentials("wronguser", "testpassword123")).toBe(false);
    });

    it("rejects wrong password", async () => {
      const { verifyCredentials } = await getAuthModule();
      expect(verifyCredentials("testadmin", "wrongpassword")).toBe(false);
    });

    it("rejects empty credentials", async () => {
      const { verifyCredentials } = await getAuthModule();
      expect(verifyCredentials("", "")).toBe(false);
    });
  });

  describe("createSessionToken / verifySessionToken", () => {
    it("creates and verifies a valid token", async () => {
      const { createSessionToken, verifySessionToken } = await getAuthModule();
      const token = createSessionToken("testadmin");
      expect(typeof token).toBe("string");
      expect(verifySessionToken(token)).toBe(true);
    });

    it("rejects tampered token", async () => {
      const { createSessionToken, verifySessionToken } = await getAuthModule();
      const token = createSessionToken("testadmin");
      const parts = token.split(".");
      const tampered = parts[0] + ".tampered_signature";
      expect(verifySessionToken(tampered)).toBe(false);
    });

    it("rejects empty token", async () => {
      const { verifySessionToken } = await getAuthModule();
      expect(verifySessionToken("")).toBe(false);
    });

    it("rejects malformed token", async () => {
      const { verifySessionToken } = await getAuthModule();
      expect(verifySessionToken("not-a-token")).toBe(false);
    });

    it("rejects token with wrong secret", async () => {
      const { createSessionToken, verifySessionToken } = await getAuthModule();
      // Manually create a token using a different secret
      const nodeCrypto = await import("node:crypto");
      const payload = JSON.stringify({ u: "admin", iat: Date.now(), exp: Date.now() + 3600000 });
      const data = Buffer.from(payload).toString("base64url");
      const wrongSig = nodeCrypto.createHmac("sha256", "wrong-secret").update(data).digest("base64url");
      const wrongToken = `${data}.${wrongSig}`;
      
      expect(verifySessionToken(wrongToken)).toBe(false);
      
      // Valid token should still work
      const validToken = createSessionToken("testadmin");
      expect(verifySessionToken(validToken)).toBe(true);
    });
  });

  describe("rate limiting", () => {
    it("allows up to 5 attempts", async () => {
      const { checkLoginRateLimit, resetLoginRateLimit } = await getAuthModule();
      resetLoginRateLimit("test-ip");
      
      for (let i = 0; i < 5; i++) {
        const result = checkLoginRateLimit("test-ip");
        expect(result.allowed).toBe(true);
      }
      const sixth = checkLoginRateLimit("test-ip");
      expect(sixth.allowed).toBe(false);
      resetLoginRateLimit("test-ip");
    });

    it("resets rate limit on successful login", async () => {
      const { checkLoginRateLimit, resetLoginRateLimit } = await getAuthModule();
      resetLoginRateLimit("test-ip-2");
      
      // Make some attempts
      checkLoginRateLimit("test-ip-2");
      checkLoginRateLimit("test-ip-2");
      
      // Reset
      resetLoginRateLimit("test-ip-2");
      
      // Should allow again
      const result = checkLoginRateLimit("test-ip-2");
      expect(result.allowed).toBe(true);
    });

    it("tracks remaining attempts", async () => {
      const { checkLoginRateLimit, resetLoginRateLimit } = await getAuthModule();
      resetLoginRateLimit("test-ip-3");
      
      const r1 = checkLoginRateLimit("test-ip-3");
      expect(r1.remaining).toBe(4);
      
      const r2 = checkLoginRateLimit("test-ip-3");
      expect(r2.remaining).toBe(3);
      resetLoginRateLimit("test-ip-3");
    });
  });

  describe("getAdminSessionConfig", () => {
    it("returns correct config", async () => {
      const { getAdminSessionConfig } = await getAuthModule();
      const config = getAdminSessionConfig();
      expect(config.cookieName).toBe("admin_session");
      expect(config.maxAgeMs).toBe(24 * 60 * 60 * 1000);
    });
  });
});
