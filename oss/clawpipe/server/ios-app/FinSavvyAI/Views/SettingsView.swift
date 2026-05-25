//
//  SettingsView.swift
//  Settings and configuration view
//

import SwiftUI

struct SettingsView: View {
    @EnvironmentObject var clusterManager: ClusterManager
    @State private var serverIP: String = ""
    @State private var serverPort: String = ""
    @State private var refreshInterval = 5.0
    @State private var notificationsEnabled = true
    @State private var darkModeEnabled = true
    @State private var showingAlert = false
    @State private var alertMessage = ""
    @State private var alertTitle = ""
    @State private var isTesting = false
    @State private var apiKeyInput = ""
    @State private var hasStoredKey = KeychainManager.getAPIKey() != nil

    var body: some View {
        NavigationView {
            Form {
                Section("Cluster Connection") {
                    HStack {
                        Text("Server IP")
                        Spacer()
                        TextField("e.g. 192.168.1.100", text: $serverIP)
                            .multilineTextAlignment(.trailing)
                            .keyboardType(.decimalPad)
                            .autocorrectionDisabled()
                    }

                    HStack {
                        Text("Server Port")
                        Spacer()
                        TextField("8000", text: $serverPort)
                            .multilineTextAlignment(.trailing)
                            .keyboardType(.numberPad)
                    }

                    HStack {
                        Text("Refresh Interval")
                        Spacer()
                        Slider(value: $refreshInterval, in: 1...30, step: 1)
                            .frame(width: 150)
                        Text("\(Int(refreshInterval))s")
                            .foregroundColor(.secondary)
                            .frame(width: 30)
                    }

                    // Connection status
                    HStack {
                        Text("Status")
                        Spacer()
                        HStack(spacing: 6) {
                            Circle()
                                .fill(clusterManager.isConnected ? Color.green : Color.red)
                                .frame(width: 8, height: 8)
                            Text(clusterManager.isConnected ? "Connected" : "Disconnected")
                                .font(.subheadline)
                                .foregroundColor(.secondary)
                        }
                    }
                }

                Section("Authentication") {
                    if hasStoredKey {
                        HStack {
                            Image(systemName: "key.fill")
                                .foregroundColor(.green)
                            Text("API Key Stored")
                                .foregroundColor(.primary)
                            Spacer()
                            Button("Remove") {
                                KeychainManager.removeAPIKey()
                                hasStoredKey = false
                                showAlert(
                                    title: "Removed", message: "API key removed from Keychain")
                            }
                            .foregroundColor(.red)
                            .font(.subheadline)
                        }
                    } else {
                        SecureField("Enter API key (finsavvy-...)", text: $apiKeyInput)
                            .autocorrectionDisabled()
                            .textInputAutocapitalization(.never)

                        Button("Save to Keychain") {
                            guard !apiKeyInput.isEmpty else {
                                showAlert(title: "Error", message: "API key cannot be empty")
                                return
                            }
                            KeychainManager.storeAPIKey(apiKeyInput)
                            apiKeyInput = ""
                            hasStoredKey = true
                            showAlert(
                                title: "Saved", message: "API key stored securely in Keychain")
                        }
                        .disabled(apiKeyInput.isEmpty)
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
                        Text("2026.02")
                            .foregroundColor(.secondary)
                    }

                    if let lastUpdated = clusterManager.lastUpdated {
                        HStack {
                            Text("Last Sync")
                            Spacer()
                            Text(lastUpdated, style: .relative)
                                .foregroundColor(.secondary)
                        }
                    }
                }

                Section("Actions") {
                    Button(action: saveConfiguration) {
                        Label("Save Configuration", systemImage: "square.and.arrow.down")
                    }

                    Button(action: resetConfiguration) {
                        Label("Reset to Defaults", systemImage: "arrow.counterclockwise")
                    }

                    Button(action: testConnection) {
                        HStack {
                            Label("Test Connection", systemImage: "network")
                            Spacer()
                            if isTesting {
                                ProgressView()
                                    .scaleEffect(0.8)
                            }
                        }
                    }
                    .disabled(isTesting)

                    Button(role: .destructive, action: clearCache) {
                        Label("Clear Cache", systemImage: "trash")
                    }
                }
            }
            .navigationTitle("Settings")
            .onAppear(perform: loadSavedSettings)
        }
        .alert(alertTitle, isPresented: $showingAlert) {
            Button("OK") {}
        } message: {
            Text(alertMessage)
        }
    }

    private func loadSavedSettings() {
        serverIP = UserDefaults.standard.string(forKey: "serverIP") ?? "10.0.0.10"
        serverPort = UserDefaults.standard.string(forKey: "serverPort") ?? "8000"
        refreshInterval = UserDefaults.standard.double(forKey: "refreshInterval")
        if refreshInterval < 1 { refreshInterval = 5.0 }
        notificationsEnabled =
            UserDefaults.standard.object(forKey: "notificationsEnabled") as? Bool ?? true
        darkModeEnabled = UserDefaults.standard.object(forKey: "darkModeEnabled") as? Bool ?? true
    }

    private func saveConfiguration() {
        // Validate inputs
        guard !serverIP.isEmpty else {
            showAlert(title: "Validation Error", message: "Server IP cannot be empty")
            return
        }
        guard let port = Int(serverPort), (1...65535).contains(port) else {
            showAlert(title: "Validation Error", message: "Port must be between 1 and 65535")
            return
        }

        UserDefaults.standard.set(serverIP, forKey: "serverIP")
        UserDefaults.standard.set(serverPort, forKey: "serverPort")
        UserDefaults.standard.set(refreshInterval, forKey: "refreshInterval")
        UserDefaults.standard.set(notificationsEnabled, forKey: "notificationsEnabled")
        UserDefaults.standard.set(darkModeEnabled, forKey: "darkModeEnabled")

        // Update the live connection
        clusterManager.updateBaseURL(ip: serverIP, port: serverPort)

        showAlert(title: "Saved", message: "Configuration saved and cluster connection updated")
    }

    private func resetConfiguration() {
        serverIP = "10.0.0.10"
        serverPort = "8000"
        refreshInterval = 5.0
        notificationsEnabled = true
        darkModeEnabled = true

        showAlert(title: "Reset", message: "Settings reset to defaults. Tap Save to apply.")
    }

    private func testConnection() {
        isTesting = true
        Task {
            do {
                let testService = FinSavvyAIService(baseURL: "http://\(serverIP):\(serverPort)")
                let healthy = try await testService.checkHealth()
                isTesting = false
                if healthy {
                    showAlert(
                        title: "Success", message: "Connection to cluster established successfully")
                } else {
                    showAlert(title: "Failed", message: "Server responded but health check failed")
                }
            } catch {
                isTesting = false
                showAlert(title: "Connection Error", message: error.localizedDescription)
            }
        }
    }

    private func clearCache() {
        let keys = [
            "serverIP", "serverPort", "refreshInterval", "notificationsEnabled",
            "darkModeEnabled", "cachedClusterStatus", "cachedNodes",
        ]
        keys.forEach { UserDefaults.standard.removeObject(forKey: $0) }
        loadSavedSettings()
        showAlert(
            title: "Cache Cleared", message: "All saved settings and cached data have been cleared")
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
