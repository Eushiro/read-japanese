import SwiftUI

// MARK: - FuriganaTextView

/// Displays Japanese text with furigana (reading annotations) above kanji
/// Supports both tokenized format (new) and legacy text+furigana format
struct FuriganaTextView: View {
    let segment: StorySegment
    let fontSize: CGFloat
    let showFurigana: Bool
    var isAudioHighlighted: Bool = false  // True when this segment is being read aloud (sentence mode)
    var currentAudioWord: String? = nil   // Current word being spoken (word mode)
    var currentAudioWordStart: Double? = nil  // Start time of current word for matching
    var selectedTokenId: String? = nil  // Unique token ID for highlighting (segment.id + index)
    var onWordTap: ((WordInfo, String, CGRect) -> Void)? = nil  // (wordInfo, tokenId, frame)
    var onWordLongPress: ((WordInfo) -> Void)? = nil  // Long press to save

    @AppStorage("fontName") private var fontName: String = "System"

    private var selectedFont: JapaneseFont {
        JapaneseFont(rawValue: fontName) ?? .system
    }

    var body: some View {
        WrappingHStack(alignment: .bottom, spacing: 0) {
            if segment.isTokenized, let tokens = segment.tokens {
                // New tokenized format
                ForEach(Array(tokens.enumerated()), id: \.offset) { index, token in
                    let tokenId = "\(segment.id)_\(index)"
                    tokenView(for: token, tokenId: tokenId)
                }
            } else {
                // Legacy format
                ForEach(Array(buildTextParts().enumerated()), id: \.offset) { index, part in
                    let partId = "\(segment.id)_\(index)"
                    wordButton(for: part, partId: partId)
                }
            }
        }
    }

    // MARK: - Tokenized Format Views

    /// Characters that should have a space after them for readability
    private let sentenceEndingPunctuation: Set<Character> = ["。", "！", "？", "!", "?", "」", "』", "）", ")"]

    @ViewBuilder
    private func tokenView(for token: Token, tokenId: String) -> some View {
        if token.isPunctuation {
            // Non-tappable punctuation with optional trailing space
            let needsSpace = token.surface.last.map { sentenceEndingPunctuation.contains($0) } ?? false
            HStack(spacing: 0) {
                VStack(spacing: 0) {
                    // Always reserve furigana space for consistent layout
                    Text(" ")
                        .font(selectedFont.font(size: fontSize * 0.5))
                        .opacity(0)

                    Text(token.surface)
                        .font(selectedFont.font(size: fontSize))
                }
                .fixedSize(horizontal: true, vertical: false)

                // Add space after sentence-ending punctuation
                if needsSpace {
                    Text(" ")
                        .font(selectedFont.font(size: fontSize * 0.3))
                }
            }
        } else {
            // Tappable word with parts-based furigana
            let wordInfo = WordInfo.from(token)
            let isSelected = selectedTokenId == tokenId
            // Check if this word matches the current audio word (bidirectional matching)
            // Match if token contains the audio word OR audio word contains the token
            let isWordHighlighted: Bool = {
                guard let audioWord = currentAudioWord, !audioWord.isEmpty else { return false }
                return token.surface.contains(audioWord) || audioWord.contains(token.surface)
            }()
            TokenPartsView(
                token: token,
                fontSize: fontSize,
                fontName: fontName,
                showFurigana: showFurigana,
                isAudioHighlighted: isAudioHighlighted,
                isWordHighlighted: isWordHighlighted,
                isSelected: isSelected,
                onTap: { onWordTap?(wordInfo, tokenId, $0) },
                onLongPress: { onWordLongPress?(wordInfo) }
            )
        }
    }

    // MARK: - Legacy Format Support

