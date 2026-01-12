import SwiftUI

/// Login screen with Google Sign-In
struct LoginView: View {
    @EnvironmentObject var authService: AuthService
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        VStack(spacing: 32) {
            Spacer()

            // App icon and title
            VStack(spacing: 16) {
                Image(systemName: "book.fill")
                    .font(.system(size: 80))
                    .foregroundStyle(.tint)

                Text("Read Japanese")
                    .font(.largeTitle)
                    .fontWeight(.bold)

                Text("Learn Japanese through graded readers")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
            }

            Spacer()

            // Sign in buttons
            VStack(spacing: 16) {
                // Google Sign-In button
                Button {
                    Task {
                        await authService.signInWithGoogle()
                    }
                } label: {
                    HStack(spacing: 12) {
                        Image("google_logo")
                            .resizable()
                            .scaledToFit()
                            .frame(width: 20, height: 20)

                        Text("Continue with Google")
                            .fontWeight(.medium)
                    }
                    .frame(maxWidth: .infinity)
                    .frame(height: 50)
                    .background(colorScheme == .dark ? Color(.systemGray5) : .white)
                    .foregroundStyle(.primary)
                    .cornerRadius(12)
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .stroke(Color(.systemGray4), lineWidth: 1)
                    )
                }
                .disabled(authService.isLoading)

                // Continue as guest
                Button {
                    // Skip login - user can use app without account
                } label: {
                    Text("Continue as Guest")
                        .fontWeight(.medium)
                        .frame(maxWidth: .infinity)
                        .frame(height: 50)
                        .foregroundStyle(.secondary)
                }
            }
            .padding(.horizontal, 24)

            // Error message
            if let error = authService.errorMessage {
                Text(error)
                    .font(.caption)
                    .foregroundStyle(.red)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal)
            }

            // Loading indicator
            if authService.isLoading {
                ProgressView()
                    .padding()
            }

            Spacer()
                .frame(height: 40)

            // Terms
            Text("By continuing, you agree to our Terms of Service and Privacy Policy")
                .font(.caption2)
                .foregroundStyle(.tertiary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)
                .padding(.bottom, 16)
        }
        .onAppear {
            AnalyticsService.shared.trackScreen("Login")
        }
    }
}

#Preview {
    LoginView()
        .environmentObject(AuthService.shared)
}
