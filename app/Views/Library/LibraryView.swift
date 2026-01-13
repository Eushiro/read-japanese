import SwiftUI

/// Sort order for library stories by difficulty
enum SortOrder {
    case easyToHard
    case hardToEasy

    mutating func toggle() {
        self = self == .easyToHard ? .hardToEasy : .easyToHard
    }
}

/// Main library view showing stories grouped by JLPT level
struct LibraryView: View {
    @EnvironmentObject var appState: AppState
    @Environment(\.colorScheme) private var colorScheme
    @State private var selectedLevel: JLPTLevel? = nil
    @State private var searchText = ""
    @State private var sortOrder: SortOrder = .easyToHard
    @State private var showSettings = false
    @State private var showPaywall = false
    @State private var selectedPremiumStory: Story? = nil

    /// Callback when a story is selected
    var onStorySelected: ((Story) -> Void)? = nil

    private var secondaryTextColor: Color {
        Color.adaptiveSecondary(for: colorScheme)
    }

    /// Filtered stories based on selected level and search
    var filteredStories: [Story] {
        var result = appState.stories

        // Filter by level
        if let level = selectedLevel {
            result = result.filter { $0.metadata.jlptLevel == level }
        }

        // Filter by search text (supports romaji input)
        if !searchText.isEmpty {
            result = result.filter { story in
                // Title matches (English)
                story.metadata.title.localizedCaseInsensitiveContains(searchText) ||
                // Japanese title matches (direct or romaji converted)
                (story.metadata.titleJapanese?.matchesJapaneseSearch(searchText) ?? false) ||
                // Summary matches
                story.metadata.summary.localizedCaseInsensitiveContains(searchText) ||
                // Title reading matches (hiragana or romaji)
                titleReading(for: story).matchesJapaneseSearch(searchText)
            }
        }

        return result
    }

    /// Extract hiragana reading from title tokens for search
    private func titleReading(for story: Story) -> String {
        guard let tokens = story.metadata.titleTokens else { return "" }
        return tokens.map { token in
            if let parts = token.parts {
                return parts.map { $0.reading ?? $0.text }.joined()
            }
            return token.surface
        }.joined()
    }

    /// Stories grouped by level for section display
    var storiesByLevel: [(level: JLPTLevel, stories: [Story])] {
        let grouped = Dictionary(grouping: filteredStories) { $0.metadata.jlptLevel }
        let levels = sortOrder == .easyToHard ? JLPTLevel.allCases : JLPTLevel.allCases.reversed()
        return levels.compactMap { level in
            guard let stories = grouped[level], !stories.isEmpty else { return nil }
            return (level: level, stories: stories)
        }
    }

