import SwiftUI

/// Card component displaying a story preview with thumbnail
struct StoryCard: View {
    let story: Story
    @EnvironmentObject var appState: AppState
    @Environment(\.colorScheme) private var colorScheme
    @AppStorage("showEnglishTitles") private var showEnglishTitles: Bool = false
    @AppStorage("showEnglishDescriptions") private var showEnglishDescriptions: Bool = false
    @AppStorage("showTokenizerSource") private var showTokenizerSource: Bool = false
    @AppStorage("showAuthor") private var showAuthor: Bool = false

    private var progress: ReadingProgress? {
        appState.progress(for: story.id)
    }

    private var isCompleted: Bool {
        progress?.isCompleted ?? false
    }

    /// Adaptive secondary color for better dark mode readability
    private var secondaryTextColor: Color {
        Color.adaptiveSecondary(for: colorScheme)
    }

    /// Adaptive tertiary color for less prominent text
    private var tertiaryTextColor: Color {
        Color.adaptiveTertiary(for: colorScheme)
    }

    var body: some View {
        HStack(alignment: .top, spacing: 14) {
            // Thumbnail
            StoryThumbnail(
                imageURL: story.metadata.coverImageURL,
                level: story.metadata.jlptLevel,
                isCompleted: isCompleted
            )

            // Content
            VStack(alignment: .leading, spacing: 8) {
                // Title
                VStack(alignment: .leading, spacing: 2) {
                    Text(story.metadata.titleJapanese ?? story.metadata.title)
                        .font(.headline)
                        .lineLimit(1)

                    if showEnglishTitles, story.metadata.titleJapanese != nil {
                        Text(story.metadata.title)
                            .font(.caption)
                            .foregroundStyle(secondaryTextColor)
                            .lineLimit(1)
                    }
                }

                // Summary
                VStack(alignment: .leading, spacing: 2) {
                    Text(story.metadata.summaryJapanese ?? story.metadata.summary)
                        .font(.subheadline)
                        .foregroundStyle(secondaryTextColor)
                        .lineLimit(showEnglishDescriptions ? 1 : 2)

                    if showEnglishDescriptions, story.metadata.summaryJapanese != nil {
                        Text(story.metadata.summary)
                            .font(.caption)
                            .foregroundStyle(tertiaryTextColor)
                            .lineLimit(1)
                    }
                }

                Spacer(minLength: 0)

                // Metadata row
                HStack(spacing: 8) {
                    JLPTBadge(level: story.metadata.jlptLevel)

                    // Developer badges
                    if showTokenizerSource {
                        // Model badge (always shows the AI model name)
                        ModelBadge(model: story.metadata.author)

                        // Tokenizer badge (if tokenized with dictionary-based tokenizer)
                        if let source = story.metadata.tokenizerSource?.lowercased() {
                            if source == "janome" {
                                TokenizerBadge(name: "Janome")
                            } else if source == "sudachipy" {
                                TokenizerBadge(name: "Sudachi")
                            }
                        }
                    }

                    if story.hasChapters {
                        Text("\(story.chapterCount) ch")
                            .font(.caption2)
                            .foregroundStyle(secondaryTextColor)
                    }

                    Text("•")
                        .font(.caption2)
                        .foregroundStyle(secondaryTextColor)

                    Text("\(story.estimatedReadingTime) min")
                        .font(.caption2)
                        .foregroundStyle(secondaryTextColor)

                    Spacer()

                    // Author (developer option)
                    if showAuthor {
                        Text(story.metadata.author)
                            .font(.caption2)
                            .foregroundStyle(tertiaryTextColor)
                    }

                    Text(story.metadata.genre)
                        .font(.caption2)
                        .foregroundStyle(secondaryTextColor)
                }

                // Progress bar (if started but not completed)
                if let progress = progress, !progress.isCompleted {
                    ProgressView(value: progress.percentComplete, total: 100)
                        .tint(story.metadata.jlptLevel.color)
                }
            }
        }
        .padding(12)
        .frame(height: 130)
        .background(Color(.systemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .shadow(color: .black.opacity(0.08), radius: 4, x: 0, y: 2)
    }
}

/// Thumbnail view for story cards
struct StoryThumbnail: View {
    let imageURL: String?
    let level: JLPTLevel
    let isCompleted: Bool

    var body: some View {
        ZStack(alignment: .topTrailing) {
            // Image or placeholder
            Group {
                if let urlString = imageURL, let url = URL(string: urlString) {
                    AsyncImage(url: url) { phase in
                        switch phase {
                        case .empty:
                            placeholderView
                                .overlay {
                                    ProgressView()
                                        .scaleEffect(0.7)
                                }
                        case .success(let image):
                            image
                                .resizable()
                                .aspectRatio(contentMode: .fill)
                        case .failure:
                            placeholderView
                        @unknown default:
                            placeholderView
                        }
                    }
                } else {
                    placeholderView
                }
            }
            .frame(width: 85, height: 106)
            .clipShape(RoundedRectangle(cornerRadius: 8))

            // Completion badge
            if isCompleted {
                Image(systemName: "checkmark.circle.fill")
                    .font(.system(size: 18))
                    .foregroundStyle(.white)
                    .background(
                        Circle()
                            .fill(.green)
                            .frame(width: 20, height: 20)
                    )
                    .offset(x: 4, y: -4)
            }
        }
    }

    private var placeholderView: some View {
        Rectangle()
            .fill(level.color.opacity(0.15))
            .overlay {
                VStack(spacing: 4) {
                    Image(systemName: "book.closed.fill")
                        .font(.title2)
                        .foregroundStyle(level.color.opacity(0.5))
                    Text(level.displayName)
                        .font(.caption2)
                        .fontWeight(.bold)
                        .foregroundStyle(level.color)
                }
            }
    }
}

/// Badge showing JLPT level
struct JLPTBadge: View {
    let level: JLPTLevel

    var body: some View {
        Text(level.displayName)
            .font(.caption)
            .fontWeight(.bold)
            .foregroundStyle(.white)
            .padding(.horizontal, 10)
            .padding(.vertical, 4)
            .background(level.color)
            .clipShape(Capsule())
    }
}

/// Badge showing AI model name (developer option)
struct ModelBadge: View {
    let model: String

    var body: some View {
        Text(model)
            .font(.caption2)
            .fontWeight(.semibold)
            .foregroundStyle(.white)
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .background(Color.orange)
            .clipShape(Capsule())
    }
}

/// Badge indicating tokenizer source (developer option)
struct TokenizerBadge: View {
    let name: String

    var body: some View {
        Text(name)
            .font(.caption2)
            .fontWeight(.semibold)
            .foregroundStyle(.white)
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .background(Color.green)
            .clipShape(Capsule())
    }
}

#Preview {
    let sampleStory = Story(
        id: "preview_story",
        metadata: StoryMetadata(
            title: "My Morning",
            titleJapanese: "わたしの朝",
            author: "Test Author",
            jlptLevel: .n5,
            wordCount: 85,
            characterCount: 180,
            genre: "Daily Life",
            tags: ["morning", "routine"],
            summary: "A student describes their typical morning routine.",
            summaryJapanese: nil,
            coverImageURL: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400&q=80"
        ),
        content: [],
        chapters: nil,
        vocabulary: [],
        grammarPoints: nil
    )

    return VStack(spacing: 16) {
        StoryCard(story: sampleStory)

        // Card without thumbnail
        StoryCard(story: Story(
            id: "preview_story_2",
            metadata: StoryMetadata(
                title: "Lost Wallet",
                titleJapanese: "落とした財布",
                author: "Test Author",
                jlptLevel: .n4,
                wordCount: 280,
                characterCount: 1650,
                genre: "Daily Life",
                tags: ["wallet"],
                summary: "A person loses their wallet and experiences kindness.",
                summaryJapanese: nil
            ),
            content: [],
            chapters: nil,
            vocabulary: [],
            grammarPoints: nil
        ))
    }
    .padding()
    .environmentObject(AppState())
}
