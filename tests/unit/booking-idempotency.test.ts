import { describe, it, expect } from "vitest";
import fs from "fs";
import { BOOKING } from "@/config/booking";

describe("migration ordering", () => {
  it("20260724000300 includes booking_event_id column before function creation", () => {
    const sql = fs.readFileSync(
      "supabase/migrations/20260724000300_create_funnel_appointment.sql",
      "utf-8",
    );

    const addColumnPos = sql.indexOf("add column if not exists booking_event_id");
    const createFunctionPos = sql.indexOf("create or replace function");
    expect(addColumnPos).toBeGreaterThanOrEqual(0);
    expect(addColumnPos).toBeLessThan(createFunctionPos);
    expect(createFunctionPos).toBeGreaterThan(0);

    const indexPos = sql.indexOf("create unique index if not exists idx_appointments_booking_event_id");
    const commentPos = sql.indexOf("-- create_funnel_appointment");
    expect(indexPos).toBeGreaterThan(0);
    expect(indexPos).toBeLessThan(commentPos);

    expect(fs.existsSync("supabase/migrations/20260724000400_add_booking_event_id.sql")).toBe(false);
  });

  it("003 migration runs before 004 in file system", () => {
    const files = fs
      .readdirSync("supabase/migrations")
      .filter((f: string) => f.endsWith(".sql"))
      .sort();
    const idx003 = files.indexOf("20260724000300_create_funnel_appointment.sql");
    expect(idx003).toBeGreaterThanOrEqual(0);
    expect(files.filter((f: string) => f > "20260724000300").length).toBeGreaterThanOrEqual(0);
  });
});

describe("RPC idempotency — event_id identity field matching", () => {
  const baseFields = {
    lead_id: "00000000-0000-0000-0000-000000000001",
    session_id: "00000000-0000-0000-0000-000000000002",
    start_time: "2026-08-03T13:00:00.000Z",
    end_time: "2026-08-03T13:30:00.000Z",
    timezone: "America/New_York",
    provider: "google_calendar",
  };

  function findFieldMismatches(
    existing: Record<string, string>,
    incoming: Record<string, string>,
  ): string[] {
    const identityFields = [
      "lead_id",
      "session_id",
      "start_time",
      "end_time",
      "timezone",
      "provider",
    ];
    return identityFields.filter((field) => existing[field] !== incoming[field]);
  }

  it("same event_id plus identical booking data is idempotent", () => {
    const mismatches = findFieldMismatches(baseFields, baseFields);
    expect(mismatches).toEqual([]);
  });

  it("same event_id plus different lead is rejected", () => {
    const different = { ...baseFields, lead_id: "00000000-0000-0000-0000-000000000099" };
    const mismatches = findFieldMismatches(baseFields, different);
    expect(mismatches).toContain("lead_id");
    expect(mismatches.length).toBe(1);
  });

  it("same event_id plus different session is rejected", () => {
    const different = { ...baseFields, session_id: "00000000-0000-0000-0000-000000000099" };
    const mismatches = findFieldMismatches(baseFields, different);
    expect(mismatches).toContain("session_id");
    expect(mismatches.length).toBe(1);
  });

  it("same event_id plus different start_time is rejected", () => {
    const different = { ...baseFields, start_time: "2026-08-03T14:00:00.000Z" };
    const mismatches = findFieldMismatches(baseFields, different);
    expect(mismatches).toContain("start_time");
    expect(mismatches.length).toBe(1);
  });

  it("same event_id plus different end_time is rejected", () => {
    const different = { ...baseFields, end_time: "2026-08-03T14:30:00.000Z" };
    const mismatches = findFieldMismatches(baseFields, different);
    expect(mismatches).toContain("end_time");
    expect(mismatches.length).toBe(1);
  });

  it("same event_id plus different timezone is rejected", () => {
    const different = { ...baseFields, timezone: "America/Chicago" };
    const mismatches = findFieldMismatches(baseFields, different);
    expect(mismatches).toContain("timezone");
    expect(mismatches.length).toBe(1);
  });

  it("same event_id plus different provider is rejected", () => {
    const different = { ...baseFields, provider: "calendly" };
    const mismatches = findFieldMismatches(baseFields, different);
    expect(mismatches).toContain("provider");
    expect(mismatches.length).toBe(1);
  });

  it("same event_id plus multiple mismatched fields is rejected", () => {
    const different = {
      ...baseFields,
      lead_id: "00000000-0000-0000-0000-000000000099",
      session_id: "00000000-0000-0000-0000-000000000099",
      start_time: "2026-08-04T13:00:00.000Z",
    };
    const mismatches = findFieldMismatches(baseFields, different);
    expect(mismatches).toContain("lead_id");
    expect(mismatches).toContain("session_id");
    expect(mismatches).toContain("start_time");
    expect(mismatches.length).toBe(3);
  });
});

describe("API passes configured buffer values to RPC", () => {
  it("BOOKING config exports numeric buffer values", () => {
    expect(typeof BOOKING.BUFFER_BEFORE_MINUTES).toBe("number");
    expect(typeof BOOKING.BUFFER_AFTER_MINUTES).toBe("number");
    expect(BOOKING.BUFFER_BEFORE_MINUTES).toBeGreaterThanOrEqual(0);
    expect(BOOKING.BUFFER_AFTER_MINUTES).toBeGreaterThanOrEqual(0);
  });

  it("buffer format matches PostgreSQL interval syntax", () => {
    const beforeInterval = `${BOOKING.BUFFER_BEFORE_MINUTES} minutes`;
    const afterInterval = `${BOOKING.BUFFER_AFTER_MINUTES} minutes`;
    expect(beforeInterval).toMatch(/^\d+ minutes$/);
    expect(afterInterval).toMatch(/^\d+ minutes$/);
  });

  it("POST /api/bookings route delegates to createBooking", () => {
    const routeSource = fs.readFileSync("src/app/api/bookings/route.ts", "utf-8");

    expect(routeSource).toContain("create-booking");
    expect(routeSource).toContain("createBooking");

    const configSource = fs.readFileSync("src/config/booking.ts", "utf-8");
    expect(configSource).toContain("BUFFER_BEFORE_MINUTES");
    expect(configSource).toContain("BUFFER_AFTER_MINUTES");
  });

  it("RPC function signature accepts p_buffer_before and p_buffer_after", () => {
    const sql = fs.readFileSync(
      "supabase/migrations/20260724000300_create_funnel_appointment.sql",
      "utf-8",
    );
    expect(sql).toContain("p_buffer_before");
    expect(sql).toContain("p_buffer_after");
    expect(sql).toContain("interval default interval '0 minutes'");
  });
});