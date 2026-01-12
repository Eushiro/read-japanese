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
    @State private var chapterHeights: [Int: CGFloat] = [:]  // Store chapter heights for offset calculation
    @State private var scrollToTargetOffset: CGFloat? = nil  // For programmatic scrolling in continuous mode
    @State private var isScrubbing = false  // Track when user is scrubbing audio
    @State private var scrubPosition: Double = 0  // Temporary position while scrubbing

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

    /// Whether the current chapter/story has audio (checks both chapter and story level)
    private var hasAudio: Bool {
        if let chapter = currentChapter, chapter.audioURL != nil {
            return true
        }
        return story.metadata.audioURL != nil
    }

    /// Current audio URL (chapter or story level), with base URL prepended for relative paths
    private var currentAudioURL: String? {
        let audioPath: String?
        if let chapter = currentChapter {
            audioPath = chapter.audioURL ?? story.metadata.audioURL
        } else {
            audioPath = story.metadata.audioURL
        }

        guard let path = audioPath else { return nil }

        // If it's a relative path, prepend the API base URL
        if path.hasPrefix("/") {
            return APIConfig.baseURL + path
        }
        return path
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
                    .onAppear {
                        containerWidth = screenWidth
                    }
                    .onChange(of: geometry.size.width) { _, newWidth in
                        containerWidth = newWidth
                    }
                }
            }

            // Bottom toolbar (includes audio controls when active)
            nativeBottomToolbar
        }
        .background(Color(.systemBackground))
        .overlay(alignment: .bottom) {
            // Auto-scroll indicator (floating above footer)
            if isAutoScrolling {
                autoScrollIndicator
                    .padding(.bottom, 70)  // Above the bottom toolbar
            }
        }
        .animation(.easeInOut(duration: 0.2), value: showAudioPlayer)
        .animation(.easeInOut(duration: 0.15), value: isAutoScrolling)
        .navigationBarHidden(true)
        .sheet(isPresented: $showSettings) {
            SettingsView()
                .environmentObject(AuthService.shared)
        }
        .onAppear {
            AnalyticsService.shared.track(.readerOpened, properties: [
                "story_id": story.id,
                "jlpt_level": story.metadata.jlptLevel.rawValue
            ])
            AnalyticsService.shared.trackScreen("Reader")
        }
        .onDisappear {
            isAutoScrolling = false
            saveProgress()
            audioPlayer.cleanup()
            AnalyticsService.shared.track(.readerClosed, properties: [
                "story_id": story.id,
                "chapters_read": currentChapterIndex + 1
            ])
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
            // Reset scroll offset when changing chapters (only in paged mode)
            if chapterViewMode == "paged" {
                scrollOffset = 0
            }
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
        VStack(spacing: 0) {
            // Audio scrubber (when audio player is active)
            if showAudioPlayer && hasAudio {
                HStack(spacing: 8) {
                    Text(formatAudioTime(isScrubbing ? scrubPosition : audioPlayer.currentTime))
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                        .monospacedDigit()
                        .frame(width: 40, alignment: .trailing)

                    Slider(
                        value: Binding(
                            get: { isScrubbing ? scrubPosition : audioPlayer.currentTime },
                            set: { newValue in
                                scrubPosition = newValue
                                if !isScrubbing {
                                    isScrubbing = true
                                }
                            }
                        ),
                        in: 0...max(audioPlayer.duration, 1),
                        onEditingChanged: { editing in
                            if !editing {
                                // User finished scrubbing - seek to position
                                audioPlayer.seek(to: scrubPosition)
                                isScrubbing = false
                            }
                        }
                    )
                    .tint(.blue)

                    Text(formatAudioTime(audioPlayer.duration))
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                        .monospacedDigit()
                        .frame(width: 40, alignment: .leading)
                }
                .padding(.horizontal, 20)
                .padding(.top, 8)
            }

            HStack(spacing: 12) {
                // Furigana toggle
                Button {
                    showFurigana.toggle()
                } label: {
                    Image(systemName: "character.book.closed")
                        .font(.system(size: 17, weight: .semibold))
                        .frame(width: 36, height: 36)
                        .background {
                            if showFurigana {
                                Circle().fill(Color.green.opacity(0.2))
                            } else {
                                Circle().fill(.ultraThinMaterial)
                            }
                        }
                }
                .buttonStyle(.plain)
                .foregroundStyle(showFurigana ? .green : .primary)

                // Audio controls (if audio available)
                if hasAudio {
                    if showAudioPlayer {
                        // Expanded audio controls
                        HStack(spacing: 8) {
                            // Skip backward
                            Button {
                                audioPlayer.skipBackward(seconds: 5)
                            } label: {
                                Image(systemName: "gobackward.5")
                                    .font(.system(size: 15, weight: .semibold))
                                    .frame(width: 32, height: 32)
                                    .background(.ultraThinMaterial)
                                    .clipShape(Circle())
                            }
                            .buttonStyle(.plain)
                            .foregroundStyle(.primary)

                            // Play/Pause
                            Button {
                                audioPlayer.togglePlayback()
                            } label: {
                                Image(systemName: audioPlayer.isPlaying ? "pause.fill" : "play.fill")
                                    .font(.system(size: 17, weight: .semibold))
                                    .frame(width: 36, height: 36)
                                    .background(Color.blue)
                                    .clipShape(Circle())
                            }
                            .buttonStyle(.plain)
                            .foregroundStyle(.white)

                            // Skip forward
                            Button {
                                audioPlayer.skipForward(seconds: 5)
                            } label: {
                                Image(systemName: "goforward.5")
                                    .font(.system(size: 15, weight: .semibold))
                                    .frame(width: 32, height: 32)
                                    .background(.ultraThinMaterial)
                                    .clipShape(Circle())
                            }
                            .buttonStyle(.plain)
                            .foregroundStyle(.primary)

                            // Close audio controls
                            Button {
                                showAudioPlayer = false
                            } label: {
                                Image(systemName: "xmark")
                                    .font(.system(size: 14, weight: .semibold))
                                    .frame(width: 28, height: 28)
                                    .background(.ultraThinMaterial)
                                    .clipShape(Circle())
                            }
                            .buttonStyle(.plain)
                            .foregroundStyle(.secondary)
                        }
                    } else {
                        // Collapsed audio button
                        Button {
                            showAudioPlayer = true
                        } label: {
                            Image(systemName: audioPlayer.isPlaying ? "waveform" : "speaker.wave.2")
                                .font(.system(size: 17, weight: .semibold))
                                .frame(width: 36, height: 36)
                                .background {
                                    if audioPlayer.isPlaying {
                                        Circle().fill(Color.blue.opacity(0.2))
                                    } else {
                                        Circle().fill(.ultraThinMaterial)
                                    }
                                }
                        }
                        .buttonStyle(.plain)
                        .foregroundStyle(audioPlayer.isPlaying ? .blue : .primary)
                    }
                }

                Spacer()

                // Chapter menu (only show for multi-chapter stories, hide when audio expanded)
                if story.hasChapters, let chapters = story.chapters, !showAudioPlayer {
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
                    .id(currentChapterIndex)
                    .menuOrder(.fixed)
                    .foregroundStyle(.primary)
                }

                // Settings button (hide when audio expanded)
                if !showAudioPlayer {
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
                }

                #if DEBUG
                // Debug: Toggle between paged and continuous mode (hide when audio expanded)
                if !showAudioPlayer {
                    Button {
                        chapterViewMode = chapterViewMode == "paged" ? "continuous" : "paged"
                    } label: {
                        Image(systemName: chapterViewMode == "paged" ? "rectangle.split.3x1" : "scroll")
                            .font(.system(size: 17, weight: .semibold))
                            .frame(width: 36, height: 36)
                            .background(.ultraThinMaterial)
                            .clipShape(Circle())
                    }
                    .buttonStyle(.plain)
                    .foregroundStyle(.primary)
                }
                #endif

                // Previous/Next chapter buttons (only show for multi-chapter stories in paged mode, hide when audio expanded)
                if story.hasChapters && chapterViewMode == "paged" && !showAudioPlayer {
                    HStack(spacing: 8) {
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
        }
        .background(Color(.systemBackground))
        .overlay(alignment: .top) {
            Divider()
        }
    }

    /// Format audio time as m:ss
    private func formatAudioTime(_ seconds: Double) -> String {
        let mins = Int(seconds) / 60
        let secs = Int(seconds) % 60
        return String(format: "%d:%02d", mins, secs)
    }

    // MARK: - Story Content

    /// Helper to create a continuous scroll view with all chapters
    private func continuousScrollView(width: CGFloat) -> some View {
        AutoScrollView(
            isAutoScrolling: $isAutoScrolling,
            scrollOffset: $scrollOffset,
            scrollToOffset: $scrollToTargetOffset,
            scrollSpeed: scrollSpeedPointsPerSecond,
            onSwipeBack: { onDismiss?() }
        ) {
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
                    .background(
                        GeometryReader { geo in
                            Color.clear
                                .onAppear {
                                    // Capture chapter height on initial layout
                                    chapterHeights[chapterIndex] = geo.size.height
                                }
                                .onChange(of: geo.size.height) { _, newHeight in
                                    chapterHeights[chapterIndex] = newHeight
                                }
                        }
                    )
                }
            }
            .frame(maxWidth: .infinity)
            .padding(.horizontal, 24)
            .padding(.top, 4)
            .padding(.bottom, 32)
        }
        .onChange(of: scrollOffset) { _, newOffset in
            // Update chapter marker on any scroll change
            updateVisibleChapter(for: newOffset)
        }
        .onChange(of: scrollToChapterIndex) { _, newIndex in
            if let index = newIndex {
                // Small delay to ensure chapter heights are captured
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                    // Calculate offset for the target chapter
                    let targetOffset = calculateChapterOffset(for: index)
                    if targetOffset > 0 || index == 0 {
                        scrollToTargetOffset = targetOffset
                        currentChapterIndex = index
                    }
                }
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.6) {
                    scrollToChapterIndex = nil
                }
            }
        }
        .frame(width: width)
    }

    /// Calculate the scroll offset for a given chapter index
    private func calculateChapterOffset(for chapterIndex: Int) -> CGFloat {
        let topPadding: CGFloat = 16
        let chapterSpacing: CGFloat = 48
        var offset = topPadding

        for i in 0..<chapterIndex {
            offset += (chapterHeights[i] ?? 0) + chapterSpacing
        }

        return offset
    }

    /// Update which chapter is currently visible based on scroll offset
    private func updateVisibleChapter(for offset: CGFloat) {
        // Don't update if we don't have chapter heights yet
        guard !chapterHeights.isEmpty else { return }

        let topPadding: CGFloat = 16
        let chapterSpacing: CGFloat = 48
        var cumulativeOffset = topPadding

        for i in 0..<story.chapterCount {
            // Skip if we don't have height for this chapter yet
            guard let chapterHeight = chapterHeights[i], chapterHeight > 0 else { continue }
            let chapterEnd = cumulativeOffset + chapterHeight

            // Chapter is visible if scroll position is within its bounds
            if offset < chapterEnd - 50 {  // 50pt threshold before switching
                if currentChapterIndex != i {
                    currentChapterIndex = i
                }
                return
            }

            cumulativeOffset = chapterEnd + chapterSpacing
        }

        // If scrolled past all chapters, set to last chapter
        if currentChapterIndex != story.chapterCount - 1 {
            currentChapterIndex = story.chapterCount - 1
        }
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
                .padding(.top, 4)
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

        return VStack(alignment: .leading, spacing: 24) {
            // Chapter header (title only)
            if let chapter = chapter {
                VStack(alignment: .leading, spacing: 4) {
                    // Chapter title with furigana if available
                    if let titleTokens = chapter.titleTokens, !titleTokens.isEmpty {
                        chapterTitleWithFurigana(tokens: titleTokens, chapterIndex: chapterIndex)
                    } else if let titleJapanese = chapter.titleJapanese {
                        // Make plain Japanese title tappable
                        tappableChapterTitle(titleJapanese, chapterIndex: chapterIndex)
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
            }

            // Story segments for this chapter
            ForEach(Array(segments.enumerated()), id: \.element.id) { index, segment in
                segmentView(segment, index: index)
                    .id(segment.id)
            }

            // Chapter image at end of chapter (before completion section)
            if let chapter = chapter,
               let imageURL = chapter.imageURL,
               let url = URL(string: imageURL) {
                chapterImageView(url: url)
                    .padding(.top, 8)
            }

            // Completion section (only on last chapter or single-chapter stories)
            if isLast {
                completionSection
            }
        }
    }

    // Chapter title with furigana support and tappable words
    private func chapterTitleWithFurigana(tokens: [Token], chapterIndex: Int) -> some View {
        WrappingHStack(alignment: .bottom, spacing: 0) {
            ForEach(Array(tokens.enumerated()), id: \.offset) { index, token in
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
                    // Tappable word token
                    let tokenId = "chapter_\(chapterIndex)_title_\(index)"
                    let wordInfo = WordInfo.from(token)
                    let isSelected = selectedTokenId == tokenId

                    ChapterTitleTokenView(
                        token: token,
                        showFurigana: showFurigana,
                        furiganaColor: furiganaColor,
                        isSelected: isSelected,
                        onTap: { frame in
                            selectedWordInfo = wordInfo
                            selectedTokenId = tokenId
                            selectedWordFrame = frame
                            showTooltip = true
                        },
                        onLongPress: {
                            Task {
                                await quickSaveWord(wordInfo)
                                await MainActor.run {
                                    showSaveToast = true
                                    DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
                                        showSaveToast = false
                                    }
                                }
                            }
                        }
                    )
                }
            }
        }
    }

    // Chapter image view with async loading - adapts to image's natural aspect ratio
    private func chapterImageView(url: URL) -> some View {
        AsyncImage(url: url) { phase in
            switch phase {
            case .empty:
                // Loading placeholder with 1:1 default aspect ratio
                RoundedRectangle(cornerRadius: 12)
                    .fill(Color(.secondarySystemBackground))
                    .aspectRatio(1, contentMode: .fit)
                    .frame(maxWidth: 400)
                    .overlay {
                        ProgressView()
                    }
            case .success(let image):
                image
                    .resizable()
                    .aspectRatio(contentMode: .fit)
                    .frame(maxWidth: 400)
                    .clipShape(RoundedRectangle(cornerRadius: 12))
            case .failure:
                // Error state - show nothing or placeholder
                EmptyView()
            @unknown default:
                EmptyView()
            }
        }
        .frame(maxWidth: .infinity, alignment: .center)
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

    // MARK: - Tappable Chapter Title (non-tokenized)

    private func tappableChapterTitle(_ title: String, chapterIndex: Int) -> some View {
        TappableChapterTitleView(
            title: title,
            chapterIndex: chapterIndex,
            isSelected: selectedTokenId == "chapter_\(chapterIndex)_title_plain",
            colorScheme: colorScheme,
            onTap: { frame in
                selectedWordInfo = WordInfo.surface(title)
                selectedTokenId = "chapter_\(chapterIndex)_title_plain"
                selectedWordFrame = frame
                showTooltip = true
            },
            onLongPress: {
                Task {
                    await quickSaveWord(WordInfo.surface(title))
                    await MainActor.run {
                        showSaveToast = true
                        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
                            showSaveToast = false
                        }
                    }
                }
            }
        )
    }
}

