import SwiftUI

/// Main library view showing stories grouped by JLPT level
struct LibraryView: View {
    @EnvironmentObject var appState: AppState
    @Environment(\.colorScheme) private var colorScheme
    @State private var selectedLevel: JLPTLevel? = nil
    @State private var searchText = ""

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
                story.metadata.summary.localizedCaseInsensitiveContains(searchText)
            }
        }

        return result
    }

    /// Stories grouped by level for section display
    var storiesByLevel: [(level: JLPTLevel, stories: [Story])] {
        let grouped = Dictionary(grouping: filteredStories) { $0.metadata.jlptLevel }
        return JLPTLevel.allCases.compactMap { level in
            guard let stories = grouped[level], !stories.isEmpty else { return nil }
            return (level: level, stories: stories)
        }
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
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                levelFilterMenu
            }
        }
        .task {
            if appState.stories.isEmpty {
                await appState.loadStories()
            }
        }
    }

    // MARK: - Subviews

    private var loadingView: some View {
        VStack(spacing: 24) {
            BookFlipAnimation()
                .frame(width: 80, height: 80)

            Text("Loading stories...")
                .font(.subheadline)
                .foregroundStyle(secondaryTextColor)
        }
    }

    private var emptyView: some View {
        VStack(spacing: 20) {
            Image(systemName: "book.closed")
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
                        }
                        .buttonStyle(.plain)
                        .listRowInsets(EdgeInsets(top: 10, leading: 16, bottom: 10, trailing: 16))
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
                    levelHeader(levelGroup.level, count: levelGroup.stories.count)
                }
            }
        }
        .listStyle(.plain)
    }

    private func levelHeader(_ level: JLPTLevel, count: Int) -> some View {
        HStack {
            Text(level.displayName)
                .font(.headline)
                .foregroundStyle(level.color)

            Text("- \(level.description)")
                .font(.subheadline)
                .foregroundStyle(secondaryTextColor)

            Spacer()

            Text("\(count) stories")
                .font(.caption)
                .foregroundStyle(secondaryTextColor)
        }
        .padding(.vertical, 8)
        .padding(.horizontal, 4)
        .background(.background)
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
