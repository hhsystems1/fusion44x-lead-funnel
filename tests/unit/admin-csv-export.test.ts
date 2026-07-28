import { describe, it, expect } from "vitest";
import { toCsv } from "@/lib/admin/queries";

// We can't test the query functions without Supabase,
// but we can test the CSV helper and date range logic.

describe("CSV Export", () => {
  describe("toCsv", () => {
    it("generates correct CSV with header and rows", () => {
      const rows = [
        { name: "Alice", email: "alice@example.com", status: "new" },
        { name: "Bob", email: "bob@example.com", status: "booked" },
      ];
      const columns = ["name", "email", "status"];
      const csv = toCsv(rows, columns);
      expect(csv).toContain("name,email,status");
      expect(csv).toContain("Alice,alice@example.com,new");
      expect(csv).toContain("Bob,bob@example.com,booked");
    });

    it("escapes values containing commas", () => {
      const rows = [{ note: "hello, world" }];
      const csv = toCsv(rows, ["note"]);
      expect(csv).toContain('"hello, world"');
    });

    it("escapes values containing double quotes", () => {
      const rows = [{ note: 'say "hello"' }];
      const csv = toCsv(rows, ["note"]);
      expect(csv).toContain('"say ""hello"""');
    });

    it("escapes values containing newlines", () => {
      const rows = [{ note: "line1\nline2" }];
      const csv = toCsv(rows, ["note"]);
      expect(csv).toContain('"line1\nline2"');
    });

    it("prevents formula injection with = prefix", () => {
      const rows = [{ formula: "=SUM(A1:A10)" }];
      const csv = toCsv(rows, ["formula"]);
      expect(csv).toContain("'=SUM(A1:A10)");
      expect(csv).not.toContain('"=SUM');
    });

    it("prevents formula injection with + prefix", () => {
      const rows = [{ formula: "+123" }];
      const csv = toCsv(rows, ["formula"]);
      expect(csv).toContain("'+123");
    });

    it("prevents formula injection with - prefix", () => {
      const rows = [{ formula: "-123" }];
      const csv = toCsv(rows, ["formula"]);
      expect(csv).toContain("'-123");
    });

    it("prevents formula injection with @ prefix", () => {
      const rows = [{ formula: "@SUM(A1)" }];
      const csv = toCsv(rows, ["formula"]);
      expect(csv).toContain("'@SUM(A1)");
    });

    it("prevents formula injection with tab prefix", () => {
      const rows = [{ formula: "\t=1" }];
      const csv = toCsv(rows, ["formula"]);
      expect(csv).toContain("'\t=1");
    });

    it("handles null and undefined values", () => {
      const rows = [{ a: null, b: undefined, c: "yes" }];
      const csv = toCsv(rows, ["a", "b", "c"]);
      expect(csv).toContain(",yes");
    });

    it("handles empty rows", () => {
      const csv = toCsv([], ["col1", "col2"]);
      expect(csv).toContain("col1,col2");
    });

    it("handles numeric values", () => {
      const rows = [{ count: 42, rate: 3.14 }];
      const csv = toCsv(rows, ["count", "rate"]);
      expect(csv).toContain("42,3.14");
    });
  });
});
