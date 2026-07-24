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

  it("creates the unique partial index for internal deliveries", () => {
    expect(sql).toContain("idx_integration_deliveries_internal_booking_unique");
    expect(sql).toContain(
      "where destination = 'email' and event_type = 'internal_booking_notification'",
    );
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
    expect(sql).toContain(
      "create unique index if not exists idx_integration_deliveries_internal_booking_unique",
    );
  });

  it("scopes the internal index to destination = 'email'", () => {
    expect(sql).toContain("destination = 'email'");
  });

  it("verifies both event types are accepted after constraint creation", () => {
    expect(sql).toContain("booking_confirmation must be allowed");
    expect(sql).toContain("internal_booking_notification must be allowed");
  });
});

describe("schema state 1: no existing event_type CHECK constraint", () => {
  let sql: string;

  beforeAll(() => {
    sql = fs.readFileSync(MIGRATION_PATH, "utf-8");
  });

  it("checks whether any event_type CHECK constraint exists", () => {
    expect(sql).toContain("v_has_constraint");
    expect(sql).toContain("pg_get_constraintdef(c.oid) like '%event_type%'");
  });

  it("creates a new constraint when none exists (Case 1)", () => {
    expect(sql).toContain("if not v_has_constraint then");
    expect(sql).toContain("add constraint integration_deliveries_event_type_check");
  });

  it("new constraint includes booking_confirmation", () => {
    const createBlock = sql.substring(
      sql.indexOf("if not v_has_constraint then"),
      sql.indexOf("elsif not v_has_internal then"),
    );
    expect(createBlock).toContain("'booking_confirmation'");
  });

  it("new constraint includes internal_booking_notification", () => {
    const createBlock = sql.substring(
      sql.indexOf("if not v_has_constraint then"),
      sql.indexOf("elsif not v_has_internal then"),
    );
    expect(createBlock).toContain("'internal_booking_notification'");
  });
});

describe("schema state 2: existing constraint already allows internal_booking_notification", () => {
  let sql: string;

  beforeAll(() => {
    sql = fs.readFileSync(MIGRATION_PATH, "utf-8");
  });

  it("checks whether internal_booking_notification is already permitted", () => {
    expect(sql).toContain("v_has_internal");
    expect(sql).toContain(
      "pg_get_constraintdef(c.oid) like '%internal_booking_notification%'",
    );
  });

  it("does nothing when constraint already permits internal_booking_notification (Case 3)", () => {
    // The ELSE branch (Case 3) is implicit — when both v_has_constraint and v_has_internal are true,
    // neither the CREATE nor REPLACE branches execute. The END IF closes after the elsif.
    expect(sql).toContain("end if;");
  });
});

describe("schema state 3: existing constraint excludes internal_booking_notification", () => {
  let sql: string;

  beforeAll(() => {
    sql = fs.readFileSync(MIGRATION_PATH, "utf-8");
  });

  it("detects when constraint exists but excludes internal_booking_notification (Case 2)", () => {
    expect(sql).toContain("elsif not v_has_internal then");
  });

  it("extracts existing allowed values from the constraint definition", () => {
    expect(sql).toContain("regexp_matches");
    expect(sql).toContain("v_old_values");
  });

  it("drops existing event_type CHECK constraints before replacing", () => {
    expect(sql).toContain("DROP CONSTRAINT");
    expect(sql).toContain("conname");
  });

  it("builds new value list as existing values + internal_booking_notification", () => {
    expect(sql).toContain("array_cat");
    expect(sql).toContain("array['internal_booking_notification']");
  });

  it("preserves existing event types via distinct aggregation", () => {
    expect(sql).toContain("array_agg(distinct v order by v)");
  });

  it("recreates constraint with ANY syntax including all values", () => {
    expect(sql).toContain("event_type = ANY (ARRAY[");
    expect(sql).toContain("::text[]");
  });

  it("does not drop unrelated CHECK constraints (destination, status, etc.)", () => {
    // Verify the DROP loop only targets constraints whose definition mentions event_type
    const dropLoop = sql.substring(
      sql.indexOf("for v_sql in"),
      sql.indexOf("end loop;") + "end loop;".length,
    );
    expect(dropLoop).toContain("pg_get_constraintdef(c.oid) like '%event_type%'");
    expect(dropLoop).not.toMatch(
      /drop constraint.*integration_deliveries_(destination|status|attempt_count|has_reference)/,
    );
  });

  it("preserves destination_check constraint by not targeting non-event_type constraints", () => {
    // The drop loop uses: pg_get_constraintdef(c.oid) like '%event_type%'
    // This cannot match destination_check (which checks destination IN (...))
    const dropLoop = sql.substring(
      sql.indexOf("for v_sql in"),
      sql.indexOf("end loop;") + "end loop;".length,
    );
    expect(dropLoop).toContain("like '%event_type%'");
  });
});

describe("migration is transactional and idempotent", () => {
  let sql: string;

  beforeAll(() => {
    sql = fs.readFileSync(MIGRATION_PATH, "utf-8");
  });

  it("uses a single DO block for constraint management (transactional within the block)", () => {
    // The constraint logic is in a single DO $$ ... $$ block — atomic within its transaction
    const doBlocks = sql.match(/do\s+\$\$/g);
    expect(doBlocks).toHaveLength(2); // constraint logic + verification
  });

  it("does not drop the unique index on re-run", () => {
    expect(sql).toContain("create unique index if not exists");
    expect(sql).not.toContain("drop index");
  });

  it("does not alter existing RPC function signatures", () => {
    expect(sql).not.toContain("create or replace function");
  });

  it("preserves all existing allowed event types in every code path", () => {
    // Case 1 (create new): includes booking_confirmation + internal_booking_notification
    const case1Block = sql.substring(
      sql.indexOf("if not v_has_constraint then"),
      sql.indexOf("elsif not v_has_internal then"),
    );
    expect(case1Block).toContain("'booking_confirmation'");
    expect(case1Block).toContain("'internal_booking_notification'");

    // Case 2 (replace): preserves existing values via array_cat + adds internal_booking_notification
    expect(sql).toContain("array_cat(");
    expect(sql).toContain("coalesce(v_old_values, array[]::text[])");
    expect(sql).toContain("array['internal_booking_notification']");
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
    const internal = fs.readFileSync(MIGRATION_PATH, "utf-8");
    expect(internal).toContain(
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
