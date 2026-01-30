/**
 * i18next configuration (implementation detail)
 * This file should not be imported directly by components
 */

import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";

import brandConfig from "../../../../shared/brand.json";
// Import translation files
import enCommon from "./locales/en/common.json";
import enComprehension from "./locales/en/comprehension.json";
import enCredits from "./locales/en/credits.json";
import enDashboard from "./locales/en/dashboard.json";
import enExamResults from "./locales/en/examResults.json";
import enExams from "./locales/en/exams.json";
import enExamTaking from "./locales/en/examTaking.json";
import enFlashcards from "./locales/en/flashcards.json";
import enFoundations from "./locales/en/foundations.json";
import enGenerate from "./locales/en/generate.json";
import enLanding from "./locales/en/landing.json";
import enLearn from "./locales/en/learn.json";
import enLegal from "./locales/en/legal.json";
import enLibrary from "./locales/en/library.json";
import enMicroReview from "./locales/en/microReview.json";
import enNavigation from "./locales/en/navigation.json";
import enOnboarding from "./locales/en/onboarding.json";
import enPaywall from "./locales/en/paywall.json";
import enPlacement from "./locales/en/placement.json";
import enPractice from "./locales/en/practice.json";
import enPricing from "./locales/en/pricing.json";
import enProgress from "./locales/en/progress.json";
import enQuiz from "./locales/en/quiz.json";
import enReader from "./locales/en/reader.json";
import enSettings from "./locales/en/settings.json";
import enShadowing from "./locales/en/shadowing.json";
import enStudySession from "./locales/en/studySession.json";
import enUsage from "./locales/en/usage.json";
import enVideo from "./locales/en/video.json";
import enVideoQuiz from "./locales/en/videoQuiz.json";
import enVocabulary from "./locales/en/vocabulary.json";
import frCommon from "./locales/fr/common.json";
import frComprehension from "./locales/fr/comprehension.json";
import frCredits from "./locales/fr/credits.json";
import frDashboard from "./locales/fr/dashboard.json";
import frExamResults from "./locales/fr/examResults.json";
import frExams from "./locales/fr/exams.json";
import frExamTaking from "./locales/fr/examTaking.json";
import frFlashcards from "./locales/fr/flashcards.json";
import frFoundations from "./locales/fr/foundations.json";
import frGenerate from "./locales/fr/generate.json";
import frLanding from "./locales/fr/landing.json";
import frLearn from "./locales/fr/learn.json";
import frLegal from "./locales/fr/legal.json";
import frLibrary from "./locales/fr/library.json";
import frMicroReview from "./locales/fr/microReview.json";
import frNavigation from "./locales/fr/navigation.json";
import frOnboarding from "./locales/fr/onboarding.json";
import frPaywall from "./locales/fr/paywall.json";
import frPlacement from "./locales/fr/placement.json";
import frPractice from "./locales/fr/practice.json";
import frPricing from "./locales/fr/pricing.json";
import frProgress from "./locales/fr/progress.json";
import frQuiz from "./locales/fr/quiz.json";
import frReader from "./locales/fr/reader.json";
import frSettings from "./locales/fr/settings.json";
import frShadowing from "./locales/fr/shadowing.json";
import frStudySession from "./locales/fr/studySession.json";
import frUsage from "./locales/fr/usage.json";
import frVideo from "./locales/fr/video.json";
import frVideoQuiz from "./locales/fr/videoQuiz.json";
import frVocabulary from "./locales/fr/vocabulary.json";
import jaCommon from "./locales/ja/common.json";
import jaComprehension from "./locales/ja/comprehension.json";
import jaCredits from "./locales/ja/credits.json";
import jaDashboard from "./locales/ja/dashboard.json";
import jaExamResults from "./locales/ja/examResults.json";
import jaExams from "./locales/ja/exams.json";
import jaExamTaking from "./locales/ja/examTaking.json";
import jaFlashcards from "./locales/ja/flashcards.json";
import jaFoundations from "./locales/ja/foundations.json";
import jaGenerate from "./locales/ja/generate.json";
import jaLanding from "./locales/ja/landing.json";
import jaLearn from "./locales/ja/learn.json";
import jaLegal from "./locales/ja/legal.json";
import jaLibrary from "./locales/ja/library.json";
import jaMicroReview from "./locales/ja/microReview.json";
import jaNavigation from "./locales/ja/navigation.json";
import jaOnboarding from "./locales/ja/onboarding.json";
import jaPaywall from "./locales/ja/paywall.json";
import jaPlacement from "./locales/ja/placement.json";
import jaPractice from "./locales/ja/practice.json";
import jaPricing from "./locales/ja/pricing.json";
import jaProgress from "./locales/ja/progress.json";
import jaQuiz from "./locales/ja/quiz.json";
import jaReader from "./locales/ja/reader.json";
import jaSettings from "./locales/ja/settings.json";
import jaShadowing from "./locales/ja/shadowing.json";
import jaStudySession from "./locales/ja/studySession.json";
import jaUsage from "./locales/ja/usage.json";
import jaVideo from "./locales/ja/video.json";
import jaVideoQuiz from "./locales/ja/videoQuiz.json";
import jaVocabulary from "./locales/ja/vocabulary.json";
import zhCommon from "./locales/zh/common.json";
import zhComprehension from "./locales/zh/comprehension.json";
import zhCredits from "./locales/zh/credits.json";
import zhDashboard from "./locales/zh/dashboard.json";
import zhExamResults from "./locales/zh/examResults.json";
import zhExams from "./locales/zh/exams.json";
import zhExamTaking from "./locales/zh/examTaking.json";
import zhFlashcards from "./locales/zh/flashcards.json";
import zhFoundations from "./locales/zh/foundations.json";
import zhGenerate from "./locales/zh/generate.json";
import zhLanding from "./locales/zh/landing.json";
import zhLearn from "./locales/zh/learn.json";
import zhLegal from "./locales/zh/legal.json";
import zhLibrary from "./locales/zh/library.json";
import zhMicroReview from "./locales/zh/microReview.json";
import zhNavigation from "./locales/zh/navigation.json";
import zhOnboarding from "./locales/zh/onboarding.json";
import zhPaywall from "./locales/zh/paywall.json";
import zhPlacement from "./locales/zh/placement.json";
import zhPractice from "./locales/zh/practice.json";
import zhPricing from "./locales/zh/pricing.json";
import zhProgress from "./locales/zh/progress.json";
import zhQuiz from "./locales/zh/quiz.json";
import zhReader from "./locales/zh/reader.json";
import zhSettings from "./locales/zh/settings.json";
import zhShadowing from "./locales/zh/shadowing.json";
import zhStudySession from "./locales/zh/studySession.json";
import zhUsage from "./locales/zh/usage.json";
import zhVideo from "./locales/zh/video.json";
import zhVideoQuiz from "./locales/zh/videoQuiz.json";
import zhVocabulary from "./locales/zh/vocabulary.json";
import { DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES } from "./types";

