import SwiftUI

/// Popup view showing word definition with option to save to vocabulary
struct WordDefinitionPopup: View {
    let word: String
    let storyId: String
    let onSave: (VocabularyItem) -> Void
    let onDismiss: () -> Void

    @State private var definition: WordDefinition?
    @State private var isLoading = true
    @State private var error: String?
    @State private var isSaved = false

    var body: some View {
        VStack(spacing: 0) {
            // Header with close button
            HStack {
                Text("Word Lookup")
                    .font(.headline)
                Spacer()
                Button {
                    onDismiss()
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .font(.title2)
                        .foregroundStyle(.secondary)
                }
            }
            .padding()
            .background(Color(.systemGray6))

            // Content
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    if isLoading {
                        loadingView
                    } else if let error = error {
                        errorView(error)
                    } else if let definition = definition {
                        definitionView(definition)
                    } else {
                        noResultView
                    }
                }
                .padding()
            }

            // Save button
            if let definition = definition, !isLoading {
                saveButton(for: definition)
            }
        }
        .frame(maxWidth: 400)
        .background(Color(.systemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .shadow(radius: 20)
        .task {
            await lookupWord()
        }
    }

    // MARK: - Loading View

    private var loadingView: some View {
        HStack {
            Spacer()
            VStack(spacing: 12) {
                ProgressView()
                Text("Looking up \"\(word)\"...")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            .padding(.vertical, 40)
            Spacer()
        }
    }

    // MARK: - Error View

    private func errorView(_ message: String) -> some View {
        VStack(spacing: 12) {
            Image(systemName: "exclamationmark.triangle")
                .font(.largeTitle)
                .foregroundStyle(.orange)
            Text(message)
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 40)
    }

    // MARK: - No Result View

    private var noResultView: some View {
        VStack(spacing: 12) {
            Image(systemName: "questionmark.circle")
                .font(.largeTitle)
                .foregroundStyle(.secondary)
            Text("No definition found for \"\(word)\"")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 40)
    }

    // MARK: - Definition View

    private func definitionView(_ definition: WordDefinition) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            // Word and reading
            VStack(alignment: .leading, spacing: 4) {
                Text(definition.word)
                    .font(.system(size: 32, weight: .bold))

                if definition.reading != definition.word {
                    Text(definition.reading)
                        .font(.title2)
                        .foregroundStyle(.secondary)
                }
            }

            // Tags (JLPT level, common)
            HStack(spacing: 8) {
                if let jlpt = definition.jlptLevel {
                    Text(jlpt.uppercased())
                        .font(.caption)
                        .fontWeight(.semibold)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(Color.blue.opacity(0.2))
                        .foregroundStyle(.blue)
                        .clipShape(RoundedRectangle(cornerRadius: 4))
                }

                if definition.isCommon {
                    Text("Common")
                        .font(.caption)
                        .fontWeight(.semibold)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(Color.green.opacity(0.2))
                        .foregroundStyle(.green)
                        .clipShape(RoundedRectangle(cornerRadius: 4))
                }

                if !definition.partsOfSpeech.isEmpty {
                    Text(definition.partsOfSpeech.prefix(2).joined(separator: ", "))
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }

            Divider()

            // Definitions
            VStack(alignment: .leading, spacing: 8) {
                Text("Definitions")
                    .font(.subheadline)
                    .fontWeight(.semibold)
                    .foregroundStyle(.secondary)

                ForEach(Array(definition.definitions.prefix(5).enumerated()), id: \.offset) { index, meaning in
                    HStack(alignment: .top, spacing: 8) {
                        Text("\(index + 1).")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                            .frame(width: 20, alignment: .trailing)
                        Text(meaning)
                            .font(.body)
                    }
                }
            }
        }
    }

    // MARK: - Save Button

    private func saveButton(for definition: WordDefinition) -> some View {
        Button {
            let vocabItem = VocabularyItem.from(definition, sourceStoryId: storyId)
            onSave(vocabItem)
            isSaved = true
        } label: {
            HStack {
                Image(systemName: isSaved ? "checkmark.circle.fill" : "plus.circle.fill")
                Text(isSaved ? "Saved to Vocabulary" : "Save to Vocabulary")
            }
            .frame(maxWidth: .infinity)
            .padding()
            .background(isSaved ? Color.green : Color.blue)
            .foregroundStyle(.white)
            .fontWeight(.semibold)
        }
        .disabled(isSaved)
    }

    // MARK: - Lookup

    private func lookupWord() async {
        isLoading = true
        error = nil

        do {
            definition = try await DictionaryService.shared.lookup(word)
            isLoading = false
        } catch {
            self.error = error.localizedDescription
            isLoading = false
        }
    }
}

#Preview {
    ZStack {
        Color.black.opacity(0.3)
            .ignoresSafeArea()

        WordDefinitionPopup(
            word: "勉強",
            storyId: "test",
            onSave: { _ in },
            onDismiss: { }
        )
        .padding()
    }
}
