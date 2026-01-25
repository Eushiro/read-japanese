#!/usr/bin/env bun
/**
 * Custom pattern checker for SanLang web.
 *
 * Enforces patterns documented in docs/DEVELOPMENT.md:
 * 1. Use ContentLanguage type from @/lib/contentLanguages instead of hardcoding language unions
 * 2. Use TierId type from @/lib/tiers instead of hardcoding tier unions
 *
 * Run: bun run scripts/lint-patterns.ts
 */

import { readdirSync, readFileSync, statSync } from "fs";
import { join, relative } from "path";

// Files that are allowed to have the patterns we're checking for
const EXCLUDED_FILES = new Set([
  "contentLanguages.ts", // The content language config
  "lint-patterns.ts", // This script
  "tiers.ts", // The tier config itself
  "schema.ts", // Convex schema with validators
  "stripe.ts", // Convex backend with local tier types for Stripe price mapping
]);

// Directories to exclude
const EXCLUDED_DIRS = new Set([
  "node_modules",
  "dist",
  ".git",
  "__tests__",
  "test",
]);

// Pattern to match hardcoded language union types
// Matches: "japanese" | "english" | "french" (in any order, with any subset of 2+)
const LANGUAGE_UNION_PATTERN =
  /:\s*["'](japanese|english|french)["']\s*\|\s*["'](japanese|english|french)["']/;

// Also check for the full 3-language union as a type annotation
const FULL_UNION_PATTERN =
  /["'](japanese|english|french)["']\s*\|\s*["'](japanese|english|french)["']\s*\|\s*["'](japanese|english|french)["']/;

// Pattern to catch local Language type definitions
// Matches: type Language = "japanese" | "english" | "french"
const LOCAL_LANGUAGE_TYPE_PATTERN = /^type\s+Language\s*=/;

// Pattern to match hardcoded tier union types
// Matches: "free" | "plus" | "pro" (in any order, with any subset of 2+)
// Catches both type annotations (: "free" | "plus") and type aliases (= "free" | "plus")
const TIER_UNION_PATTERN = /[=:]\s*["'](free|plus|pro)["']\s*\|\s*["'](free|plus|pro)["']/;

interface Violation {
  file: string;
  line: number;
  message: string;
  code: string;
}

function shouldCheckFile(filePath: string): boolean {
  const fileName = filePath.split("/").pop() || "";

  if (EXCLUDED_FILES.has(fileName)) {
    return false;
  }

  const parts = filePath.split("/");
  if (parts.some((part) => EXCLUDED_DIRS.has(part))) {
    return false;
  }

  return filePath.endsWith(".ts") || filePath.endsWith(".tsx");
}

function checkFile(filePath: string): Violation[] {
  const violations: Violation[] = [];

  let content: string;
  try {
    content = readFileSync(filePath, "utf-8");
  } catch {
    return [
      {
        file: filePath,
        line: 0,
        message: "Could not read file",
        code: "",
      },
    ];
  }

  const lines = content.split("\n");

  for (let lineNum = 0; lineNum < lines.length; lineNum++) {
    const line = lines[lineNum];
    const trimmed = line.trim();

    // Skip comments
    if (trimmed.startsWith("//") || trimmed.startsWith("/*") || trimmed.startsWith("*")) {
      continue;
    }

    // Check for local Language type definitions
    // This catches patterns like: type Language = "japanese" | "english" | "french"
    if (LOCAL_LANGUAGE_TYPE_PATTERN.test(trimmed)) {
      violations.push({
        file: filePath,
        line: lineNum + 1,
        message:
          'Local Language type definition. Import `ContentLanguage` from "@/lib/contentLanguages" instead.',
        code: trimmed.substring(0, 80) + (trimmed.length > 80 ? "..." : ""),
      });
    }

    // Check for hardcoded language union types
    // This catches patterns like: (language: "japanese" | "english" | "french")
    // or (): "japanese" | "english" | "french" =>
    if (LANGUAGE_UNION_PATTERN.test(line) || FULL_UNION_PATTERN.test(line)) {
      // Make sure it's a type annotation, not a value
      // Type annotations have : before the union, values don't
      const isTypeAnnotation =
        /:\s*["'](japanese|english|french)["']/.test(line) ||
        /\)\s*:\s*["'](japanese|english|french)["']/.test(line);

      if (isTypeAnnotation) {
        violations.push({
          file: filePath,
          line: lineNum + 1,
          message:
            'Hardcoded language union type. Use `ContentLanguage` type from "@/lib/contentLanguages" instead.',
          code: trimmed.substring(0, 80) + (trimmed.length > 80 ? "..." : ""),
        });
      }
    }

    // Check for hardcoded tier union types
    // This catches patterns like: (tier: "free" | "plus" | "pro") or type X = "free" | "plus"
    if (TIER_UNION_PATTERN.test(line)) {
      // Make sure it's a type annotation or type alias, not a value
      const isTypeAnnotation =
        /:\s*["'](free|plus|pro)["']/.test(line) ||
        /\)\s*:\s*["'](free|plus|pro)["']/.test(line) ||
        /^type\s+\w+\s*=/.test(trimmed); // type alias

      if (isTypeAnnotation) {
        violations.push({
          file: filePath,
          line: lineNum + 1,
          message: 'Hardcoded tier union type. Use `TierId` type from "@/lib/tiers" instead.',
          code: trimmed.substring(0, 80) + (trimmed.length > 80 ? "..." : ""),
        });
      }
    }
  }

  return violations;
}

function walkDir(dir: string): string[] {
  const files: string[] = [];

  try {
    const entries = readdirSync(dir);

    for (const entry of entries) {
      const fullPath = join(dir, entry);

      if (EXCLUDED_DIRS.has(entry)) {
        continue;
      }

      try {
        const stat = statSync(fullPath);
        if (stat.isDirectory()) {
          files.push(...walkDir(fullPath));
        } else if (stat.isFile()) {
          files.push(fullPath);
        }
      } catch {
        // Skip files we can't stat
      }
    }
  } catch {
    // Skip directories we can't read
  }

  return files;
}

function main() {
  const srcDir = join(import.meta.dir, "..", "src");
  const convexDir = join(import.meta.dir, "..", "convex");

  const allFiles = [...walkDir(srcDir), ...walkDir(convexDir)];

  const filesToCheck = allFiles.filter(shouldCheckFile);
  const allViolations: Violation[] = [];

  for (const file of filesToCheck) {
    const violations = checkFile(file);
    allViolations.push(...violations);
  }

  // Summary
  console.log(`Checked ${filesToCheck.length} TypeScript files`);

  if (allViolations.length > 0) {
    console.log(`\n❌ Found ${allViolations.length} pattern violation(s):\n`);

    for (const v of allViolations) {
      const relPath = relative(join(import.meta.dir, ".."), v.file);
      console.log(`  ${relPath}:${v.line}: ${v.message}`);
      console.log(`    > ${v.code}\n`);
    }

    console.log('Import the ContentLanguage type: import type { ContentLanguage } from "@/lib/contentLanguages";');
    console.log('Import the TierId type: import type { TierId } from "@/lib/tiers";');
    console.log("\nSee docs/DEVELOPMENT.md for correct patterns.");
    process.exit(1);
  } else {
    console.log("✅ No pattern violations found");
    process.exit(0);
  }
}

main();