const resources = {
  en: {
    common: enCommon,
    credits: enCredits,
    dashboard: enDashboard,
    landing: enLanding,
    legal: enLegal,
    navigation: enNavigation,
    settings: enSettings,
    vocabulary: enVocabulary,
    flashcards: enFlashcards,
    foundations: enFoundations,
    library: enLibrary,
    microReview: enMicroReview,
    practice: enPractice,
    pricing: enPricing,
    exams: enExams,
    examTaking: enExamTaking,
    video: enVideo,
    examResults: enExamResults,
    progress: enProgress,
    comprehension: enComprehension,
    placement: enPlacement,
    learn: enLearn,
    videoQuiz: enVideoQuiz,
    generate: enGenerate,
    reader: enReader,
    studySession: enStudySession,
    usage: enUsage,
    onboarding: enOnboarding,
    paywall: enPaywall,
    quiz: enQuiz,
    shadowing: enShadowing,
  },
  fr: {
    common: frCommon,
    credits: frCredits,
    dashboard: frDashboard,
    landing: frLanding,
    legal: frLegal,
    navigation: frNavigation,
    settings: frSettings,
    vocabulary: frVocabulary,
    flashcards: frFlashcards,
    foundations: frFoundations,
    library: frLibrary,
    microReview: frMicroReview,
    practice: frPractice,
    pricing: frPricing,
    exams: frExams,
    examTaking: frExamTaking,
    video: frVideo,
    examResults: frExamResults,
    progress: frProgress,
    comprehension: frComprehension,
    placement: frPlacement,
    learn: frLearn,
    videoQuiz: frVideoQuiz,
    generate: frGenerate,
    reader: frReader,
    studySession: frStudySession,
    usage: frUsage,
    onboarding: frOnboarding,
    paywall: frPaywall,
    quiz: frQuiz,
    shadowing: frShadowing,
  },
  ja: {
    common: jaCommon,
    credits: jaCredits,
    dashboard: jaDashboard,
    landing: jaLanding,
    legal: jaLegal,
    navigation: jaNavigation,
    settings: jaSettings,
    vocabulary: jaVocabulary,
    flashcards: jaFlashcards,
    foundations: jaFoundations,
    library: jaLibrary,
    microReview: jaMicroReview,
    practice: jaPractice,
    pricing: jaPricing,
    exams: jaExams,
    examTaking: jaExamTaking,
    video: jaVideo,
    examResults: jaExamResults,
    progress: jaProgress,
    comprehension: jaComprehension,
    placement: jaPlacement,
    learn: jaLearn,
    videoQuiz: jaVideoQuiz,
    generate: jaGenerate,
    reader: jaReader,
    studySession: jaStudySession,
    usage: jaUsage,
    onboarding: jaOnboarding,
    paywall: jaPaywall,
    quiz: jaQuiz,
    shadowing: jaShadowing,
  },
  zh: {
    common: zhCommon,
    credits: zhCredits,
    dashboard: zhDashboard,
    landing: zhLanding,
    legal: zhLegal,
    navigation: zhNavigation,
    settings: zhSettings,
    vocabulary: zhVocabulary,
    flashcards: zhFlashcards,
    foundations: zhFoundations,
    library: zhLibrary,
    microReview: zhMicroReview,
    practice: zhPractice,
    pricing: zhPricing,
    exams: zhExams,
    examTaking: zhExamTaking,
    video: zhVideo,
    examResults: zhExamResults,
    progress: zhProgress,
    comprehension: zhComprehension,
    placement: zhPlacement,
    learn: zhLearn,
    videoQuiz: zhVideoQuiz,
    generate: zhGenerate,
    reader: zhReader,
    studySession: zhStudySession,
    usage: zhUsage,
    onboarding: zhOnboarding,
    paywall: zhPaywall,
    quiz: zhQuiz,
    shadowing: zhShadowing,
  },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: DEFAULT_LANGUAGE,
    supportedLngs: SUPPORTED_LANGUAGES,

    // Default namespace
    defaultNS: "common",
    ns: [
      "common",
      "credits",
      "dashboard",
      "landing",
      "legal",
      "navigation",
      "settings",
      "vocabulary",
      "flashcards",
      "foundations",
      "library",
      "microReview",
      "practice",
      "pricing",
      "exams",
      "examTaking",
      "video",
      "examResults",
      "progress",
      "comprehension",
      "placement",
      "learn",
      "videoQuiz",
      "generate",
      "reader",
      "studySession",
      "usage",
      "onboarding",
      "paywall",
      "quiz",
      "shadowing",
    ],

    // Detection options
    detection: {
      order: ["localStorage", "navigator"],
      lookupLocalStorage: "uiLanguage",
      caches: ["localStorage"],
    },

    // Allow returning arrays/objects from translations
    returnObjects: true,

    interpolation: {
      escapeValue: false, // React already escapes
      defaultVariables: {
        brandName: brandConfig.name,
        brandVersion: brandConfig.version,
      },
    },

    react: {
      useSuspense: false, // We handle loading states manually
    },

    // Development helpers
    saveMissing: import.meta.env.DEV,
    missingKeyHandler: import.meta.env.DEV
      ? (lngs, ns, key) => {
          console.warn(`[i18n] Missing translation: ${lngs}/${ns}:${key}`);
        }
      : undefined,
  });

export default i18n;
