import js from "@eslint/js";
import globals from "globals";
import reactCompiler from "eslint-plugin-react-compiler";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";
import i18next from "eslint-plugin-i18next";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import i18nInterpolation from "./eslint-plugin-i18n-interpolation.js";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
  globalIgnores(["dist", "convex/_generated"]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    plugins: {
      "react-compiler": reactCompiler,
      "simple-import-sort": simpleImportSort,
    },
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      // React Compiler - warn on patterns that prevent optimization
      "react-compiler/react-compiler": "error",

      // Import sorting - auto-fixable
      "simple-import-sort/imports": "error",
      "simple-import-sort/exports": "error",

      // Stricter TypeScript
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],

      // No console.log (allow warn/error for legitimate logging)
      "no-console": ["error", { allow: ["warn", "error"] }],

      // Prevent common mistakes
      "no-debugger": "error",
      eqeqeq: ["error", "always"],
      "no-var": "error",
      "prefer-const": "error",
    },
  },
  // Enforce analytics abstraction - no direct PostHog usage
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/lib/analytics.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["posthog-js", "posthog-js/*"],
              message: "Use @/lib/analytics instead of PostHog directly.",
            },
          ],
        },
      ],
    },
  },
  // Enforce i18n abstraction - no direct react-i18next usage
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/lib/i18n/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["react-i18next", "react-i18next/*", "i18next", "i18next/*"],
              message: "Use @/lib/i18n (useT, useI18n, t) instead of react-i18next directly.",
            },
          ],
        },
      ],
    },
  },
  // Enforce useAIAction for AI actions - automatic analytics tracking
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/hooks/useAIAction.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "CallExpression[callee.name='useAction'][arguments.0.object.object.name='api'][arguments.0.object.property.name='ai']",
          message:
            "Use useAIAction from @/hooks/useAIAction instead of useAction for AI actions. It provides automatic analytics tracking.",
        },
      ],
    },
  },
  // i18n interpolation - catch untranslated strings passed to t() interpolation
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: {
      "i18n-interpolation": i18nInterpolation,
    },
    rules: {
      "i18n-interpolation/no-literal-interpolation": [
        "error",
        {
          // Parameters that are allowed to have literal strings
          // ns: i18next namespace configuration
          // format, style, currency: formatting hints
          allowedParams: ["ns", "format", "style", "currency"],
        },
      ],
    },
  },
  // i18n linting - error on hardcoded strings in JSX (excludes admin pages)
  {
    files: ["src/**/*.tsx"],
    ignores: ["src/**/admin/**", "src/components/admin/**", "src/pages/admin/**"],
    plugins: {
      i18next: i18next,
    },
    rules: {
      "i18next/no-literal-string": [
        "error",
        {
          mode: "jsx-text-only",
          "jsx-attributes": {
            include: ["alt", "aria-label", "aria-placeholder", "placeholder", "title"],
            exclude: [
              "className",
              "class",
              "style",
              "href",
              "to",
              "src",
              "name",
              "id",
              "data-*",
              "key",
              "type",
              "role",
              "htmlFor",
              "target",
              "rel",
              "method",
              "action",
              "variant",
              "size",
              "asChild",
              "mode",
              "side",
              "align",
              "sideOffset",
              "alignOffset",
            ],
          },
          words: {
            exclude: [
              // Single characters and symbols (escape regex special chars: | . * + ?)
              "/",
              "\\|",
              "-",
              "•",
              "→",
              "←",
              "×",
              "\\+",
              "&",
              "@",
              ":",
              ",",
              "\\.",
              "!",
              "\\?",
              "\\*",
              "#",
              "~",
              // Numbers (standalone)
              "[0-9]+",
              // Emojis (common ones used in app)
              "🎉",
              "✓",
              "✗",
              "⭐",
              "🔥",
              "💪",
              // Ruby text parentheses
              "\\(",
              "\\)",
              // Technical values
              "N/A",
              "px",
              "em",
              "rem",
              "%",
              "auto",
              "none",
              "inherit",
              // Common technical strings
              "GET",
              "POST",
              "PUT",
              "DELETE",
              "PATCH",
              // Time formats
              "HH:mm",
              "mm:ss",
              "YYYY-MM-DD",
            ],
          },
          // Ignore object keys and certain patterns
          "should-validate-template": false,
        },
      ],
    },
  },
  // Ban hardcoded AI model names outside of centralized model file
  // All model configuration must be defined ONLY in lib/models.ts
  {
    files: ["convex/**/*.ts", "scripts/**/*.ts"],
    ignores: ["convex/lib/models.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "Literal[value=/^(google\\/)?gemini|moonshotai\\/|anthropic\\/claude|gpt-audio/]",
          message:
            "Import model constants from lib/models.ts instead (e.g., TEXT_MODELS, AUDIO_MODELS, IMAGE_MODELS).",
        },
      ],
    },
  },
  // Allow console.log in Convex backend files (server-side logging)
  {
    files: ["convex/**/*.ts"],
    rules: {
      "no-console": "off",
    },
  },
  // Allow console.log in scripts (CLI tools)
  {
    files: ["scripts/**/*.ts"],
    rules: {
      "no-console": "off",
    },
  },
  // Disable react-refresh for non-component files (hooks, contexts, utilities)
  // Also allow exporting types/constants alongside components
  {
    files: [
      "src/hooks/**/*.ts",
      "src/contexts/**/*.tsx",
      "src/lib/**/*.ts",
      "src/components/ui/**/*.tsx",
      "src/components/library/**/*.tsx",
      "src/components/ThemeProvider.tsx",
    ],
    rules: {
      "react-refresh/only-export-components": "off",
    },
  },
]);