/// Tappable chapter title view that properly captures its frame
struct TappableChapterTitleView: View {
    let title: String
    let chapterIndex: Int
    let isSelected: Bool
    let colorScheme: ColorScheme
    var onTap: ((CGRect) -> Void)?
    var onLongPress: (() -> Void)?

    @State private var viewFrame: CGRect = .zero
    @State private var isPressed = false

    private var highlightColor: Color {
        guard isPressed || isSelected else { return Color.clear }
        return colorScheme == .dark ? Color.blue.opacity(0.4) : Color.blue.opacity(0.25)
    }

    var body: some View {
        Text(title)
            .font(.title3)
            .fontWeight(.semibold)
            .padding(.horizontal, 4)
            .padding(.vertical, 2)
            .background(highlightColor)
            .cornerRadius(4)
            .background(
                GeometryReader { geo in
                    Color.clear
                        .onAppear { viewFrame = geo.frame(in: .global) }
                        .onChange(of: geo.frame(in: .global)) { _, newFrame in
                            viewFrame = newFrame
                        }
                }
            )
            .contentShape(Rectangle())
            .onTapGesture {
                onTap?(viewFrame)
            }
            .onLongPressGesture(minimumDuration: 0.3, pressing: { pressing in
                isPressed = pressing
            }, perform: {
                onLongPress?()
                isPressed = false
            })
    }
}

