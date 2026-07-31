import { describe, it, expect, beforeAll } from "vitest";
import fs from "fs";

const MIGRATION_PATH =
  "supabase/migrations/20260729000100_add_booking_followup_event_type.sql";
const EXISTING_INDEX_PATH =
  "supabase/migrations/20260724000500_email_notification_delivery_columns.sql";

describe("no nested untagged dollar quoting", () => {
  let sql: string;

  beforeAll(() => {
    sql = fs.readFileSync(MIGRATION_PATH, "utf-8");
  });

  it("DO blocks use named dollar-quote tags", () => {
    expect(sql).toContain("$migration$");
    expect(sql).toContain("$verify$");
  });

  it("no bare $$ inside a DO block body", () => {
    const doBlockRegex = /do\s+(\$\w+\$)([\s\S]*?)\1\s*;/g;
    let match: RegExpExecArray | null;
    while ((match = doBlockRegex.exec(sql)) !== null) {
      const body = match[2];
      expect(body).not.toMatch(/\$\$/);
    }
  });

  it("regexp_matches uses a named dollar-quoted regex string", () => {
    expect(sql).toContain("$regex$");
    expect(sql).toMatch(/regexp_matches\(.*,\s*\$regex\$.*\$regex\$/);
  });

  it("DO blocks are well-formed (tagged open matches tagged close)", () => {
    const tags = sql.match(/\$(\w+)\$/g) || [];
    const tagCounts = new Map<string, number>();
    for (const tag of tags) {
      tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
    }
    for (const [, count] of tagCounts) {
      expect(count % 2).toBe(0);
    }
  });
});

describe("migration file existence and structure", () => {
  let sql: string;

  beforeAll(() => {
    sql = fs.readFileSync(MIGRATION_PATH, "utf-8");
  });

  it("migration file exists", () => {
    expect(fs.existsSync(MIGRATION_PATH)).toBe(true);
  });

  it("creates the unique partial index for follow-up deliveries", () => {
    expect(sql).toContain("idx_integration_deliveries_booking_followup_unique");
    expect(sql).toContain(
      "where destination = 'email' and event_type = 'booking_followup'",
    );
  });

  it("uses IF NOT EXISTS for the new index", () => {
    expect(sql).toContain(
      "create unique index if not exists idx_integration_deliveries_booking_followup_unique",
    );
  });

  it("does not create or modify RPC functions", () => {
    expect(sql).not.toContain("create or replace function");
    expect(sql).not.toContain("returns setof");
  });

  it("does not change permission grants", () => {
    expect(sql).not.toContain("grant");
    expect(sql).not.toContain("revoke");
  });

  it("verifies both event types are accepted after constraint creation", () => {
    expect(sql).toContain("booking_confirmation must be allowed");
    expect(sql).toContain("booking_followup must be allowed");
  });

  it("does not modify the existing customer unique index", () => {
    const existing = fs.readFileSync(EXISTING_INDEX_PATH, "utf-8");
    expect(existing).toContain("idx_integration_deliveries_email_booking_unique");
    expect(existing).toContain("booking_confirmation");
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
      sql.indexOf("elsif not v_has_followup then"),
    );
    expect(createBlock).toContain("'booking_confirmation'");
  });

  it("new constraint includes booking_followup", () => {
    const createBlock = sql.substring(
      sql.indexOf("if not v_has_constraint then"),
      sql.indexOf("elsif not v_has_followup then"),
    );
    expect(createBlock).toContain("'booking_followup'");
  });

  it("new constraint preserves internal_booking_notification and appointment_create", () => {
    const createBlock = sql.substring(
      sql.indexOf("if not v_has_constraint then"),
      sql.indexOf("elsif not v_has_followup then"),
    );
    expect(createBlock).toContain("'internal_booking_notification'");
    expect(createBlock).toContain("'appointment_create'");
  });
});

describe("schema state 2: existing constraint already allows booking_followup", () => {
  let sql: string;

  beforeAll(() => {
    sql = fs.readFileSync(MIGRATION_PATH, "utf-8");
  });

  it("checks whether booking_followup is already permitted", () => {
    expect(sql).toContain("v_has_followup");
    expect(sql).toContain(
      "pg_get_constraintdef(c.oid) like '%booking_followup%'",
    );
  });
});

