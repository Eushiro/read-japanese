import SwiftUI

/// Main reading view for displaying story content
struct ReaderView: View {
    let story: Story
    @EnvironmentObject var appState: AppState

    // Dismiss handling (called from parent)
    var onDismiss: (() -> Void)? = nil
    var onStorySelected: ((Story) -> Void)? = nil

    // MARK: - Local State

    @State private var isAutoScrolling = false
    @State private var showSettings = false
    @State private var currentSegmentIndex = 0
    @State private var currentChapterIndex = 0
    @State private var selectedWordInfo: WordInfo?
    @State private var selectedTokenId: String?
    @State private var selectedWordFrame: CGRect = .zero
    @State private var showTooltip = false
    @State private var showDefinition = false
    @State private var scrollOffset: CGFloat = 0
    @State private var containerWidth: CGFloat = 0
    @State private var showAudioPlayer = false
    @State private var dismissDragOffset: CGFloat = 0

    // Audio player
    @StateObject private var audioPlayer = AudioPlayerService()

    // Header collapse calculation
    private var headerCollapseProgress: CGFloat {
        // Collapse over 80 points of scrolling
        min(1.0, scrollOffset / 80.0)
    }

    private var isHeaderCollapsed: Bool {
        headerCollapseProgress > 0.5
    }

    // Settings (persisted)
    @AppStorage("autoScrollSpeed") private var autoScrollSpeed: Double = 300.0
    @AppStorage("fontSize") private var fontSize: Double = 20.0
    @AppStorage("showFurigana") private var showFurigana: Bool = true
    @AppStorage("showEnglishTitles") private var showEnglishTitles: Bool = false

    // Environment
    @Environment(\.dismiss) private var dismiss
    @Environment(\.colorScheme) private var colorScheme

    /// Furigana color that adapts to dark mode
    private var furiganaColor: Color {
        colorScheme == .dark ? Color(white: 0.65) : Color(white: 0.4)
    }

    /// Scroll speed in points per second (direct from settings)
    private var scrollSpeedPointsPerSecond: CGFloat {
        CGFloat(autoScrollSpeed)
    }

    /// Whether the current chapter/story has audio
    private var hasAudio: Bool {
        if let chapter = currentChapter {
            return chapter.audioURL != nil
        }
        return story.metadata.audioURL != nil
    }

    /// Current audio URL (chapter or story level)
    private var currentAudioURL: String? {
        if let chapter = currentChapter {
            return chapter.audioURL ?? story.metadata.audioURL
        }
        return story.metadata.audioURL
    }

    /// Segment ID being highlighted by audio playback
    private var audioHighlightedSegmentId: String? {
        audioPlayer.currentSegmentId
    }

