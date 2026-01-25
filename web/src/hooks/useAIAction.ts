/**
 * Drop-in replacement for useAction that automatically tracks AI analytics.
 *
 * Usage - completely seamless:
 *   const verifySentence = useAIAction(api.ai.verifySentence);
 *   const result = await verifySentence(args);
 *
 * The operation name is auto-detected from the action reference.
 * Analytics (request start, success with latency, errors) are tracked automatically.
 */

import { useAction } from "convex/react";
import type { FunctionReference } from "convex/server";
import { useCallback, useMemo, useRef } from "react";

import { trackAIError, trackAIRequest, trackAISuccess } from "@/lib/analytics";

type AnyArgs = Record<string, unknown>;

/**
 * Extract operation name from a Convex function reference.
 * Converts "api.ai.verifySentence" → "verify_sentence"
 */
function extractOperationName(actionRef: unknown): string {
  try {
    // Convex function references have internal structure we can inspect
    // Try common patterns for extracting the function name
    const ref = actionRef as Record<string, unknown>;

    // Method 1: Check for _name property (internal Convex property)
    if (typeof ref._name === "string") {
      return camelToSnake(ref._name.split(":").pop() || "unknown");
    }

    // Method 2: Convert to string and parse
    const str = String(actionRef);
    if (str.includes("ai.")) {
      const match = str.match(/ai\.(\w+)/);
      if (match) {
        return camelToSnake(match[1]);
      }
    }

    // Method 3: Check functionName property
    if (typeof ref.functionName === "string") {
      return camelToSnake(ref.functionName.split("/").pop() || "unknown");
    }

    return "unknown_ai_action";
  } catch {
    return "unknown_ai_action";
  }
}

/**
 * Convert camelCase to snake_case
 * "verifySentence" → "verify_sentence"
 */
function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`).replace(/^_/, "");
}

/**
 * Hook that wraps a Convex AI action with automatic analytics tracking.
 * Operation name is auto-detected from the action reference.
 *
 * @param actionRef - The Convex action reference (e.g., api.ai.verifySentence)
 * @param options - Optional overrides for operation name and model
 * @returns A wrapped action function with the same signature
 */
export function useAIAction<Args extends AnyArgs, Result>(
  actionRef: FunctionReference<"action", "public", Args, Result>,
  options?: {
    /** Override the auto-detected operation name */
    operationName?: string;
    /** Model name for tracking (default: "gemini-2.0-flash") */
    model?: string;
  }
) {
  const action = useAction(actionRef);
  const pendingRef = useRef(false);

  // Auto-detect operation name, memoized to avoid re-computation
  const operationName = useMemo(
    () => options?.operationName || extractOperationName(actionRef),
    [actionRef, options?.operationName]
  );
  const model = options?.model || "gemini-2.0-flash";

  const trackedAction = useCallback(
    async (args: Args): Promise<Result> => {
      // Prevent double-tracking if called multiple times rapidly
      if (pendingRef.current) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Convex action call signature
        return (action as any)(args);
      }

      pendingRef.current = true;
      const startTime = Date.now();

      // Track request start
      trackAIRequest(operationName, model, args as Record<string, unknown>);

      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Convex action call signature
        const result = await (action as any)(args);

        // Track success with latency
        const latencyMs = Date.now() - startTime;
        trackAISuccess(operationName, model, latencyMs);

        return result;
      } catch (error) {
        // Track error
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        trackAIError(operationName, model, errorMessage);
        throw error;
      } finally {
        pendingRef.current = false;
      }
    },
    [action, operationName, model]
  );

  return trackedAction;
}

// Re-export for backwards compatibility during migration
export { useAIAction as useTrackedAIAction };
