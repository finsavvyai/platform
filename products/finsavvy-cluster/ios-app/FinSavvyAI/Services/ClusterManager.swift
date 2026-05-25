//
//  ClusterManager.swift
//  Core service for managing FinSavvyAI cluster communication
//

import Combine
import Foundation

// MARK: - Data Models
struct ClusterStatus: Codable, Identifiable {
    let id = UUID()
    let clusterId: String
    let status: String
    let master: String
    let totalNodes: Int
    let onlineNodes: Int
    let created: String

    enum CodingKeys: String, CodingKey {
        case clusterId = "ClusterId"
        case status = "Status"
        case master = "Master"
        case totalNodes = "Nodes"
        case onlineNodes = "OnlineNodes"
        case created = "Created"
    }
}

struct ClusterNode: Codable, Identifiable {
    let id: String
    let name: String
    let host: String
    let port: Int
    let status: String
    let models: [String]
    let load: String
    let lastHeartbeat: String?

    enum CodingKeys: String, CodingKey {
        case id = "NodeId"
        case name = "Name"
        case host = "Host"
        case port = "Port"
        case status = "Status"
        case models = "Models"
        case load = "Load"
        case lastHeartbeat = "Last Heartbeat"
    }
}

struct ServiceStatus: Codable, Identifiable {
    let id = String
    let service: String
    let status: String
    let port: String
    let endpoint: String

    init(service: String, status: String, port: String, endpoint: String) {
        self.id = service
        self.service = service
        self.status = status
        self.port = port
        self.endpoint = endpoint
    }
}

// MARK: - API Service
class FinSavvyAIService: ObservableObject {
    private let baseURL: String
    private let session: URLSession

    init(baseURL: String = "http://10.0.0.10:8000") {
        self.baseURL = baseURL
        self.session = URLSession(configuration: .default)
    }

    func getClusterStatus() async throws -> ClusterStatus {
        let url = URL(string: "\(baseURL)/cluster/status")!
        let (data, _) = try await session.data(from: url)
        let decoder = JSONDecoder()
        return try decoder.decode([String: Any].self, from: data).map { dict in
            ClusterStatus(
                clusterId: dict["cluster_id"] as? String ?? "unknown",
                status: dict["status"] as? String ?? "unknown",
                master: dict["master"] as? String ?? "unknown",
                totalNodes: dict["total_nodes"] as? Int ?? 0,
                onlineNodes: dict["online_nodes"] as? Int ?? 0,
                created: dict["timestamp"] as? String ?? ""
            )
        }.first
            ?? ClusterStatus(
                clusterId: "unknown",
                status: "unknown",
                master: baseURL,
                totalNodes: 0,
                onlineNodes: 0,
                created: ""
            )
    }

    func getNodes() async throws -> [ClusterNode] {
        let url = URL(string: "\(baseURL)/cluster/nodes")!
        let (data, _) = try await session.data(from: url)
        let decoder = JSONDecoder()
        let response = try decoder.decode([String: Any].self, from: data)

        guard let nodesData = response["nodes"] as? [[String: Any]] else {
            return []
        }

        return nodesData.compactMap { dict in
            guard let id = dict["id"] as? String else { return nil }
            return ClusterNode(
                id: id,
                name: dict["name"] as? String ?? "Unknown",
                host: dict["host"] as? String ?? "localhost",
                port: dict["port"] as? Int ?? 0,
                status: dict["status"] as? String ?? "unknown",
                models: dict["models"] as? [String] ?? [],
                load: dict["load"] as? String ?? "0/0",
                lastHeartbeat: dict["last_heartbeat"] as? String
            )
        }
    }

    func startService(service: String) async throws -> Bool {
        let url = URL(string: "\(baseURL)/api/services/start")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let body = ["service": service]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (_, response) = try await session.data(for: request)
        return (response as? HTTPURLResponse)?.statusCode == 200
    }

    func stopService(service: String) async throws -> Bool {
        let url = URL(string: "\(baseURL)/api/services/stop")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let body = ["service": service]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (_, response) = try await session.data(for: request)
        return (response as? HTTPURLResponse)?.statusCode == 200
    }
}

// MARK: - Cluster Manager
class ClusterManager: ObservableObject {
    @Published var clusterStatus: ClusterStatus?
    @Published var nodes: [ClusterNode] = []
    @Published var services: [ServiceStatus] = []
    @Published var isConnected = false
    @Published var isLoading = false
    @Published var errorMessage: String?

    private let apiService = FinSavvyAIService()
    private var timer: Timer?

    init() {
        loadClusterStatus()
    }

    func startMonitoring() {
        timer = Timer.scheduledTimer(withTimeInterval: 5.0, repeats: true) { _ in
            Task {
                await self.refreshData()
            }
        }
    }

    func stopMonitoring() {
        timer?.invalidate()
        timer = nil
    }

    func refreshData() async {
        isLoading = true
        errorMessage = nil

        do {
            async let status = try await apiService.getClusterStatus()
            async let nodes = try await apiService.getNodes()

            await MainActor.run {
                self.clusterStatus = status
                self.nodes = nodes
                self.updateServices()
                self.isConnected = true
                self.isLoading = false
            }
        } catch {
            await MainActor.run {
                self.errorMessage = error.localizedDescription
                self.isConnected = false
                self.isLoading = false
            }
        }
    }

    private func loadClusterStatus() {
        Task {
            await refreshData()
        }
    }

    private func updateServices() {
        services = [
            ServiceStatus(
                service: "Master",
                status: "RUNNING",
                port: "8000",
                endpoint: "http://10.0.0.10:8000"
            ),
            ServiceStatus(
                service: "Worker",
                status: nodes.isEmpty ? "STOPPED" : "RUNNING",
                port: "8001",
                endpoint: "http://10.0.0.10:8001"
            ),
        ]
    }

    func startService(_ service: String) async {
        do {
            let success = try await apiService.startService(service: service)
            if success {
                await refreshData()
            } else {
                errorMessage = "Failed to start \(service) service"
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func stopService(_ service: String) async {
        do {
            let success = try await apiService.stopService(service: service)
            if success {
                await refreshData()
            } else {
                errorMessage = "Failed to stop \(service) service"
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