    var body: some View {
        Group {
            if appState.isLoadingStories && appState.stories.isEmpty {
                loadingView
            } else if let error = appState.storiesError, appState.stories.isEmpty {
                errorView(error)
            } else if appState.stories.isEmpty {
                emptyView
            } else {
                storyListView
            }
        }
        .navigationTitle("Library")
        .searchable(text: $searchText, placement: .navigationBarDrawer(displayMode: .always), prompt: "Search stories")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                sortButton
            }
            ToolbarItem(placement: .topBarTrailing) {
                levelFilterMenu
            }
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    showSettings = true
                } label: {
                    Image(systemName: "gearshape")
                }
            }
        }
        .sheet(isPresented: $showSettings) {
            SettingsView()
                .environmentObject(AuthService.shared)
                .environmentObject(appState)
        }
        .sheet(isPresented: $showPaywall) {
            PaywallView(story: selectedPremiumStory)
                .environmentObject(appState)
        }
        .task {
            if appState.stories.isEmpty {
                await appState.loadStories()
            }
        }
        .refreshable {
            await appState.refreshStories()
        }
        .onAppear {
            AnalyticsService.shared.trackScreen("Library")
        }
        .onChange(of: selectedLevel) { _, newValue in
            AnalyticsService.shared.track(.storyFilterChanged, properties: [
                "filter_type": "level",
                "level": newValue?.rawValue ?? "all"
            ])
        }
        .overlay(alignment: .top) {
            // Show banner when using cached data
            if appState.isUsingCachedData {
                HStack {
                    Image(systemName: "wifi.slash")
                    Text("Offline - Showing cached data")
                }
                .font(.caption)
                .foregroundStyle(.white)
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .background(Color.orange)
                .cornerRadius(8)
                .padding(.top, 8)
            }
        }
    }

    // MARK: - Subviews

    private var loadingView: some View {
        VStack(spacing: 20) {
            Image(systemName: "book")
                .font(.system(size: 60))
                .foregroundStyle(secondaryTextColor)

            ProgressView()

            Text("Loading stories...")
                .font(.subheadline)
                .foregroundStyle(secondaryTextColor)
        }
    }

    private var emptyView: some View {
        VStack(spacing: 20) {
            Image(systemName: "book")
                .font(.system(size: 60))
                .foregroundStyle(secondaryTextColor)

            Text("No Stories Found")
                .font(.title2)

            Text("Stories will appear here once loaded.")
                .foregroundStyle(secondaryTextColor)
                .multilineTextAlignment(.center)

            Button("Reload") {
                Task {
                    await appState.loadStories()
                }
            }
            .buttonStyle(.borderedProminent)
        }
        .padding()
    }

    private func errorView(_ error: NetworkError) -> some View {
        VStack(spacing: 20) {
            Image(systemName: errorIcon(for: error))
                .font(.system(size: 60))
                .foregroundStyle(.red.opacity(0.7))

            Text(errorTitle(for: error))
                .font(.title2)

            Text(error.localizedDescription)
                .foregroundStyle(secondaryTextColor)
                .multilineTextAlignment(.center)

            Button {
                Task {
                    await appState.loadStories(forceRefresh: true)
                }
            } label: {
                Label("Try Again", systemImage: "arrow.clockwise")
            }
            .buttonStyle(.borderedProminent)
        }
        .padding()
    }

    private func errorIcon(for error: NetworkError) -> String {
        switch error {
        case .noConnection:
            return "wifi.slash"
        case .timeout:
            return "clock.badge.exclamationmark"
        case .serverError:
            return "server.rack"
        default:
            return "exclamationmark.triangle"
        }
    }

    private func errorTitle(for error: NetworkError) -> String {
        switch error {
        case .noConnection:
            return "No Connection"
        case .timeout:
            return "Request Timed Out"
        case .serverError:
            return "Server Error"
        default:
            return "Something Went Wrong"
        }
    }

    private var storyListView: some View {
        List {
            ForEach(storiesByLevel, id: \.level) { levelGroup in
                Section {
                    ForEach(levelGroup.stories) { story in
                        Button {
                            // Check if story is premium and user is not subscribed
                            if story.metadata.isPremium && !appState.isPremiumUser {
                                selectedPremiumStory = story
                                showPaywall = true
                            } else {
                                AnalyticsService.shared.track(.storySelected, properties: [
                                    "story_id": story.id,
                                    "jlpt_level": story.metadata.jlptLevel.rawValue,
                                    "title": story.metadata.title
                                ])
                                onStorySelected?(story)
                            }
                        } label: {
                            StoryCard(story: story)
                                .frame(maxWidth: .infinity, alignment: .leading)
                        }
                        .buttonStyle(PlainButtonStyle())
                        .contentShape(Rectangle())
                        .listRowSeparator(.hidden)
                        .swipeActions(edge: .trailing, allowsFullSwipe: true) {
                            let isCompleted = appState.progress(for: story.id)?.isCompleted ?? false
                            if isCompleted {
                                Button {
                                    appState.markUnread(storyId: story.id)
                                } label: {
                                    Label("Mark Unread", systemImage: "arrow.counterclockwise")
                                }
                                .tint(.orange)
                            } else {
                                Button {
                                    appState.markCompleted(storyId: story.id)
                                } label: {
                                    Label("Mark Read", systemImage: "checkmark.circle.fill")
                                }
                                .tint(.green)
                            }
                        }
                    }
                } header: {
                    levelHeader(levelGroup.level)
                }
            }
        }
        .listStyle(.insetGrouped)
    }

    private func levelHeader(_ level: JLPTLevel) -> some View {
        HStack {
            Text(level.displayName)
                .font(.subheadline)
                .fontWeight(.semibold)
                .foregroundStyle(level.color)

            Text("- \(level.description)")
                .font(.subheadline)
                .foregroundStyle(secondaryTextColor)

            Spacer()
        }
    }

    private var sortButton: some View {
        Button {
            sortOrder.toggle()
        } label: {
            Image(systemName: "arrow.up.arrow.down")
                .font(.body)
                .imageScale(.medium)
        }
    }

    private var levelFilterMenu: some View {
        Menu {
            Button {
                selectedLevel = nil
            } label: {
                HStack {
                    Text("All Levels")
                    if selectedLevel == nil {
                        Image(systemName: "checkmark")
                    }
                }
            }

            Divider()

            ForEach(JLPTLevel.allCases) { level in
                Button {
                    selectedLevel = level
                } label: {
                    HStack {
                        Text("\(level.displayName) - \(level.description)")
                        if selectedLevel == level {
                            Image(systemName: "checkmark")
                        }
                    }
                }
            }
        } label: {
            Label(
                selectedLevel?.displayName ?? "Filter",
                systemImage: "line.3.horizontal.decrease.circle"
            )
        }
    }
}

#Preview {
    NavigationStack {
        LibraryView()
    }
    .environmentObject(AppState())
}
