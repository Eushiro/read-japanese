//
//  AppMain.swift
//

import SwiftUI
import GoogleSignIn

@main
struct AppMain: App {
    @StateObject private var authService = AuthService.shared

    init() {
        // Configure Firebase
        AuthService.configure()

        // Configure PostHog Analytics
        AnalyticsService.shared.configure()
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(authService)
                .onAppear {
                    AnalyticsService.shared.track(.appOpened)
                }
                .onOpenURL { url in
                    GIDSignIn.sharedInstance.handle(url)
                }
        }
    }
}
