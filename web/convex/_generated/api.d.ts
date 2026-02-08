/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as adaptivePractice from "../adaptivePractice.js";
import type * as adaptivePracticeQueries from "../adaptivePracticeQueries.js";
import type * as admin from "../admin.js";
import type * as ai from "../ai.js";
import type * as ai_assessment from "../ai/assessment.js";
import type * as ai_comprehension from "../ai/comprehension.js";
import type * as ai_core from "../ai/core.js";
import type * as ai_definitions from "../ai/definitions.js";
import type * as ai_flashcards from "../ai/flashcards.js";
import type * as ai_media from "../ai/media.js";
import type * as ai_models from "../ai/models.js";
import type * as ai_providers_google from "../ai/providers/google.js";
import type * as ai_providers_index from "../ai/providers/index.js";
import type * as ai_providers_openrouter from "../ai/providers/openrouter.js";
import type * as ai_providers_types from "../ai/providers/types.js";
import type * as aiHelpers from "../aiHelpers.js";
import type * as batchJobs from "../batchJobs.js";
import type * as contentEngine from "../contentEngine.js";
import type * as contentEngineQueries from "../contentEngineQueries.js";
import type * as contentLibrary from "../contentLibrary.js";
import type * as contentReadiness from "../contentReadiness.js";
import type * as crons from "../crons.js";
import type * as examAttempts from "../examAttempts.js";
import type * as examQuestions from "../examQuestions.js";
import type * as examTemplates from "../examTemplates.js";
import type * as flashcards from "../flashcards.js";
import type * as http from "../http.js";
import type * as learnerModel from "../learnerModel.js";
import type * as lib_admin from "../lib/admin.js";
import type * as lib_audioCompression from "../lib/audioCompression.js";
import type * as lib_brand from "../lib/brand.js";
import type * as lib_contentReuse from "../lib/contentReuse.js";
import type * as lib_difficultyEstimator from "../lib/difficultyEstimator.js";
import type * as lib_generation from "../lib/generation.js";
import type * as lib_gradingProfiles from "../lib/gradingProfiles.js";
import type * as lib_helpers from "../lib/helpers.js";
import type * as lib_imageCompression from "../lib/imageCompression.js";
import type * as lib_models from "../lib/models.js";
import type * as lib_paymentTypes from "../lib/paymentTypes.js";
import type * as lib_promptHelpers from "../lib/promptHelpers.js";
import type * as lib_questionPoolHelpers from "../lib/questionPoolHelpers.js";
import type * as lib_storage from "../lib/storage.js";
import type * as lib_translation from "../lib/translation.js";
import type * as migrations_definitionTranslations from "../migrations/definitionTranslations.js";
import type * as migrations_fixMediaEncoding from "../migrations/fixMediaEncoding.js";
import type * as migrations_fixMediaEncodingActions from "../migrations/fixMediaEncodingActions.js";
import type * as migrations_mediaCleanup from "../migrations/mediaCleanup.js";
import type * as migrations_mediaReorganization from "../migrations/mediaReorganization.js";
import type * as migrations_settingsMigration from "../migrations/settingsMigration.js";
import type * as migrations_storyMigration from "../migrations/storyMigration.js";
import type * as migrations_translationData from "../migrations/translationData.js";
import type * as mockTests from "../mockTests.js";
import type * as onboarding from "../onboarding.js";
import type * as payments from "../payments.js";
import type * as placementTest from "../placementTest.js";
import type * as premadeDecks from "../premadeDecks.js";
import type * as progress from "../progress.js";
import type * as questionPool from "../questionPool.js";
import type * as questionPoolQueries from "../questionPoolQueries.js";
import type * as scheduledJobs from "../scheduledJobs.js";
import type * as settings from "../settings.js";
import type * as shadowing from "../shadowing.js";
import type * as stories from "../stories.js";
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

import type { ApiFromModules, FilterApi, FunctionReference } from "convex/server";

declare const fullApi: ApiFromModules<{
  adaptivePractice: typeof adaptivePractice;
  adaptivePracticeQueries: typeof adaptivePracticeQueries;
  admin: typeof admin;
  ai: typeof ai;
  "ai/assessment": typeof ai_assessment;
  "ai/comprehension": typeof ai_comprehension;
  "ai/core": typeof ai_core;
  "ai/definitions": typeof ai_definitions;
  "ai/flashcards": typeof ai_flashcards;
  "ai/media": typeof ai_media;
  "ai/models": typeof ai_models;
  "ai/providers/google": typeof ai_providers_google;
  "ai/providers/index": typeof ai_providers_index;
  "ai/providers/openrouter": typeof ai_providers_openrouter;
  "ai/providers/types": typeof ai_providers_types;
  aiHelpers: typeof aiHelpers;
  batchJobs: typeof batchJobs;
  contentEngine: typeof contentEngine;
  contentEngineQueries: typeof contentEngineQueries;
  contentLibrary: typeof contentLibrary;
  contentReadiness: typeof contentReadiness;
  crons: typeof crons;
  examAttempts: typeof examAttempts;
  examQuestions: typeof examQuestions;
  examTemplates: typeof examTemplates;
  flashcards: typeof flashcards;
  http: typeof http;
  learnerModel: typeof learnerModel;
  "lib/admin": typeof lib_admin;
  "lib/audioCompression": typeof lib_audioCompression;
  "lib/brand": typeof lib_brand;
  "lib/contentReuse": typeof lib_contentReuse;
  "lib/difficultyEstimator": typeof lib_difficultyEstimator;
  "lib/generation": typeof lib_generation;
  "lib/gradingProfiles": typeof lib_gradingProfiles;
  "lib/helpers": typeof lib_helpers;
  "lib/imageCompression": typeof lib_imageCompression;
  "lib/models": typeof lib_models;
  "lib/paymentTypes": typeof lib_paymentTypes;
  "lib/promptHelpers": typeof lib_promptHelpers;
  "lib/questionPoolHelpers": typeof lib_questionPoolHelpers;
  "lib/storage": typeof lib_storage;
  "lib/translation": typeof lib_translation;
  "migrations/definitionTranslations": typeof migrations_definitionTranslations;
  "migrations/fixMediaEncoding": typeof migrations_fixMediaEncoding;
  "migrations/fixMediaEncodingActions": typeof migrations_fixMediaEncodingActions;
  "migrations/mediaCleanup": typeof migrations_mediaCleanup;
  "migrations/mediaReorganization": typeof migrations_mediaReorganization;
  "migrations/settingsMigration": typeof migrations_settingsMigration;
  "migrations/storyMigration": typeof migrations_storyMigration;
  "migrations/translationData": typeof migrations_translationData;
  mockTests: typeof mockTests;
  onboarding: typeof onboarding;
  payments: typeof payments;
  placementTest: typeof placementTest;
  premadeDecks: typeof premadeDecks;
  progress: typeof progress;
  questionPool: typeof questionPool;
  questionPoolQueries: typeof questionPoolQueries;
  scheduledJobs: typeof scheduledJobs;
  settings: typeof settings;
  shadowing: typeof shadowing;
  stories: typeof stories;
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
export declare const api: FilterApi<typeof fullApi, FunctionReference<any, "public">>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<typeof fullApi, FunctionReference<any, "internal">>;

export declare const components: {};
