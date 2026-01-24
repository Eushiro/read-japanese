/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin from "../admin.js";
import type * as ai from "../ai.js";
import type * as ai_assessment from "../ai/assessment.js";
import type * as ai_comprehension from "../ai/comprehension.js";
import type * as ai_core from "../ai/core.js";
import type * as ai_flashcards from "../ai/flashcards.js";
import type * as ai_media from "../ai/media.js";
import type * as aiHelpers from "../aiHelpers.js";
import type * as batchJobs from "../batchJobs.js";
import type * as contentLibrary from "../contentLibrary.js";
import type * as crons from "../crons.js";
import type * as examAttempts from "../examAttempts.js";
import type * as examQuestions from "../examQuestions.js";
import type * as examTemplates from "../examTemplates.js";
import type * as flashcards from "../flashcards.js";
import type * as http from "../http.js";
import type * as learnerModel from "../learnerModel.js";
import type * as lib_admin from "../lib/admin.js";
import type * as lib_contentReuse from "../lib/contentReuse.js";
import type * as lib_generation from "../lib/generation.js";
import type * as lib_gradingProfiles from "../lib/gradingProfiles.js";
import type * as lib_helpers from "../lib/helpers.js";
import type * as lib_imageCompression from "../lib/imageCompression.js";
import type * as lib_models from "../lib/models.js";
import type * as lib_paymentTypes from "../lib/paymentTypes.js";
import type * as lib_storage from "../lib/storage.js";
import type * as lib_translation from "../lib/translation.js";
import type * as migrations_settingsMigration from "../migrations/settingsMigration.js";
import type * as mockTests from "../mockTests.js";
import type * as payments from "../payments.js";
import type * as placementTest from "../placementTest.js";
import type * as premadeDecks from "../premadeDecks.js";
import type * as progress from "../progress.js";
import type * as scheduledJobs from "../scheduledJobs.js";
import type * as settings from "../settings.js";
import type * as shadowing from "../shadowing.js";
import type * as storyComprehension from "../storyComprehension.js";
import type * as storyQuestions from "../storyQuestions.js";
import type * as stripe from "../stripe.js";
import type * as stripeHelpers from "../stripeHelpers.js";
import type * as subscriptions from "../subscriptions.js";
import type * as userDeckSubscriptions from "../userDeckSubscriptions.js";
import type * as userSentences from "../userSentences.js";
import type * as users from "../users.js";
import type * as videoData from "../videoData.js";
import type * as videoQuestions from "../videoQuestions.js";
import type * as vocabulary from "../vocabulary.js";
import type * as youtubeContent from "../youtubeContent.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  ai: typeof ai;
  "ai/assessment": typeof ai_assessment;
  "ai/comprehension": typeof ai_comprehension;
  "ai/core": typeof ai_core;
  "ai/flashcards": typeof ai_flashcards;
  "ai/media": typeof ai_media;
  aiHelpers: typeof aiHelpers;
  batchJobs: typeof batchJobs;
  contentLibrary: typeof contentLibrary;
  crons: typeof crons;
  examAttempts: typeof examAttempts;
  examQuestions: typeof examQuestions;
  examTemplates: typeof examTemplates;
  flashcards: typeof flashcards;
  http: typeof http;
  learnerModel: typeof learnerModel;
  "lib/admin": typeof lib_admin;
  "lib/contentReuse": typeof lib_contentReuse;
  "lib/generation": typeof lib_generation;
  "lib/gradingProfiles": typeof lib_gradingProfiles;
  "lib/helpers": typeof lib_helpers;
  "lib/imageCompression": typeof lib_imageCompression;
  "lib/models": typeof lib_models;
  "lib/paymentTypes": typeof lib_paymentTypes;
  "lib/storage": typeof lib_storage;
  "lib/translation": typeof lib_translation;
  "migrations/settingsMigration": typeof migrations_settingsMigration;
  mockTests: typeof mockTests;
  payments: typeof payments;
  placementTest: typeof placementTest;
  premadeDecks: typeof premadeDecks;
  progress: typeof progress;
  scheduledJobs: typeof scheduledJobs;
  settings: typeof settings;
  shadowing: typeof shadowing;
  storyComprehension: typeof storyComprehension;
  storyQuestions: typeof storyQuestions;
  stripe: typeof stripe;
  stripeHelpers: typeof stripeHelpers;
  subscriptions: typeof subscriptions;
  userDeckSubscriptions: typeof userDeckSubscriptions;
  userSentences: typeof userSentences;
  users: typeof users;
  videoData: typeof videoData;
  videoQuestions: typeof videoQuestions;
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
