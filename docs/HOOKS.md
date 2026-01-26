# Pre-commit Hooks

The repository uses **Husky** for pre-commit hooks that enforce code quality.

## What runs on commit (pre-commit)

1. **Secret detection** - Scans for accidentally committed API keys/credentials
2. **Prettier** - Auto-formats staged files (non-blocking, just fixes)
3. **TypeScript** - `tsc --noEmit` catches type errors
4. **ESLint** - Runs on staged `.ts/.tsx` files, fails on any warnings or errors
5. **i18n validation** - Ensures all translation files have matching keys AND all keys used in code exist
6. **i18n interpolation** - Catches untranslated strings passed to `t()` interpolation (see below)
7. **Convex typecheck** - Validates Convex functions and schema types
8. **Pattern validation** - Checks for hardcoded language types (use `Language` from `@/lib/languages`)
9. **Smoke tests** - Runs `bun test` to verify critical paths aren't broken
10. **Python linting** - Ruff check/format on backend files (if changed)
11. **Claude Code review** - AI review checks for bugs, security issues, and guideline violations

## What runs on commit message (commit-msg)

**Conventional Commits** - Commit messages must follow this format:
```
type: description

# Examples:
feat: add flashcard audio playback
fix: resolve login redirect loop
docs: update API documentation
refactor: simplify session logic
chore: update dependencies
perf: optimize vocabulary query
test: add flashcard review tests
```

Valid types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`, `revert`, `ci`, `build`

---

## If a commit fails

**Secret detected:** Remove the secret, use environment variables instead.

**Type errors:** Fix TypeScript errors in your code.

**ESLint errors:** Run `bun run lint:fix` to auto-fix, or fix manually.

**Convex type errors:** Fix type issues in `web/convex/` files. Run `npx convex typecheck` to see details.

**i18n key mismatch:** Ensure all locale files have the same keys:
- English (`en/`) is the source of truth
- Add missing keys to `ja/`, `fr/`, `zh/` files
- Remove extra keys that don't exist in English
- **Translations must be colloquial and natural** - not literal word-for-word. Each language should sound native to its speakers.

**i18n missing keys:** Keys used in code must exist in translation files:
- Check the error output for the list of missing keys
- Add the missing keys to English (`en/`) locale files first
- Then sync to other locales (`ja/`, `fr/`, `zh/`)

**i18n interpolation error:** Literal strings in `t()` interpolation won't be translated:
```typescript
// BAD - "stories" appears as English in all languages
t("paywall.message", { action: "stories" })

// GOOD - translate the value first
const actionText = t("paywall.features.stories")
t("paywall.message", { action: actionText })

// GOOD - use a variable that's already translated
t("paywall.message", { action: translatedFeatureName })
```
Add translation keys for the interpolated values to all locale files.

**Tests failed:** Fix the failing tests. Run `bun test` to see details.

**Pattern violations:** Use proper types instead of hardcoding:
- Use `Language` type from `@/lib/languages` instead of `"japanese" | "english" | "french"`
- Run `bun run check-patterns` to see details

**Claude Code review blocked:** The review found issues that need attention:
- `BLOCKER:` - Fix the code issue described
- `UPDATE_DOCS:` - Add missing documentation, then re-commit

**Bad commit message:** Use conventional commit format (see above).

---

## Manual validation

```bash
cd web

# Run all checks at once
bun run validate

# Individual checks
bun run typecheck      # TypeScript
bun run lint           # ESLint
bun run format:check   # Prettier (check only)
bun run format         # Prettier (auto-fix)
bun run check-i18n     # Translation keys
bun run check-secrets  # Secret detection
bun run check-patterns # Pattern validation
bun test               # Smoke tests
```

---

## Test files

The smoke tests are located in `web/src/__tests__/`:

```
web/src/__tests__/
  setup.ts                    # Test setup (minimal)
  smoke/
    provider-stack.test.tsx   # Verifies critical files exist
    router.test.ts            # Verifies routes and pages exist
  critical/
    fsrs.test.ts              # FSRS algorithm correctness
    credits.test.ts           # Credit system calculations
```

These tests are designed to be:
- **Fast** (~17ms total)
- **Stable** - Use file existence checks, not dynamic imports
- **Focused** - Only test "would brick the app" scenarios

---

## Key files

- `.husky/pre-commit` - Pre-commit hook script
- `.husky/commit-msg` - Commit message validation
- `web/bunfig.toml` - Bun test configuration
- `web/scripts/check-i18n-keys.ts` - Translation key validator
- `web/eslint-plugin-i18n-interpolation.js` - ESLint rule for i18n interpolation
- `web/.prettierrc` - Prettier configuration
- `web/commitlint.config.js` - Commit message rules
- `web/.secretlintrc.json` - Secret detection rules

**Note:** The i18n validator ignores i18next plural suffixes (`_other`, `_zero`, `_one`, etc.) since these are language-specific.
