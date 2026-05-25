//
//  ModelsView.swift
//  View for managing AI models
//

import SwiftUI

struct ModelsView: View {
    @EnvironmentObject var clusterManager: ClusterManager
    @State private var showingDownloadSheet = false
    @State private var downloadingModel: String?
    @State private var showingAlert = false
    @State private var alertTitle = ""
    @State private var alertMessage = ""

    var body: some View {
        NavigationView {
            ScrollView {
                VStack(spacing: 20) {
                    // Error banner
                    if let error = clusterManager.errorMessage {
                        ErrorBanner(message: error) {
                            clusterManager.errorMessage = nil
                        }
                    }

                    // Models Overview
                    modelsOverview

                    // Models Grid
                    modelsGrid

                    // Model Actions
                    modelActions

                    Spacer()
                }
                .padding()
            }
            .navigationTitle("Models")
            .refreshable {
                await clusterManager.refreshData()
            }
        }
        .alert(alertTitle, isPresented: $showingAlert) {
            Button("OK") {}
        } message: {
            Text(alertMessage)
        }
    }

    private var modelsOverview: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("AI Models")
                .font(.headline)
                .foregroundColor(.primary)

            HStack {
                ModelStat(
                    title: "Total", value: "\(totalModels)",
                    icon: "brain.head.profile", color: .blue
                )
                Spacer()
                ModelStat(
                    title: "Loaded", value: "\(loadedModels)",
                    icon: "checkmark.circle", color: .green
                )
                Spacer()
                ModelStat(
                    title: "Available", value: "\(availableModels)",
                    icon: "icloud.and.arrow.down", color: .orange
                )
            }
        }
    }

    private var modelsGrid: some View {
        let allModels = getAllModels()

        return Group {
            if allModels.isEmpty {
                VStack(spacing: 12) {
                    Image(systemName: "brain.head.profile")
                        .font(.system(size: 40))
                        .foregroundColor(.secondary)
                    Text("No Models")
                        .font(.title3)
                        .fontWeight(.semibold)
                    Text("Connect to a cluster with loaded models or download new ones.")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                        .multilineTextAlignment(.center)
                }
                .padding(30)
                .frame(maxWidth: .infinity)
                .background(Color(.systemGray6))
                .cornerRadius(12)
            } else {
                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 16) {
                    ForEach(allModels) { model in
                        ModelCard(model: model)
                    }
                }
            }
        }
    }

    private var modelActions: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Model Management")
                .font(.headline)
                .foregroundColor(.primary)

            VStack(spacing: 12) {
                Button(action: {
                    showAlert(
                        title: "Download Models",
                        message:
                            "Use the worker node API to download models:\nPOST /models/load with model_id and model_path.\nSee the CLI guide for details."
                    )
                }) {
                    HStack {
                        Image(systemName: "square.and.arrow.down")
                        Text("Download Models")
                        Spacer()
                    }
                }
                .buttonStyle(.bordered)

                Button(action: {
                    Task { await clusterManager.refreshData() }
                }) {
                    HStack {
                        Image(systemName: "arrow.clockwise")
                        Text("Refresh Models")
                        Spacer()
                    }
                }
                .buttonStyle(.bordered)

                Button(action: {
                    showAlert(
                        title: "Model Info",
                        message:
                            "Models are managed per-worker via the /models/load and /models/unload endpoints. Use the worker's /models/local endpoint to list available GGUF files."
                    )
                }) {
                    HStack {
                        Image(systemName: "info.circle")
                        Text("Model Info")
                        Spacer()
                    }
                }
                .buttonStyle(.bordered)
            }
        }
    }

    // MARK: - Computed Properties

    private var totalModels: Int { getAllModels().count }

    private var loadedModels: Int {
        getAllModels().filter { $0.isDownloaded }.count
    }

    private var availableModels: Int {
        getAllModels().filter { !$0.isDownloaded }.count
    }

    private func getAllModels() -> [AIModel] {
        var models = clusterManager.nodes.flatMap { $0.models }.map { modelName in
            AIModel(
                name: modelName,
                description: getDescription(for: modelName),
                size: getModelSize(for: modelName),
                layer: getLayer(for: modelName),
                isDownloaded: true,
                status: .active
            )
        }

        // Deduplicate by name
        var seen = Set<String>()
        models = models.filter { seen.insert($0.name).inserted }

        // Add available-but-not-loaded models
        let loadedNames = Set(models.map { $0.name.lowercased() })
        let available = getAvailableModels().filter { !loadedNames.contains($0.name.lowercased()) }
        models.append(contentsOf: available)

        return models.sorted { $0.name < $1.name }
    }

    private func showAlert(title: String, message: String) {
        alertTitle = title
        alertMessage = message
        showingAlert = true
    }

    // MARK: - Model Metadata

    private func getDescription(for modelName: String) -> String {
        switch modelName.lowercased() {
        case "phi-2": return "Microsoft's small but capable model"
        case "mistral-7b-instruct": return "Fast instruction-tuned model"
        case "codellama-7b-instruct": return "Specialized for programming"
        case "glm-4v-9b": return "Multimodal model with vision"
        case "llama-2-7b-chat": return "Meta's Llama 2 chat model"
        case "llama-3-8b-instruct": return "Advanced reasoning model"
        case "deepseek-coder-6.7b": return "Advanced code assistant"
        case "starcoder2-7b": return "Code generation model"
        default: return "AI language model"
        }
    }

    private func getModelSize(for modelName: String) -> String {
        switch modelName.lowercased() {
        case "phi-2": return "2.8GB"
        case "mistral-7b-instruct": return "4.1GB"
        case "codellama-7b-instruct": return "7.4GB"
        case "glm-4v-9b": return "18GB"
        case "llama-2-7b-chat": return "6.7GB"
        case "llama-3-8b-instruct": return "8.2GB"
        default: return "Unknown"
        }
    }

    private func getLayer(for modelName: String) -> Int {
        switch modelName.lowercased() {
        case "phi-2", "mistral-7b-instruct": return 1
        case "codellama-7b-instruct": return 2
        case "llama-2-7b-chat", "llama-3-8b-instruct": return 3
        case "glm-4v-9b": return 4
        default: return 1
        }
    }

    private func getAvailableModels() -> [AIModel] {
        [
            AIModel(
                name: "deepseek-coder-6.7b", description: "Advanced code assistant", size: "6.5GB",
                layer: 2, isDownloaded: false, status: .available),
            AIModel(
                name: "starcoder2-7b", description: "Code generation model", size: "7.1GB",
                layer: 2, isDownloaded: false, status: .available),
            AIModel(
                name: "llava-1.5-7b", description: "Vision Assistant", size: "13GB", layer: 4,
                isDownloaded: false, status: .available),
        ]
    }
}

