"use node";

import { v } from "convex/values";

import { internalAction } from "../_generated/server";
import type { DefinitionTranslationMap } from "../lib/translation";
import { type ContentLanguage, languageValidator } from "../schema";
import {
  callWithRetry,
  type CallWithRetryResult,
  callWithRetryTracked,
  type JsonSchema,
  languageNames,
  parseJson,
} from "./core";

// ============================================
// DEFINITION TRANSLATION
// ============================================

/**
 * Translate definitions from English to all UI languages.
 * Used when adding new vocabulary to ensure definitions are available
 * in the user's preferred language.
 */
export const translateDefinitions = internalAction({
  args: {
    word: v.string(),
    definitions: v.array(v.string()), // Source definitions (typically English)
    language: languageValidator, // Word's content language
  },
  returns: v.array(
    v.object({
      en: v.string(),
      ja: v.string(),
      fr: v.string(),
      zh: v.string(),
    })
  ),
  handler: async (_ctx, args): Promise<DefinitionTranslationMap[]> => {
    const languageName = languageNames[args.language];

    const systemPrompt = `You are a language learning assistant that translates vocabulary definitions.
Your task is to translate each definition into all 4 UI languages: English, Japanese, French, and Chinese (Simplified).

Important guidelines:
1. Keep translations concise and appropriate for dictionary entries
2. Preserve the meaning and nuance of the original definition
3. Use natural phrasing in each target language
4. For Japanese, use appropriate kanji with furigana reading when helpful
5. For Chinese, use Simplified Chinese characters

Respond ONLY with valid JSON.`;

    const definitionsList = args.definitions.map((def, i) => `${i + 1}. ${def}`).join("\n");

    const prompt = `Translate the following definitions for the ${languageName} word "${args.word}" into all 4 UI languages.

Original definitions:
${definitionsList}

Provide translations for each definition in this exact JSON format:
{
  "translations": [
    {
      "en": "English definition",
      "ja": "日本語の定義",
      "fr": "définition française",
      "zh": "中文定义"
    }
  ]
}

Make sure to return the same number of translation objects as there are original definitions.`;

    const translationSchema: JsonSchema = {
      name: "definition_translations",
      schema: {
        type: "object",
        properties: {
          translations: {
            type: "array",
            items: {
              type: "object",
              properties: {
                en: { type: "string", description: "English translation" },
                ja: { type: "string", description: "Japanese translation" },
                fr: { type: "string", description: "French translation" },
                zh: { type: "string", description: "Chinese (Simplified) translation" },
              },
              required: ["en", "ja", "fr", "zh"],
              additionalProperties: false,
            },
          },
        },
        required: ["translations"],
        additionalProperties: false,
      },
    };

    interface TranslationResponse {
      translations: DefinitionTranslationMap[];
    }

    const result = await callWithRetry<TranslationResponse>({
      prompt,
      systemPrompt,
      maxTokens: 1500, // Allow for multiple definitions
      jsonSchema: translationSchema,
      parse: (response) => parseJson<TranslationResponse>(response),
      validate: (parsed) => {
        if (!parsed.translations || !Array.isArray(parsed.translations)) {
          return "Missing translations array";
        }
        if (parsed.translations.length !== args.definitions.length) {
          return `Expected ${args.definitions.length} translations, got ${parsed.translations.length}`;
        }
        for (const t of parsed.translations) {
          if (!t.en || !t.ja || !t.fr || !t.zh) {
            return "Missing translation for one or more languages";
          }
        }
        return null;
      },
    });

    return result.translations;
  },
});

/**
 * Translate definitions with usage tracking (for cost monitoring).
 */
export async function translateDefinitionsTracked(args: {
  word: string;
  definitions: string[];
  language: ContentLanguage;
}): Promise<CallWithRetryResult<DefinitionTranslationMap[]>> {
  const languageName = languageNames[args.language];

  const systemPrompt = `You are a language learning assistant that translates vocabulary definitions.
Your task is to translate each definition into all 4 UI languages: English, Japanese, French, and Chinese (Simplified).

Important guidelines:
1. Keep translations concise and appropriate for dictionary entries
2. Preserve the meaning and nuance of the original definition
3. Use natural phrasing in each target language
4. For Japanese, use appropriate kanji with furigana reading when helpful
5. For Chinese, use Simplified Chinese characters

Respond ONLY with valid JSON.`;

  const definitionsList = args.definitions.map((def, i) => `${i + 1}. ${def}`).join("\n");

  const prompt = `Translate the following definitions for the ${languageName} word "${args.word}" into all 4 UI languages.

Original definitions:
${definitionsList}

Provide translations for each definition in this exact JSON format:
{
  "translations": [
    {
      "en": "English definition",
      "ja": "日本語の定義",
      "fr": "définition française",
      "zh": "中文定义"
    }
  ]
}

Make sure to return the same number of translation objects as there are original definitions.`;

  const translationSchema: JsonSchema = {
    name: "definition_translations",
    schema: {
      type: "object",
      properties: {
        translations: {
          type: "array",
          items: {
            type: "object",
            properties: {
              en: { type: "string", description: "English translation" },
              ja: { type: "string", description: "Japanese translation" },
              fr: { type: "string", description: "French translation" },
              zh: { type: "string", description: "Chinese (Simplified) translation" },
            },
            required: ["en", "ja", "fr", "zh"],
            additionalProperties: false,
          },
        },
      },
      required: ["translations"],
      additionalProperties: false,
    },
  };

  interface TranslationResponse {
    translations: DefinitionTranslationMap[];
  }

  const result = await callWithRetryTracked<TranslationResponse>({
    prompt,
    systemPrompt,
    maxTokens: 1500,
    jsonSchema: translationSchema,
    parse: (response) => parseJson<TranslationResponse>(response),
    validate: (parsed) => {
      if (!parsed.translations || !Array.isArray(parsed.translations)) {
        return "Missing translations array";
      }
      if (parsed.translations.length !== args.definitions.length) {
        return `Expected ${args.definitions.length} translations, got ${parsed.translations.length}`;
      }
      for (const t of parsed.translations) {
        if (!t.en || !t.ja || !t.fr || !t.zh) {
          return "Missing translation for one or more languages";
        }
      }
      return null;
    },
  });

  return {
    result: result.result.translations,
    usage: result.usage,
  };
}