    @ViewBuilder
    private func wordButton(for part: TextPart, partId: String) -> some View {
        if part.isWord {
            // Tappable word (with or without furigana)
            let wordInfo = WordInfo.surface(part.text)
            let isSelected = selectedTokenId == partId
            // Check if this word matches the current audio word (bidirectional matching)
            let isWordHighlighted: Bool = {
                guard let audioWord = currentAudioWord, !audioWord.isEmpty else { return false }
                return part.text.contains(audioWord) || audioWord.contains(part.text)
            }()
            WordTapView(
                wordInfo: wordInfo,
                displayReading: showFurigana ? part.reading : nil,
                fontSize: fontSize,
                fontName: fontName,
                isAudioHighlighted: isAudioHighlighted,
                isWordHighlighted: isWordHighlighted,
                isSelected: isSelected,
                onTap: { info, frame in onWordTap?(info, partId, frame) },
                onLongPress: { info in onWordLongPress?(info) }
            )
        } else {
            // Non-tappable text (punctuation) with optional trailing space
            let needsSpace = part.text.last.map { sentenceEndingPunctuation.contains($0) } ?? false
            HStack(spacing: 0) {
                VStack(spacing: 0) {
                    // Always reserve furigana space for consistent layout
                    Text(" ")
                        .font(selectedFont.font(size: fontSize * 0.5))
                        .opacity(0)

                    Text(part.text)
                        .font(selectedFont.font(size: fontSize))
                }
                .fixedSize(horizontal: true, vertical: false)

                // Add space after sentence-ending punctuation
                if needsSpace {
                    Text(" ")
                        .font(selectedFont.font(size: fontSize * 0.3))
                }
            }
        }
    }

    // MARK: - Text Part Model (Legacy)

    private struct TextPart {
        let text: String
        let reading: String?
        let isWord: Bool
    }

    // MARK: - Text Parsing (Legacy)

    private func buildTextParts() -> [TextPart] {
        let text = segment.text ?? ""
        let furigana = segment.furigana ?? []

        var parts: [TextPart] = []
        var currentIndex = 0

        let sortedFurigana = furigana.sorted { $0.rangeStart < $1.rangeStart }

        for annotation in sortedFurigana {
            guard annotation.rangeStart >= currentIndex,
                  annotation.rangeStart + annotation.rangeLength <= text.count else {
                continue
            }

            // Add text before this annotation
            if annotation.rangeStart > currentIndex {
                let beforeText = substring(text, from: currentIndex, to: annotation.rangeStart)
                if !beforeText.isEmpty {
                    parts.append(contentsOf: splitIntoUnits(beforeText))
                }
            }

            // Add the annotated word
            let wordText = substring(text, from: annotation.rangeStart, length: annotation.rangeLength)
            parts.append(TextPart(text: wordText, reading: annotation.reading, isWord: true))

            currentIndex = annotation.rangeStart + annotation.rangeLength
        }

        // Add remaining text
        if currentIndex < text.count {
            let remainingText = substring(text, from: currentIndex, to: text.count)
            if !remainingText.isEmpty {
                parts.append(contentsOf: splitIntoUnits(remainingText))
            }
        }

        // Handle empty result
        if parts.isEmpty && !text.isEmpty {
            parts.append(TextPart(text: text, reading: nil, isWord: isJapaneseWord(text)))
        }

        return parts
    }

    private func splitIntoUnits(_ text: String) -> [TextPart] {
        var parts: [TextPart] = []
        var currentWord = ""

        for char in text {
            if isPunctuation(char) {
                if !currentWord.isEmpty {
                    parts.append(TextPart(text: currentWord, reading: nil, isWord: isJapaneseWord(currentWord)))
                    currentWord = ""
                }
                parts.append(TextPart(text: String(char), reading: nil, isWord: false))
            } else {
                currentWord.append(char)
            }
        }

        if !currentWord.isEmpty {
            parts.append(TextPart(text: currentWord, reading: nil, isWord: isJapaneseWord(currentWord)))
        }

        return parts
    }

    private func substring(_ text: String, from start: Int, to end: Int) -> String {
        guard start >= 0, end <= text.count, start < end else { return "" }
        let startIdx = text.index(text.startIndex, offsetBy: start)
        let endIdx = text.index(text.startIndex, offsetBy: end)
        return String(text[startIdx..<endIdx])
    }

    private func substring(_ text: String, from start: Int, length: Int) -> String {
        substring(text, from: start, to: start + length)
    }

    private func isPunctuation(_ char: Character) -> Bool {
        let punctuation = "。、！？「」『』（）・…―〜　"
        return punctuation.contains(char) || char.isWhitespace || char.isNewline
    }

    private func isJapaneseWord(_ text: String) -> Bool {
        let japanesePattern = "[\\u3040-\\u309F\\u30A0-\\u30FF\\u4E00-\\u9FAF]"
        return text.range(of: japanesePattern, options: .regularExpression) != nil
    }
}

// MARK: - Token Parts View