// MARK: - Chapter Title Token View

/// A tappable token view for chapter titles with furigana support
struct ChapterTitleTokenView: View {
    let token: Token
    let showFurigana: Bool
    let furiganaColor: Color
    var isSelected: Bool = false
    var onTap: ((CGRect) -> Void)?
    var onLongPress: (() -> Void)?

    @State private var isPressed = false
    @State private var viewFrame: CGRect = .zero
    @Environment(\.colorScheme) private var colorScheme

    private var highlightColor: Color {
        guard isPressed || isSelected else { return Color.clear }
        return colorScheme == .dark ? Color.blue.opacity(0.4) : Color.blue.opacity(0.25)
    }

    var body: some View {
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
        .background(highlightColor)
        .cornerRadius(4)
        .background(
            GeometryReader { geo in
                Color.clear
                    .onAppear { viewFrame = geo.frame(in: .global) }
                    .onChange(of: geo.frame(in: .global)) { _, newFrame in
                        viewFrame = newFrame
                    }
            }
        )
        .contentShape(Rectangle())
        .onTapGesture {
            onTap?(viewFrame)
        }
        .onLongPressGesture(minimumDuration: 0.3, pressing: { pressing in
            isPressed = pressing
        }, perform: {
            onLongPress?()
            isPressed = false
        })
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