    var body: some View {
        GeometryReader { geometry in
            let screenWidth = geometry.size.width

            VStack(spacing: 0) {
                // Collapsible story header
                collapsibleHeader
                    .background(Color(.systemBackground))

                // Main content area - native paging TabView for chapters
                TabView(selection: $currentChapterIndex) {
                    ForEach(0..<max(story.chapterCount, 1), id: \.self) { index in
                        chapterScrollView(forChapterIndex: index, width: screenWidth)
                            .tag(index)
                    }
                }
                .tabViewStyle(.page(indexDisplayMode: .never))
                .overlay(alignment: .bottom) {
                    if isAutoScrolling {
                        autoScrollIndicator
                            .padding(.bottom, 40)
                    }
                }
                .onAppear {
                    containerWidth = screenWidth
                }
                .onChange(of: geometry.size.width) { _, newWidth in
                    containerWidth = newWidth
                }

                // Audio player bar (shown when toggled)
                if showAudioPlayer && hasAudio {
                    AudioPlayerBar(audioPlayer: audioPlayer)
                        .transition(.move(edge: .bottom).combined(with: .opacity))
                }

                // Bottom toolbar - has its own background
                bottomToolbar
            }
            .animation(.easeInOut(duration: 0.2), value: showAudioPlayer)
        }
        .background(Color(.systemBackground))
        .navigationBarTitleDisplayMode(.inline)
        .navigationBarBackButtonHidden(true)
        .toolbar {
            // Empty toolbar to keep navigation gesture enabled
        }
        .sheet(isPresented: $showSettings) {
            ReaderSettingsSheet(
                autoScrollSpeed: $autoScrollSpeed,
                fontSize: $fontSize,
                showFurigana: $showFurigana
            )
        }
        .onDisappear {
            isAutoScrolling = false
            saveProgress()
            audioPlayer.cleanup()
        }
        .task {
            await loadAudioIfAvailable()
        }
        .onChange(of: currentChapterIndex) { _, _ in
            Task {
                await loadAudioIfAvailable()
            }
        }
        .overlay {
            // Tap anywhere to dismiss tooltip
            if showTooltip {
                Color.clear
                    .contentShape(Rectangle())
                    .onTapGesture {
                        showTooltip = false
                        selectedWordInfo = nil
                        selectedTokenId = nil
                    }
            }
        }
        .overlay {
            // Lightweight tooltip near the word
            if showTooltip, let wordInfo = selectedWordInfo {
                GeometryReader { geo in
                    // Convert global frame to local coordinates
                    let globalOrigin = geo.frame(in: .global).origin
                    let localWordFrame = CGRect(
                        x: selectedWordFrame.minX - globalOrigin.x,
                        y: selectedWordFrame.minY - globalOrigin.y,
                        width: selectedWordFrame.width,
                        height: selectedWordFrame.height
                    )

                    // Measure the tooltip to get accurate dimensions
                    let tooltipSize = TooltipMeasurement.measure(hasWord: true)

                    // Position tooltip centered above the word
                    let tooltipX = min(
                        max(localWordFrame.midX, tooltipSize.width / 2 + 16),
                        geo.size.width - tooltipSize.width / 2 - 16
                    )

                    // Position so the tooltip's arrow points to the top of the word
                    // The arrow is at the bottom of the tooltip, so we position the center
                    // such that bottom of tooltip is just above the word
                    let tooltipY = max(
                        localWordFrame.minY - tooltipSize.height / 2 - 4,
                        tooltipSize.height / 2 + 16
                    )

                    WordActionTooltip(
                        wordInfo: wordInfo,
                        position: CGPoint(x: tooltipX, y: tooltipY),
                        onAddToVocabulary: {
                            Task {
                                await quickSaveWord(wordInfo)
                            }
                        },
                        onViewDefinition: {
                            showTooltip = false
                            showDefinition = true
                        },
                        onDismiss: {
                            showTooltip = false
                            selectedWordInfo = nil
                            selectedTokenId = nil
                        }
                    )
                    .position(x: tooltipX, y: tooltipY)
                }
                .transition(.scale.combined(with: .opacity))
            }
        }
        .overlay {
            // Compact definition view
            if showDefinition, let wordInfo = selectedWordInfo {
                Color.black.opacity(0.3)
                    .ignoresSafeArea()
                    .onTapGesture {
                        showDefinition = false
                        selectedWordInfo = nil
                        selectedTokenId = nil
                    }

                CompactDefinitionView(
                    wordInfo: wordInfo,
                    onDismiss: {
                        showDefinition = false
                        selectedWordInfo = nil
                        selectedTokenId = nil
                    }
                )
                .transition(.scale.combined(with: .opacity))
            }
        }
        .animation(.easeInOut(duration: 0.15), value: showTooltip)
        .animation(.easeInOut(duration: 0.2), value: showDefinition)
    }

    // MARK: - Bottom Toolbar

