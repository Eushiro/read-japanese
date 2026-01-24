/**
 * Smoke test: Router and page files exist
 * This catches deleted routes, missing pages, and structural issues
 */

import { describe, expect, it } from "bun:test";
import * as fs from "fs";
import * as path from "path";

const srcDir = path.join(process.cwd(), "src");
const pagesDir = path.join(srcDir, "pages");

describe("Router Configuration", () => {
  it("router.tsx exists and exports router", () => {
    const routerPath = path.join(srcDir, "router.tsx");
    expect(fs.existsSync(routerPath)).toBe(true);

    const content = fs.readFileSync(routerPath, "utf-8");
    expect(content).toContain("export const router");
  });

  it("critical page files exist", () => {
    const criticalPages = [
      "LandingPage.tsx",
      "DashboardPage.tsx",
      "LibraryPage.tsx",
      "SettingsPage.tsx",
      "PricingPage.tsx",
      "FlashcardsPage.tsx",
    ];

    for (const page of criticalPages) {
      const pagePath = path.join(pagesDir, page);
      expect(fs.existsSync(pagePath)).toBe(true);
    }
  });

  it("router imports all critical pages", () => {
    const routerPath = path.join(srcDir, "router.tsx");
    const content = fs.readFileSync(routerPath, "utf-8");

    const criticalImports = [
      "LandingPage",
      "DashboardPage",
      "LibraryPage",
      "SettingsPage",
      "PricingPage",
    ];

    for (const importName of criticalImports) {
      expect(content).toContain(importName);
    }
  });

  it("admin pages directory exists", () => {
    const adminDir = path.join(pagesDir, "admin");
    expect(fs.existsSync(adminDir)).toBe(true);
  });
});
