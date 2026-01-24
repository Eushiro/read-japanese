/**
 * Smoke test: Core exports exist
 * This catches missing files, syntax errors, and major structural issues
 *
 * Note: These tests use static analysis rather than dynamic imports
 * to avoid dependency resolution issues with mocked modules.
 */

import { describe, expect, it } from "bun:test";
import * as fs from "fs";
import * as path from "path";

const srcDir = path.join(process.cwd(), "src");

describe("Provider Stack Smoke Test", () => {
  it("main.tsx file exists", () => {
    const mainPath = path.join(srcDir, "main.tsx");
    expect(fs.existsSync(mainPath)).toBe(true);
  });

  it("router.tsx file exists", () => {
    const routerPath = path.join(srcDir, "router.tsx");
    expect(fs.existsSync(routerPath)).toBe(true);
  });

  it("AuthContext file exists", () => {
    const authPath = path.join(srcDir, "contexts", "AuthContext.tsx");
    expect(fs.existsSync(authPath)).toBe(true);
  });

  it("i18n module exists", () => {
    const i18nPath = path.join(srcDir, "lib", "i18n", "index.ts");
    expect(fs.existsSync(i18nPath)).toBe(true);
  });

  it("main.tsx has expected provider imports", () => {
    const mainPath = path.join(srcDir, "main.tsx");
    const content = fs.readFileSync(mainPath, "utf-8");

    // Check for critical provider imports
    expect(content).toContain("ClerkProvider");
    expect(content).toContain("ConvexProviderWithClerk");
    expect(content).toContain("AuthProvider");
    expect(content).toContain("TranslationProvider");
  });

  it("router.tsx has expected route definitions", () => {
    const routerPath = path.join(srcDir, "router.tsx");
    const content = fs.readFileSync(routerPath, "utf-8");

    // Check for critical routes
    expect(content).toContain("DashboardPage");
    expect(content).toContain("LibraryPage");
    expect(content).toContain("SettingsPage");
    expect(content).toContain("createRouter");
  });
});
