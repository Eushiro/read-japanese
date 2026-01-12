import SwiftUI

/// Sort options for vocabulary list
enum VocabSortOrder: String, CaseIterable {
    case newestFirst = "Newest First"
    case oldestFirst = "Oldest First"
    case alphabetical = "A → Z"
    case alphabeticalReverse = "Z → A"
    case byLevel = "By Level"
}

/// Displays the user's saved vocabulary items
struct VocabularyListView: View {
    @EnvironmentObject var appState: AppState
    @State private var searchText = ""
    @State private var sortOrder: VocabSortOrder = .newestFirst
    @State private var selectedLevelFilter: String? = nil
    @State private var selectedStoryFilter: String? = nil
    @State private var isEditMode = false
    @State private var selectedItems: Set<UUID> = []
    @State private var showDefinition = false
    @State private var selectedWordForLookup: WordInfo? = nil
    @State private var showSettings = false

    // MARK: - Computed Properties

    private let allLevels = ["N5", "N4", "N3", "N2", "N1"]

    private var uniqueStories: [(id: String, title: String)] {
        let storyIds = Set(appState.vocabularyItems.compactMap { $0.sourceStoryId })
        return storyIds.compactMap { storyId in
            if let story = appState.stories.first(where: { $0.id == storyId }) {
                return (id: storyId, title: story.metadata.titleJapanese ?? story.metadata.title)
            }
            return nil
        }.sorted { $0.title < $1.title }
    }

    /// Normalize JLPT level string (handles "jlpt-n5" -> "N5" format)
    private func normalizeLevel(_ level: String?) -> String? {
        guard let level = level else { return nil }
        let upper = level.uppercased()
        // Handle "jlpt-n5" format from Jisho API
        if upper.hasPrefix("JLPT-") {
            return String(upper.dropFirst(5))
        }
        // Handle "N5" format
        if upper.hasPrefix("N") && upper.count == 2 {
            return upper
        }
        return upper
    }

    private var filteredItems: [VocabularyItem] {
        var result = appState.vocabularyItems

        // Filter by search text (supports romaji input)
        if !searchText.isEmpty {
            result = result.filter { item in
                // Match word (kanji) - supports romaji conversion
                item.word.matchesJapaneseSearch(searchText) ||
                // Match reading (hiragana) - supports romaji conversion
                item.reading.matchesJapaneseSearch(searchText) ||
                // Match meaning (English)
                item.meaning.localizedCaseInsensitiveContains(searchText)
            }
        }

        if let levelFilter = selectedLevelFilter {
            if levelFilter == "none" {
                result = result.filter { $0.jlptLevel == nil }
            } else {
                result = result.filter { normalizeLevel($0.jlptLevel) == levelFilter }
            }
        }

        if let storyFilter = selectedStoryFilter {
            result = result.filter { $0.sourceStoryId == storyFilter }
        }

        return result
    }

    private var sortedItems: [VocabularyItem] {
        switch sortOrder {
        case .newestFirst:
            return filteredItems.sorted { $0.dateAdded > $1.dateAdded }
        case .oldestFirst:
            return filteredItems.sorted { $0.dateAdded < $1.dateAdded }
        case .alphabetical:
            return filteredItems.sorted { $0.word < $1.word }
        case .alphabeticalReverse:
            return filteredItems.sorted { $0.word > $1.word }
        case .byLevel:
            return filteredItems.sorted { item1, item2 in
                let order = ["N5", "N4", "N3", "N2", "N1"]
                let idx1 = normalizeLevel(item1.jlptLevel).flatMap { order.firstIndex(of: $0) } ?? 99
                let idx2 = normalizeLevel(item2.jlptLevel).flatMap { order.firstIndex(of: $0) } ?? 99
                return idx1 < idx2
            }
        }
    }

    private var itemsByLevel: [(level: String, items: [VocabularyItem])] {
        let grouped = Dictionary(grouping: sortedItems) { item in
            normalizeLevel(item.jlptLevel) ?? "Other"
        }
        let levelOrder = ["N5", "N4", "N3", "N2", "N1", "Other"]
        return levelOrder.compactMap { level in
            guard let items = grouped[level], !items.isEmpty else { return nil }
            return (level: level, items: items)
        }
    }

    private var hasActiveFilter: Bool {
        selectedLevelFilter != nil || selectedStoryFilter != nil
    }