/// Renders a token with furigana only above kanji parts
struct TokenPartsView: View {
    let token: Token
    let fontSize: CGFloat
    let fontName: String
    let showFurigana: Bool
    var isAudioHighlighted: Bool = false  // True when segment is being read aloud (sentence mode)
    var isWordHighlighted: Bool = false   // True when this specific word is being spoken (word mode)
    var isSelected: Bool = false
    var onTap: ((CGRect) -> Void)?
    var onLongPress: (() -> Void)?

    @State private var isPressed = false
    @State private var viewFrame: CGRect = .zero
    @Environment(\.colorScheme) private var colorScheme

    private var selectedFont: JapaneseFont {
        JapaneseFont(rawValue: fontName) ?? .system
    }

    private var highlightColor: Color {
        guard isPressed || isSelected else { return Color.clear }
        return colorScheme == .dark ? Color.blue.opacity(0.4) : Color.blue.opacity(0.25)
    }

    private var audioUnderlineColor: Color {
        colorScheme == .dark ? Color.blue.opacity(0.8) : Color.blue.opacity(0.6)
    }

    /// Whether to show underline (either sentence or word mode)
    private var shouldUnderline: Bool {
        isAudioHighlighted || isWordHighlighted
    }

    private var furiganaColor: Color {
        Color.furigana(for: colorScheme)
    }

    var body: some View {
        // Each part rendered as furigana above text, aligned horizontally
        HStack(alignment: .bottom, spacing: 0) {
            if let parts = token.parts, !parts.isEmpty {
                ForEach(Array(parts.enumerated()), id: \.offset) { _, part in
                    VStack(spacing: 0) {
                        // Furigana (centered above text)
                        if showFurigana {
                            Text(part.reading ?? " ")
                                .font(selectedFont.font(size: fontSize * 0.5))
                                .foregroundStyle(part.reading != nil ? furiganaColor : .clear)
                        }
                        // Main text with highlight only on text
                        Text(part.text)
                            .font(selectedFont.font(size: fontSize))
                            .foregroundStyle(.primary)
                            .background(highlightColor)
                    }
                }
            } else {
                VStack(spacing: 0) {
                    if showFurigana {
                        Text(" ")
                            .font(selectedFont.font(size: fontSize * 0.5))
                            .foregroundStyle(.clear)
                    }
                    Text(token.surface)
                        .font(selectedFont.font(size: fontSize))
                        .foregroundStyle(.primary)
                        .background(highlightColor)
                }
            }
        }
        .fixedSize(horizontal: true, vertical: false)
        .overlay(alignment: .bottom) {
            if shouldUnderline {
                Rectangle()
                    .fill(audioUnderlineColor)
                    .frame(height: 3)
                    .offset(y: 2)
            }
        }
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

// MARK: - Word Tap View

/// A tappable word view that captures its frame when tapped (legacy format)
struct WordTapView: View {
    let wordInfo: WordInfo
    let displayReading: String?
    let fontSize: CGFloat
    let fontName: String
    var isAudioHighlighted: Bool = false  // True when segment is being read aloud (sentence mode)
    var isWordHighlighted: Bool = false   // True when this specific word is being spoken (word mode)
    var isSelected: Bool = false
    var onTap: ((WordInfo, CGRect) -> Void)?
    var onLongPress: ((WordInfo) -> Void)?

    @State private var isPressed = false
    @State private var viewFrame: CGRect = .zero
    @Environment(\.colorScheme) private var colorScheme

    private var selectedFont: JapaneseFont {
        JapaneseFont(rawValue: fontName) ?? .system
    }

    private var highlightColor: Color {
        guard isPressed || isSelected else { return Color.clear }
        return colorScheme == .dark ? Color.blue.opacity(0.4) : Color.blue.opacity(0.25)
    }

    private var audioUnderlineColor: Color {
        colorScheme == .dark ? Color.blue.opacity(0.8) : Color.blue.opacity(0.6)
    }

    /// Whether to show underline (either sentence or word mode)
    private var shouldUnderline: Bool {
        isAudioHighlighted || isWordHighlighted
    }

    private var furiganaColor: Color {
        Color.furigana(for: colorScheme)
    }

    var body: some View {
        VStack(spacing: 0) {
            // Furigana (only when showing) - no highlight here, only on main text
            if let reading = displayReading {
                Text(reading)
                    .font(selectedFont.font(size: fontSize * 0.5))
                    .foregroundStyle(furiganaColor)
            }

            // Main text
            Text(wordInfo.surface)
                .font(selectedFont.font(size: fontSize))
                .foregroundStyle(.primary)
                .background(highlightColor)
                .cornerRadius(4)
                .overlay(alignment: .bottom) {
                    if shouldUnderline {
                        Rectangle()
                            .fill(audioUnderlineColor)
                            .frame(height: 3)
                            .offset(y: 2)
                    }
                }
        }
        .fixedSize(horizontal: true, vertical: false)
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
            onTap?(wordInfo, viewFrame)
        }
        .onLongPressGesture(minimumDuration: 0.3, pressing: { pressing in
            isPressed = pressing
        }, perform: {
            onLongPress?(wordInfo)
            isPressed = false
        })
    }
}

// MARK: - Wrapping HStack Layout

struct WrappingHStack: Layout {
    var alignment: VerticalAlignment = .center
    var spacing: CGFloat = 0

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let maxWidth = proposal.width ?? .infinity
        var currentX: CGFloat = 0
        var currentY: CGFloat = 0
        var lineHeight: CGFloat = 0
        var totalHeight: CGFloat = 0

        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)

