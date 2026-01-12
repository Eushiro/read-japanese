import SwiftUI

/// Standalone settings view accessible from Library and Vocabulary pages
struct SettingsView: View {
    @Environment(\.dismiss) private var dismiss

    // Reader settings (stored in AppStorage)
    @AppStorage("autoScrollSpeed") private var autoScrollSpeed: Double = 300.0
    @AppStorage("fontSize") private var fontSize: Double = 20.0
    @AppStorage("fontName") private var fontName: String = "System"
    @AppStorage("showFurigana") private var showFurigana: Bool = true
    @AppStorage("colorScheme") private var colorSchemePreference: String = "system"
    @AppStorage("showEnglishTitles") private var showEnglishTitles: Bool = false
    @AppStorage("showEnglishDescriptions") private var showEnglishDescriptions: Bool = false
    @AppStorage("showTokenizerSource") private var showTokenizerSource: Bool = false
    @AppStorage("showAuthor") private var showAuthor: Bool = false
    @AppStorage("chapterViewMode") private var chapterViewMode: String = "paged"

    private var selectedFont: JapaneseFont {
        JapaneseFont(rawValue: fontName) ?? .system
    }

    // Speed presets (in points per second)
    private let speedPresets: [(name: String, value: Double)] = [
        ("Slow", 200.0),
        ("Medium", 350.0),
        ("Fast", 600.0)
    ]

    // Color scheme options
    private let colorSchemeOptions: [(name: String, value: String, icon: String)] = [
        ("System", "system", "circle.lefthalf.filled"),
        ("Light", "light", "sun.max.fill"),
        ("Dark", "dark", "moon.fill")
    ]

