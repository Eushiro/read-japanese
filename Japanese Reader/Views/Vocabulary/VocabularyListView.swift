import SwiftUI

/// Displays the user's saved vocabulary items
struct VocabularyListView: View {
    @EnvironmentObject var appState: AppState
    @State private var searchText = ""

    var filteredItems: [VocabularyItem] {
        if searchText.isEmpty {
            return appState.vocabularyItems
        }
        return appState.vocabularyItems.filter { item in
            item.word.contains(searchText) ||
            item.reading.contains(searchText) ||
            item.meaning.localizedCaseInsensitiveContains(searchText)
        }
    }

    var body: some View {
        Group {
            if appState.vocabularyItems.isEmpty {
                emptyState
            } else {
                vocabularyList
            }
        }
        .navigationTitle("Vocabulary")
        .searchable(text: $searchText, placement: .navigationBarDrawer(displayMode: .always))
        .onAppear {
            appState.loadVocabularyFromStorage()
        }
    }

    // MARK: - Empty State

    private var emptyState: some View {
        VStack(spacing: 20) {
            Image(systemName: "character.book.closed.fill")
                .font(.system(size: 60))
                .foregroundStyle(.secondary)

            Text("No Words Saved Yet")
                .font(.title2)

            Text("Tap on words while reading stories to look them up and save them to your vocabulary.")
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 40)
        }
    }

    // MARK: - Vocabulary List

    private var vocabularyList: some View {
        List {
            ForEach(filteredItems) { item in
                VocabularyRow(item: item)
            }
            .onDelete(perform: deleteItems)
        }
        .listStyle(.insetGrouped)
    }

    private func deleteItems(at offsets: IndexSet) {
        for index in offsets {
            let item = filteredItems[index]
            appState.removeVocabularyItem(item)
        }
    }
}

// MARK: - Vocabulary Row

struct VocabularyRow: View {
    let item: VocabularyItem
    @EnvironmentObject var appState: AppState

    /// Get the story title for display
    private var storyTitle: String? {
        guard let storyId = item.sourceStoryId else { return nil }
        if let story = appState.stories.first(where: { $0.id == storyId }) {
            return story.metadata.titleJapanese ?? story.metadata.title
        }
        return nil
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(alignment: .firstTextBaseline) {
                Text(item.word)
                    .font(.title2)
                    .fontWeight(.semibold)

                if item.reading != item.word {
                    Text(item.reading)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }

                Spacer()

                if let level = item.jlptLevel {
                    Text(level.uppercased())
                        .font(.caption2)
                        .fontWeight(.semibold)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 3)
                        .background(Color.blue.opacity(0.2))
                        .foregroundStyle(.blue)
                        .clipShape(RoundedRectangle(cornerRadius: 4))
                }
            }

            Text(item.meaning)
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .lineLimit(2)

            HStack {
                Text(item.dateAdded, style: .date)
                    .font(.caption2)
                    .foregroundStyle(.tertiary)

                if let title = storyTitle {
                    Text("from \(title)")
                        .font(.caption2)
                        .foregroundStyle(.tertiary)
                }
            }
        }
        .padding(.vertical, 4)
    }
}

#Preview {
    NavigationStack {
        VocabularyListView()
    }
    .environmentObject(AppState())
}