            if currentX + size.width > maxWidth && currentX > 0 {
                currentX = 0
                currentY += lineHeight + spacing
                lineHeight = 0
            }

            currentX += size.width + spacing
            lineHeight = max(lineHeight, size.height)
            totalHeight = currentY + lineHeight
        }

        return CGSize(width: maxWidth, height: totalHeight)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var currentX: CGFloat = bounds.minX
        var currentY: CGFloat = bounds.minY
        var lineHeight: CGFloat = 0
        var lineSubviews: [(Subviews.Element, CGSize, CGFloat)] = []

        func placeLine() {
            for (subview, size, xPos) in lineSubviews {
                let y: CGFloat
                switch alignment {
                case .top:
                    y = currentY
                case .bottom:
                    y = currentY + lineHeight - size.height
                default:
                    y = currentY + (lineHeight - size.height) / 2
                }
                subview.place(at: CGPoint(x: xPos, y: y), proposal: .unspecified)
            }
        }

        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)

            if currentX + size.width > bounds.maxX && currentX > bounds.minX {
                placeLine()
                currentY += lineHeight + spacing
                lineHeight = 0
                lineSubviews.removeAll()
                currentX = bounds.minX
            }

            lineSubviews.append((subview, size, currentX))
            currentX += size.width + spacing
            lineHeight = max(lineHeight, size.height)
        }

        placeLine()
    }
}

// MARK: - Preview

#Preview {
    let legacySegment = StorySegment(
        id: "preview_legacy",
        text: "私は学生です。",
        furigana: [
            FuriganaAnnotation(word: "私", reading: "わたし", rangeStart: 0, rangeLength: 1),
            FuriganaAnnotation(word: "学生", reading: "がくせい", rangeStart: 2, rangeLength: 2)
        ],
        segmentType: .paragraph
    )

    // New format: furigana only on kanji parts
    let tokenizedSegment = StorySegment(
        id: "preview_tokenized",
        tokens: [
            Token(
                surface: "食べます",
                parts: [
                    TokenPart(text: "食", reading: "た"),
                    TokenPart(text: "べます", reading: nil)
                ],
                baseForm: "食べる",
                partOfSpeech: "verb"
            ),
            Token(
                surface: "。",
                parts: nil,
                baseForm: nil,
                partOfSpeech: "punctuation"
            )
        ],
        segmentType: .paragraph
    )

    VStack(alignment: .leading, spacing: 30) {
        Text("Legacy Format:")
            .font(.caption)
            .foregroundStyle(.secondary)

        FuriganaTextView(
            segment: legacySegment,
            fontSize: 24,
            showFurigana: true
        ) { wordInfo, tokenId, frame in
            print("Tapped: \(wordInfo.surface), tokenId: \(tokenId), lookup: \(wordInfo.lookupWord)")
        }

        Text("Tokenized Format (furigana only on kanji):")
            .font(.caption)
            .foregroundStyle(.secondary)

        FuriganaTextView(
            segment: tokenizedSegment,
            fontSize: 24,
            showFurigana: true
        ) { wordInfo, tokenId, frame in
            print("Tapped: \(wordInfo.surface), tokenId: \(tokenId), lookup: \(wordInfo.lookupWord)")
        }
    }
    .padding()
}
