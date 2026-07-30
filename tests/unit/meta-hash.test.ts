import { describe, it, expect } from "vitest";
import { hashEmail, hashPhone, hashName, hashZipCode } from "@/lib/meta/hash";
import { createHash } from "node:crypto";

function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

describe("hashEmail", () => {
  it("lowercases and trims before hashing", () => {
    expect(hashEmail("Test@Example.COM ")).toBe(sha256("test@example.com"));
  });

  it("produces same result for already-normalized email", () => {
    expect(hashEmail("test@example.com")).toBe(sha256("test@example.com"));
  });

  it("handles empty string", () => {
    expect(hashEmail("")).toBe(sha256(""));
  });

  it("is deterministic", () => {
    const result = hashEmail("User@Domain.com");
    expect(result).toBe(hashEmail("  USER@domain.COM  "));
  });
});

describe("hashPhone", () => {
  it("strips all non-digit characters", () => {
    expect(hashPhone("(212) 555-0100")).toBe(sha256("2125550100"));
  });

  it("preserves leading country code digits", () => {
    expect(hashPhone("+1 (212) 555-0100")).toBe(sha256("12125550100"));
  });

  it("handles digits-only input", () => {
    expect(hashPhone("12125550100")).toBe(sha256("12125550100"));
  });

  it("handles dots and spaces", () => {
    expect(hashPhone("212.555.0100")).toBe(sha256("2125550100"));
  });

  it("handles empty string", () => {
    expect(hashPhone("")).toBe(sha256(""));
  });
});

describe("hashName", () => {
  it("lowercases and trims before hashing", () => {
    expect(hashName(" JOHN ")).toBe(sha256("john"));
  });

  it("handles mixed case", () => {
    expect(hashName("John")).toBe(sha256("john"));
  });

  it("handles empty string", () => {
    expect(hashName("")).toBe(sha256(""));
  });
});

describe("hashZipCode", () => {
  it("lowercases and trims before hashing", () => {
    expect(hashZipCode(" 10001 ")).toBe(sha256("10001"));
  });

  it("handles ZIP+4 format", () => {
    expect(hashZipCode("10001-1234")).toBe(sha256("10001-1234"));
  });

  it("handles empty string", () => {
    expect(hashZipCode("")).toBe(sha256(""));
  });
});
