import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("Dashboard Migration", () => {
  const migrationPath = path.join(
    process.cwd(),
    "supabase/migrations/20260728000100_dashboard_indexes_and_browser.sql",
  );

  it("migration file exists", () => {
    expect(fs.existsSync(migrationPath)).toBe(true);
  });

  it("migration is wrapped in BEGIN/COMMIT", () => {
    const sql = fs.readFileSync(migrationPath, "utf-8");
    expect(sql).toContain("BEGIN");
    expect(sql).toContain("COMMIT");
  });

  it("adds browser column to funnel_sessions", () => {
    const sql = fs.readFileSync(migrationPath, "utf-8");
    expect(sql).toContain("ALTER TABLE public.funnel_sessions");
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS browser text");
  });

  it("creates dashboard-optimized indexes", () => {
    const sql = fs.readFileSync(migrationPath, "utf-8");
    expect(sql).toContain("idx_funnel_sessions_started_at");
    expect(sql).toContain("idx_funnel_sessions_anonymous_id");
    expect(sql).toContain("idx_leads_created_at");
    expect(sql).toContain("idx_appointments_start_time");
    expect(sql).toContain("idx_integration_deliveries_appointment_id");
    expect(sql).toContain("idx_funnel_events_event_name_session");
  });

  it("uses IF NOT EXISTS for idempotency", () => {
    const sql = fs.readFileSync(migrationPath, "utf-8");
    const createIndexStatements = sql.match(/CREATE INDEX/g);
    expect(createIndexStatements).toBeTruthy();
    // All CREATE INDEX should use IF NOT EXISTS
    expect(sql).toContain("CREATE INDEX IF NOT EXISTS");
  });

  it("does not drop or alter existing tables", () => {
    const sql = fs.readFileSync(migrationPath, "utf-8");
    expect(sql).not.toContain("DROP TABLE");
    expect(sql).not.toContain("DROP COLUMN");
    expect(sql).not.toContain("ALTER COLUMN");
  });
});
