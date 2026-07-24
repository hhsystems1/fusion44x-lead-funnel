import { describe, it, expect, beforeAll } from "vitest";
import fs from "fs";

const MIGRATION_PATH =
  "supabase/migrations/20260725000100_internal_booking_notification_delivery.sql";
const EXISTING_INDEX_PATH =
  "supabase/migrations/20260724000500_email_notification_delivery_columns.sql";

describe("internal booking notification migration", () => {
  let sql: string;

  beforeAll(() => {
    sql = fs.readFileSync(MIGRATION_PATH, "utf-8");
  });

  it("migration file exists", () => {
    expect(fs.existsSync(MIGRATION_PATH)).toBe(true);
  });

  it("does not modify the 00500 migration", () => {
    const existing = fs.readFileSync(EXISTING_INDEX_PATH, "utf-8");
    expect(existing).toContain("booking_confirmation");
    expect(existing).toContain("idx_integration_deliveries_email_booking_unique");
  });

  it("accepts internal_booking_notification event type", () => {
    expect(sql).toContain("internal_booking_notification");
  });

  it("preserves booking_confirmation event type", () => {
    expect(sql).toContain("booking_confirmation");
  });

  it("creates the unique partial index for internal deliveries", () => {
    expect(sql).toContain("idx_integration_deliveries_internal_booking_unique");
    expect(sql).toContain("where destination = 'email' and event_type = 'internal_booking_notification'");
  });

  it("does not duplicate or change the return type of existing RPC functions", () => {
    expect(sql).not.toContain("create or replace function");
    expect(sql).not.toContain("returns setof");
    expect(sql).not.toContain("grant execute");
  });

  it("preserves service-role-only execution permissions", () => {
    expect(sql).not.toContain("grant");
    expect(sql).not.toContain("revoke");
  });

  it("does not modify the existing customer unique index", () => {
    const existing = fs.readFileSync(EXISTING_INDEX_PATH, "utf-8");
    expect(existing).toContain("idx_integration_deliveries_email_booking_unique");
  });

  it("uses IF NOT EXISTS for the new index", () => {
    expect(sql).toContain("create unique index if not exists idx_integration_deliveries_internal_booking_unique");
  });

  it("scopes the internal index to destination = 'email'", () => {
    expect(sql).toContain("destination = 'email'");
  });

  it("safely handles event_type check constraint creation", () => {
    expect(sql).toContain("integration_deliveries_event_type_check");
    expect(sql).toContain("do $$");
  });

  it("verifies both event types are accepted after constraint creation", () => {
    expect(sql).toContain("booking_confirmation must be allowed");
    expect(sql).toContain("internal_booking_notification must be allowed");
  });
});

describe("internal and customer unique indexes are independent", () => {
  it("existing customer index is unchanged", () => {
    const existing = fs.readFileSync(EXISTING_INDEX_PATH, "utf-8");
    expect(existing).toContain(
      "where destination = 'email' and event_type = 'booking_confirmation'",
    );
  });

  it("new internal index is scoped differently", () => {
    const sql = fs.readFileSync(MIGRATION_PATH, "utf-8");
    expect(sql).toContain(
      "where destination = 'email' and event_type = 'internal_booking_notification'",
    );
  });

  it("indexes have different names", () => {
    const existing = fs.readFileSync(EXISTING_INDEX_PATH, "utf-8");
    const internal = fs.readFileSync(MIGRATION_PATH, "utf-8");
    expect(existing).toContain("idx_integration_deliveries_email_booking_unique");
    expect(internal).toContain("idx_integration_deliveries_internal_booking_unique");
  });
});

describe("migration ordering", () => {
  it("new migration sorts after 00500 in file system", () => {
    const files = fs
      .readdirSync("supabase/migrations")
      .filter((f: string) => f.endsWith(".sql"))
      .sort();
    const idx00500 = files.indexOf(
      "20260724000500_email_notification_delivery_columns.sql",
    );
    const idxInternal = files.indexOf(
      "20260725000100_internal_booking_notification_delivery.sql",
    );
    expect(idx00500).toBeGreaterThanOrEqual(0);
    expect(idxInternal).toBeGreaterThan(idx00500);
  });
});
