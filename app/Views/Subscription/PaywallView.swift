import SwiftUI

/// Paywall shown when user taps a premium story
struct PaywallView: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject var appState: AppState

    let story: Story?  // Optional - can show generic paywall

    var body: some View {
        NavigationStack {
            VStack(spacing: 24) {
                Spacer()

                // Premium icon
                Image(systemName: "crown.fill")
                    .font(.system(size: 60))
                    .foregroundStyle(.yellow)

                // Title
                Text("Unlock Premium Stories")
                    .font(.title)
                    .fontWeight(.bold)
                    .multilineTextAlignment(.center)

                // Description
                VStack(spacing: 12) {
                    if let story = story {
                        Text("\"\(story.metadata.titleJapanese ?? story.metadata.title)\" is a premium story.")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                            .multilineTextAlignment(.center)
                    }

                    Text("Subscribe to access all premium content across every JLPT level.")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                }
                .padding(.horizontal)

                // Features list
                VStack(alignment: .leading, spacing: 12) {
                    FeatureRow(icon: "book.fill", text: "Access all premium stories")
                    FeatureRow(icon: "sparkles", text: "New stories added regularly")
                    FeatureRow(icon: "star.fill", text: "Support the development")
                }
                .padding()
                .background(Color(.secondarySystemGroupedBackground))
                .clipShape(RoundedRectangle(cornerRadius: 12))
                .padding(.horizontal)

                Spacer()

                // Subscribe button
                VStack(spacing: 12) {
                    Button {
                        appState.setPremiumUser(true)
                        dismiss()
                    } label: {
                        Text("Subscribe")
                            .font(.headline)
                            .frame(maxWidth: .infinity)
                            .padding()
                            .background(Color.accentColor)
                            .foregroundStyle(.white)
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                    }
                }
                .padding(.horizontal)
                .padding(.bottom)
            }
            .navigationTitle("Premium")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Close") {
                        dismiss()
                    }
                }
            }
        }
    }
}

/// Feature row for paywall
struct FeatureRow: View {
    let icon: String
    let text: String

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .foregroundStyle(Color.accentColor)
                .frame(width: 24)
            Text(text)
                .font(.subheadline)
        }
    }
}

#Preview {
    PaywallView(story: nil)
        .environmentObject(AppState())
}
