/**
 * Credit Guardrail Test
 *
 * Prevents future AI actions from being added without credit charging.
 * Scans all exported action() functions in web/convex/ai/*.ts and verifies
 * they either call spendCreditsInternal or are in an explicit allowlist.
 *
 * If this test fails, it means a new AI action was added without credit charging.
 * Either add spendCreditsInternal to the action or add it to CREDIT_EXEMPT_ACTIONS.
 */

import { describe, expect, it } from "bun:test";
import { readdirSync, readFileSync } from "fs";
import { join } from "path";

// Actions that intentionally don't charge credits (with reason)
const CREDIT_EXEMPT_ACTIONS: Record<string, string> = {
  "assessment.ts:getNextQuestionDifficulty": "Pure computation, no AI call",
  "comprehension.ts:fetchYoutubeTranscript": "YouTube API, not AI",
  "flashcards.ts:enhancePremadeVocabulary": "Admin content pipeline",
  "flashcards.ts:generateSentenceInternal": "Internal helper called by gated actions",
  "flashcards.ts:verifySentenceInternal": "Internal helper called by gated actions",
  "flashcards.ts:generatePersonalizedStoryInternal": "Internal helper called by gated actions",
  "assessment.ts:gradeExamAnswerInternal": "Internal helper called by batch action",
  "definitions.ts:translateDefinitions": "Internal helper called by gated actions",
  "media.ts:generateTTSAudioAction": "Internal helper called by gated actions",
  "media.ts:generateFlashcardImageAction": "Internal helper called by gated actions",
  "media.ts:generateMultiSpeakerTTSAudioAction": "Internal helper called by gated actions",
};

// Regex to match exported action declarations
// Matches: export const name = action({ or export const name = internalAction({
const ACTION_REGEX = /export\s+const\s+(\w+)\s*=\s*(?:action|internalAction)\s*\(/g;

describe("Credit Guardrail", () => {
  const aiDir = join(__dirname, "../../../convex/ai");
  const aiFiles = readdirSync(aiDir).filter((f) => f.endsWith(".ts"));

  it("finds AI action files", () => {
    expect(aiFiles.length).toBeGreaterThan(0);
  });

  it("all AI actions either charge credits or are explicitly exempt", () => {
    const uncharged: string[] = [];

    for (const file of aiFiles) {
      const filePath = join(aiDir, file);
      const content = readFileSync(filePath, "utf-8");

      // Find all exported actions in this file
      let match;
      ACTION_REGEX.lastIndex = 0;
      while ((match = ACTION_REGEX.exec(content)) !== null) {
        const actionName = match[1];
        const exemptKey = `${file}:${actionName}`;

        // Check if this action is exempt
        if (CREDIT_EXEMPT_ACTIONS[exemptKey]) {
          continue;
        }

        // Check if the action's handler body contains spendCreditsInternal
        // Find the handler body by looking from the action declaration forward
        const actionStart = match.index;
        const remainingContent = content.slice(actionStart);

        if (!remainingContent.includes("spendCreditsInternal")) {
          // Double-check: the spendCreditsInternal might be in a different part of the file
          // but specifically needs to be AFTER this action's declaration and BEFORE the next export
          const nextExportIdx = remainingContent.indexOf(
            "\nexport ",
            100 // Skip past the current export
          );
          const actionBody =
            nextExportIdx > 0 ? remainingContent.slice(0, nextExportIdx) : remainingContent;

          if (!actionBody.includes("spendCreditsInternal")) {
            uncharged.push(
              `${file}:${actionName} — missing spendCreditsInternal call. ` +
                `Either add credit charging or add to CREDIT_EXEMPT_ACTIONS with a reason.`
            );
          }
        }
      }
    }

    if (uncharged.length > 0) {
      throw new Error(
        `Found ${uncharged.length} AI action(s) without credit charging:\n\n` +
          uncharged.map((u) => `  - ${u}`).join("\n") +
          "\n\nSee docs/DEVELOPMENT.md 'Credit System' section for instructions."
      );
    }
  });

  it("all exempt actions actually exist in the codebase", () => {
    const missing: string[] = [];

    for (const [key, reason] of Object.entries(CREDIT_EXEMPT_ACTIONS)) {
      const [file, actionName] = key.split(":");
      const filePath = join(aiDir, file);

      try {
        const content = readFileSync(filePath, "utf-8");
        const pattern = new RegExp(
          `export\\s+const\\s+${actionName}\\s*=\\s*(?:action|internalAction)\\s*\\(`
        );
        if (!pattern.test(content)) {
          missing.push(`${key} (reason: ${reason}) — not found in ${file}`);
        }
      } catch {
        missing.push(`${key} (reason: ${reason}) — file ${file} not found`);
      }
    }

    if (missing.length > 0) {
      throw new Error(
        `Found ${missing.length} stale entries in CREDIT_EXEMPT_ACTIONS:\n\n` +
          missing.map((m) => `  - ${m}`).join("\n") +
          "\n\nRemove these entries from the allowlist."
      );
    }
  });
});
