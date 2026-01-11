import SwiftUI

/// Settings sheet for reader preferences (accessible while reading)
struct ReaderSettingsSheet: View {
    @Binding var autoScrollSpeed: Double
    @Binding var fontSize: Double
    @Binding var showFurigana: Bool

    @Environment(\.dismiss) private var dismiss
    @AppStorage("colorScheme") private var colorSchemePreference: String = "system"
    @AppStorage("showEnglishTitles") private var showEnglishTitles: Bool = false
    @AppStorage("showEnglishDescriptions") private var showEnglishDescriptions: Bool = false
    @AppStorage("showTokenizerSource") private var showTokenizerSource: Bool = false
    @AppStorage("showAuthor") private var showAuthor: Bool = false

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
            Form {
                // Auto-scroll section
                Section("Auto-Scroll") {
                    VStack(alignment: .leading, spacing: 12) {
                        HStack {
                            Text("Speed")
                            Spacer()
                            Text("\(Int(autoScrollSpeed)) pts/sec")
                                .foregroundStyle(.secondary)
                        }

                        Slider(value: $autoScrollSpeed, in: 200...600, step: 25)

                        // Speed presets
                        HStack {
                            ForEach(speedPresets, id: \.name) { preset in
                                Button {
                                    withAnimation {
                                        autoScrollSpeed = preset.value
                                    }
                                } label: {
                                    Text(preset.name)
                                        .font(.caption)
                                        .frame(maxWidth: .infinity)
                                        .padding(.vertical, 8)
                                        .background(
                                            autoScrollSpeed == preset.value
                                                ? Color.accentColor
                                                : Color.secondary.opacity(0.2)
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

                    Text("Long-press on the story to start auto-scrolling. Release to stop.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                // Text display section
                Section("Text Display") {
                    VStack(alignment: .leading, spacing: 12) {
                        HStack {
                            Text("Font Size")
                            Spacer()
                            Text("\(Int(fontSize)) pt")
                                .foregroundStyle(.secondary)
                        }

                        Slider(value: $fontSize, in: 14...32, step: 2)

                        // Preview text
                        Text("私は学生です。")
                            .font(.system(size: fontSize))
                            .frame(maxWidth: .infinity, alignment: .center)
                            .padding(.vertical, 8)
                            .background(Color.secondary.opacity(0.1))
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                    }

                    Toggle("Show Furigana", isOn: $showFurigana)
                }

                // Language assistance section
                Section("Language Assistance") {
                    Toggle("Show English Titles", isOn: $showEnglishTitles)
                    Toggle("Show English Descriptions", isOn: $showEnglishDescriptions)

                    Text("Shows English translations beneath Japanese titles and summaries.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                // Appearance section
                Section("Appearance") {
                    HStack(spacing: 12) {
                        ForEach(colorSchemeOptions, id: \.value) { option in
                            Button {
                                withAnimation {
                                    colorSchemePreference = option.value
                                }
                            } label: {
                                VStack(spacing: 6) {
                                    Image(systemName: option.icon)
                                        .font(.title2)
                                    Text(option.name)
                                        .font(.caption)
                                }
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 12)
                                .background(
                                    colorSchemePreference == option.value
                                        ? Color.accentColor
                                        : Color.secondary.opacity(0.2)
                                )
                                .foregroundStyle(
                                    colorSchemePreference == option.value
                                        ? .white
                                        : .primary
                                )
                                .clipShape(RoundedRectangle(cornerRadius: 10))
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }

                // Developer section
                Section("Developer") {
                    Toggle("Show Tokenizer Source", isOn: $showTokenizerSource)
                    Toggle("Show Author", isOn: $showAuthor)

                    Text("Shows badges indicating the tokenizer source (Sudachi vs AI) and story author.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                // Info section
                Section {
                    HStack {
                        Image(systemName: "info.circle")
                            .foregroundStyle(.secondary)
                        Text("Settings are saved automatically and will persist across sessions.")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
            }
            .navigationTitle("Reader Settings")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
        }
        .presentationDetents([.medium])
    }
}

#Preview {
    ReaderSettingsSheet(
        autoScrollSpeed: .constant(50.0),
        fontSize: .constant(20.0),
        showFurigana: .constant(true)
    )
}