describe("schema state 3: existing constraint excludes booking_followup (Case 2)", () => {
  let sql: string;

  beforeAll(() => {
    sql = fs.readFileSync(MIGRATION_PATH, "utf-8");
  });

  it("collects ALL event_type CHECK constraint definitions, not just the first", () => {
    expect(sql).toContain("string_agg(pg_get_constraintdef(c.oid)");
    const extractionBlock = sql.substring(
      sql.indexOf("elsif not v_has_followup then"),
      sql.indexOf("Safety: extraction"),
    );
    expect(extractionBlock).not.toContain("limit 1");
  });

  it("extracts values using regexp_matches with named dollar-quoted regex", () => {
    expect(sql).toContain("regexp_matches(v_def, $regex$");
    expect(sql).toContain("$regex$, 'g')");
  });

  it("deduplicates extracted values across all constraints", () => {
    expect(sql).toContain("array_agg(distinct m[1] order by m[1])");
  });

  it("drops existing event_type CHECK constraints before replacing", () => {
    expect(sql).toContain("DROP CONSTRAINT");
    expect(sql).toContain("conname");
  });

  it("builds new value list as existing values + booking_followup", () => {
    expect(sql).toContain("array_cat");
    expect(sql).toContain("array['booking_followup']");
  });

  it("preserves existing event types via distinct aggregation in final list", () => {
    expect(sql).toContain("array_agg(distinct v order by v)");
  });

  it("recreates constraint with ANY syntax including all values", () => {
    expect(sql).toContain("event_type = ANY (ARRAY[");
    expect(sql).toContain("::text[]");
  });

  it("does not drop unrelated CHECK constraints (destination, status, etc.)", () => {
    const dropLoop = sql.substring(
      sql.indexOf("for v_sql in"),
      sql.indexOf("end loop;") + "end loop;".length,
    );
    expect(dropLoop).toContain("pg_get_constraintdef(c.oid) like '%event_type%'");
    expect(dropLoop).not.toMatch(
      /drop constraint.*integration_deliveries_(destination|status|attempt_count|has_reference)/,
    );
  });
});

describe("safety: extraction failure before any DROP CONSTRAINT", () => {
  let sql: string;

  beforeAll(() => {
    sql = fs.readFileSync(MIGRATION_PATH, "utf-8");
  });

  it("checks extraction produced at least one value before dropping", () => {
    const case2Block = sql.substring(
      sql.indexOf("elsif not v_has_followup then"),
      sql.indexOf("-- Drop all existing"),
    );
    expect(case2Block).toContain("array_length(v_old_values, 1) = 0");
    expect(case2Block).toContain("raise exception");
    expect(case2Block).toContain("aborting to prevent data loss");
  });

  it("booking_confirmation cannot be lost — checked via array membership", () => {
    expect(sql).toContain("'booking_confirmation' = any(v_old_values)");
  });
});

describe("rerunning the migration is safe", () => {
  let sql: string;

  beforeAll(() => {
    sql = fs.readFileSync(MIGRATION_PATH, "utf-8");
  });

  it("unique index uses IF NOT EXISTS", () => {
    expect(sql).toContain("create unique index if not exists");
  });

  it("idempotent: constraint check prevents duplicate creation (Case 3 is no-op)", () => {
    expect(sql).toContain("elsif not v_has_followup then");
  });

  it("does not drop the unique index on re-run", () => {
    expect(sql).not.toContain("drop index");
  });

  it("does not alter existing RPC function signatures", () => {
    expect(sql).not.toContain("create or replace function");
  });
});

describe("unique indexes are independent", () => {
  it("existing customer index is unchanged", () => {
    const existing = fs.readFileSync(EXISTING_INDEX_PATH, "utf-8");
    expect(existing).toContain(
      "where destination = 'email' and event_type = 'booking_confirmation'",
    );
  });

  it("new follow-up index is scoped differently", () => {
    const followUp = fs.readFileSync(MIGRATION_PATH, "utf-8");
    expect(followUp).toContain(
      "where destination = 'email' and event_type = 'booking_followup'",
    );
  });

  it("indexes have different names", () => {
    const existing = fs.readFileSync(EXISTING_INDEX_PATH, "utf-8");
    const followUp = fs.readFileSync(MIGRATION_PATH, "utf-8");
    expect(existing).toContain("idx_integration_deliveries_email_booking_unique");
    expect(followUp).toContain(
      "idx_integration_deliveries_booking_followup_unique",
    );
  });
});

describe("migration ordering", () => {
  it("new migration sorts after the customer and internal migrations", () => {
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
    const idxFollowUp = files.indexOf(
      "20260729000100_add_booking_followup_event_type.sql",
    );
    expect(idx00500).toBeGreaterThanOrEqual(0);
    expect(idxInternal).toBeGreaterThan(idx00500);
    expect(idxFollowUp).toBeGreaterThan(idxInternal);
  });
});
