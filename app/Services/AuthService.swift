import Foundation
import Combine
import FirebaseCore
import FirebaseAuth
import GoogleSignIn

/// Authentication service using Firebase Auth
@MainActor
final class AuthService: ObservableObject {
    static let shared = AuthService()

    // MARK: - Published Properties

    @Published private(set) var currentUser: User?
    @Published private(set) var isAuthenticated = false
    @Published private(set) var isLoading = false
    @Published var errorMessage: String?

    // MARK: - Private Properties

    private var authStateListener: AuthStateDidChangeListenerHandle?

    // MARK: - Initialization

    private init() {
        setupAuthStateListener()
    }

    deinit {
        if let listener = authStateListener {
            Auth.auth().removeStateDidChangeListener(listener)
        }
    }

    // MARK: - Configuration

    /// Configure Firebase - call this in App init
    static func configure() {
        FirebaseApp.configure()
    }

    // MARK: - Auth State

    private func setupAuthStateListener() {
        authStateListener = Auth.auth().addStateDidChangeListener { [weak self] _, firebaseUser in
            Task { @MainActor in
                if let firebaseUser = firebaseUser {
                    self?.currentUser = User(from: firebaseUser)
                    self?.isAuthenticated = true

                    // Identify user in analytics
                    AnalyticsService.shared.identify(
                        userId: firebaseUser.uid,
                        properties: [
                            "email": firebaseUser.email ?? "",
                            "name": firebaseUser.displayName ?? ""
                        ]
                    )
                } else {
                    self?.currentUser = nil
                    self?.isAuthenticated = false
                    AnalyticsService.shared.reset()
                }
            }
        }
    }

    // MARK: - Sign In with Google

    /// Sign in with Google
    func signInWithGoogle() async {
        isLoading = true
        errorMessage = nil

        defer { isLoading = false }

        AnalyticsService.shared.track(.loginStarted, properties: ["method": "google"])

        guard let clientID = FirebaseApp.app()?.options.clientID else {
            errorMessage = "Firebase not configured"
            return
        }

        let config = GIDConfiguration(clientID: clientID)
        GIDSignIn.sharedInstance.configuration = config

        guard let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
              let rootViewController = windowScene.windows.first?.rootViewController else {
            errorMessage = "Unable to get root view controller"
            return
        }

        do {
            let result = try await GIDSignIn.sharedInstance.signIn(withPresenting: rootViewController)

            guard let idToken = result.user.idToken?.tokenString else {
                errorMessage = "Unable to get ID token"
                return
            }

            let credential = GoogleAuthProvider.credential(
                withIDToken: idToken,
                accessToken: result.user.accessToken.tokenString
            )

            try await Auth.auth().signIn(with: credential)
            AnalyticsService.shared.track(.loginCompleted, properties: ["method": "google"])
        } catch {
            if (error as NSError).code != GIDSignInError.canceled.rawValue {
                errorMessage = error.localizedDescription
            }
        }
    }

    // MARK: - Email/Password Auth

    /// Sign up with email and password
    func signUp(email: String, password: String, displayName: String? = nil) async {
        isLoading = true
        errorMessage = nil

        defer { isLoading = false }

        AnalyticsService.shared.track(.signUpStarted, properties: ["method": "email"])

        do {
            let result = try await Auth.auth().createUser(withEmail: email, password: password)

            if let displayName = displayName, !displayName.isEmpty {
                let changeRequest = result.user.createProfileChangeRequest()
                changeRequest.displayName = displayName
                try? await changeRequest.commitChanges()
            }

            AnalyticsService.shared.track(.signUpCompleted, properties: ["method": "email"])
        } catch {
            errorMessage = mapAuthError(error)
        }
    }

    /// Sign in with email and password
    func signIn(email: String, password: String) async {
        isLoading = true
        errorMessage = nil

        defer { isLoading = false }

        AnalyticsService.shared.track(.loginStarted, properties: ["method": "email"])

        do {
            try await Auth.auth().signIn(withEmail: email, password: password)
            AnalyticsService.shared.track(.loginCompleted, properties: ["method": "email"])
        } catch {
            errorMessage = mapAuthError(error)
        }
    }

    /// Send password reset email
    func resetPassword(email: String) async {
        isLoading = true
        errorMessage = nil

        defer { isLoading = false }

        do {
            try await Auth.auth().sendPasswordReset(withEmail: email)
        } catch {
            errorMessage = mapAuthError(error)
        }
    }

    // MARK: - Sign Out

    func signOut() {
        do {
            try Auth.auth().signOut()
            AnalyticsService.shared.track(.logoutCompleted)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    // MARK: - Delete Account

    func deleteAccount() async {
        isLoading = true
        errorMessage = nil

        defer { isLoading = false }

        do {
            try await Auth.auth().currentUser?.delete()
        } catch {
            errorMessage = mapAuthError(error)
        }
    }

    // MARK: - Helpers

    private func mapAuthError(_ error: Error) -> String {
        guard let authError = error as NSError?,
              authError.domain == AuthErrorDomain else {
            return error.localizedDescription
        }

        switch AuthErrorCode(rawValue: authError.code) {
        case .emailAlreadyInUse:
            return "This email is already registered"
        case .invalidEmail:
            return "Invalid email address"
        case .weakPassword:
            return "Password must be at least 6 characters"
        case .wrongPassword, .invalidCredential:
            return "Invalid email or password"
        case .userNotFound:
            return "No account found with this email"
        case .networkError:
            return "Network error. Please try again"
        case .requiresRecentLogin:
            return "Please sign in again to complete this action"
        default:
            return error.localizedDescription
        }
    }

}

// MARK: - User Model

struct User: Identifiable {
    let id: String
    let email: String?
    let displayName: String?
    let photoURL: URL?

    init(from firebaseUser: FirebaseAuth.User) {
        self.id = firebaseUser.uid
        self.email = firebaseUser.email
        self.displayName = firebaseUser.displayName
        self.photoURL = firebaseUser.photoURL
    }
}
