import SwiftUI

// MARK: - Tooltip Measurement

/// Helper to calculate tooltip dimensions for positioning
enum TooltipMeasurement {
    static let menuWidth: CGFloat = 160
    static let rowHeight: CGFloat = 44

    /// Measure the size of the tooltip
    static func measure(hasWord: Bool) -> CGSize {
        // Two menu items
        let totalHeight = rowHeight * 2
        return CGSize(width: menuWidth, height: totalHeight)
    }
}

/// Native iOS-style context menu tooltip for word actions
struct WordActionTooltip: View {
    let wordInfo: WordInfo
    let position: CGPoint
    let isAlreadySaved: Bool  // Whether word is already in vocabulary
    let onAddToVocabulary: () -> Void
    let onRemoveFromVocabulary: () -> Void
    let onViewDefinition: () -> Void
    let onDismiss: () -> Void

    @State private var saveState: SaveState = .initial
    @Environment(\.colorScheme) private var colorScheme

    enum SaveState {
        case initial
        case justSaved
        case justRemoved
        case nowUnsaved  // After removal animation completes
    }

    private var displayState: DisplayState {
        switch saveState {
        case .initial:
            return isAlreadySaved ? .saved : .unsaved
        case .justSaved:
            return .saved
        case .justRemoved:
            return .removed
        case .nowUnsaved:
            return .unsaved
        }
    }

    enum DisplayState {
        case unsaved, saved, removed

        var text: String {
            switch self {
            case .unsaved: return "Save to List"
            case .saved: return "Saved"
            case .removed: return "Removed"
            }
        }

        var icon: String {
            switch self {
            case .unsaved: return "plus.circle"
            case .saved: return "checkmark.circle.fill"
            case .removed: return "minus.circle"
            }
        }

        var color: Color {
            switch self {
            case .unsaved: return .primary
            case .saved: return .green
            case .removed: return .red
            }
        }

        var iconColor: Color {
            switch self {
            case .unsaved: return .secondary
            case .saved: return .green
            case .removed: return .red
            }
        }
    }

    var body: some View {
        // Menu container
        VStack(spacing: 0) {
            // Look Up button
            Button {
                onViewDefinition()
            } label: {
                HStack {
                    Text("Look Up")
                        .font(.system(size: 16))
                    Spacer()
                    Image(systemName: "book")
                        .font(.system(size: 15))
                        .foregroundStyle(.secondary)
                }
                .foregroundStyle(.primary)
                .padding(.horizontal, 16)
                .frame(height: 44)
                .contentShape(Rectangle())
            }
            .buttonStyle(MenuButtonStyle())

            Divider()
                .padding(.leading, 16)

            // Save/Remove button
            Button {
                handleSaveToggle()
            } label: {
                HStack {
                    Text(displayState.text)
                        .font(.system(size: 16))
                    Spacer()
                    Image(systemName: displayState.icon)
                        .font(.system(size: 15))
                        .foregroundStyle(displayState.iconColor)
                }
                .foregroundStyle(displayState.color)
                .padding(.horizontal, 16)
                .frame(height: 44)
                .contentShape(Rectangle())
            }
            .buttonStyle(MenuButtonStyle())
        }
        .frame(width: 160)
        .background(.ultraThinMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .strokeBorder(Color.primary.opacity(0.08), lineWidth: 0.5)
        }
        .shadow(color: .black.opacity(colorScheme == .dark ? 0.4 : 0.15), radius: 16, x: 0, y: 8)
    }

    private func handleSaveToggle() {
        switch displayState {
        case .unsaved:
            // Save the word
            onAddToVocabulary()
            withAnimation(.easeInOut(duration: 0.15)) {
                saveState = .justSaved
            }
            // Auto dismiss after saving
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                onDismiss()
            }

        case .saved:
            // Set state FIRST (synchronously) to prevent "Save to List" flash
            saveState = .justRemoved
            // Then remove from vocabulary
            onRemoveFromVocabulary()
            // Go to unsaved state after delay
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
                withAnimation(.easeInOut(duration: 0.15)) {
                    saveState = .nowUnsaved
                }
            }

        case .removed:
            // Already showing removed, do nothing
            break
        }
    }
}

/// Custom button style for menu items with highlight effect
struct MenuButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .background(configuration.isPressed ? Color.primary.opacity(0.1) : Color.clear)
    }
}

/// Triangle shape for the tooltip arrow
struct Triangle: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        path.move(to: CGPoint(x: rect.midX, y: rect.maxY))
        path.addLine(to: CGPoint(x: rect.minX, y: rect.minY))
        path.addLine(to: CGPoint(x: rect.maxX, y: rect.minY))
        path.closeSubpath()
        return path
    }
}

/// Native iOS-style definition sheet
struct CompactDefinitionView: View {
    let wordInfo: WordInfo
    let onDismiss: () -> Void

    @State private var definition: WordDefinition?
    @State private var isLoading = true
    @State private var error: String?
    @Environment(\.colorScheme) private var colorScheme

