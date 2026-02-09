/**
 * Smoke test: Credit cost registration consistency
 *
 * Verifies that every CREDIT_COSTS action key is consistently registered
 * across all required locations:
 *   1. CREDIT_COSTS in convex/subscriptions.ts (source of truth)
 *   2. ACTION_COLORS in src/pages/UsageHistoryPage.tsx
 *   3. actions in src/lib/i18n/locales/en/usage.json
 *
 * If this test fails, a credit action was added to one place but not all others.
 */

import { describe, expect, it } from "bun:test";
import { readFileSync } from "fs";
import { join } from "path";

const rootDir = process.cwd();

/**
 * Extract top-level keys from a TS object literal like:
 *   const NAME: Type = {
 *     key1: value,
 *     key2: value,
 *   };
 *
 * Only matches keys at the start of a line (with optional whitespace).
 */
function extractObjectKeys(content: string, objectName: string): string[] {
  const lines = content.split("\n");
  const keys: string[] = [];
  let inside = false;
  let braceDepth = 0;

  for (const line of lines) {
    const trimmed = line.trim();

    // Detect start: `const NAME = {` or `const NAME: Type = {`
    if (!inside) {
      const startPattern = new RegExp(`(?:const|let|var)\\s+${objectName}[^=]*=\\s*\\{`);
      if (startPattern.test(trimmed)) {
        inside = true;
        braceDepth = 1;
        continue;
      }
    }

    if (inside) {
      // Count braces to handle nesting
      for (const ch of trimmed) {
        if (ch === "{") braceDepth++;
        if (ch === "}") braceDepth--;
      }

      // Only extract keys at depth 1 (top-level of the object)
      if (braceDepth >= 1) {
        const keyMatch = trimmed.match(/^["']?(\w+)["']?\s*:/);
        if (keyMatch && braceDepth === 1) {
          keys.push(keyMatch[1]);
        }
      }

      if (braceDepth === 0) {
        inside = false;
      }
    }
  }
  return keys;
}

describe("Credit Cost Registration", () => {
  // 1. Read source of truth: CREDIT_COSTS from subscriptions.ts
  const subscriptionsPath = join(rootDir, "convex", "subscriptions.ts");
  const subscriptionsContent = readFileSync(subscriptionsPath, "utf-8");
  const creditCostKeys = extractObjectKeys(subscriptionsContent, "CREDIT_COSTS");

  // 2. Read ACTION_COLORS from UsageHistoryPage.tsx
  const usagePage = join(rootDir, "src", "pages", "UsageHistoryPage.tsx");
  const usagePageContent = readFileSync(usagePage, "utf-8");
  const actionColorKeys = extractObjectKeys(usagePageContent, "ACTION_COLORS");

  // 3. Read actions from en/usage.json
  const usageJsonPath = join(rootDir, "src", "lib", "i18n", "locales", "en", "usage.json");
  const usageJson = JSON.parse(readFileSync(usageJsonPath, "utf-8"));
  const usageActionKeys = Object.keys(usageJson.actions ?? {});

  it("CREDIT_COSTS has entries", () => {
    expect(creditCostKeys.length).toBeGreaterThan(0);
  });

  it("every CREDIT_COSTS key has a color in ACTION_COLORS", () => {
    const missing = creditCostKeys.filter((k) => !actionColorKeys.includes(k));
    if (missing.length > 0) {
      throw new Error(
        `CREDIT_COSTS keys missing from ACTION_COLORS in UsageHistoryPage.tsx: ${missing.join(", ")}`
      );
    }
  });

  it("every ACTION_COLORS key exists in CREDIT_COSTS", () => {
    const extra = actionColorKeys.filter((k) => !creditCostKeys.includes(k));
    if (extra.length > 0) {
      throw new Error(
        `ACTION_COLORS has keys not in CREDIT_COSTS (subscriptions.ts): ${extra.join(", ")}`
      );
    }
  });

  it("every CREDIT_COSTS key has an i18n label in usage.json", () => {
    const missing = creditCostKeys.filter((k) => !usageActionKeys.includes(k));
    if (missing.length > 0) {
      throw new Error(
        `CREDIT_COSTS keys missing from en/usage.json actions: ${missing.join(", ")}`
      );
    }
  });

  it("every usage.json action key exists in CREDIT_COSTS", () => {
    const extra = usageActionKeys.filter((k) => !creditCostKeys.includes(k));
    if (extra.length > 0) {
      throw new Error(
        `usage.json actions has keys not in CREDIT_COSTS (subscriptions.ts): ${extra.join(", ")}`
      );
    }
  });
});
