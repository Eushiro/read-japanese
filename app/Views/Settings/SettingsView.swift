import SwiftUI

/// Standalone settings view accessible from Library and Vocabulary pages
struct SettingsView: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject var authService: AuthService
    @EnvironmentObject var appState: AppState
    @State private var showingLogoutConfirmation = false
    @State private var showingDeleteConfirmation = false

    // Reader settings (stored in AppStorage)
    @AppStorage("fontSize") private var fontSize: Double = 20.0
    @AppStorage("fontName") private var fontName: String = "System"
    @AppStorage("showFurigana") private var showFurigana: Bool = true
    @AppStorage("colorScheme") private var colorSchemePreference: String = "system"
    @AppStorage("showEnglishTitles") private var showEnglishTitles: Bool = false
    @AppStorage("showEnglishDescriptions") private var showEnglishDescriptions: Bool = false
    @AppStorage("showTokenizerSource") private var showTokenizerSource: Bool = false
    @AppStorage("showAuthor") private var showAuthor: Bool = false
    @AppStorage("chapterViewMode") private var chapterViewMode: String = "paged"
    @AppStorage("audioHighlightMode") private var audioHighlightMode: String = "sentence"  // "sentence" or "word"

    private var selectedFont: JapaneseFont {
        JapaneseFont(rawValue: fontName) ?? .system
    }

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

                    // Audio highlight mode
                    VStack(alignment: .leading, spacing: 12) {
                        Label("Audio Highlight", systemImage: "waveform")

                        HStack(spacing: 10) {
                            // Sentence mode
                            Button {
                                withAnimation(.easeInOut(duration: 0.2)) {
                                    audioHighlightMode = "sentence"
                                }
                            } label: {
                                VStack(spacing: 6) {
                                    Image(systemName: "text.alignleft")
                                        .font(.title2)
                                    Text("Sentence")
                                        .font(.caption)
                                        .fontWeight(.medium)
                                }
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 12)
                                .background(
                                    audioHighlightMode == "sentence"
                                        ? Color.accentColor
                                        : Color(.tertiarySystemGroupedBackground)
                                )
                                .foregroundStyle(
                                    audioHighlightMode == "sentence"
                                        ? .white
                                        : .primary
                                )
                                .clipShape(RoundedRectangle(cornerRadius: 10))
                            }
                            .buttonStyle(.plain)

                            // Word mode
                            Button {
                                withAnimation(.easeInOut(duration: 0.2)) {
                                    audioHighlightMode = "word"
                                }
                            } label: {
                                VStack(spacing: 6) {
                                    Image(systemName: "character.cursor.ibeam")
                                        .font(.title2)
                                    Text("Word")
                                        .font(.caption)
                                        .fontWeight(.medium)
                                }
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 12)
                                .background(
                                    audioHighlightMode == "word"
                                        ? Color.accentColor
                                        : Color(.tertiarySystemGroupedBackground)
                                )
                                .foregroundStyle(
                                    audioHighlightMode == "word"
                                        ? .white
                                        : .primary
                                )
                                .clipShape(RoundedRectangle(cornerRadius: 10))
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(.vertical, 4)

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

                #if DEBUG
                // Developer section (only visible in debug builds)
                Section {
                    Toggle(isOn: $showTokenizerSource) {
                        Label("Tokenizer Source", systemImage: "wrench.and.screwdriver")
                    }

                    Toggle(isOn: $showAuthor) {
                        Label("Story Author", systemImage: "person.text.rectangle")
                    }

                    Toggle(isOn: $appState.isPremiumUser) {
                        Label("Premium User (Mock)", systemImage: "crown.fill")
                    }
                } header: {
                    Text("Developer")
                } footer: {
                    Text("Shows technical information. Premium toggle simulates subscription.")
                }
                #endif

                // Account section
                Section {
                    if authService.isAuthenticated, let user = authService.currentUser {
                        // User info
                        HStack(spacing: 12) {
                            // Profile image or placeholder
                            if let photoURL = user.photoURL {
                                AsyncImage(url: photoURL) { image in
                                    image
                                        .resizable()
                                        .scaledToFill()
                                } placeholder: {
                                    Image(systemName: "person.circle.fill")
                                        .font(.system(size: 40))
                                        .foregroundStyle(.secondary)
                                }
                                .frame(width: 44, height: 44)
                                .clipShape(Circle())
                            } else {
                                Image(systemName: "person.circle.fill")
                                    .font(.system(size: 40))
                                    .foregroundStyle(.secondary)
                            }

                            VStack(alignment: .leading, spacing: 2) {
                                Text(user.displayName ?? "User")
                                    .font(.headline)
                                if let email = user.email {
                                    Text(email)
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                            }
                        }
                        .padding(.vertical, 4)

                        // Sign out button
                        Button(role: .destructive) {
                            showingLogoutConfirmation = true
                        } label: {
                            Label("Sign Out", systemImage: "rectangle.portrait.and.arrow.right")
                        }

                        // Delete account button
                        Button(role: .destructive) {
                            showingDeleteConfirmation = true
                        } label: {
                            Label("Delete Account", systemImage: "trash")
                                .foregroundStyle(.red)
                        }
                    } else {
                        // Not signed in
                        HStack {
                            Image(systemName: "person.circle")
                                .font(.system(size: 40))
                                .foregroundStyle(.secondary)

                            VStack(alignment: .leading, spacing: 2) {
                                Text("Guest")
                                    .font(.headline)
                                Text("Sign in to sync your progress")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                        }
                        .padding(.vertical, 4)

                        Button {
                            Task {
                                await authService.signInWithGoogle()
                            }
                        } label: {
                            Label("Sign in with Google", systemImage: "person.badge.plus")
                        }
                    }
                } header: {
                    Text("Account")
                }
                .confirmationDialog("Sign Out", isPresented: $showingLogoutConfirmation) {
                    Button("Sign Out", role: .destructive) {
                        authService.signOut()
                        AnalyticsService.shared.track(.logoutCompleted)
                    }
                    Button("Cancel", role: .cancel) {}
                } message: {
                    Text("Are you sure you want to sign out?")
                }
                .confirmationDialog("Delete Account", isPresented: $showingDeleteConfirmation) {
                    Button("Delete Account", role: .destructive) {
                        Task {
                            await authService.deleteAccount()
                        }
                    }
                    Button("Cancel", role: .cancel) {}
                } message: {
                    Text("This will permanently delete your account. This action cannot be undone.")
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
        .environmentObject(AuthService.shared)
}
