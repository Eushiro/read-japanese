/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as ai from "../ai.js";
import type * as aiHelpers from "../aiHelpers.js";
import type * as crons from "../crons.js";
import type * as flashcards from "../flashcards.js";
import type * as http from "../http.js";
import type * as mockTests from "../mockTests.js";
import type * as placementTest from "../placementTest.js";
import type * as progress from "../progress.js";
import type * as scheduledJobs from "../scheduledJobs.js";
import type * as settings from "../settings.js";
import type * as storyComprehension from "../storyComprehension.js";
import type * as storyQuestions from "../storyQuestions.js";
import type * as stripe from "../stripe.js";
import type * as stripeHelpers from "../stripeHelpers.js";
import type * as subscriptions from "../subscriptions.js";
import type * as userSentences from "../userSentences.js";
import type * as users from "../users.js";
import type * as videoData from "../videoData.js";
import type * as vocabulary from "../vocabulary.js";
import type * as youtubeContent from "../youtubeContent.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  ai: typeof ai;
  aiHelpers: typeof aiHelpers;
  crons: typeof crons;
  flashcards: typeof flashcards;
  http: typeof http;
  mockTests: typeof mockTests;
  placementTest: typeof placementTest;
  progress: typeof progress;
  scheduledJobs: typeof scheduledJobs;
  settings: typeof settings;
  storyComprehension: typeof storyComprehension;
  storyQuestions: typeof storyQuestions;
  stripe: typeof stripe;
  stripeHelpers: typeof stripeHelpers;
  subscriptions: typeof subscriptions;
  userSentences: typeof userSentences;
  users: typeof users;
  videoData: typeof videoData;
  vocabulary: typeof vocabulary;
  youtubeContent: typeof youtubeContent;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
