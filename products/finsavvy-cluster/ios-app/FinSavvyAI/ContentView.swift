//
//  ContentView.swift
//  FinSavvyAI - Professional iOS app for managing AI clusters
//
//  Created by FinSavvyAI Team
//

import SwiftUI

struct ContentView: View {
    @StateObject private var clusterManager = ClusterManager()
    @State private var selectedTab = 0

    var body: some View {
        TabView(selection: $selectedTab) {
            // Dashboard Tab
            DashboardView()
                .tabItem {
                    Label("Dashboard", systemImage: "cpu")
                }
                .environmentObject(clusterManager)

            // Nodes Tab
            NodesView()
                .tabItem {
                    Label("Nodes", systemImage: "server.rack")
                }
                .environmentObject(clusterManager)

            // Services Tab
            ServicesView()
                .tabItem {
                    Label("Services", systemImage: "gear.circle")
                }
                .environmentObject(clusterManager)

            // Models Tab
            ModelsView()
                .tabItem {
                    Label("Models", systemImage: "brain.head.profile")
                }
                .environmentObject(clusterManager)

            // Settings Tab
            SettingsView()
                .tabItem {
                    Label("Settings", systemImage: "slider.horizontal.3")
                }
                .environmentObject(clusterManager)
        }
        .accentColor(.blue)
        .onAppear {
            clusterManager.startMonitoring()
        }
    }
}

#Preview {
    ContentView()
        .environmentObject(ClusterManager())
}
