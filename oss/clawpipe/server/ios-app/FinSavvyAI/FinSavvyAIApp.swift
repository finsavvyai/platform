//
//  FinSavvyAIApp.swift
//  Main app entry point
//

import SwiftUI

@main
struct FinSavvyAIApp: App {
    @State private var isLaunching = true

    var body: some Scene {
        WindowGroup {
            ZStack {
                ContentView()
                    .opacity(isLaunching ? 0 : 1)

                if isLaunching {
                    LaunchScreen()
                        .transition(.opacity)
                }
            }
            .preferredColorScheme(.dark)
            .onAppear {
                DispatchQueue.main.asyncAfter(deadline: .now() + 1.2) {
                    withAnimation(.easeOut(duration: 0.4)) {
                        isLaunching = false
                    }
                }
            }
        }
    }
}
