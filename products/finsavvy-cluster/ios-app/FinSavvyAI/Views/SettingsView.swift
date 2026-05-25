//
//  SettingsView.swift
//  Settings and configuration view
//

import SwiftUI

struct SettingsView: View {
    @EnvironmentObject var clusterManager: ClusterManager
    @State private var serverIP = "10.0.0.10"
    @State private var serverPort = "8000"
    @State private var refreshInterval = 5.0
    @State private var notificationsEnabled = true
    @State private var darkModeEnabled = true
    @State private var showingAlert = false
    @State private var alertMessage = ""
    @State private var alertTitle = ""

    var body: some View {
        NavigationView {
            Form {
                Section("Cluster Configuration") {
                    TextField("Server IP", text: $serverIP)
                        .textFieldStyle(RoundedBorderTextFieldStyle())

                    TextField("Server Port", text: $serverPort)
                        .textFieldStyle(RoundedBorderTextFieldStyle())

                    HStack {
                        Text("Refresh Interval")
                        Spacer()
                        Slider(value: $refreshInterval, in: 1...30, step: 1)
                        Text("\(Int(refreshInterval))s")
                            .foregroundColor(.secondary)
                    }
                }

                Section("Display") {
                    Toggle("Enable Notifications", isOn: $notificationsEnabled)
                    Toggle("Dark Mode", isOn: $darkModeEnabled)
                }

                Section("About") {
                    HStack {
                        Text("Version")
                        Spacer()
                        Text("1.0.0")
                            .foregroundColor(.secondary)
                    }

                    HStack {
                        Text("Build")
                        Spacer()
                        Text("2024.11.20")
                            .foregroundColor(.secondary)
                    }

                    Link(
                        "GitHub Repository",
                        destination: URL(
                            string: "https://github.com/finsavvyai/finsavvyai-cluster")!)

                    Link(
                        "Documentation",
                        destination: URL(
                            string: "https://github.com/finsavvyai/finsavvyai-cluster/docs")!)
                }

                Section("Actions") {
                    Button(action: {
                        saveConfiguration()
                    }) {
                        HStack {
                            Image(systemName: "square.and.arrow.down")
                            Text("Save Configuration")
                        }
                    }

                    Button(action: {
                        resetConfiguration()
                    }) {
                        HStack {
                            Image(systemName: "arrow.counterclockwise")
                            Text("Reset to Defaults")
                        }
                    }

                    Button(action: {
                        testConnection()
                    }) {
                        HStack {
                            Image(systemName: "network")
                            Text("Test Connection")
                        }
                    }

                    Button(
                        role: .destructive,
                        action: {
                            clearCache()
                        }
                    ) {
                        HStack {
                            Image(systemName: "trash")
                            Text("Clear Cache")
                                .foregroundColor(.red)
                        }
                    }
                }
            }
            .navigationTitle("Settings")
        }
        .alert(alertTitle, isPresented: $showingAlert) {
            Button("OK") {}
        } message: {
            Text(alertMessage)
        }
    }

    private func saveConfiguration() {
        UserDefaults.standard.set(serverIP, forKey: "serverIP")
        UserDefaults.standard.set(serverPort, forKey: "serverPort")
        UserDefaults.standard.set(refreshInterval, forKey: "refreshInterval")
        UserDefaults.standard.set(notificationsEnabled, forKey: "notificationsEnabled")
        UserDefaults.standard.set(darkModeEnabled, forKey: "darkModeEnabled")

        showAlert(title: "Success", message: "Configuration saved successfully")
    }

    private func resetConfiguration() {
        serverIP = "10.0.0.10"
        serverPort = "8000"
        refreshInterval = 5.0
        notificationsEnabled = true
        darkModeEnabled = true

        showAlert(title: "Reset Complete", message: "Settings reset to defaults")
    }

    private func testConnection() {
        Task {
            await performConnectionTest()
        }
    }

    private func performConnectionTest() async {
        let testIP = serverIP
        let testPort = serverPort

        guard let url = URL(string: "http://\(testIP):\(testPort)/health") else {
            showAlert(title: "Error", message: "Invalid URL")
            return
        }

        do {
            let (_, response) = try await URLSession.shared.data(from: url)

            if let httpResponse = response as? HTTPURLResponse,
                httpResponse.statusCode == 200
            {
                showAlert(
                    title: "Success", message: "Connection to cluster established successfully")
            } else {
                showAlert(title: "Connection Failed", message: "Unable to reach cluster server")
            }
        } catch {
            showAlert(title: "Connection Error", message: error.localizedDescription)
        }
    }

    private func clearCache() {
        UserDefaults.standard.removeObject(forKey: "serverIP")
        UserDefaults.standard.removeObject(forKey: "serverPort")
        UserDefaults.standard.removeObject(forKey: "refreshInterval")
        UserDefaults.standard.removeObject(forKey: "notificationsEnabled")
        UserDefaults.standard.removeObject(forKey: "darkModeEnabled")

        showAlert(title: "Cache Cleared", message: "All saved settings have been cleared")
    }

    private func showAlert(title: String, message: String) {
        alertTitle = title
        alertMessage = message
        showingAlert = true
    }
}

#Preview {
    SettingsView()
        .environmentObject(ClusterManager())
}