// MARK: - Model Data

struct AIModel: Identifiable {
    let id = UUID()
    let name: String
    let description: String
    let size: String
    let layer: Int
    let isDownloaded: Bool
    let status: ModelDisplayStatus

    enum ModelDisplayStatus {
        case active, available, downloading, error
    }
}

// MARK: - Supporting Views

struct ModelStat: View {
    let title: String
    let value: String
    let icon: String
    let color: Color

    var body: some View {
        VStack(spacing: 4) {
            Image(systemName: icon)
                .foregroundColor(color)
                .font(.title2)
            Text(value)
                .font(.title2)
                .fontWeight(.bold)
                .foregroundColor(.primary)
            Text(title)
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(title): \(value)")
    }
}

struct ModelCard: View {
    let model: AIModel

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: modelIcon)
                    .foregroundColor(statusColor)
                    .font(.title2)

                VStack(alignment: .leading) {
                    Text(model.name)
                        .font(.headline)
                        .foregroundColor(.primary)
                        .lineLimit(1)

                    Text(model.description)
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .lineLimit(2)
                }

                Spacer()
            }

            Divider()

            HStack {
                Text("Size")
                    .font(.caption)
                    .foregroundColor(.secondary)
                Spacer()
                Text(model.size)
                    .font(.caption)
                    .fontWeight(.medium)
            }

            HStack {
                Image(systemName: model.isDownloaded ? "checkmark.circle.fill" : "icloud")
                    .foregroundColor(model.isDownloaded ? .green : .blue)
                    .font(.caption)

                Text(model.isDownloaded ? "Loaded" : "Available")
                    .font(.caption)
                    .foregroundColor(.secondary)

                Spacer()
            }
        }
        .padding()
        .background(Color(.systemGray6))
        .cornerRadius(12)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(
            "\(model.name), \(model.size), \(model.isDownloaded ? "loaded" : "available")")
    }

    private var modelIcon: String {
        switch model.layer {
        case 1: return "bolt"
        case 2: return "brain.head.profile"
        case 3: return "waveform"
        case 4: return "eye"
        default: return "gear"
        }
    }

    private var statusColor: Color {
        switch model.status {
        case .active: return .green
        case .available: return .blue
        case .downloading: return .orange
        case .error: return .red
        }
    }
}

#Preview {
    ModelsView()
        .environmentObject(ClusterManager())
}
