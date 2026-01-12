//
//  ContentView.swift
//  Japanese Reader
//
//  Created by Hiro Ayettey on 1/6/26.
//

import SwiftUI

struct ContentView: View {
    @StateObject private var appState = AppState()
    @AppStorage("colorScheme") private var colorSchemePreference: String = "system"

    var preferredColorScheme: ColorScheme? {
        switch colorSchemePreference {
        case "light": return .light
        case "dark": return .dark
        default: return nil // System default
        }
    }

    var body: some View {
        MainTabView()
            .environmentObject(appState)
            .preferredColorScheme(preferredColorScheme)
    }
}

#Preview {
    ContentView()
}
