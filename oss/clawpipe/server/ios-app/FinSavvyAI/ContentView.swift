//
//  ContentView.swift
//  FinSavvyAI - Professional iOS app for managing AI clusters
//

import SwiftUI

struct ContentView: View {
    @StateObject private var clusterManager = ClusterManager()
    @State private var selectedTab = 0

    var body: some View {
        TabView(selection: $selectedTab) {
            DashboardView()
                .tabItem {
                    Label("Dashboard", systemImage: "cpu")
                }
                .tag(0)
                .environmentObject(clusterManager)

            NodesView()
                .tabItem {
                    Label("Nodes", systemImage: "server.rack")
                }
                .tag(1)
                .environmentObject(clusterManager)

            ServicesView()
                .tabItem {
                    Label("Services", systemImage: "gear.circle")
                }
                .tag(2)
                .environmentObject(clusterManager)

            ModelsView()
                .tabItem {
                    Label("Models", systemImage: "brain.head.profile")
                }
                .tag(3)
                .environmentObject(clusterManager)

            SettingsView()
                .tabItem {
                    Label("Settings", systemImage: "slider.horizontal.3")
                }
                .tag(4)
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
}