    private var bottomToolbar: some View {
        HStack(spacing: 24) {
            // Furigana toggle
            Button {
                showFurigana.toggle()
            } label: {
                VStack(spacing: 4) {
                    Image(systemName: showFurigana ? "checkmark.circle.fill" : "circle")
                        .font(.title2)
                        .foregroundStyle(showFurigana ? .green : .secondary)
                    Text("Furigana")
                        .font(.caption2)
                }
            }
            .foregroundStyle(showFurigana ? .primary : .secondary)

            Spacer()

            // Font size controls (right side, near settings)
            HStack(spacing: 16) {
                Button {
                    fontSize = max(fontSize - 2, 14)
                } label: {
                    Image(systemName: "minus.circle")
                        .font(.title2)
                }
                .disabled(fontSize <= 14)
                .foregroundStyle(fontSize <= 14 ? .tertiary : .primary)

                Text("\(Int(fontSize))")
                    .font(.subheadline)
                    .fontWeight(.medium)
                    .foregroundStyle(.secondary)
                    .frame(width: 28)

                Button {
                    fontSize = min(fontSize + 2, 32)
                } label: {
                    Image(systemName: "plus.circle")
                        .font(.title2)
                }
                .disabled(fontSize >= 32)
                .foregroundStyle(fontSize >= 32 ? .tertiary : .primary)
            }

            // Audio button (if audio available)
            if hasAudio {
                Button {
                    showAudioPlayer.toggle()
                } label: {
                    Image(systemName: audioPlayer.isPlaying ? "waveform" : "speaker.wave.2")
                        .font(.title2)
                }
                .foregroundStyle(audioPlayer.isPlaying ? .blue : .primary)
            }

            // Settings
            Button {
                showSettings = true
            } label: {
                Image(systemName: "gearshape")
                    .font(.title2)
            }
            .foregroundStyle(.primary)
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 10)
        .background(Color(.systemBackground))
        .overlay(alignment: .top) {
            Divider()
        }
    }

    // MARK: - Story Content

    /// Helper to create a scroll view for a specific chapter
    private func chapterScrollView(forChapterIndex index: Int, width: CGFloat) -> some View {
        AutoScrollView(
            isAutoScrolling: $isAutoScrolling,
            scrollOffset: index == currentChapterIndex ? $scrollOffset : .constant(0),
            scrollSpeed: scrollSpeedPointsPerSecond
        ) {
            chapterBodyContent(forChapterIndex: index)
                .frame(maxWidth: .infinity)
                .padding(.horizontal, 24)
                .padding(.top, 24)
                .padding(.bottom, 32)
        }
        .frame(width: width)
        .id("chapter_\(index)")
    }

    /// Current segments to display (chapter-aware)
    private var currentSegments: [StorySegment] {
        story.segments(forChapter: currentChapterIndex)
    }

    /// Current chapter (if story has chapters)
    private var currentChapter: Chapter? {
        guard story.hasChapters, let chapters = story.chapters else { return nil }
        return chapters[safe: currentChapterIndex]
    }

    /// Whether this is the last chapter
    private var isLastChapter: Bool {
        currentChapterIndex >= story.chapterCount - 1
    }

    /// Navigate to next chapter (TabView handles animation)
    private func goToNextChapter() {
        guard story.hasChapters && !isLastChapter else { return }
        withAnimation {
            currentChapterIndex += 1
        }
    }

    /// Navigate to previous chapter (TabView handles animation)
    private func goToPreviousChapter() {
        guard currentChapterIndex > 0 else { return }
        withAnimation {
            currentChapterIndex -= 1
        }
    }

    /// Navigate to specific chapter (TabView handles animation)
    private func goToChapter(_ index: Int) {
        guard index != currentChapterIndex else { return }
        withAnimation {
            currentChapterIndex = index
        }
    }

    // MARK: - Collapsible Header

