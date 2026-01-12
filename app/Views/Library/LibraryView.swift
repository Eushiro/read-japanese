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

        // Filter by search text
        if !searchText.isEmpty {
            result = result.filter { story in
                story.metadata.title.localizedCaseInsensitiveContains(searchText) ||
                (story.metadata.titleJapanese?.contains(searchText) ?? false) ||
                story.metadata.summary.localizedCaseInsensitiveContains(searchText) ||
                titleReading(for: story).contains(searchText)
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

    /// Search suggestions based on story titles and genres
    var searchSuggestions: [String] {
        guard !searchText.isEmpty else { return [] }
        let lowercasedSearch = searchText.lowercased()

        var suggestions: Set<String> = []

        for story in appState.stories {
            // Match Japanese titles
            if let japaneseTitle = story.metadata.titleJapanese,
               japaneseTitle.contains(searchText) {
                suggestions.insert(japaneseTitle)
            }

            // Match hiragana reading of title
            let reading = titleReading(for: story)
            if !reading.isEmpty && reading.contains(searchText),
               let japaneseTitle = story.metadata.titleJapanese {
                suggestions.insert(japaneseTitle)
            }

            // Match English titles
            if story.metadata.title.lowercased().contains(lowercasedSearch) {
                suggestions.insert(story.metadata.title)
            }

            // Match genres
            if story.metadata.genre.lowercased().contains(lowercasedSearch) {
                suggestions.insert(story.metadata.genre)
            }
        }

        return Array(suggestions).sorted().prefix(5).map { $0 }
    }

    var body: some View {
        Group {
            if appState.isLoadingStories {
                loadingView
            } else if appState.stories.isEmpty {
                emptyView
            } else {
                storyListView
            }
        }
        .navigationTitle("Library")
        .searchable(text: $searchText, placement: .navigationBarDrawer(displayMode: .always), prompt: "Search stories")
        .searchSuggestions {
            if !searchText.isEmpty {
                ForEach(searchSuggestions, id: \.self) { suggestion in
                    Label(suggestion, systemImage: "magnifyingglass")
                        .searchCompletion(suggestion)
                }
            }
        }
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
        }
        .task {
            if appState.stories.isEmpty {
                await appState.loadStories()
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

    private var storyListView: some View {
        List {
            ForEach(storiesByLevel, id: \.level) { levelGroup in
                Section {
                    ForEach(levelGroup.stories) { story in
                        Button {
                            onStorySelected?(story)
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
