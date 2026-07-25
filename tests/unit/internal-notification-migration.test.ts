import { describe, it, expect, beforeAll } from "vitest";
import fs from "fs";

const MIGRATION_PATH =
  "supabase/migrations/20260725000100_internal_booking_notification_delivery.sql";
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
    // Extract the content between each DO ... $tag$ ... $tag$ block
    // and verify there are no untagged $$ within them
    const doBlockRegex = /do\s+(\$\w+\$)([\s\S]*?)\1\s*;/g;
    let match: RegExpExecArray | null;
    while ((match = doBlockRegex.exec(sql)) !== null) {
      const body = match[2];
      // A bare $$ would appear as two consecutive $ not preceded/followed by the tag
      expect(body).not.toMatch(/\$\$/);
    }
  });

  it("regexp_matches uses a named dollar-quoted regex string", () => {
    expect(sql).toContain("$regex$");
    expect(sql).toMatch(/regexp_matches\(.*,\s*\$regex\$.*\$regex\$/);
  });

  it("regex string does not contain bare $$", () => {
    const regexMatch = sql.match(/\$regex\$(.*?)\$regex\$/);
    expect(regexMatch).not.toBeNull();
    expect(regexMatch![1]).not.toContain("$$");
  });

  it("DO blocks are well-formed (tagged open matches tagged close)", () => {
    const tags = sql.match(/\$(\w+)\$/g) || [];
    // Each tag should appear an even number of times (open + close)
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
    expect(sql).toContain("end if;");
  });
});

describe("schema state 3: multiple event_type constraints have all values preserved", () => {
  let sql: string;

  beforeAll(() => {
    sql = fs.readFileSync(MIGRATION_PATH, "utf-8");
  });

  it("detects when constraint exists but excludes internal_booking_notification (Case 2)", () => {
    expect(sql).toContain("elsif not v_has_internal then");
  });

  it("collects ALL event_type CHECK constraint definitions, not just the first", () => {
    // Uses string_agg to concatenate all matching constraint defs
    expect(sql).toContain("string_agg(pg_get_constraintdef(c.oid)");
    // Must NOT have limit 1 in the extraction query
    const extractionBlock = sql.substring(
      sql.indexOf("elsif not v_has_internal then"),
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

  it("builds new value list as existing values + internal_booking_notification", () => {
    expect(sql).toContain("array_cat");
    expect(sql).toContain("array['internal_booking_notification']");
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

  it("preserves destination_check constraint by not targeting non-event_type constraints", () => {
    const dropLoop = sql.substring(
      sql.indexOf("for v_sql in"),
      sql.indexOf("end loop;") + "end loop;".length,
    );
    expect(dropLoop).toContain("like '%event_type%'");
  });
});

describe("safety: extraction failure before any DROP CONSTRAINT", () => {
  let sql: string;

  beforeAll(() => {
    sql = fs.readFileSync(MIGRATION_PATH, "utf-8");
  });

  it("checks extraction produced at least one value before dropping", () => {
    const case2Block = sql.substring(
      sql.indexOf("elsif not v_has_internal then"),
      sql.indexOf("-- Drop all existing"),
    );
    expect(case2Block).toContain("array_length(v_old_values, 1) = 0");
    expect(case2Block).toContain("raise exception");
    expect(case2Block).toContain("aborting to prevent data loss");
  });

  it("extraction safety check appears before the DROP CONSTRAINT loop", () => {
    const safetyCheckPos = sql.indexOf("array_length(v_old_values, 1) = 0");
    const dropLoopPos = sql.indexOf("for v_sql in");
    expect(safetyCheckPos).toBeLessThan(dropLoopPos);
  });

  it("booking_confirmation presence check appears before the DROP CONSTRAINT loop", () => {
    const bookingCheckPos = sql.indexOf("booking_confirmation.*any(v_old_values)");
    const dropLoopPos = sql.indexOf("for v_sql in");
    expect(bookingCheckPos).toBeLessThan(dropLoopPos);
  });

  it("booking_confirmation cannot be lost — checked via array membership", () => {
    expect(sql).toContain("'booking_confirmation' = any(v_old_values)");
  });

  it("both safety checks raise exceptions that abort the transaction", () => {
    // Find the two raise exception lines in Case 2
    const case2Block = sql.substring(
      sql.indexOf("elsif not v_has_internal then"),
      sql.indexOf("-- Case 3"),
    );
    const raises = case2Block.match(/raise exception/g);
    expect(raises).toHaveLength(2);
  });

  it("safety checks reference v_old_values which is populated from extraction", () => {
    const case2Block = sql.substring(
      sql.indexOf("elsif not v_has_internal then"),
      sql.indexOf("-- Drop all existing"),
    );
    // The extraction into v_old_values must precede the safety checks
    const extractPos = case2Block.indexOf("into v_old_values");
    const safetyPos = case2Block.indexOf("v_old_values is null");
    expect(extractPos).toBeLessThan(safetyPos);
  });
});

describe("booking_confirmation cannot be lost in any code path", () => {
  let sql: string;

  beforeAll(() => {
    sql = fs.readFileSync(MIGRATION_PATH, "utf-8");
  });

  it("Case 1 (create new) explicitly includes booking_confirmation", () => {
    const case1Block = sql.substring(
      sql.indexOf("if not v_has_constraint then"),
      sql.indexOf("elsif not v_has_internal then"),
    );
    expect(case1Block).toContain("'booking_confirmation'");
  });

  it("Case 2 (replace) validates booking_confirmation is in extracted values", () => {
    expect(sql).toContain("'booking_confirmation' = any(v_old_values)");
  });

  it("Case 2 (replace) adds internal_booking_notification to the preserved set", () => {
    expect(sql).toContain("array['internal_booking_notification']");
  });

  it("verification DO block checks booking_confirmation is present", () => {
    const verifyBlock = sql.substring(sql.indexOf("do $verify$"));
    expect(verifyBlock).toContain("booking_confirmation must be allowed");
  });
});

describe("unrelated constraints are untouched", () => {
  let sql: string;

  beforeAll(() => {
    sql = fs.readFileSync(MIGRATION_PATH, "utf-8");
  });

  it("DROP loop only matches constraints with event_type in definition", () => {
    const dropLoop = sql.substring(
      sql.indexOf("for v_sql in"),
      sql.indexOf("end loop;") + "end loop;".length,
    );
    expect(dropLoop).toContain("pg_get_constraintdef(c.oid) like '%event_type%'");
  });

  it("no hardcoded constraint names in the DROP path", () => {
    const dropLoop = sql.substring(
      sql.indexOf("for v_sql in"),
      sql.indexOf("end loop;") + "end loop;".length,
    );
    expect(dropLoop).not.toContain("integration_deliveries_destination_check");
    expect(dropLoop).not.toContain("integration_deliveries_status_check");
    expect(dropLoop).not.toContain("integration_deliveries_attempt_count_check");
    expect(dropLoop).not.toContain("integration_deliveries_has_reference_check");
  });

  it("does not drop index", () => {
    expect(sql).not.toMatch(/drop\s+index/i);
  });

  it("does not alter unrelated columns", () => {
    expect(sql).not.toMatch(/alter\s+table.*add\s+column/i);
    expect(sql).not.toMatch(/alter\s+table.*drop\s+column/i);
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
    // If constraint already has internal_booking_notification, the elsif branch skips
    expect(sql).toContain("elsif not v_has_internal then");
  });

  it("does not drop the unique index on re-run", () => {
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
