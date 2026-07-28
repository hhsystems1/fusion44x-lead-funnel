import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("Security: Service-role key never reaches client", () => {
  const srcDir = path.join(process.cwd(), "src");

  function getAllTsxTsFiles(dir: string): string[] {
    const files: string[] = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules") continue;
        files.push(...getAllTsxTsFiles(fullPath));
      } else if (
        entry.name.endsWith(".ts") ||
        entry.name.endsWith(".tsx")
      ) {
        files.push(fullPath);
      }
    }
    return files;
  }

  it("no client component imports supabase server client", () => {
    const files = getAllTsxTsFiles(path.join(srcDir, "app"));
    const clientFiles = files.filter((f) => {
      const content = fs.readFileSync(f, "utf-8");
      return content.includes('"use client"');
    });

    for (const file of clientFiles) {
      const content = fs.readFileSync(file, "utf-8");
      expect(content).not.toContain("getServerSupabaseClient");
      expect(content).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
      expect(content).not.toContain("@/lib/supabase/server");
    }
  });

  it("no component imports server-only modules", () => {
    const componentDir = path.join(srcDir, "components");
    if (!fs.existsSync(componentDir)) return;

    const files = getAllTsxTsFiles(componentDir);
    for (const file of files) {
      const content = fs.readFileSync(file, "utf-8");
      expect(content).not.toContain('import "server-only"');
      expect(content).not.toContain("getServerSupabaseClient");
    }
  });

  it("admin pages use server components for data fetching", () => {
    const adminDir = path.join(srcDir, "app", "admin");
    if (!fs.existsSync(adminDir)) return;

    // Check that overview, funnel, sessions, leads, appointments pages
    // do NOT have "use client" at the top (they should be server components)
    const serverPages = [
      "overview/page.tsx",
      "funnel/page.tsx",
      "leads/page.tsx",
      "leads/[id]/page.tsx",
      "appointments/page.tsx",
      "integration-health/page.tsx",
    ];

    for (const page of serverPages) {
      const filePath = path.join(adminDir, page);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, "utf-8");
        // These pages should NOT be client components
        expect(content.startsWith('"use client"')).toBe(false);
      }
    }
  });

  it("admin auth library is server-only", () => {
    const authFile = path.join(srcDir, "lib", "admin", "auth.ts");
    const content = fs.readFileSync(authFile, "utf-8");
    expect(content).toContain('import "server-only"');
  });

  it("admin queries library is server-only", () => {
    const queriesFile = path.join(srcDir, "lib", "admin", "queries.ts");
    const content = fs.readFileSync(queriesFile, "utf-8");
    expect(content).toContain('import "server-only"');
  });

  it("no admin page exposes ADMIN_DASHBOARD_PASSWORD", () => {
    const adminDir = path.join(srcDir, "app", "admin");
    const files = getAllTsxTsFiles(adminDir);
    for (const file of files) {
      const content = fs.readFileSync(file, "utf-8");
      expect(content).not.toContain("ADMIN_DASHBOARD_PASSWORD");
      expect(content).not.toContain("ADMIN_DASHBOARD_SESSION_SECRET");
    }
  });

  it("middleware does not expose credentials in client code", () => {
    const middlewareFile = path.join(srcDir, "middleware.ts");
    const content = fs.readFileSync(middlewareFile, "utf-8");
    // Middleware only reads from process.env, never from client
    expect(content).not.toContain("requireAdminAuthEnv");
  });
});
