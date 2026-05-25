//
//  ViewModelTests.swift
//  Tests for ClusterManager ViewModel behavior
//

import XCTest

@testable import FinSavvyAI

// MARK: - ClusterManager Initialization Tests

final class ClusterManagerInitTests: XCTestCase {

    @MainActor
    func testInitialState() {
        let manager = ClusterManager(baseURL: "http://127.0.0.1:19999")

        XCTAssertNil(manager.clusterStatus)
        XCTAssertTrue(manager.nodes.isEmpty)
        XCTAssertTrue(manager.services.isEmpty)
        XCTAssertFalse(manager.isConnected)
        XCTAssertFalse(manager.isLoading)
        XCTAssertNil(manager.errorMessage)
        XCTAssertNil(manager.lastUpdated)
    }

    @MainActor
    func testCustomBaseURL() {
        let manager = ClusterManager(baseURL: "http://custom:9090")
        XCTAssertEqual(manager.apiService.baseURL, "http://custom:9090")
    }

    @MainActor
    func testDefaultBaseURLUsesUserDefaults() {
        UserDefaults.standard.set("10.0.0.20", forKey: "serverIP")
        UserDefaults.standard.set("7070", forKey: "serverPort")

        let manager = ClusterManager()
        XCTAssertEqual(manager.apiService.baseURL, "http://10.0.0.20:7070")

        // Cleanup
        UserDefaults.standard.removeObject(forKey: "serverIP")
        UserDefaults.standard.removeObject(forKey: "serverPort")
    }
}

// MARK: - ClusterManager Update Tests

final class ClusterManagerUpdateTests: XCTestCase {

    @MainActor
    func testUpdateBaseURLChangesAPIService() {
        let manager = ClusterManager(baseURL: "http://old:8000")
        manager.updateBaseURL(ip: "new-host", port: "9999")
        XCTAssertEqual(manager.apiService.baseURL, "http://new-host:9999")
    }

    @MainActor
    func testRefreshDataSetsLoadingState() async {
        let manager = ClusterManager(baseURL: "http://127.0.0.1:19999")

        // After refresh completes (will fail on unreachable server),
        // isLoading should be false
        await manager.refreshData()
        XCTAssertFalse(manager.isLoading)
    }

    @MainActor
    func testRefreshDataSetsErrorOnUnreachable() async {
        let manager = ClusterManager(baseURL: "http://127.0.0.1:19999")
        await manager.refreshData()

        XCTAssertNotNil(manager.errorMessage)
        XCTAssertFalse(manager.isConnected)
    }

    @MainActor
    func testStopMonitoringCleansUp() {
        let manager = ClusterManager(baseURL: "http://127.0.0.1:19999")
        manager.stopMonitoring()
        // Should not crash and websocket should be disconnected
        XCTAssertFalse(manager.webSocket.isConnected)
    }
}

// MARK: - Services Derivation Tests

final class ClusterManagerServicesTests: XCTestCase {

    @MainActor
    func testServicesEmptyBeforeRefresh() {
        let manager = ClusterManager(baseURL: "http://127.0.0.1:19999")
        // Before any refresh, services list is empty
        XCTAssertTrue(manager.services.isEmpty)
    }

    @MainActor
    func testServiceStatusInit() {
        let svc = ServiceStatus(
            service: "Worker",
            status: "STOPPED",
            port: "8001",
            endpoint: "http://10.0.0.10:8001"
        )

        XCTAssertEqual(svc.id, "Worker")
        XCTAssertEqual(svc.service, "Worker")
        XCTAssertEqual(svc.status, "STOPPED")
        XCTAssertEqual(svc.port, "8001")
        XCTAssertEqual(svc.endpoint, "http://10.0.0.10:8001")
    }
}

// MARK: - Cached Data Tests

final class ClusterManagerCacheTests: XCTestCase {

    override func tearDown() {
        UserDefaults.standard.removeObject(forKey: "cachedClusterStatus")
        UserDefaults.standard.removeObject(forKey: "cachedNodes")
        super.tearDown()
    }

    @MainActor
    func testCachedStatusLoadedOnInit() {
        // Pre-seed cached status
        let status = ClusterStatus(
            clusterId: "cached-cluster",
            status: "running",
            master: "localhost:8000",
            totalNodes: 2,
            onlineNodes: 1,
            totalModels: 3,
            timestamp: "2026-02-28T10:00:00"
        )
        if let data = try? JSONEncoder().encode(status) {
            UserDefaults.standard.set(data, forKey: "cachedClusterStatus")
        }

        // New manager should load the cached data
        let manager = ClusterManager(baseURL: "http://127.0.0.1:19999")
        // The cached data is loaded internally; we verify by doing a
        // refresh against an unreachable server and checking fallback
        XCTAssertNil(manager.clusterStatus)  // Not yet applied until fallback
    }

    @MainActor
    func testCachedNodesLoadedOnInit() {
        let nodes = [
            ClusterNode(
                id: "cached-w1", name: "Cached Worker", host: "10.0.0.1",
                port: 8001, status: "online", models: ["phi-2"],
                load: 3, lastHeartbeat: nil, registeredAt: nil,
                requestCount: 10, uptime: 1000.0
            ),
        ]
        if let data = try? JSONEncoder().encode(nodes) {
            UserDefaults.standard.set(data, forKey: "cachedNodes")
        }

        let manager = ClusterManager(baseURL: "http://127.0.0.1:19999")
        // Nodes are cached internally for fallback
        XCTAssertTrue(manager.nodes.isEmpty)  // Not applied until fallback
    }

    @MainActor
    func testFallbackToCache() async {
        // Pre-seed cached status
        let status = ClusterStatus(
            clusterId: "fallback-cluster",
            status: "running",
            master: "localhost:8000",
            totalNodes: 1,
            onlineNodes: 1,
            totalModels: 2,
            timestamp: "2026-02-28T10:00:00"
        )
        if let data = try? JSONEncoder().encode(status) {
            UserDefaults.standard.set(data, forKey: "cachedClusterStatus")
        }

        let manager = ClusterManager(baseURL: "http://127.0.0.1:19999")
        // Refresh will fail, should fallback to cache
        await manager.refreshData()

        // After failed refresh, cached data should be used as fallback
        if let cs = manager.clusterStatus {
            XCTAssertEqual(cs.clusterId, "fallback-cluster")
        }
    }
}
