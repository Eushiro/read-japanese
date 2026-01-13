import Foundation
import PostHog

/// Analytics service using PostHog for event tracking and session recording
final class AnalyticsService {
    static let shared = AnalyticsService()

    private init() {}

    // MARK: - Configuration

    /// Initialize PostHog with your API key
    /// Call this in your App's init or AppDelegate
    func configure() {
        let config = PostHogConfig(
            apiKey: AnalyticsConfig.apiKey,
            host: AnalyticsConfig.host
        )
        config.captureScreenViews = true
        config.captureApplicationLifecycleEvents = true
        // Session replay disabled - causes SwiftUI view hierarchy warnings
        config.sessionReplay = false

        PostHogSDK.shared.setup(config)
    }

    // MARK: - User Identification

    /// Identify a user after login
    func identify(userId: String, properties: [String: Any]? = nil) {
        PostHogSDK.shared.identify(userId, userProperties: properties)
    }

    /// Reset user identity on logout
    func reset() {
        PostHogSDK.shared.reset()
    }

    // MARK: - Event Tracking

    /// Track a custom event
    func track(_ event: AnalyticsEvent, properties: [String: Any]? = nil) {
        PostHogSDK.shared.capture(event.rawValue, properties: properties)
    }

    // MARK: - Screen Tracking

    /// Track screen view
    func trackScreen(_ screen: String, properties: [String: Any]? = nil) {
        PostHogSDK.shared.screen(screen, properties: properties)
    }

    // MARK: - Feature Flags

    /// Check if a feature flag is enabled
    func isFeatureEnabled(_ flag: String) -> Bool {
        PostHogSDK.shared.isFeatureEnabled(flag)
    }

    /// Get feature flag value
    func getFeatureFlag(_ flag: String) -> Any? {
        PostHogSDK.shared.getFeatureFlagPayload(flag)
    }
}

// MARK: - Analytics Events

enum AnalyticsEvent: String {
    // App lifecycle
    case appOpened = "app_opened"
    case appBackgrounded = "app_backgrounded"

    // Library
    case libraryViewed = "library_viewed"
    case storySelected = "story_selected"
    case storyFilterChanged = "story_filter_changed"

    // Reader
    case readerOpened = "reader_opened"
    case readerClosed = "reader_closed"
    case chapterChanged = "chapter_changed"
    case readingModeChanged = "reading_mode_changed"
    case furiganaToggled = "furigana_toggled"

    // Word interactions
    case wordTapped = "word_tapped"
    case wordAddedToVocabulary = "word_added_to_vocabulary"
    case wordRemovedFromVocabulary = "word_removed_from_vocabulary"

    // Audio
    case audioPlayed = "audio_played"
    case audioPaused = "audio_paused"
    case audioScrubbed = "audio_scrubbed"
    case audioCompleted = "audio_completed"

    // Vocabulary
    case vocabularyViewed = "vocabulary_viewed"
    case vocabularySearched = "vocabulary_searched"
    case vocabularyExported = "vocabulary_exported"

    // Settings
    case settingsOpened = "settings_opened"
    case settingChanged = "setting_changed"

    // Auth
    case signUpStarted = "sign_up_started"
    case signUpCompleted = "sign_up_completed"
    case loginStarted = "login_started"
    case loginCompleted = "login_completed"
    case logoutCompleted = "logout_completed"
}

// MARK: - PostHog Configuration

enum AnalyticsConfig {
    /// Your PostHog API key
    static let apiKey = "REMOVED"

    /// PostHog host
    static let host = "https://us.i.posthog.com"
}
