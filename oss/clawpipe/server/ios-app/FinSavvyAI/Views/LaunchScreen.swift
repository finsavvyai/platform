//
//  LaunchScreen.swift
//  Splash screen shown during app startup
//

import SwiftUI

struct LaunchScreen: View {
    var body: some View {
        ZStack {
            Color(.systemBackground)
                .ignoresSafeArea()

            VStack(spacing: 20) {
                Image(systemName: "cpu")
                    .font(.system(size: 64))
                    .foregroundStyle(
                        .linearGradient(
                            colors: [.blue, .purple],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        ))

                Text("FinSavvyAI")
                    .font(.largeTitle)
                    .fontWeight(.bold)
                    .foregroundColor(.primary)

                Text("AI Cluster Manager")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
            }
        }
    }
}

#Preview {
    LaunchScreen()
}
