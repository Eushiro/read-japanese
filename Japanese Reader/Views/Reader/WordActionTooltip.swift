import SwiftUI

// MARK: - Tooltip Measurement

/// Helper to calculate tooltip dimensions for positioning
enum TooltipMeasurement {
    // Button dimensions
    static let buttonPaddingH: CGFloat = 12
    static let buttonPaddingV: CGFloat = 8
    static let buttonFontSize: CGFloat = 14
    static let buttonSpacing: CGFloat = 0
    static let arrowHeight: CGFloat = 8

    /// Measure the size of the tooltip
    static func measure(hasWord: Bool) -> CGSize {
        // Estimate button text width (larger of "Define" or "Save")
        let textWidth: CGFloat = 60 // Approximate width of "Define" text + icon

        let buttonWidth = textWidth + buttonPaddingH * 2
        let buttonHeight = buttonFontSize + buttonPaddingV * 2

        // Two buttons stacked + arrow
        let totalHeight = buttonHeight * 2 + buttonSpacing + arrowHeight
        let totalWidth = buttonWidth

        return CGSize(width: totalWidth, height: totalHeight)
    }
}

/// Lightweight tooltip that appears near a tapped word with quick actions
struct WordActionTooltip: View {
    let wordInfo: WordInfo
    let position: CGPoint
    let onAddToVocabulary: () -> Void
    let onViewDefinition: () -> Void
    let onDismiss: () -> Void

    @State private var isAdded = false

    var body: some View {
        VStack(spacing: 0) {
            // Definition button (top)
            Button {
                onViewDefinition()
            } label: {
                HStack(spacing: 6) {
                    Image(systemName: "book")
                        .font(.system(size: 14))
                    Text("Define")
                        .font(.system(size: 14, weight: .medium))
                }
                .foregroundStyle(.white)
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .background(Color.blue)
                .clipShape(RoundedRectangle(cornerRadius: 8))
            }

            // Add to vocabulary button (bottom, closer to word)
            Button {
                if !isAdded {
                    onAddToVocabulary()
                    isAdded = true
                    // Auto dismiss after adding
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                        onDismiss()
                    }
                }
            } label: {
                HStack(spacing: 6) {
                    Image(systemName: isAdded ? "checkmark" : "plus")
                        .font(.system(size: 14))
                    Text(isAdded ? "Added" : "Save")
                        .font(.system(size: 14, weight: .medium))
                }
                .foregroundStyle(.white)
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .background(isAdded ? Color.green : Color.orange)
                .clipShape(RoundedRectangle(cornerRadius: 8))
            }
            .disabled(isAdded)

        }
        .shadow(color: .black.opacity(0.2), radius: 8, x: 0, y: 4)
    }
}

/// Small definition sheet (not full screen)
struct CompactDefinitionView: View {
    let wordInfo: WordInfo
    let onDismiss: () -> Void

    @State private var definition: WordDefinition?
    @State private var isLoading = true
    @State private var error: String?

    /// Whether we're looking up a base form different from the surface
    private var showingBaseForm: Bool {
        if let baseForm = wordInfo.baseForm, baseForm != wordInfo.surface {
            return true
        }
        return false
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Header - show surface form and base form if different
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: 8) {
                        Text(wordInfo.surface)
                            .font(.title2)
                            .fontWeight(.bold)

                        // Show reading from token if available (not from dictionary)
                        if let reading = wordInfo.reading, reading != wordInfo.surface {
                            Text(reading)
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                        }
                    }

                    if showingBaseForm, let baseForm = wordInfo.baseForm {
                        HStack(spacing: 4) {
                            Text("Dictionary form:")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                            Text(baseForm)
                                .font(.subheadline)
                                .fontWeight(.medium)
                        }
                    }
                }

                Spacer()

                Button {
                    onDismiss()
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .font(.title3)
                        .foregroundStyle(.secondary)
                }
            }

            Divider()

            if isLoading {
                HStack {
                    Spacer()
                    ProgressView()
                        .padding()
                    Spacer()
                }
            } else if let error = error {
                Text(error)
                    .foregroundStyle(.secondary)
                    .font(.subheadline)
            } else if let def = definition {
                // Tags
                HStack(spacing: 6) {
                    if let jlpt = def.jlptLevel {
                        Text(jlpt.uppercased())
                            .font(.caption2)
                            .fontWeight(.semibold)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(Color.blue.opacity(0.2))
                            .foregroundStyle(.blue)
                            .clipShape(RoundedRectangle(cornerRadius: 4))
                    }
                    if def.isCommon {
                        Text("Common")
                            .font(.caption2)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(Color.green.opacity(0.2))
                            .foregroundStyle(.green)
                            .clipShape(RoundedRectangle(cornerRadius: 4))
                    }
                }

                // Definitions
                ForEach(Array(def.definitions.prefix(3).enumerated()), id: \.offset) { index, meaning in
                    HStack(alignment: .top, spacing: 6) {
                        Text("\(index + 1).")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                            .frame(width: 16, alignment: .trailing)
                        Text(meaning)
                            .font(.subheadline)
                    }
                }
            } else {
                Text("No definition found")
                    .foregroundStyle(.secondary)
                    .font(.subheadline)
            }
        }
        .padding(16)
        .frame(maxWidth: 320)
        .background(Color(.systemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .shadow(color: .black.opacity(0.15), radius: 12, x: 0, y: 4)
        .task {
            await lookupWord()
        }
    }

    private func lookupWord() async {
        isLoading = true
        do {
            // Use lookupWord (baseForm if available, otherwise surface)
            definition = try await DictionaryService.shared.lookup(wordInfo.lookupWord)
            isLoading = false
        } catch {
            self.error = "Could not look up word"
            isLoading = false
        }
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
                onAddToVocabulary: {},
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
