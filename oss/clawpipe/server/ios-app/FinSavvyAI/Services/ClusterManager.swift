//
//  ClusterManager.swift
//  Core service for managing FinSavvyAI cluster communication
//

import Combine
import Foundation

// MARK: - Data Models

struct ClusterStatus: Codable {
    let clusterId: String
    let status: String
    let master: String
    let totalNodes: Int
    let onlineNodes: Int
    let totalModels: Int
    let timestamp: String

    enum CodingKeys: String, CodingKey {
        case clusterId = "cluster_id"
        case status
        case master
        case totalNodes = "total_nodes"
        case onlineNodes = "online_nodes"
        case totalModels = "total_models"
        case timestamp
    }
}

struct ClusterNode: Codable, Identifiable {
    let id: String
    let name: String?
    let host: String
    let port: Int
    let status: String
    let models: [String]
    let load: Int?
    let lastHeartbeat: String?
    let registeredAt: String?
    let requestCount: Int?
    let uptime: Double?

    enum CodingKeys: String, CodingKey {
        case id, name, host, port, status, models, load
        case lastHeartbeat = "last_heartbeat"
        case registeredAt = "registered_at"
        case requestCount = "request_count"
        case uptime
    }

    var displayName: String {
        name ?? id
    }

    var isOnline: Bool {
        status == "online"
    }

    var loadPercent: Double {
        Double(load ?? 0) * 10.0
    }
}

struct NodesResponse: Codable {
    let nodes: [ClusterNode]
}

struct ServiceStatus: Identifiable {
    let id: String
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

// MARK: - Network Errors

enum ClusterError: LocalizedError {
    case invalidURL
    case serverUnreachable(String)
    case httpError(Int, String)
    case decodingError(String)
    case timeout
    case noData

    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "Invalid server URL. Check your settings."
        case .serverUnreachable(let detail):
            return "Cannot reach cluster: \(detail)"
        case .httpError(let code, let message):
            return "Server error (\(code)): \(message)"
        case .decodingError(let detail):
            return "Unexpected response format: \(detail)"
        case .timeout:
            return "Connection timed out. Is the cluster running?"
        case .noData:
            return "No data received from server."
        }
    }
}

// MARK: - API Service

class FinSavvyAIService {
    var baseURL: String

    private let session: URLSession

    init(baseURL: String? = nil) {
        let savedIP = UserDefaults.standard.string(forKey: "serverIP") ?? "10.0.0.10"
        let savedPort = UserDefaults.standard.string(forKey: "serverPort") ?? "8000"
        self.baseURL = baseURL ?? "http://\(savedIP):\(savedPort)"

        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 10
        config.timeoutIntervalForResource = 30
        self.session = URLSession(configuration: config)
    }

    func updateBaseURL(ip: String, port: String) {
        self.baseURL = "http://\(ip):\(port)"
    }

    // MARK: - Cluster Status

    func getClusterStatus() async throws -> ClusterStatus {
        guard let url = URL(string: "\(baseURL)/cluster/status") else {
            throw ClusterError.invalidURL
        }

        let (data, response) = try await performRequest(url: url)
        try validateResponse(response, data: data)

        do {
            let decoder = JSONDecoder()
            return try decoder.decode(ClusterStatus.self, from: data)
        } catch {
            throw ClusterError.decodingError(error.localizedDescription)
        }
    }

    // MARK: - Nodes

    func getNodes() async throws -> [ClusterNode] {
        guard let url = URL(string: "\(baseURL)/cluster/nodes") else {
            throw ClusterError.invalidURL
        }

        let (data, response) = try await performRequest(url: url)
        try validateResponse(response, data: data)

        do {
            let decoder = JSONDecoder()
            let nodesResponse = try decoder.decode(NodesResponse.self, from: data)
            return nodesResponse.nodes
        } catch {
            throw ClusterError.decodingError(error.localizedDescription)
        }
    }

    // MARK: - Service Control

    func startService(service: String) async throws -> Bool {
        return try await postServiceCommand(action: "start", service: service)
    }

    func stopService(service: String) async throws -> Bool {
        return try await postServiceCommand(action: "stop", service: service)
    }

    // MARK: - Health Check

    func checkHealth() async throws -> Bool {
        guard let url = URL(string: "\(baseURL)/health") else {
            throw ClusterError.invalidURL
        }

        let (_, response) = try await performRequest(url: url)
        guard let http = response as? HTTPURLResponse else { return false }
        return http.statusCode == 200
    }

    // MARK: - Private Helpers

    private func performRequest(url: URL) async throws -> (Data, URLResponse) {
        // Build request with optional API key from Keychain
        var request = URLRequest(url: url)
        if let apiKey = KeychainManager.getAPIKey() {
            request.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")
        }

        do {
            return try await session.data(for: request)
        } catch let error as URLError {
            switch error.code {
            case .timedOut:
                throw ClusterError.timeout
            case .cannotConnectToHost, .cannotFindHost, .networkConnectionLost:
                throw ClusterError.serverUnreachable(error.localizedDescription)
            default:
                throw ClusterError.serverUnreachable(error.localizedDescription)
            }
        }
    }

