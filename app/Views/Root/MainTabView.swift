import SwiftUI

/// Main tab navigation container for the app
struct MainTabView: View {
    @EnvironmentObject var appState: AppState
    @State private var selectedTab = 0
    @State private var selectedStory: Story? = nil
    @State private var readerDragOffset: CGFloat = 0

    var body: some View {
        GeometryReader { geometry in
            ZStack {
                // Tab content (always rendered, visible when reader slides away)
                TabView(selection: $selectedTab) {
                    // Library Tab
                    NavigationStack {
                        LibraryView(onStorySelected: { story in
                            selectStory(story)
                        })
                    }
                    .tabItem {
                        Label("Library", systemImage: "book.fill")
                    }
                    .tag(0)

                    // Vocabulary Tab
                    NavigationStack {
                        VocabularyListView()
                    }
                    .tabItem {
                        Label("Vocabulary", systemImage: "character.book.closed.fill")
                    }
                    .tag(1)
                }
                .tabViewStyle(.tabBarOnly)

                // Reader overlay (slides over library)
                if let story = selectedStory {
                    ReaderView(
                        story: story,
                        onDismiss: {
                            dismissReader()
                        },
                        onStorySelected: { newStory in
                            // Switch to new story (for recommended stories)
                            selectStory(newStory)
                        }
                    )
                    .offset(x: readerDragOffset)
                    .overlay(alignment: .leading) {
                        // Edge swipe zone for dismiss (left 40pt of screen)
                        Color.clear
                            .frame(width: 40)
                            .contentShape(Rectangle())
                            .highPriorityGesture(
                                DragGesture(minimumDistance: 10)
                                    .onChanged { value in
                                        if value.translation.width > 0 {
                                            readerDragOffset = value.translation.width
                                        }
                                    }
                                    .onEnded { value in
                                        let threshold = geometry.size.width * 0.2
                                        let velocity = value.predictedEndTranslation.width - value.translation.width
                                        if value.translation.width > threshold || velocity > 200 {
                                            dismissReader()
                                        } else {
                                            withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) {
                                                readerDragOffset = 0
                                            }
                                        }
                                    }
                            )
                    }
                    .transition(.move(edge: .trailing))
                    .zIndex(1)
                }
            }
        }
    }

    private func selectStory(_ story: Story) {
        withAnimation(.easeOut(duration: 0.3)) {
            selectedStory = story
            readerDragOffset = 0
        }
    }

    private func dismissReader() {
        withAnimation(.easeOut(duration: 0.25)) {
            selectedStory = nil
            readerDragOffset = 0
        }
    }
}

#Preview {
    MainTabView()
        .environmentObject(AppState())
}
