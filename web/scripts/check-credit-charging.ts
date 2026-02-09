#!/usr/bin/env bun
/**
 * Credit charging guardrail for SanLang Convex actions.
 *
 * Scans all public `action()` exports in web/convex/ and verifies that any
 * action calling AI generation also:
 *   1. Checks auth via ctx.auth.getUserIdentity()
 *   2. Charges credits via spendCreditsInternal
 *
 * Run: bun run scripts/check-credit-charging.ts
 */

import { readdirSync, readFileSync, statSync } from "fs";
import { join, relative } from "path";

// ============================================
// CONFIGURATION
// ============================================

// Directories/files to exclude from scanning
const EXCLUDED_DIRS = new Set(["_generated", "lib", "node_modules"]);
const EXCLUDED_FILES = new Set(["check-credit-charging.ts"]);

// Actions that legitimately skip credits (with reason)
const ALLOWLIST: Record<string, string> = {
  "adaptivePractice.ts:generateForModel":
    "Admin-only model testing action (has isAdminEmail check)",
  "stories.ts:generatePersonalized":
    "Delegates to internal.lib.generation.generatePersonalizedMicroStory which charges credits",
};

// Patterns that indicate AI generation is happening
const AI_GENERATION_PATTERNS = [
  /generateAndParse\s*[<(]/,
  /callWithRetry(?:Tracked)?\s*\(/,
  /ctx\.runAction\(\s*internal\.ai\./,
  /ctx\.runAction\(\s*internal\.lib\.generation\./,
  /fetch\(\s*["'`]https:\/\/openrouter\.ai/,
  /fetch\(\s*["'`]https:\/\/generativelanguage\.googleapis\.com/,
];

// Patterns that indicate credit charging
const CREDIT_CHARGE_PATTERN = /spendCreditsInternal/;

// Patterns that indicate auth checking
const AUTH_CHECK_PATTERN = /ctx\.auth\.getUserIdentity\s*\(/;

// ============================================
// TYPES
// ============================================

interface Violation {
  file: string;
  line: number;
  actionName: string;
  missing: string[];
}

// ============================================
// FILE WALKER
// ============================================

function walkDir(dir: string): string[] {
  const files: string[] = [];
  try {
    const entries = readdirSync(dir);
    for (const entry of entries) {
      if (EXCLUDED_DIRS.has(entry)) continue;
      const fullPath = join(dir, entry);
      try {
        const stat = statSync(fullPath);
        if (stat.isDirectory()) {
          files.push(...walkDir(fullPath));
        } else if (stat.isFile() && entry.endsWith(".ts") && !EXCLUDED_FILES.has(entry)) {
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

// ============================================
// ACTION PARSER
// ============================================

/**
 * Find all `export const X = action({` in a file and return
 * { name, startLine, bodyText } for each.
 */
function findPublicActions(
  content: string
): Array<{ name: string; startLine: number; body: string }> {
  const actions: Array<{ name: string; startLine: number; body: string }> = [];
  const lines = content.split("\n");

  // Match only public action() — not internalAction()
  const pattern = /^export\s+const\s+(\w+)\s*=\s*action\s*\(/;

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(pattern);
    if (!match) continue;

    const name = match[1];
    const startLine = i + 1; // 1-indexed

    // Extract the body: from this line to the next `export const` or EOF
    let endIdx = content.length;
    const startCharIdx = content.split("\n").slice(0, i).join("\n").length;

    // Find the next export statement after the current one
    for (let j = i + 1; j < lines.length; j++) {
      if (/^export\s+(const|function|type|interface)\s/.test(lines[j])) {
        endIdx = content.split("\n").slice(0, j).join("\n").length;
        break;
      }
    }

    const body = content.slice(startCharIdx, endIdx);
    actions.push({ name, startLine, body });
  }

  return actions;
}

// ============================================
// CHECKER
// ============================================

function checkFile(filePath: string, convexDir: string): Violation[] {
  const violations: Violation[] = [];

  let content: string;
  try {
    content = readFileSync(filePath, "utf-8");
  } catch {
    return [];
  }

  const relPath = relative(convexDir, filePath);
  const actions = findPublicActions(content);

  for (const action of actions) {
    const allowKey = `${relPath}:${action.name}`;
    if (ALLOWLIST[allowKey]) continue;

    // Check if this action calls any AI generation
    const hasAIGeneration = AI_GENERATION_PATTERNS.some((pattern) => pattern.test(action.body));
    if (!hasAIGeneration) continue;

    // It calls AI — check for credit charging and auth
    const missing: string[] = [];

    if (!CREDIT_CHARGE_PATTERN.test(action.body)) {
      missing.push("spendCreditsInternal call");
    }

    if (!AUTH_CHECK_PATTERN.test(action.body)) {
      missing.push("ctx.auth.getUserIdentity() check");
    }

    if (missing.length > 0) {
      violations.push({
        file: filePath,
        line: action.startLine,
        actionName: action.name,
        missing,
      });
    }
  }

  return violations;
}

// ============================================
// MAIN
// ============================================

function main() {
  const convexDir = join(import.meta.dir, "..", "convex");
  const allFiles = walkDir(convexDir);
  const allViolations: Violation[] = [];

  for (const file of allFiles) {
    const violations = checkFile(file, convexDir);
    allViolations.push(...violations);
  }

  console.log(`Checked ${allFiles.length} Convex action files`);

  if (allViolations.length > 0) {
    console.log(`\n❌ Found ${allViolations.length} credit charging violation(s):\n`);

    for (const v of allViolations) {
      const relPath = relative(join(import.meta.dir, ".."), v.file);
      console.log(
        `  ${relPath}:${v.line}: Action "${v.actionName}" calls AI generation but is missing guardrails`
      );
      console.log(`    Missing: ${v.missing.join(", ")}\n`);
    }

    console.log("All public action() exports that call AI generation must:");
    console.log("  1. Check auth: ctx.auth.getUserIdentity()");
    console.log("  2. Charge credits: spendCreditsInternal");
    console.log("\nSee docs/DEVELOPMENT.md 'Credit System' section for instructions.");
    process.exit(1);
  } else {
    console.log("✅ No credit charging violations found");
    process.exit(0);
  }
}

main();
