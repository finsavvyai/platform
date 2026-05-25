//
//  ModelsView.swift
//  View for managing AI models
//

import SwiftUI

struct ModelsView: View {
    @EnvironmentObject var clusterManager: ClusterManager

    var body: some View {
        NavigationView {
            ScrollView {
                VStack(spacing: 20) {
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
                Task {
                    await clusterManager.refreshData()
                }
            }
        }
    }

    private var modelsOverview: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("AI Models")
                .font(.headline)
                .foregroundColor(.primary)

            HStack {
                ModelStat(
                    title: "Total Models", value: totalModels, icon: "brain.head.profile",
                    color: .blue)
                Spacer()
                ModelStat(
                    title: "Available", value: availableModels, icon: "checkmark.circle",
                    color: .green)
                Spacer()
                ModelStat(title: "Layers", value: modelLayers, icon: "stack", color: .purple)
            }
        }
    }

    private var modelsGrid: some View {
        let allModels = getAllModels()

        LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 2), spacing: 16) {
            ForEach(allModels) { model in
                ModelCard(model: model)
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
                    // TODO: Download models
                }) {
                    HStack {
                        Image(systemName: "square.and.arrow.down")
                        Text("Download Models")
                    }
                }
                .buttonStyle(.bordered)

                Button(action: {
                    // TODO: Update models
                }) {
                    HStack {
                        Image(systemName: "arrow.clockwise")
                        Text("Update Models")
                    }
                }
                .buttonStyle(.bordered)

                Button(action: {
                    // TODO: Manage models
                }) {
                    HStack {
                        Image(systemName: "slider.horizontal.3")
                        Text("Manage Models")
                    }
                }
                .buttonStyle(.bordered)
            }
        }
    }

    private var totalModels: Int {
        return getAllModels().count
    }

    private var availableModels: Int {
        return getAllModels().filter { $0.isDownloaded }.count
    }

    private var modelLayers: Int {
        return Set(getAllModels().map { $0.layer }).count
    }

    private func getAllModels() -> [AIModel] {
        // Return models from cluster nodes plus available models
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

        // Add available models that can be downloaded
        models.append(contentsOf: getAvailableModels())

        return models.sorted { $0.name < $1.name }
    }

    private func getDescription(for modelName: String) -> String {
        switch modelName.lowercased() {
        case "phi-2":
            return "Microsoft's small but capable model for quick tasks"
        case "mistral-7b-instruct":
            return "Fast instruction-tuned model for chat"
        case "codellama-7b-instruct":
            return "Specialized for programming and development"
        case "glm-4v-9b":
            return "Multimodal model with vision capabilities"
        case "llama-2-7b-chat":
            return "Meta's Llama 2 chat model"
        case "llama-3-8b-instruct":
            return "Advanced reasoning and strategy model"
        default:
            return "AI language model"
        }
    }

    private func getModelSize(for modelName: String) -> String {
        switch modelName.lowercased() {
        case "phi-2":
            return "2.8GB"
        case "mistral-7b-instruct":
            return "4.1GB"
        case "codellama-7b-instruct":
            return "7.4GB"
        case "glm-4v-9b":
            return "18GB"
        case "llama-2-7b-chat":
            return "6.7GB"
        case "llama-3-8b-instruct":
            return "8.2GB"
        default:
            return "Unknown"
        }
    }

    private func getLayer(for modelName: String) -> Int {
        switch modelName.lowercased() {
        case "phi-2", "mistral-7b-instruct":
            return 1
        case "codellama-7b-instruct":
            return 2
        case "llama-2-7b-chat", "llama-3-8b-instruct":
            return 3
        case "glm-4v-9b":
            return 4
        default:
            return 1
        }
    }

    private func getAvailableModels() -> [AIModel] {
        // Models that can be downloaded but aren't currently loaded
        return [
            AIModel(
                name: "deepseek-coder-6.7b",
                description: "Advanced programming assistant",
                size: "6.5GB",
                layer: 2,
                isDownloaded: false,
                status: .available
            ),
            AIModel(
                name: "starcoder2-7b",
                description: "Advanced code generation model",
                size: "7.1GB",
                layer: 2,
                isDownloaded: false,
                status: .available
            ),
            AIModel(
                name: "llava-1.5-7b",
                description: "Large Language and Vision Assistant",
                size: "13GB",
                layer: 4,
                isDownloaded: false,
                status: .available
            ),
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
    let status: ModelStatus

    enum ModelStatus {
        case active, available, downloading, error
    }
}

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

                    Text(model.description)
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .lineLimit(2)
                }

                Spacer()
            }

            Divider()

            HStack {
                DetailRow(title: "Size", value: model.size)
                Spacer()
            }

            HStack {
                DetailRow(title: "Layer", value: "Layer \(model.layer)")
                Spacer()
            }

            HStack {
                Image(systemName: model.isDownloaded ? "checkmark.circle.fill" : "icloud")
                    .foregroundColor(model.isDownloaded ? .green : .blue)

                Text(model.isDownloaded ? "Downloaded" : "Available")
                    .font(.caption)
                    .foregroundColor(.secondary)

                Spacer()
            }
        }
        .padding()
        .background(Color(.systemGray6))
        .cornerRadius(12)
    }

    private var modelIcon: String {
        switch model.layer {
        case 1:
            return "bolt"
        case 2:
            return "brain.head.profile"
        case 3:
            return "waveform"
        case 4:
            return "eye"
        default:
            return "gear"
        }
    }

    private var statusColor: Color {
        switch model.status {
        case .active:
            return .green
        case .available:
            return .blue
        case .downloading:
            return .orange
        case .error:
            return .red
        }
    }
}

#Preview {
    ModelsView()
        .environmentObject(ClusterManager())
}