    var body: some View {
        Group {
            if appState.vocabularyItems.isEmpty {
                emptyState
            } else if sortedItems.isEmpty {
                noResultsState
            } else {
                vocabularyList
            }
        }
        .navigationTitle("Vocabulary")
        .searchable(text: $searchText, placement: .navigationBarDrawer(displayMode: .always))
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                if isEditMode {
                    Button {
                        deleteSelectedItems()
                    } label: {
                        Image(systemName: "trash")
                            .foregroundColor(.red)
                    }
                    .disabled(selectedItems.isEmpty)
                    .opacity(selectedItems.isEmpty ? 0.5 : 1.0)
                } else {
                    sortMenu
                }
            }
            ToolbarItem(placement: .topBarTrailing) {
                if isEditMode {
                    Button("Done") {
                        exitEditMode()
                    }
                    .fontWeight(.semibold)
                } else {
                    filterMenu
                }
            }
            ToolbarItem(placement: .topBarTrailing) {
                if !isEditMode {
                    Button {
                        showSettings = true
                    } label: {
                        Image(systemName: "gearshape")
                    }
                }
            }
        }
        .sheet(isPresented: $showSettings) {
            SettingsView()
        }
        .onAppear {
            appState.loadVocabularyFromStorage()
        }
        .onDisappear {
            if isEditMode {
                exitEditMode()
            }
        }
        .overlay {
            if showDefinition, let wordInfo = selectedWordForLookup {
                Color.black.opacity(0.3)
                    .ignoresSafeArea()
                    .onTapGesture {
                        showDefinition = false
                        selectedWordForLookup = nil
                    }

                CompactDefinitionView(
                    wordInfo: wordInfo,
                    onDismiss: {
                        showDefinition = false
                        selectedWordForLookup = nil
                    }
                )
                .transition(.opacity)
            }
        }
        .animation(.easeOut(duration: 0.15), value: showDefinition)
    }

    // MARK: - Toolbar

    private var sortMenu: some View {
        Menu {
            ForEach(VocabSortOrder.allCases, id: \.self) { order in
                Button {
                    sortOrder = order
                } label: {
                    HStack {
                        Text(order.rawValue)
                        if sortOrder == order {
                            Image(systemName: "checkmark")
                        }
                    }
                }
            }
        } label: {
            Image(systemName: "arrow.up.arrow.down")
                .font(.body)
                .imageScale(.medium)
        }
    }

    private var filterMenu: some View {
        Menu {
            if hasActiveFilter {
                Button {
                    selectedLevelFilter = nil
                    selectedStoryFilter = nil
                } label: {
                    Label("Clear Filters", systemImage: "xmark.circle")
                }
                Divider()
            }

            Menu {
                Button {
                    selectedLevelFilter = nil
                } label: {
                    HStack {
                        Text("All Levels")
                        if selectedLevelFilter == nil {
                            Image(systemName: "checkmark")
                        }
                    }
                }
                Divider()
                ForEach(allLevels, id: \.self) { level in
                    Button {
                        selectedLevelFilter = level
                    } label: {
                        HStack {
                            Text(level)
                            if selectedLevelFilter == level {
                                Image(systemName: "checkmark")
                            }
                        }
                    }
                }
                Divider()
                Button {
                    selectedLevelFilter = "none"
                } label: {
                    HStack {
                        Text("No Level")
                        if selectedLevelFilter == "none" {
                            Image(systemName: "checkmark")
                        }
                    }
                }
            } label: {
                Label("By Level", systemImage: "chart.bar")
            }

            if !uniqueStories.isEmpty {
                Menu {
                    Button {
                        selectedStoryFilter = nil
                    } label: {
                        HStack {
                            Text("All Stories")
                            if selectedStoryFilter == nil {
                                Image(systemName: "checkmark")
                            }
                        }
                    }
                    Divider()
                    ForEach(uniqueStories, id: \.id) { story in
                        Button {
                            selectedStoryFilter = story.id
                        } label: {
                            HStack {
                                Text(story.title)
                                if selectedStoryFilter == story.id {
                                    Image(systemName: "checkmark")
                                }
                            }
                        }
                    }
                } label: {
                    Label("By Story", systemImage: "book")
                }
            }
        } label: {
            Image(systemName: hasActiveFilter ? "line.3.horizontal.decrease.circle.fill" : "line.3.horizontal.decrease.circle")
        }
    }

    // MARK: - States

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

    private var noResultsState: some View {
        VStack(spacing: 16) {
            Image(systemName: "magnifyingglass")
                .font(.system(size: 48))
                .foregroundStyle(.secondary)

            Text("No Results")
                .font(.title3)

            if hasActiveFilter {
                Button("Clear Filters") {
                    selectedLevelFilter = nil
                    selectedStoryFilter = nil
                }
                .buttonStyle(.bordered)
            }
        }
    }

    // MARK: - Vocabulary List

    private var vocabularyList: some View {
        List {
            // Summary card
            Section {
                VStack(spacing: 12) {
                    // Main count
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("\(sortedItems.count)")
                                .font(.system(size: 32, weight: .bold, design: .rounded))
                            Text(sortedItems.count == 1 ? "word saved" : "words saved")
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                        }

                        Spacer()

                        // Level breakdown pills
                        HStack(spacing: 6) {
                            ForEach(itemsByLevel.prefix(4), id: \.level) { group in
                                levelPill(level: group.level, count: group.items.count)
                            }
                        }
                    }

                    // Active filters indicator
                    if hasActiveFilter {
                        HStack(spacing: 8) {
                            Image(systemName: "line.3.horizontal.decrease")
                                .font(.caption)
                                .foregroundStyle(.secondary)

                            if let level = selectedLevelFilter {
                                filterTag(text: level == "none" ? "No Level" : level)
                            }
                            if let storyId = selectedStoryFilter,
                               let story = appState.stories.first(where: { $0.id == storyId }) {
                                filterTag(text: story.metadata.titleJapanese ?? story.metadata.title)
                            }

                            Spacer()

                            Button {
                                selectedLevelFilter = nil
                                selectedStoryFilter = nil
                            } label: {
                                Text("Clear")
                                    .font(.caption)
                                    .foregroundStyle(.blue)
                            }
                        }
                        .padding(.top, 4)
                    }
                }
                .padding(.vertical, 4)
            }

            ForEach(itemsByLevel, id: \.level) { group in
                Section(header: sectionHeader(group.level, count: group.items.count)) {
                    ForEach(group.items) { item in
                        vocabularyRow(item)
                    }
                    .onDelete { offsets in
                        deleteItems(in: group.items, at: offsets)
                    }
                }
            }
        }
        .listStyle(.insetGrouped)
    }

    private func levelPill(level: String, count: Int) -> some View {
        VStack(spacing: 2) {
            Text("\(count)")
                .font(.caption)
                .fontWeight(.semibold)
            Text(level)
                .font(.caption2)
        }
        .frame(minWidth: 36)
        .padding(.horizontal, 6)
        .padding(.vertical, 4)
        .background(jlptColor(for: level).opacity(0.15))
        .foregroundStyle(jlptColor(for: level))
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }

    private func filterTag(text: String) -> some View {
        Text(text)
            .font(.caption)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(Color.secondary.opacity(0.15))
            .clipShape(Capsule())
            .lineLimit(1)
    }

    private func sectionHeader(_ level: String, count: Int) -> some View {
        HStack {
            Text(level == "Other" ? "Other" : level)
                .foregroundStyle(level == "Other" ? .secondary : jlptColor(for: level))
            Text("(\(count))")
                .foregroundStyle(.secondary)
        }
    }

    @ViewBuilder
    private func vocabularyRow(_ item: VocabularyItem) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(alignment: .firstTextBaseline) {
                if isEditMode {
                    Image(systemName: selectedItems.contains(item.id) ? "checkmark.circle.fill" : "circle")
                        .foregroundStyle(selectedItems.contains(item.id) ? .blue : .secondary)
                }

                Text(item.word)
                    .font(.title2)
                    .fontWeight(.semibold)

                if item.reading != item.word {
                    Text(item.reading)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }

                Spacer()

                if let level = normalizeLevel(item.jlptLevel) {
                    Text(level)
                        .font(.caption2)
                        .fontWeight(.semibold)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 3)
                        .background(jlptColor(for: level).opacity(0.2))
                        .foregroundStyle(jlptColor(for: level))
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

                if let storyId = item.sourceStoryId,
                   let story = appState.stories.first(where: { $0.id == storyId }) {
                    Text("from \(story.metadata.titleJapanese ?? story.metadata.title)")
                        .font(.caption2)
                        .foregroundStyle(.tertiary)
                        .lineLimit(1)
                }
            }
        }
        .padding(.vertical, 4)
        .contentShape(Rectangle())
        .onTapGesture {
            if isEditMode {
                toggleSelection(item.id)
            } else {
                lookUpWord(item)
            }
        }
        .onLongPressGesture(minimumDuration: 0.5) {
            if !isEditMode {
                isEditMode = true
                selectedItems = [item.id]
            }
        }
    }

    private func jlptColor(for level: String) -> Color {
        switch level {
        case "N5": return .green
        case "N4": return .teal
        case "N3": return .blue
        case "N2": return .orange
        case "N1": return .red
        default: return .secondary
        }
    }

    // MARK: - Actions

    private func toggleSelection(_ id: UUID) {
        if selectedItems.contains(id) {
            selectedItems.remove(id)
        } else {
            selectedItems.insert(id)
        }
    }

    private func exitEditMode() {
        isEditMode = false
        selectedItems = []
    }

    private func deleteSelectedItems() {
        for id in selectedItems {
            if let item = appState.vocabularyItems.first(where: { $0.id == id }) {
                appState.removeVocabularyItem(item)
            }
        }
        exitEditMode()
    }

    private func deleteItems(in items: [VocabularyItem], at offsets: IndexSet) {
        for index in offsets {
            appState.removeVocabularyItem(items[index])
        }
    }

    private func lookUpWord(_ item: VocabularyItem) {
        selectedWordForLookup = WordInfo(
            surface: item.word,
            baseForm: item.word,
            reading: item.reading
        )
        showDefinition = true
    }
}

#Preview {
    NavigationStack {
        VocabularyListView()
    }
    .environmentObject(AppState())
}
