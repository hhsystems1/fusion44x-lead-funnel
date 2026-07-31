import { describe, it, expect, beforeAll } from "vitest";
import fs from "fs";

const MIGRATION_PATH =
  "supabase/migrations/20260731000100_exit_popup_and_lead_stages.sql";

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

  it("relaxes NOT NULL on diagnostic and contact columns", () => {
    for (const column of [
      "phone",
      "zip_code",
      "water_feature",
      "installation_type",
      "pool_size",
      "current_treatment",
      "primary_goal",
    ]) {
      expect(sql).toContain(`c.column_name in (`);
      expect(sql).toContain(`'${column}'`);
      expect(sql).toContain("DROP NOT NULL");
    }
  });

  it("adds leads.lead_origin with the funnel/exit_popup CHECK", () => {
    expect(sql).toContain("add column lead_origin text not null default 'funnel'");
    expect(sql).toContain("leads_lead_origin_check");
    expect(sql).toContain("check (lead_origin in ('funnel', 'exit_popup'))");
  });

  it("adds leads.stage with the pipeline CHECK", () => {
    expect(sql).toContain("add column stage text null");
    expect(sql).toContain("leads_stage_check");
    expect(sql).toContain(
      "check (stage in ('contacted', 'no_show', 'follow_up', 'won', 'lost'))",
    );
  });

  it("creates create_lead_from_popup with consent enforcement", () => {
    expect(sql).toContain("create or replace function public.create_lead_from_popup(");
    expect(sql).toContain("security definer");
    expect(sql).toContain("set search_path = ''");
    expect(sql).toContain("using errcode = 'P0004'");
    expect(sql).toContain("using errcode = 'P0003'");
  });

  it("revokes execute from public, anon, authenticated and grants to service_role", () => {
    expect(sql).toMatch(/revoke execute on function public\.create_lead_from_popup/);
    expect(sql).toMatch(/from public, anon, authenticated/);
    expect(sql).toMatch(/grant execute on function public\.create_lead_from_popup/);
    expect(sql).toMatch(/to service_role/);
  });

  it("upgrades create_lead_from_funnel_session to upgrade exit_popup leads", () => {
    expect(sql).toContain(
      "create or replace function public.create_lead_from_funnel_session(",
    );
    expect(sql).toContain("Only exit_popup leads can be upgraded");
    expect(sql).toContain("delete from public.lead_answers where lead_id = v_lead_id;");
    expect(sql).toContain("where id = p_session_id");
  });

  it("includes a verification block", () => {
    expect(sql).toContain("do $verify$");
    expect(sql).toContain("raise exception 'leads.lead_origin column must exist'");
    expect(sql).toContain("raise exception 'create_lead_from_popup function must exist'");
  });

  it("guards idempotent column additions with IF NOT EXISTS", () => {
    expect(sql).toContain("if not exists (");
  });
});