    private var collapsibleHeader: some View {
        VStack(spacing: 0) {
            // Top bar with glassy back button - aligned with tab bar level
            HStack {
                Button {
                    onDismiss?()
                } label: {
                    Image(systemName: "chevron.left")
                        .font(.system(size: 17, weight: .semibold))
                        .foregroundStyle(.primary)
                        .frame(width: 36, height: 36)
                        .background {
                            Circle()
                                .fill(.ultraThinMaterial)
                                .overlay {
                                    Circle()
                                        .strokeBorder(.white.opacity(0.3), lineWidth: 0.5)
                                }
                                .shadow(color: .black.opacity(0.1), radius: 8, x: 0, y: 2)
                        }
                }

                Spacer()
            }
            .padding(.horizontal, 16)
            .padding(.top, 4)
            .padding(.bottom, isHeaderCollapsed ? 8 : 4)

            // Title section
            if !isHeaderCollapsed {
                VStack(alignment: .leading, spacing: 6) {
                    // Japanese title with furigana
                    if let titleTokens = story.metadata.titleTokens, !titleTokens.isEmpty {
                        titleWithFurigana(tokens: titleTokens)
                    } else {
                        Text(story.metadata.titleJapanese ?? story.metadata.title)
                            .font(.title2)
                            .fontWeight(.bold)
                            .lineLimit(2)
                    }

                    // English title (if setting enabled)
                    if showEnglishTitles {
                        Text(story.metadata.title)
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }

                    // Metadata row
                    HStack(spacing: 6) {
                        JLPTBadge(level: story.metadata.jlptLevel)
                        Text(story.metadata.genre)
                            .font(.caption)
                            .foregroundStyle(.secondary)

                        if story.hasChapters {
                            Text("•")
                                .foregroundStyle(.secondary)
                            Text("Chapter \(currentChapterIndex + 1) of \(story.chapterCount)")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 16)
                .padding(.bottom, 12)
            } else {
                // Collapsed: title and metadata on left
                VStack(alignment: .leading, spacing: 4) {
                    Text(story.metadata.titleJapanese ?? story.metadata.title)
                        .font(.headline)
                        .fontWeight(.semibold)
                        .lineLimit(1)

                    HStack(spacing: 6) {
                        JLPTBadge(level: story.metadata.jlptLevel)

                        if story.hasChapters {
                            Text("Chapter \(currentChapterIndex + 1) of \(story.chapterCount)")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 16)
                .padding(.bottom, 10)
            }

            Divider()
                .padding(.horizontal, 16)
        }
        .animation(.easeInOut(duration: 0.25), value: isHeaderCollapsed)
    }

    // Full header content (shown when not scrolled)
    private var storyHeader: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Japanese title with furigana and tap support
            if let titleTokens = story.metadata.titleTokens, !titleTokens.isEmpty {
                // Tokenized title with furigana
                titleWithFurigana(tokens: titleTokens)
            } else if let japaneseTitle = story.metadata.titleJapanese {
                // Fallback: plain text title
                Text(japaneseTitle)
                    .font(.title2)
                    .fontWeight(.bold)
            }

            if showEnglishTitles {
                Text(story.metadata.title)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }

            HStack {
                JLPTBadge(level: story.metadata.jlptLevel)
                Text(story.metadata.genre)
                    .font(.caption)
                    .foregroundStyle(.secondary)

                if story.hasChapters {
                    Text("•")
                        .foregroundStyle(.secondary)
                    Text("Chapter \(currentChapterIndex + 1) of \(story.chapterCount)")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    // Title with furigana and tap support
    private func titleWithFurigana(tokens: [Token]) -> some View {
        WrappingHStack(alignment: .bottom, spacing: 0) {
            ForEach(Array(tokens.enumerated()), id: \.offset) { _, token in
                if token.isPunctuation {
                    // Non-tappable punctuation
                    VStack(spacing: 0) {
                        Text(" ")
                            .font(.system(size: 14))
                            .opacity(0)
                        Text(token.surface)
                            .font(.title)
                            .fontWeight(.bold)
                    }
                    .fixedSize(horizontal: true, vertical: false)
                } else {
                    // Tappable word with parts-based furigana
                    let wordInfo = WordInfo.from(token)

                    HStack(spacing: 0) {
                        if let parts = token.parts, !parts.isEmpty {
                            ForEach(Array(parts.enumerated()), id: \.offset) { _, part in
                                VStack(spacing: 0) {
                                    if showFurigana, let reading = part.reading {
                                        Text(reading)
                                            .font(.system(size: 14))
                                            .foregroundStyle(furiganaColor)
                                    } else {
                                        Text(" ")
                                            .font(.system(size: 14))
                                            .opacity(0)
                                    }
                                    Text(part.text)
                                        .font(.title)
                                        .fontWeight(.bold)
                                }
                                .fixedSize(horizontal: true, vertical: false)
                            }
                        } else {
                            // Fallback: surface without furigana
                            VStack(spacing: 0) {
                                Text(" ")
                                    .font(.system(size: 14))
                                    .opacity(0)
                                Text(token.surface)
                                    .font(.title)
                                    .fontWeight(.bold)
                            }
                            .fixedSize(horizontal: true, vertical: false)
                        }
                    }
                    .overlay(
                        GeometryReader { geo in
                            Color.clear
                                .contentShape(Rectangle())
                                .onTapGesture {
                                    selectedWordInfo = wordInfo
                                    selectedWordFrame = geo.frame(in: .global)
                                    showTooltip = true
                                }
                        }
                    )
                }
            }
        }
    }

    // Scrollable chapter body content for a specific chapter index
    private func chapterBodyContent(forChapterIndex chapterIndex: Int) -> some View {
        let segments = story.segments(forChapter: chapterIndex)
        let chapter: Chapter? = story.hasChapters ? story.chapters?[safe: chapterIndex] : nil
        let isLast = chapterIndex >= story.chapterCount - 1

        return VStack(alignment: .leading, spacing: 24) {
            // Chapter title (if applicable)
            if let chapter = chapter {
                VStack(alignment: .leading, spacing: 4) {
                    // Chapter title with furigana if available
                    if let titleTokens = chapter.titleTokens, !titleTokens.isEmpty {
                        chapterTitleWithFurigana(tokens: titleTokens)
                    } else if let titleJapanese = chapter.titleJapanese {
                        Text(titleJapanese)
                            .font(.title3)
                            .fontWeight(.semibold)
                    } else {
                        Text(chapter.title)
                            .font(.title3)
                            .fontWeight(.semibold)
                    }

                    // English chapter title (if setting enabled)
                    if showEnglishTitles, chapter.titleJapanese != nil {
                        Text(chapter.title)
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                }
                .padding(.bottom, 8)

                // Chapter image
                if let imageURL = chapter.imageURL, let url = URL(string: imageURL) {
                    chapterImageView(url: url)
                        .padding(.bottom, 8)
                }
            }

            // Story segments for this chapter
            ForEach(Array(segments.enumerated()), id: \.element.id) { index, segment in
                segmentView(segment, index: index)
                    .id(segment.id)
            }

            // Chapter navigation or completion section (only for current chapter)
            if chapterIndex == currentChapterIndex {
                if story.hasChapters && !isLast {
                    chapterNavigationSection
                } else {
                    completionSection
                }
            }
        }
    }

    // Chapter title with furigana support
    private func chapterTitleWithFurigana(tokens: [Token]) -> some View {
        WrappingHStack(alignment: .bottom, spacing: 0) {
            ForEach(Array(tokens.enumerated()), id: \.offset) { _, token in
                if token.isPunctuation {
                    VStack(spacing: 0) {
                        Text(" ")
                            .font(.system(size: 10))
                            .opacity(0)
                        Text(token.surface)
                            .font(.title3)
                            .fontWeight(.semibold)
                    }
                    .fixedSize(horizontal: true, vertical: false)
                } else {
                    HStack(spacing: 0) {
                        if let parts = token.parts, !parts.isEmpty {
                            ForEach(Array(parts.enumerated()), id: \.offset) { _, part in
                                VStack(spacing: 0) {
                                    if showFurigana, let reading = part.reading {
                                        Text(reading)
                                            .font(.system(size: 10))
                                            .foregroundStyle(furiganaColor)
                                    } else {
                                        Text(" ")
                                            .font(.system(size: 10))
                                            .opacity(0)
                                    }
                                    Text(part.text)
                                        .font(.title3)
                                        .fontWeight(.semibold)
                                }
                                .fixedSize(horizontal: true, vertical: false)
                            }
                        } else {
                            VStack(spacing: 0) {
                                Text(" ")
                                    .font(.system(size: 10))
                                    .opacity(0)
                                Text(token.surface)
                                    .font(.title3)
                                    .fontWeight(.semibold)
                            }
                            .fixedSize(horizontal: true, vertical: false)
                        }
                    }
                }
            }
        }
    }

    // Chapter image view with async loading
    private func chapterImageView(url: URL) -> some View {
        AsyncImage(url: url) { phase in
            switch phase {
            case .empty:
                // Loading placeholder
                RoundedRectangle(cornerRadius: 12)
                    .fill(Color(.secondarySystemBackground))
                    .frame(height: 200)
                    .overlay {
                        ProgressView()
                    }
            case .success(let image):
                image
                    .resizable()
                    .aspectRatio(contentMode: .fill)
                    .frame(maxWidth: .infinity)
                    .frame(height: 200)
                    .clipShape(RoundedRectangle(cornerRadius: 12))
            case .failure:
                // Error state - show nothing or placeholder
                EmptyView()
            @unknown default:
                EmptyView()
            }
        }
    }

    // MARK: - Chapter Navigation

    private var chapterNavigationSection: some View {
        VStack(spacing: 16) {
            Divider()

            Text("End of Chapter \(currentChapterIndex + 1)")
                .font(.headline)
                .foregroundStyle(.secondary)

            HStack(spacing: 16) {
                if currentChapterIndex > 0 {
                    Button {
                        goToPreviousChapter()
                    } label: {
                        Label("Previous", systemImage: "chevron.left")
                    }
                    .buttonStyle(.bordered)
                }

                Button {
                    goToNextChapter()
                } label: {
                    HStack(spacing: 6) {
                        Text("Next Chapter")
                        Image(systemName: "chevron.right")
                    }
                }
                .buttonStyle(.borderedProminent)
            }

            // Chapter list
            if let chapters = story.chapters {
                VStack(alignment: .leading, spacing: 8) {
                    Text("All Chapters")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .padding(.top, 8)

                    ForEach(Array(chapters.enumerated()), id: \.element.id) { index, chapter in
                        Button {
                            goToChapter(index)
                        } label: {
                            HStack {
                                Text("\(index + 1).")
                                    .foregroundStyle(.secondary)
                                    .frame(width: 24, alignment: .leading)

                                Text(chapter.titleJapanese ?? chapter.title)
                                    .lineLimit(1)

                                Spacer()

                                if index == currentChapterIndex {
                                    Image(systemName: "checkmark.circle.fill")
                                        .foregroundStyle(.green)
                                }
                            }
                            .padding(.vertical, 8)
                            .padding(.horizontal, 12)
                            .background(index == currentChapterIndex ? Color.accentColor.opacity(0.1) : Color.clear)
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
        .padding(.top, 32)
    }

    // MARK: - Completion Section

    private var completionSection: some View {
        VStack(spacing: 20) {
            Divider()

            Text("Story Complete!")
                .font(.title2)
                .fontWeight(.bold)

            HStack(spacing: 16) {
                if appState.hasCompleted(storyId: story.id) {
                    Button {
                        appState.markUnread(storyId: story.id)
                    } label: {
                        Label("Mark as Unread", systemImage: "arrow.uturn.backward")
                    }
                    .buttonStyle(.bordered)
                } else {
                    Button {
                        appState.markCompleted(storyId: story.id)
                    } label: {
                        Label("Mark as Read", systemImage: "checkmark")
                    }
                    .buttonStyle(.borderedProminent)
                }
            }

            // Recommended stories (shown first)
            let recommendations = appState.recommendedStories(for: story)
            if !recommendations.isEmpty {
                VStack(alignment: .leading, spacing: 12) {
                    Text("Read Next")
                        .font(.headline)
                        .padding(.top, 8)

                    ForEach(recommendations) { recommended in
                        Button {
                            onStorySelected?(recommended)
                        } label: {
                            RecommendedStoryCard(story: recommended)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }

            // Chapter list (for multi-chapter stories)
            if let chapters = story.chapters, chapters.count > 1 {
                VStack(alignment: .leading, spacing: 8) {
                    Text("All Chapters")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .padding(.top, 8)

                    ForEach(Array(chapters.enumerated()), id: \.element.id) { index, chapter in
                        Button {
                            goToChapter(index)
                        } label: {
                            HStack {
                                Text("\(index + 1).")
                                    .foregroundStyle(.secondary)
                                    .frame(width: 24, alignment: .leading)

                                Text(chapter.titleJapanese ?? chapter.title)
                                    .lineLimit(1)

                                Spacer()

                                if index == currentChapterIndex {
                                    Image(systemName: "checkmark.circle.fill")
                                        .foregroundStyle(.green)
                                }
                            }
                            .padding(.vertical, 8)
                            .padding(.horizontal, 12)
                            .background(index == currentChapterIndex ? Color.accentColor.opacity(0.1) : Color.clear)
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
        .padding(.top, 32)
    }

    private func segmentView(_ segment: StorySegment, index: Int) -> some View {
        let isAudioHighlighted = audioPlayer.isPlaying && audioPlayer.currentSegmentId == segment.id

        return VStack(alignment: .leading, spacing: 8) {
            FuriganaTextView(
                segment: segment,
                fontSize: fontSize,
                showFurigana: showFurigana,
                selectedTokenId: showTooltip ? selectedTokenId : nil,
                onWordTap: { wordInfo, tokenId, frame in
                    selectedWordInfo = wordInfo
                    selectedTokenId = tokenId
                    selectedWordFrame = frame
                    showTooltip = true
                }
            )
        }
        .padding(.vertical, isAudioHighlighted ? 8 : 0)
        .padding(.horizontal, isAudioHighlighted ? 12 : 0)
        .background(
            isAudioHighlighted
                ? Color.blue.opacity(colorScheme == .dark ? 0.2 : 0.1)
                : Color.clear
        )
        .clipShape(RoundedRectangle(cornerRadius: isAudioHighlighted ? 8 : 0))
        .animation(.easeInOut(duration: 0.2), value: isAudioHighlighted)
        .onAppear {
            currentSegmentIndex = max(currentSegmentIndex, index)
        }
        .onTapGesture {
            // Tap segment to seek audio to it
            if hasAudio && segment.hasAudioTiming {
                audioPlayer.seekToSegment(segment.id)
            }
        }
    }

    // MARK: - Auto-scroll

    private var autoScrollIndicator: some View {
        HStack {
            Image(systemName: "arrow.down.circle.fill")
            Text("Release to stop")
        }
        .font(.caption)
        .fontWeight(.medium)
        .foregroundStyle(.white)
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .background(Color.blue.opacity(0.9))
        .clipShape(Capsule())
        .shadow(radius: 4)
    }

    // MARK: - Word Actions

    /// Quickly save a word to vocabulary by looking it up first
    private func quickSaveWord(_ wordInfo: WordInfo) async {
        let lookupWord = wordInfo.lookupWord
        do {
            if let definition = try await DictionaryService.shared.lookup(lookupWord) {
                let vocabItem = VocabularyItem.from(definition, sourceStoryId: story.id)
                await MainActor.run {
                    appState.saveVocabularyItem(vocabItem)
                }
            } else {
                // Save without definition if lookup fails
                let vocabItem = VocabularyItem(
                    word: wordInfo.surface,
                    reading: wordInfo.reading ?? wordInfo.surface,
                    meaning: "(No definition found)",
                    sourceStoryId: story.id
                )
                await MainActor.run {
                    appState.saveVocabularyItem(vocabItem)
                }
            }
        } catch {
            // Save without definition on error
            let vocabItem = VocabularyItem(
                word: wordInfo.surface,
                reading: wordInfo.reading ?? wordInfo.surface,
                meaning: "(Lookup failed)",
                sourceStoryId: story.id
            )
            await MainActor.run {
                appState.saveVocabularyItem(vocabItem)
            }
        }
    }

    // MARK: - Progress

    private func saveProgress() {
        let totalSegments = story.allSegments.count
        let percentComplete = totalSegments > 0
            ? Double(currentSegmentIndex + 1) / Double(totalSegments) * 100.0
            : 0.0

        appState.updateProgress(
            for: story.id,
            segmentIndex: currentSegmentIndex,
            percentComplete: percentComplete
        )
    }

    // MARK: - Audio

    private func loadAudioIfAvailable() async {
        guard let audioURLString = currentAudioURL,
              let audioURL = URL(string: audioURLString) else {
            return
        }

        await audioPlayer.loadAudio(from: audioURL, segments: currentSegments)
    }
}

/// Compact card for recommended stories at the end of a story
struct RecommendedStoryCard: View {
    let story: Story
    @AppStorage("showEnglishTitles") private var showEnglishTitles: Bool = false

    var body: some View {
        HStack(spacing: 12) {
            // Thumbnail
            Group {
                if let urlString = story.metadata.coverImageURL,
                   let url = URL(string: urlString) {
                    AsyncImage(url: url) { phase in
                        switch phase {
                        case .success(let image):
                            image
                                .resizable()
                                .aspectRatio(contentMode: .fill)
                        case .failure, .empty:
                            thumbnailPlaceholder
                        @unknown default:
                            thumbnailPlaceholder
                        }
                    }
                } else {
                    thumbnailPlaceholder
                }
            }
            .frame(width: 60, height: 60)
            .clipShape(RoundedRectangle(cornerRadius: 8))

            VStack(alignment: .leading, spacing: 4) {
                Text(story.metadata.titleJapanese ?? story.metadata.title)
                    .font(.subheadline)
                    .fontWeight(.medium)
                    .lineLimit(1)

                if showEnglishTitles, story.metadata.titleJapanese != nil {
                    Text(story.metadata.title)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }

                HStack(spacing: 8) {
                    Text(story.metadata.genre)
                        .font(.caption2)
                        .foregroundStyle(.secondary)

                    Text("\(story.metadata.wordCount) words")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            }

            Spacer()

            Image(systemName: "chevron.right")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .padding(12)
        .background(Color(.secondarySystemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }

    private var thumbnailPlaceholder: some View {
        RoundedRectangle(cornerRadius: 8)
            .fill(story.metadata.jlptLevel.color.opacity(0.2))
            .overlay {
                Text(story.metadata.jlptLevel.displayName)
                    .font(.caption)
                    .fontWeight(.bold)
                    .foregroundStyle(story.metadata.jlptLevel.color)
            }
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
            summaryJapanese: nil
        ),
        content: [
            StorySegment(
                id: "seg_1",
                text: "私は学生です。毎朝六時に起きます。",
                furigana: nil,
                segmentType: .paragraph
            ),
            StorySegment(
                id: "seg_2",
                text: "朝ごはんを食べます。パンと卵を食べます。",
                furigana: nil,
                segmentType: .paragraph
            )
        ],
        chapters: nil,
        vocabulary: ["私", "学生", "毎朝", "起きる"],
        grammarPoints: nil
    )

    return NavigationStack {
        ReaderView(story: sampleStory)
    }
    .environmentObject(AppState())
}