    private func validateResponse(_ response: URLResponse, data: Data) throws {
        guard let http = response as? HTTPURLResponse else {
            throw ClusterError.noData
        }
        guard (200...299).contains(http.statusCode) else {
            let body = String(data: data, encoding: .utf8) ?? "No details"
            throw ClusterError.httpError(http.statusCode, body)
        }
    }

    private func postServiceCommand(action: String, service: String) async throws -> Bool {
        guard let url = URL(string: "\(baseURL)/api/services/\(action)") else {
            throw ClusterError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: ["service": service])

        let (_, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else { return false }
        return (200...299).contains(http.statusCode)
    }
}

// MARK: - Cluster Manager (ViewModel)

@MainActor
class ClusterManager: ObservableObject {
    @Published var clusterStatus: ClusterStatus?
    @Published var nodes: [ClusterNode] = []
    @Published var services: [ServiceStatus] = []
    @Published var isConnected = false
    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published var lastUpdated: Date?

    let apiService: FinSavvyAIService
    let webSocket = WebSocketManager()
    private var timer: Timer?
    private var cachedNodes: [ClusterNode] = []
    private var cachedStatus: ClusterStatus?

    init(baseURL: String? = nil) {
        self.apiService = FinSavvyAIService(baseURL: baseURL)
        loadCachedData()
    }

    func startMonitoring() {
        // Initial fetch
        Task { await refreshData() }

        // Polling fallback
        timer = Timer.scheduledTimer(withTimeInterval: 5.0, repeats: true) { [weak self] _ in
            Task { [weak self] in
                await self?.refreshData()
            }
        }

        // WebSocket for real-time push events
        connectWebSocket()
    }

    func stopMonitoring() {
        timer?.invalidate()
        timer = nil
        webSocket.disconnect()
    }

    private func connectWebSocket() {
        // The Go desktop backend serves /ws on the same host
        let wsURL = apiService.baseURL
            .replacingOccurrences(of: "http://", with: "ws://")
            .replacingOccurrences(of: "https://", with: "wss://")
        webSocket.connect(to: "\(wsURL)/ws")

        webSocket.onEvent = { [weak self] event in
            Task { [weak self] in
                // Any node/cluster/config event triggers a data refresh
                await self?.refreshData()
            }
        }
    }

    func refreshData() async {
        isLoading = true
        errorMessage = nil

        do {
            async let statusTask = apiService.getClusterStatus()
            async let nodesTask = apiService.getNodes()

            let (status, fetchedNodes) = try await (statusTask, nodesTask)

            self.clusterStatus = status
            self.nodes = fetchedNodes
            self.updateServices()
            self.isConnected = true
            self.isLoading = false
            self.lastUpdated = Date()

            // Cache for offline mode
            self.cachedStatus = status
            self.cachedNodes = fetchedNodes
            saveCachedData()
        } catch {
            self.errorMessage =
                (error as? ClusterError)?.errorDescription
                ?? error.localizedDescription
            self.isConnected = false
            self.isLoading = false

            // Fall back to cached data if available
            if clusterStatus == nil, let cached = cachedStatus {
                self.clusterStatus = cached
                self.nodes = cachedNodes
                self.updateServices()
            }
        }
    }

    func updateBaseURL(ip: String, port: String) {
        apiService.updateBaseURL(ip: ip, port: port)
        connectWebSocket()
        Task { await refreshData() }
    }

    // MARK: - Service Control

    func startService(_ service: String) async {
        do {
            let success = try await apiService.startService(service: service)
            if success {
                await refreshData()
            } else {
                errorMessage = "Failed to start \(service) service"
            }
        } catch {
            errorMessage =
                (error as? ClusterError)?.errorDescription
                ?? error.localizedDescription
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
            errorMessage =
                (error as? ClusterError)?.errorDescription
                ?? error.localizedDescription
        }
    }

    // MARK: - Private Helpers

    private func updateServices() {
        let masterEndpoint = apiService.baseURL
        let workerPort = "8001"
        // Derive worker endpoint from master URL
        let components = apiService.baseURL.replacingOccurrences(
            of: ":8000", with: ":\(workerPort)")

        services = [
            ServiceStatus(
                service: "Master",
                status: isConnected ? "RUNNING" : "UNKNOWN",
                port: "8000",
                endpoint: masterEndpoint
            ),
            ServiceStatus(
                service: "Worker",
                status: nodes.contains(where: { $0.isOnline }) ? "RUNNING" : "STOPPED",
                port: workerPort,
                endpoint: components
            ),
        ]
    }

    // MARK: - Offline Cache (UserDefaults)

    private func saveCachedData() {
        if let status = cachedStatus, let data = try? JSONEncoder().encode(status) {
            UserDefaults.standard.set(data, forKey: "cachedClusterStatus")
        }
        if let data = try? JSONEncoder().encode(cachedNodes) {
            UserDefaults.standard.set(data, forKey: "cachedNodes")
        }
    }

    private func loadCachedData() {
        if let data = UserDefaults.standard.data(forKey: "cachedClusterStatus"),
            let status = try? JSONDecoder().decode(ClusterStatus.self, from: data)
        {
            cachedStatus = status
        }
        if let data = UserDefaults.standard.data(forKey: "cachedNodes"),
            let nodes = try? JSONDecoder().decode([ClusterNode].self, from: data)
        {
            cachedNodes = nodes
        }
    }
}