    var body: some View {
        NavigationStack {
            List {
                // Appearance section (Theme)
                Section {
                    VStack(alignment: .leading, spacing: 12) {
                        HStack(spacing: 12) {
                            ForEach(colorSchemeOptions, id: \.value) { option in
                                Button {
                                    withAnimation(.easeInOut(duration: 0.2)) {
                                        colorSchemePreference = option.value
                                    }
                                } label: {
                                    VStack(spacing: 8) {
                                        Image(systemName: option.icon)
                                            .font(.title2)
                                        Text(option.name)
                                            .font(.caption)
                                            .fontWeight(.medium)
                                    }
                                    .frame(maxWidth: .infinity)
                                    .padding(.vertical, 16)
                                    .background(
                                        colorSchemePreference == option.value
                                            ? Color.accentColor
                                            : Color(.tertiarySystemGroupedBackground)
                                    )
                                    .foregroundStyle(
                                        colorSchemePreference == option.value
                                            ? .white
                                            : .primary
                                    )
                                    .clipShape(RoundedRectangle(cornerRadius: 12))
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 12)
                                            .strokeBorder(
                                                colorSchemePreference == option.value
                                                    ? Color.clear
                                                    : Color.primary.opacity(0.1),
                                                lineWidth: 1
                                            )
                                    )
                                }
                                .buttonStyle(.plain)
                            }
                        }
                    }
                    .padding(.vertical, 4)
                } header: {
                    Text("Theme")
                }

                // Reading section
                Section {
                    // Font selection
                    VStack(alignment: .leading, spacing: 12) {
                        Label("Font", systemImage: "textformat")

                        // Font options grid
                        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                            ForEach(JapaneseFont.allCases) { font in
                                Button {
                                    withAnimation(.easeInOut(duration: 0.2)) {
                                        fontName = font.rawValue
                                    }
                                } label: {
                                    VStack(spacing: 6) {
                                        Text("あいう")
                                            .font(font.font(size: 18))
                                        Text(font.displayName)
                                            .font(.caption)
                                            .fontWeight(.medium)
                                        Text(font.description)
                                            .font(.caption2)
                                            .foregroundStyle(.secondary)
                                    }
                                    .frame(maxWidth: .infinity)
                                    .padding(.vertical, 12)
                                    .background(
                                        selectedFont == font
                                            ? Color.accentColor.opacity(0.15)
                                            : Color(.tertiarySystemGroupedBackground)
                                    )
                                    .foregroundStyle(selectedFont == font ? .primary : .primary)
                                    .clipShape(RoundedRectangle(cornerRadius: 10))
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 10)
                                            .strokeBorder(
                                                selectedFont == font
                                                    ? Color.accentColor
                                                    : Color.clear,
                                                lineWidth: 2
                                            )
                                    )
                                }
                                .buttonStyle(.plain)
                            }
                        }
                    }
                    .padding(.vertical, 4)

                    // Font size
                    VStack(alignment: .leading, spacing: 16) {
                        HStack {
                            Label("Font Size", systemImage: "textformat.size")
                            Spacer()
                            Text("\(Int(fontSize)) pt")
                                .foregroundStyle(.secondary)
                                .monospacedDigit()
                        }

                        Slider(value: $fontSize, in: 14...32, step: 2)
                            .tint(.accentColor)

                        // Preview text with selected font
                        VStack(spacing: 4) {
                            Text("私は学生です。")
                                .font(selectedFont.font(size: fontSize))
                            Text("I am a student.")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 12)
                        .background(Color(.secondarySystemGroupedBackground))
                        .clipShape(RoundedRectangle(cornerRadius: 10))
                    }
                    .padding(.vertical, 4)

                    // Furigana toggle
                    Toggle(isOn: $showFurigana) {
                        Label("Show Furigana", systemImage: "character.phonetic.ja")
                    }

                    // Chapter view mode
                    VStack(alignment: .leading, spacing: 12) {
                        Label("Chapter Navigation", systemImage: "book.pages")

                        HStack(spacing: 10) {
                            // Paged option
                            Button {
                                withAnimation(.easeInOut(duration: 0.2)) {
                                    chapterViewMode = "paged"
                                }
                            } label: {
                                VStack(spacing: 6) {
                                    Image(systemName: "rectangle.split.3x1")
                                        .font(.title2)
                                    Text("Paged")
                                        .font(.caption)
                                        .fontWeight(.medium)
                                }
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 12)
                                .background(
                                    chapterViewMode == "paged"
                                        ? Color.accentColor
                                        : Color(.tertiarySystemGroupedBackground)
                                )
                                .foregroundStyle(
                                    chapterViewMode == "paged"
                                        ? .white
                                        : .primary
                                )
                                .clipShape(RoundedRectangle(cornerRadius: 10))
                            }
                            .buttonStyle(.plain)

                            // Continuous option
                            Button {
                                withAnimation(.easeInOut(duration: 0.2)) {
                                    chapterViewMode = "continuous"
                                }
                            } label: {
                                VStack(spacing: 6) {
                                    Image(systemName: "scroll")
                                        .font(.title2)
                                    Text("Continuous")
                                        .font(.caption)
                                        .fontWeight(.medium)
                                }
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 12)
                                .background(
                                    chapterViewMode == "continuous"
                                        ? Color.accentColor
                                        : Color(.tertiarySystemGroupedBackground)
                                )
                                .foregroundStyle(
                                    chapterViewMode == "continuous"
                                        ? .white
                                        : .primary
                                )
                                .clipShape(RoundedRectangle(cornerRadius: 10))
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(.vertical, 4)
                } header: {
                    Text("Reading")
                } footer: {
                    Text("Paged shows one chapter at a time with swipe navigation. Continuous shows all chapters in one scrolling view.")
                }

                // Auto-scroll section
                Section {
                    VStack(alignment: .leading, spacing: 16) {
                        HStack {
                            Label("Scroll Speed", systemImage: "arrow.down.circle")
                            Spacer()
                            Text("\(Int(autoScrollSpeed)) pts/sec")
                                .foregroundStyle(.secondary)
                                .monospacedDigit()
                        }

                        Slider(value: $autoScrollSpeed, in: 200...600, step: 25)
                            .tint(.accentColor)

                        // Speed presets
                        HStack(spacing: 10) {
                            ForEach(speedPresets, id: \.name) { preset in
                                Button {
                                    withAnimation(.easeInOut(duration: 0.2)) {
                                        autoScrollSpeed = preset.value
                                    }
                                } label: {
                                    Text(preset.name)
                                        .font(.subheadline)
                                        .fontWeight(.medium)
                                        .frame(maxWidth: .infinity)
                                        .padding(.vertical, 10)
                                        .background(
                                            autoScrollSpeed == preset.value
                                                ? Color.accentColor
                                                : Color(.tertiarySystemGroupedBackground)
                                        )
                                        .foregroundStyle(
                                            autoScrollSpeed == preset.value
                                                ? .white
                                                : .primary
                                        )
                                        .clipShape(RoundedRectangle(cornerRadius: 8))
                                }
                                .buttonStyle(.plain)
                            }
                        }
                    }
                    .padding(.vertical, 4)
                } header: {
                    Text("Auto-Scroll")
                } footer: {
                    Text("Long-press while reading to start auto-scrolling. Release to stop.")
                }

                // Language section
                Section {
                    Toggle(isOn: $showEnglishTitles) {
                        Label("English Titles", systemImage: "character.bubble")
                    }

                    Toggle(isOn: $showEnglishDescriptions) {
                        Label("English Descriptions", systemImage: "text.bubble")
                    }
                } header: {
                    Text("Language")
                } footer: {
                    Text("Shows English translations beneath Japanese text throughout the app.")
                }

                // Developer section
                Section {
                    Toggle(isOn: $showTokenizerSource) {
                        Label("Tokenizer Source", systemImage: "wrench.and.screwdriver")
                    }

                    Toggle(isOn: $showAuthor) {
                        Label("Story Author", systemImage: "person.text.rectangle")
                    }
                } header: {
                    Text("Developer")
                } footer: {
                    Text("Shows technical information about how stories were processed.")
                }

                // About section
                Section {
                    HStack {
                        Text("Version")
                        Spacer()
                        Text("1.0.0")
                            .foregroundStyle(.secondary)
                    }
                } header: {
                    Text("About")
                }
            }
            .listStyle(.insetGrouped)
            .navigationTitle("Settings")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                #if os(iOS)
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") {
                        dismiss()
                    }
                    .fontWeight(.semibold)
                }
                #else
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") {
                        dismiss()
                    }
                }
                #endif
            }
        }
    }
}

#Preview {
    SettingsView()
}
