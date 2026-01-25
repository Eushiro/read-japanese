#!/usr/bin/env bun
/**
 * Validates that all translation files have the same keys.
 * Compares each locale against English (en) as the reference.
 *
 * Checks performed:
 * 1. Keys match across all locale files (always runs, blocking)
 * 2. Keys used in code exist in translation files (always runs, blocking)
 * 3. Unused keys in translation files (--check-unused flag, informational)
 */

import { existsSync, readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";

const LOCALES_DIR = join(import.meta.dir, "../src/lib/i18n/locales");
const REFERENCE_LOCALE = "en";

// i18next plural suffixes to ignore when comparing keys
const PLURAL_SUFFIXES = ["_zero", "_one", "_two", "_few", "_many", "_other"];

interface KeyDiff {
  missing: string[];
  extra: string[];
}

function getBaseKey(key: string): string {
  for (const suffix of PLURAL_SUFFIXES) {
    if (key.endsWith(suffix)) {
      return key.slice(0, -suffix.length);
    }
  }
  return key;
}

function normalizeKeys(keys: string[]): string[] {
  // Convert plural variants to base keys
  return [...new Set(keys.map(getBaseKey))].sort();
}

function getAllKeys(obj: Record<string, unknown>, prefix = ""): string[] {
  const keys: string[] = [];
  for (const key of Object.keys(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    const value = obj[key];
    if (value && typeof value === "object" && !Array.isArray(value)) {
      keys.push(...getAllKeys(value as Record<string, unknown>, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys.sort();
}

function compareKeys(reference: string[], target: string[]): KeyDiff {
  const refSet = new Set(reference);
  const targetSet = new Set(target);

  return {
    missing: reference.filter((k) => !targetSet.has(k)),
    extra: target.filter((k) => !refSet.has(k)),
  };
}

function main() {
  const locales = readdirSync(LOCALES_DIR).filter((f) =>
    readdirSync(join(LOCALES_DIR, f)).some((file) => file.endsWith(".json"))
  );

  if (!locales.includes(REFERENCE_LOCALE)) {
    console.error(`Reference locale '${REFERENCE_LOCALE}' not found`);
    process.exit(1);
  }

  // Get all namespace files from reference locale
  const referenceDir = join(LOCALES_DIR, REFERENCE_LOCALE);
  const namespaces = readdirSync(referenceDir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(".json", ""));

  let hasErrors = false;
  const errors: string[] = [];

  for (const namespace of namespaces) {
    const refPath = join(referenceDir, `${namespace}.json`);
    const refContent = JSON.parse(readFileSync(refPath, "utf-8"));
    const refKeys = normalizeKeys(getAllKeys(refContent));

    for (const locale of locales) {
      if (locale === REFERENCE_LOCALE) continue;

      const targetPath = join(LOCALES_DIR, locale, `${namespace}.json`);

      try {
        const targetContent = JSON.parse(readFileSync(targetPath, "utf-8"));
        const targetKeys = normalizeKeys(getAllKeys(targetContent));
        const diff = compareKeys(refKeys, targetKeys);

        if (diff.missing.length > 0) {
          hasErrors = true;
          errors.push(
            `\n${locale}/${namespace}.json is missing ${diff.missing.length} key(s):`
          );
          diff.missing.forEach((k) => errors.push(`  - ${k}`));
        }

        if (diff.extra.length > 0) {
          hasErrors = true;
          errors.push(
            `\n${locale}/${namespace}.json has ${diff.extra.length} extra key(s):`
          );
          diff.extra.forEach((k) => errors.push(`  + ${k}`));
        }
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code === "ENOENT") {
          hasErrors = true;
          errors.push(`\n${locale}/${namespace}.json is missing entirely`);
        } else {
          throw e;
        }
      }
    }
  }

  // Also check if other locales have namespaces that reference doesn't have
  for (const locale of locales) {
    if (locale === REFERENCE_LOCALE) continue;

    const localeDir = join(LOCALES_DIR, locale);
    const localeNamespaces = readdirSync(localeDir)
      .filter((f) => f.endsWith(".json"))
      .map((f) => f.replace(".json", ""));

    for (const ns of localeNamespaces) {
      if (!namespaces.includes(ns)) {
        hasErrors = true;
        errors.push(
          `\n${locale}/${ns}.json exists but ${REFERENCE_LOCALE}/${ns}.json does not`
        );
      }
    }
  }

  if (hasErrors) {
    console.error("i18n key validation failed:");
    errors.forEach((e) => console.error(e));
    console.error(
      "\nPlease ensure all translation files have the same keys as the English (en) reference."
    );
    process.exit(1);
  }

  console.log("✓ All translation files have matching keys");

  // Check for missing keys (used in code but not defined) - always runs, blocking
  const missingKeysResult = checkMissingKeys(referenceDir, namespaces);
  if (missingKeysResult.hasMissing) {
    process.exit(1);
  }

  // Check for unused keys if --check-unused flag is passed (informational only)
  if (process.argv.includes("--check-unused")) {
    checkUnusedKeys(referenceDir, namespaces);
  }
}

/**
 * Recursively get all files in a directory
 */
function getAllFiles(dir: string, extensions: string[]): string[] {
  const files: string[] = [];

  if (!existsSync(dir)) return files;

  const items = readdirSync(dir);
  for (const item of items) {
    const fullPath = join(dir, item);
    if (!existsSync(fullPath)) continue;

    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      // Skip node_modules, dist, and other non-source directories
      if (["node_modules", "dist", ".git", "locales"].includes(item)) continue;
      files.push(...getAllFiles(fullPath, extensions));
    } else if (extensions.some((ext) => item.endsWith(ext))) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Extract all translation keys used in a file
 */
function extractUsedKeys(content: string): string[] {
  const keys: string[] = [];

  // Match t("key") and t('key') - skip template literals as they're dynamic
  const tFunctionRegex = /\bt\s*\(\s*["']([^"']+)["']/g;
  let match;
  while ((match = tFunctionRegex.exec(content)) !== null) {
    keys.push(match[1]);
  }

  // Match useT hook calls with variables like t(someKey) - skip these
  // Match labelKey: "key" patterns (used in router.tsx)
  const labelKeyRegex = /labelKey:\s*["'`]([^"'`]+)["'`]/g;
  while ((match = labelKeyRegex.exec(content)) !== null) {
    keys.push(match[1]);
  }

  return keys;
}

/**
 * Check for missing translation keys (used in code but not defined)
 * Returns { hasMissing: boolean } - blocking check
 */
function checkMissingKeys(
  referenceDir: string,
  namespaces: string[]
): { hasMissing: boolean } {
  const srcDir = join(import.meta.dir, "../src");
  const sourceFiles = getAllFiles(srcDir, [".tsx", ".ts"]);

  // Collect all used keys from source files
  const usedKeys = new Set<string>();
  for (const file of sourceFiles) {
    const content = readFileSync(file, "utf-8");
    const keys = extractUsedKeys(content);
    keys.forEach((k) => usedKeys.add(k));
  }

  // Check for keys using colon separator instead of dot (wrong format)
  const colonKeys = [...usedKeys].filter((k) => k.includes(":"));
  if (colonKeys.length > 0) {
    console.error(`\n✗ Found ${colonKeys.length} key(s) using colon separator instead of dot:`);
    colonKeys.sort().forEach((k) => console.error(`  - "${k}" should be "${k.replace(":", ".")}"`));
    console.error("\nUse dot (.) as namespace separator, not colon (:).");
    return { hasMissing: true };
  }

  // Collect all defined keys from reference locale (with namespace prefix)
  const definedKeys = new Set<string>();
  for (const namespace of namespaces) {
    const refPath = join(referenceDir, `${namespace}.json`);
    const refContent = JSON.parse(readFileSync(refPath, "utf-8"));
    const keys = getAllKeys(refContent);
    // Add namespace prefix to match how keys are used in code: t('namespace.key')
    keys.forEach((k) => definedKeys.add(`${namespace}.${k}`));
  }

  // Find missing keys (used in code but not defined)
  const missingKeys = [...usedKeys].filter((k) => {
    // Skip keys that look like dynamic/computed keys (contain variables)
    if (k.includes("${") || k.includes("{{")) return false;

    // Skip incomplete keys from string concatenation like t("prefix." + variable)
    if (k.endsWith(".")) return false;

    // Check if the exact key is defined
    if (definedKeys.has(k)) return false;

    // Check for plural forms - if any variant is defined, consider it defined
    const baseKey = getBaseKey(k);
    if (baseKey !== k && definedKeys.has(baseKey)) return false;

    for (const suffix of PLURAL_SUFFIXES) {
      if (definedKeys.has(k + suffix)) return false;
    }

    // Check if the namespace exists
    const dotIndex = k.indexOf(".");
    if (dotIndex === -1) return false; // No namespace, skip

    return true;
  });

  // Separate missing keys into unknown namespaces vs missing keys in known namespaces
  const unknownNamespaceKeys = missingKeys.filter((k) => {
    const dotIndex = k.indexOf(".");
    if (dotIndex === -1) return false;
    const namespace = k.substring(0, dotIndex);
    return !namespaces.includes(namespace);
  });

  const missingInKnownNamespaces = missingKeys.filter((k) => {
    const dotIndex = k.indexOf(".");
    if (dotIndex === -1) return false;
    const namespace = k.substring(0, dotIndex);
    return namespaces.includes(namespace);
  });

  let hasErrors = false;

  if (unknownNamespaceKeys.length > 0) {
    hasErrors = true;
    console.error(`\n✗ Found ${unknownNamespaceKeys.length} key(s) using unknown namespace(s):`);
    unknownNamespaceKeys.sort().forEach((k) => {
      const namespace = k.substring(0, k.indexOf("."));
      console.error(`  - "${k}" (namespace "${namespace}" does not exist)`);
    });
    console.error("\nCreate the missing namespace file(s) in src/lib/i18n/locales/en/");
  }

  if (missingInKnownNamespaces.length > 0) {
    hasErrors = true;
    console.error(`\n✗ Found ${missingInKnownNamespaces.length} missing translation key(s):`);
    missingInKnownNamespaces.sort().forEach((k) => console.error(`  - ${k}`));
    console.error(
      "\nThese keys are used in code but not defined in translation files."
    );
    console.error("Add them to the English (en) locale files first, then sync to other locales.");
  }

  if (hasErrors) {
    return { hasMissing: true };
  }

  console.log("✓ All translation keys used in code are defined");
  return { hasMissing: false };
}

/**
 * Check for unused translation keys
 */
function checkUnusedKeys(referenceDir: string, namespaces: string[]) {
  console.log("\nChecking for unused translation keys...");

  const srcDir = join(import.meta.dir, "../src");
  const sourceFiles = getAllFiles(srcDir, [".tsx", ".ts"]);

  // Collect all used keys from source files
  const usedKeys = new Set<string>();
  for (const file of sourceFiles) {
    const content = readFileSync(file, "utf-8");
    const keys = extractUsedKeys(content);
    keys.forEach((k) => usedKeys.add(k));
  }

  // Collect all defined keys from reference locale (with namespace prefix)
  const definedKeys = new Set<string>();
  for (const namespace of namespaces) {
    const refPath = join(referenceDir, `${namespace}.json`);
    const refContent = JSON.parse(readFileSync(refPath, "utf-8"));
    const keys = getAllKeys(refContent);
    // Add namespace prefix to match how keys are used in code: t('namespace.key')
    keys.forEach((k) => definedKeys.add(`${namespace}.${k}`));
  }

  // Find unused keys
  const unusedKeys = [...definedKeys].filter((k) => {
    // Check if the exact key is used
    if (usedKeys.has(k)) return false;

    // Check for plural forms - if base key exists, any variant is "used"
    const baseKey = getBaseKey(k);
    if (baseKey !== k && usedKeys.has(baseKey)) return false;

    // Check if this is a plural variant and the base form is used
    for (const suffix of PLURAL_SUFFIXES) {
      if (usedKeys.has(k + suffix)) return false;
    }

    return true;
  });

  if (unusedKeys.length > 0) {
    console.log(`\n⚠️  Found ${unusedKeys.length} potentially unused translation key(s):`);
    unusedKeys.sort().forEach((k) => console.log(`  - ${k}`));
    console.log("\nNote: Some keys may be used dynamically and not detected by static analysis.");
    // Don't exit with error - this is informational only
  } else {
    console.log("✓ No unused translation keys found");
  }
}

main();
