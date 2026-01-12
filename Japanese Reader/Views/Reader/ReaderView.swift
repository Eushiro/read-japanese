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
    @State private var showSaveToast = false  // Toast for save confirmation
    @State private var scrollOffset: CGFloat = 0
    @State private var containerWidth: CGFloat = 0
    @State private var showAudioPlayer = false
    @State private var scrollToChapterIndex: Int? = nil  // For continuous mode scrolling
    @State private var continuousScrollProxy: ScrollViewProxy? = nil

    // Audio player
    @StateObject private var audioPlayer = AudioPlayerService()

    // Settings (persisted)
    @AppStorage("autoScrollSpeed") private var autoScrollSpeed: Double = 300.0
    @AppStorage("fontSize") private var fontSize: Double = 20.0
    @AppStorage("showFurigana") private var showFurigana: Bool = true
    @AppStorage("showEnglishTitles") private var showEnglishTitles: Bool = false
    @AppStorage("chapterViewMode") private var chapterViewMode: String = "paged"

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
        VStack(spacing: 0) {
            // Sticky header
            stickyHeader

            // Main content
            GeometryReader { geometry in
                let screenWidth = geometry.size.width

                if chapterViewMode == "continuous" {
                    // Continuous mode - all chapters in one scrolling view
                    continuousScrollView(width: screenWidth)
                        .overlay(alignment: .bottom) {
                            if isAutoScrolling {
                                autoScrollIndicator
                                    .padding(.bottom, 100)
                            }
                        }
                        .onAppear {
                            containerWidth = screenWidth
                        }
                        .onChange(of: geometry.size.width) { _, newWidth in
                            containerWidth = newWidth
                        }
                } else {
                    // Paged mode - native paging TabView for chapters
                    TabView(selection: $currentChapterIndex.animation(.easeInOut(duration: 0.3))) {
                        // Dismiss page (transparent, triggers dismiss when swiped to)
                        Color.clear
                            .tag(-1)

                        ForEach(0..<max(story.chapterCount, 1), id: \.self) { index in
                            chapterScrollView(forChapterIndex: index, width: screenWidth)
                                .tag(index)
                        }
                    }
                    .tabViewStyle(.page(indexDisplayMode: .never))
                    .overlay(alignment: .bottom) {
                        if isAutoScrolling {
                            autoScrollIndicator
                                .padding(.bottom, 100)
                        }
                    }
                    .onAppear {
                        containerWidth = screenWidth
                    }
                    .onChange(of: geometry.size.width) { _, newWidth in
                        containerWidth = newWidth
                    }
                }
            }

            // Audio player bar (shown when toggled)
            if showAudioPlayer && hasAudio {
                AudioPlayerBar(audioPlayer: audioPlayer)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
            }

            // Bottom toolbar
            nativeBottomToolbar
        }
        .background(Color(.systemBackground))
        .animation(.easeInOut(duration: 0.2), value: showAudioPlayer)
        .navigationBarHidden(true)
        .sheet(isPresented: $showSettings) {
            SettingsView()
        }
        .onDisappear {
            isAutoScrolling = false
            saveProgress()
            audioPlayer.cleanup()
        }
        .onChange(of: story.id) { _, _ in
            // Reset to first chapter when a new story is selected
            currentChapterIndex = 0
            scrollOffset = 0
        }
        .task {
            await loadAudioIfAvailable()
        }
        .onChange(of: currentChapterIndex) { _, newIndex in
            // Dismiss when swiping to the dismiss page (index -1)
            if newIndex == -1 {
                onDismiss?()
                return
            }
            // Reset scroll offset when changing chapters (for swipe gestures)
            scrollOffset = 0
            // Auto-mark as read when reaching the last chapter
            if newIndex >= story.chapterCount - 1 && newIndex >= 0 {
                appState.markCompleted(storyId: story.id)
            }
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
                        dismissTooltip()
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

                    // Position so tooltip is above the word
                    let tooltipY = max(
                        localWordFrame.minY - tooltipSize.height / 2 - 8,
                        tooltipSize.height / 2 + 16
                    )

                    WordActionTooltip(
                        wordInfo: wordInfo,
                        position: CGPoint(x: tooltipX, y: tooltipY),
                        isAlreadySaved: appState.isInVocabulary(word: wordInfo.lookupWord),
                        onAddToVocabulary: {
                            Task {
                                await quickSaveWord(wordInfo)
                            }
                        },
                        onRemoveFromVocabulary: {
                            appState.removeVocabularyItemByWord(wordInfo.lookupWord)
                        },
                        onViewDefinition: {
                            // Don't clear selectedWordInfo - we need it for definition
                            showTooltip = false
                            selectedTokenId = nil
                            showDefinition = true
                        },
                        onDismiss: {
                            dismissTooltip()
                        }
                    )
                    .position(x: tooltipX, y: tooltipY)
                }
                .transition(.asymmetric(insertion: .identity, removal: .opacity))
            }
        }
        .animation(.easeOut(duration: 0.15), value: showTooltip)
        .overlay(alignment: .bottomTrailing) {
            // Save toast notification
            if showSaveToast {
                SaveToast()
                    .padding(.trailing, 16)
                    .padding(.bottom, 100)
                    .transition(.move(edge: .trailing).combined(with: .opacity))
            }
        }
        .animation(.spring(response: 0.3, dampingFraction: 0.8), value: showSaveToast)
        .overlay {
            // Compact definition view
            if showDefinition, let wordInfo = selectedWordInfo {
                Color.black.opacity(0.3)
                    .ignoresSafeArea()
                    .onTapGesture {
                        showDefinition = false
                        dismissTooltip()
                    }

                CompactDefinitionView(
                    wordInfo: wordInfo,
                    onDismiss: {
                        showDefinition = false
                        dismissTooltip()
                    }
                )
                .transition(.opacity)
            }
        }
        .animation(.easeOut(duration: 0.15), value: showDefinition)
    }

    // MARK: - Sticky Header

    private var stickyHeader: some View {
        VStack(spacing: 0) {
            HStack(spacing: 12) {
                // Back button with larger tap area
                Button {
                    onDismiss?()
                } label: {
                    Image(systemName: "chevron.left")
                        .font(.system(size: 17, weight: .semibold))
                        .foregroundStyle(.primary)
                        .frame(width: 36, height: 36)
                        .background(.ultraThinMaterial, in: Circle())
                }
                .buttonStyle(.plain)
                .frame(width: 44, height: 44)
                .contentShape(Rectangle())

                // Title and info
                VStack(alignment: .leading, spacing: 2) {
                    VStack(alignment: .leading, spacing: 0) {
                        Text(story.metadata.titleJapanese ?? story.metadata.title)
                            .font(.headline)
                            .lineLimit(1)

                        if showEnglishTitles, story.metadata.titleJapanese != nil {
                            Text(story.metadata.title)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                                .lineLimit(1)
                        }
                    }

                    HStack(spacing: 6) {
                        Text(story.metadata.jlptLevel.displayName)
                            .font(.caption)
                            .fontWeight(.semibold)
                            .foregroundStyle(story.metadata.jlptLevel.color)

                        if story.hasChapters {
                            Text("•")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                            if chapterViewMode == "continuous" {
                                Text("\(story.chapterCount) chapters")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            } else {
                                Text("Chapter \(currentChapterIndex + 1) of \(story.chapterCount)")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }
                }
                .allowsHitTesting(false)

                Spacer()
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 10)

            Divider()
        }
        .background(Color(.systemBackground))
    }

    // MARK: - Bottom Toolbar

    private var nativeBottomToolbar: some View {
        HStack(spacing: 16) {
            // Furigana toggle (old style with checkmark)
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

            // Chapter menu (only show for multi-chapter stories)
            if story.hasChapters, let chapters = story.chapters {
                Menu {
                    ForEach(Array(chapters.enumerated()), id: \.element.id) { index, chapter in
                        Button {
                            goToChapter(index)
                        } label: {
                            HStack {
                                Text("\(index + 1). \(chapter.titleJapanese ?? chapter.title)")
                                if index == currentChapterIndex {
                                    Image(systemName: "checkmark")
                                }
                            }
                        }
                    }
                } label: {
                    Image(systemName: "list.bullet")
                        .font(.system(size: 17, weight: .semibold))
                        .frame(width: 36, height: 36)
                        .background(.ultraThinMaterial)
                        .clipShape(Circle())
                }
                .menuOrder(.fixed)
                .foregroundStyle(.primary)
            }

            // Settings button
            Button {
                showSettings = true
            } label: {
                Image(systemName: "gearshape")
                    .font(.system(size: 17, weight: .semibold))
                    .frame(width: 36, height: 36)
                    .background(.ultraThinMaterial)
                    .clipShape(Circle())
            }
            .buttonStyle(.plain)
            .foregroundStyle(.primary)

            // Previous/Next chapter buttons (only show for multi-chapter stories in paged mode)
            if story.hasChapters && chapterViewMode == "paged" {
                HStack(spacing: 12) {
                    Button {
                        goToPreviousChapter()
                    } label: {
                        Image(systemName: "chevron.left")
                            .font(.system(size: 17, weight: .semibold))
                            .frame(width: 36, height: 36)
                            .background(.ultraThinMaterial)
                            .clipShape(Circle())
                    }
                    .buttonStyle(.plain)
                    .disabled(currentChapterIndex <= 0)
                    .opacity(currentChapterIndex <= 0 ? 0.3 : 1)

                    Button {
                        goToNextChapter()
                    } label: {
                        Image(systemName: "chevron.right")
                            .font(.system(size: 17, weight: .semibold))
                            .frame(width: 36, height: 36)
                            .background(.ultraThinMaterial)
                            .clipShape(Circle())
                    }
                    .buttonStyle(.plain)
                    .disabled(currentChapterIndex >= story.chapterCount - 1)
                    .opacity(currentChapterIndex >= story.chapterCount - 1 ? 0.3 : 1)
                }
            }
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 10)
        .background(Color(.systemBackground))
        .overlay(alignment: .top) {
            Divider()
        }
    }

    // MARK: - Story Content

    /// Helper to create a continuous scroll view with all chapters
    private func continuousScrollView(width: CGFloat) -> some View {
        ScrollViewReader { proxy in
            ScrollView(.vertical, showsIndicators: true) {
                VStack(alignment: .leading, spacing: 48) {
                    ForEach(0..<max(story.chapterCount, 1), id: \.self) { chapterIndex in
                        VStack(alignment: .leading, spacing: 24) {
                            // Chapter number indicator for continuous mode
                            if story.hasChapters {
                                HStack(spacing: 8) {
                                    Text("Chapter \(chapterIndex + 1)/\(story.chapterCount)")
                                        .font(.caption)
                                        .fontWeight(.semibold)
                                        .foregroundStyle(.secondary)

                                    Rectangle()
                                        .fill(Color.secondary.opacity(0.3))
                                        .frame(height: 1)
                                }
                                .padding(.bottom, 4)
                            }

                            chapterBodyContent(forChapterIndex: chapterIndex)
                        }
                        .id("chapter_\(chapterIndex)")
                        .background(
                            GeometryReader { geo in
                                Color.clear
                                    .preference(
                                        key: VisibleChapterPreferenceKey.self,
                                        value: geo.frame(in: .named("continuousScroll")).minY < 100 ? chapterIndex : -1
                                    )
                            }
                        )
                    }
                }
                .frame(maxWidth: .infinity)
                .padding(.horizontal, 24)
                .padding(.top, 16)
                .padding(.bottom, 32)
            }
            .coordinateSpace(name: "continuousScroll")
            .onPreferenceChange(VisibleChapterPreferenceKey.self) { visibleIndex in
                if visibleIndex >= 0 && visibleIndex != currentChapterIndex {
                    currentChapterIndex = visibleIndex
                }
            }
            .onAppear {
                continuousScrollProxy = proxy
            }
            .onChange(of: scrollToChapterIndex) { _, newIndex in
                if let index = newIndex {
                    withAnimation(.easeInOut(duration: 0.3)) {
                        proxy.scrollTo("chapter_\(index)", anchor: .top)
                    }
                    // Update current chapter immediately when navigating
                    currentChapterIndex = index
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) {
                        scrollToChapterIndex = nil
                    }
                }
            }
        }
        .frame(width: width)
    }

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
                .padding(.top, 16)
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

    /// Navigate to next chapter (binding animation handles transition)
    private func goToNextChapter() {
        let nextIndex = currentChapterIndex + 1
        guard nextIndex < story.chapterCount else { return }
        scrollOffset = 0
        currentChapterIndex = nextIndex
    }

    /// Navigate to previous chapter (binding animation handles transition)
    private func goToPreviousChapter() {
        guard currentChapterIndex > 0 else { return }
        scrollOffset = 0
        currentChapterIndex -= 1
    }

    /// Navigate to specific chapter (binding animation handles transition)
    private func goToChapter(_ index: Int) {
        guard index >= 0 && index < story.chapterCount else { return }

        if chapterViewMode == "continuous" {
            // In continuous mode, scroll to the chapter
            scrollToChapterIndex = index
        } else {
            // In paged mode, change chapter index
            guard index != currentChapterIndex else { return }
            scrollOffset = 0
            currentChapterIndex = index
        }
    }

    // Scrollable chapter body content for a specific chapter index
    private func chapterBodyContent(forChapterIndex chapterIndex: Int) -> some View {
        let segments = story.segments(forChapter: chapterIndex)
        let chapter: Chapter? = story.hasChapters ? story.chapters?[safe: chapterIndex] : nil
        let isLast = chapterIndex >= story.chapterCount - 1
        let hasChapterImage = chapter?.imageURL != nil

        return VStack(alignment: .leading, spacing: 24) {
            // Chapter header (title + optional image)
            if let chapter = chapter {
                VStack(alignment: .leading, spacing: hasChapterImage ? 16 : 8) {
                    // Chapter title
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

                    // Chapter image
                    if let imageURL = chapter.imageURL, let url = URL(string: imageURL) {
                        chapterImageView(url: url)
                    }
                }
                .padding(.bottom, hasChapterImage ? 0 : -8)
            }

            // Story segments for this chapter
            ForEach(Array(segments.enumerated()), id: \.element.id) { index, segment in
                segmentView(segment, index: index)
                    .id(segment.id)
            }

            // Completion section (only on last chapter or single-chapter stories)
            if isLast {
                completionSection
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


    // MARK: - Completion Section

    private var completionSection: some View {
        VStack(spacing: 20) {
            HStack(spacing: 8) {
                Image(systemName: "checkmark.circle.fill")
                    .foregroundStyle(.green)
                Text("Story Complete!")
                    .font(.title2)
                    .fontWeight(.bold)
            }

            // Recommended stories
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
                                .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
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
                },
                onWordLongPress: { wordInfo in
                    // Long press saves directly with toast
                    Task {
                        await quickSaveWord(wordInfo)
                        await MainActor.run {
                            showSaveToast = true
                            // Auto-hide after delay
                            DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
                                showSaveToast = false
                            }
                        }
                    }
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

    /// Dismiss the word action tooltip
    private func dismissTooltip() {
        showTooltip = false
        selectedWordInfo = nil
        selectedTokenId = nil
    }

    /// Quickly save a word to vocabulary by looking it up first
    private func quickSaveWord(_ wordInfo: WordInfo) async {
        let wordToSave = wordInfo.lookupWord  // Always use base form for consistency
        do {
            if let definition = try await DictionaryService.shared.lookup(wordToSave) {
                // Use lookupWord as the saved word for consistent matching
                let vocabItem = VocabularyItem(
                    word: wordToSave,
                    reading: definition.reading,
                    meaning: definition.definitions.joined(separator: "; "),
                    jlptLevel: definition.jlptLevel,
                    sourceStoryId: story.id
                )
                await MainActor.run {
                    appState.saveVocabularyItem(vocabItem)
                }
            } else {
                // Save without definition if lookup fails
                let vocabItem = VocabularyItem(
                    word: wordToSave,
                    reading: wordInfo.reading ?? wordToSave,
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
                word: wordToSave,
                reading: wordInfo.reading ?? wordToSave,
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
                    JLPTBadge(level: story.metadata.jlptLevel)

                    Text(story.metadata.genre)
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

/// Small toast notification for save confirmation
struct SaveToast: View {
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        HStack(spacing: 6) {
            Image(systemName: "checkmark.circle.fill")
                .foregroundStyle(.green)
            Text("Saved")
                .font(.subheadline)
                .fontWeight(.medium)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(.ultraThinMaterial)
        .clipShape(Capsule())
        .shadow(color: .black.opacity(colorScheme == .dark ? 0.3 : 0.1), radius: 8, x: 0, y: 4)
    }
}

/// Native-style chapter row with tap feedback
struct ChapterRow: View {
    let index: Int
    let title: String
    let isCurrentChapter: Bool
    let action: () -> Void

    @State private var isPressed = false

    var body: some View {
        Button(action: action) {
            HStack {
                Text("\(index + 1).")
                    .foregroundStyle(.secondary)
                    .frame(width: 28, alignment: .leading)

                Text(title)
                    .lineLimit(1)
                    .foregroundStyle(.primary)

                Spacer()

                if isCurrentChapter {
                    Image(systemName: "checkmark")
                        .font(.body.weight(.semibold))
                        .foregroundStyle(Color.accentColor)
                }
            }
            .padding(.vertical, 12)
            .padding(.horizontal, 16)
            .contentShape(Rectangle())
            .background(isPressed ? Color.primary.opacity(0.1) : Color.clear)
        }
        .buttonStyle(ChapterRowButtonStyle(isPressed: $isPressed))
    }
}

/// Button style that tracks press state for highlight effect
struct ChapterRowButtonStyle: ButtonStyle {
    @Binding var isPressed: Bool

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .onChange(of: configuration.isPressed) { _, newValue in
                isPressed = newValue
            }
    }
}

/// Preference key for tracking which chapter is currently visible in continuous scroll mode
struct VisibleChapterPreferenceKey: PreferenceKey {
    static var defaultValue: Int = -1

    static func reduce(value: inout Int, nextValue: () -> Int) {
        let next = nextValue()
        // Keep the highest valid chapter index (the one closest to top)
        if next >= 0 {
            value = max(value, next)
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