    /// Whether we're looking up a base form different from the surface
    private var showingBaseForm: Bool {
        if let baseForm = wordInfo.baseForm, baseForm != wordInfo.surface {
            return true
        }
        return false
    }

    var body: some View {
        VStack(spacing: 0) {
            // Word header
            VStack(spacing: 12) {
                // Main word with reading inline
                HStack(alignment: .firstTextBaseline, spacing: 4) {
                    Text(wordInfo.surface)
                        .font(.system(size: 28, weight: .bold))

                    // Reading (if different from surface)
                    if let reading = wordInfo.reading, reading != wordInfo.surface {
                        Text("【\(reading)】")
                            .font(.system(size: 17))
                            .foregroundStyle(.secondary)
                    }
                }

                // Base form indicator (clearer label)
                if showingBaseForm, let baseForm = wordInfo.baseForm {
                    HStack(spacing: 8) {
                        Text("Dictionary:")
                            .font(.system(size: 14))
                            .foregroundStyle(.tertiary)
                        Text(baseForm)
                            .font(.system(size: 16, weight: .medium))
                            .foregroundStyle(.secondary)
                    }
                }
            }
            .padding(.top, 20)
            .padding(.bottom, 16)

            // Content
            VStack(alignment: .leading, spacing: 16) {
                if isLoading {
                    HStack {
                        Spacer()
                        ProgressView()
                            .scaleEffect(1.1)
                        Spacer()
                    }
                    .padding(.vertical, 24)
                } else if let error = error {
                    HStack {
                        Spacer()
                        VStack(spacing: 8) {
                            Image(systemName: "exclamationmark.triangle")
                                .font(.title2)
                                .foregroundStyle(.secondary)
                            Text(error)
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                        }
                        Spacer()
                    }
                    .padding(.vertical, 16)
                } else if let def = definition {
                    // Tags row
                    if def.jlptLevel != nil || def.isCommon {
                        HStack(spacing: 8) {
                            if let jlpt = def.jlptLevel {
                                TagView(text: jlpt.uppercased(), color: .blue)
                            }
                            if def.isCommon {
                                TagView(text: "Common", color: .green)
                            }
                            Spacer()
                        }
                    }

                    // Definitions
                    VStack(alignment: .leading, spacing: 12) {
                        ForEach(Array(def.definitions.prefix(4).enumerated()), id: \.offset) { index, meaning in
                            HStack(alignment: .firstTextBaseline, spacing: 10) {
                                Text("\(index + 1)")
                                    .font(.system(size: 14, weight: .semibold, design: .rounded))
                                    .foregroundStyle(.white)
                                    .frame(width: 22, height: 22)
                                    .background(Color.accentColor.opacity(0.8))
                                    .clipShape(Circle())

                                Text(meaning)
                                    .font(.system(size: 16))
                                    .lineSpacing(3)
                                    .fixedSize(horizontal: false, vertical: true)
                            }
                        }
                    }
                } else {
                    HStack {
                        Spacer()
                        VStack(spacing: 8) {
                            Image(systemName: "text.book.closed")
                                .font(.title2)
                                .foregroundStyle(.secondary)
                            Text("No definition found")
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                        }
                        Spacer()
                    }
                    .padding(.vertical, 16)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 20)
            .padding(.bottom, 24)
        }
        .frame(width: 320)
        .background(.regularMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .strokeBorder(Color.primary.opacity(0.06), lineWidth: 0.5)
        }
        .shadow(color: .black.opacity(colorScheme == .dark ? 0.5 : 0.2), radius: 24, x: 0, y: 12)
        .task {
            await lookupWord()
        }
    }

    private func lookupWord() async {
        isLoading = true
        do {
            definition = try await DictionaryService.shared.lookup(wordInfo.lookupWord)
            isLoading = false
        } catch {
            self.error = "Could not look up word"
            isLoading = false
        }
    }
}

/// Small pill-style tag
struct TagView: View {
    let text: String
    let color: Color

    var body: some View {
        Text(text)
            .font(.system(size: 12, weight: .semibold))
            .padding(.horizontal, 10)
            .padding(.vertical, 5)
            .background(color.opacity(0.15))
            .foregroundStyle(color)
            .clipShape(Capsule())
    }
}

#Preview {
    ZStack {
        Color.gray.opacity(0.3)
            .ignoresSafeArea()

        VStack(spacing: 40) {
            WordActionTooltip(
                wordInfo: WordInfo(surface: "食べます", baseForm: "食べる", reading: "たべます"),
                position: .zero,
                isAlreadySaved: false,
                onAddToVocabulary: {},
                onRemoveFromVocabulary: {},
                onViewDefinition: {},
                onDismiss: {}
            )

            WordActionTooltip(
                wordInfo: WordInfo(surface: "食べる", baseForm: "食べる", reading: "たべる"),
                position: .zero,
                isAlreadySaved: true,
                onAddToVocabulary: {},
                onRemoveFromVocabulary: {},
                onViewDefinition: {},
                onDismiss: {}
            )

            CompactDefinitionView(
                wordInfo: WordInfo(surface: "食べます", baseForm: "食べる", reading: "たべます"),
                onDismiss: {}
            )
        }
    }
}
