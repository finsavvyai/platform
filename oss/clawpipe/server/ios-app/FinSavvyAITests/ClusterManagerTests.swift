//
//  ClusterManagerTests.swift
//  Unit tests for ClusterManager and API client
//

import XCTest

@testable import FinSavvyAI

// MARK: - JSON Decoding Tests

final class ClusterStatusDecodingTests: XCTestCase {

    func testDecodesClusterStatus() throws {
        let json = """
            {
                "cluster_id": "test-cluster",
                "status": "running",
                "master": "localhost:8000",
                "total_nodes": 3,
                "online_nodes": 2,
                "total_models": 5,
                "timestamp": "2026-02-14T10:00:00"
            }
            """.data(using: .utf8)!

        let status = try JSONDecoder().decode(ClusterStatus.self, from: json)

        XCTAssertEqual(status.clusterId, "test-cluster")
        XCTAssertEqual(status.status, "running")
        XCTAssertEqual(status.master, "localhost:8000")
        XCTAssertEqual(status.totalNodes, 3)
        XCTAssertEqual(status.onlineNodes, 2)
        XCTAssertEqual(status.totalModels, 5)
        XCTAssertEqual(status.timestamp, "2026-02-14T10:00:00")
    }

    func testDecodesMinimalClusterStatus() throws {
        let json = """
            {
                "cluster_id": "c1",
                "status": "idle",
                "master": "0.0.0.0:8000",
                "total_nodes": 0,
                "online_nodes": 0,
                "total_models": 0,
                "timestamp": ""
            }
            """.data(using: .utf8)!

        let status = try JSONDecoder().decode(ClusterStatus.self, from: json)
        XCTAssertEqual(status.totalNodes, 0)
        XCTAssertEqual(status.onlineNodes, 0)
    }
}

// MARK: - ClusterNode Decoding Tests

final class ClusterNodeDecodingTests: XCTestCase {

    func testDecodesFullNode() throws {
        let json = """
            {
                "id": "worker-mac-001",
                "name": "Mac Worker",
                "host": "192.168.1.50",
                "port": 8001,
                "status": "online",
                "models": ["phi-2", "mistral-7b-instruct"],
                "load": 3,
                "last_heartbeat": "2026-02-14T10:00:00",
                "registered_at": "2026-02-14T09:00:00",
                "request_count": 42,
                "uptime": 3600.5
            }
            """.data(using: .utf8)!

        let node = try JSONDecoder().decode(ClusterNode.self, from: json)

        XCTAssertEqual(node.id, "worker-mac-001")
        XCTAssertEqual(node.displayName, "Mac Worker")
        XCTAssertEqual(node.host, "192.168.1.50")
        XCTAssertEqual(node.port, 8001)
        XCTAssertTrue(node.isOnline)
        XCTAssertEqual(node.models.count, 2)
        XCTAssertEqual(node.models.first, "phi-2")
        XCTAssertEqual(node.load, 3)
        XCTAssertEqual(node.loadPercent, 30.0)
        XCTAssertEqual(node.requestCount, 42)
        XCTAssertEqual(node.uptime, 3600.5)
    }

    func testDecodesMinimalNode() throws {
        let json = """
            {
                "id": "w1",
                "host": "localhost",
                "port": 8001,
                "status": "offline",
                "models": []
            }
            """.data(using: .utf8)!

        let node = try JSONDecoder().decode(ClusterNode.self, from: json)

        XCTAssertEqual(node.id, "w1")
        XCTAssertNil(node.name)
        XCTAssertEqual(node.displayName, "w1")  // Falls back to id
        XCTAssertFalse(node.isOnline)
        XCTAssertNil(node.load)
        XCTAssertEqual(node.loadPercent, 0.0)  // nil load -> 0
        XCTAssertNil(node.lastHeartbeat)
        XCTAssertNil(node.requestCount)
    }

    func testDecodesNodesResponse() throws {
        let json = """
            {
                "nodes": [
                    {
                        "id": "w1",
                        "host": "10.0.0.1",
                        "port": 8001,
                        "status": "online",
                        "models": ["phi-2"]
                    },
                    {
                        "id": "w2",
                        "host": "10.0.0.2",
                        "port": 8002,
                        "status": "offline",
                        "models": []
                    }
                ]
            }
            """.data(using: .utf8)!

        let response = try JSONDecoder().decode(NodesResponse.self, from: json)
        XCTAssertEqual(response.nodes.count, 2)
        XCTAssertTrue(response.nodes[0].isOnline)
        XCTAssertFalse(response.nodes[1].isOnline)
    }

    func testDecodesEmptyNodesResponse() throws {
        let json = """
            {"nodes": []}
            """.data(using: .utf8)!

        let response = try JSONDecoder().decode(NodesResponse.self, from: json)
        XCTAssertTrue(response.nodes.isEmpty)
    }
}

// MARK: - ServiceStatus Tests

final class ServiceStatusTests: XCTestCase {

    func testServiceStatusInit() {
        let svc = ServiceStatus(
            service: "Master",
            status: "RUNNING",
            port: "8000",
            endpoint: "http://localhost:8000"
        )

        XCTAssertEqual(svc.id, "Master")
        XCTAssertEqual(svc.service, "Master")
        XCTAssertEqual(svc.status, "RUNNING")
        XCTAssertEqual(svc.port, "8000")
        XCTAssertEqual(svc.endpoint, "http://localhost:8000")
    }
}

// MARK: - ClusterError Tests

final class ClusterErrorTests: XCTestCase {

    func testErrorDescriptions() {
        XCTAssertNotNil(ClusterError.invalidURL.errorDescription)
        XCTAssertTrue(ClusterError.invalidURL.errorDescription!.contains("Invalid"))

        XCTAssertNotNil(ClusterError.timeout.errorDescription)
        XCTAssertTrue(ClusterError.timeout.errorDescription!.contains("timed out"))

        XCTAssertNotNil(ClusterError.noData.errorDescription)

        let httpErr = ClusterError.httpError(500, "Internal")
        XCTAssertTrue(httpErr.errorDescription!.contains("500"))
        XCTAssertTrue(httpErr.errorDescription!.contains("Internal"))

        let serverErr = ClusterError.serverUnreachable("refused")
        XCTAssertTrue(serverErr.errorDescription!.contains("refused"))

        let decodeErr = ClusterError.decodingError("bad json")
        XCTAssertTrue(decodeErr.errorDescription!.contains("bad json"))
    }
}

// MARK: - FinSavvyAIService Tests

final class FinSavvyAIServiceTests: XCTestCase {

    func testDefaultBaseURL() {
        // Clear any saved defaults
        UserDefaults.standard.removeObject(forKey: "serverIP")
        UserDefaults.standard.removeObject(forKey: "serverPort")

        let service = FinSavvyAIService()
        XCTAssertEqual(service.baseURL, "http://10.0.0.10:8000")
    }

    func testCustomBaseURL() {
        let service = FinSavvyAIService(baseURL: "http://192.168.1.1:9000")
        XCTAssertEqual(service.baseURL, "http://192.168.1.1:9000")
    }

    func testUpdateBaseURL() {
        let service = FinSavvyAIService(baseURL: "http://old:8000")
        service.updateBaseURL(ip: "192.168.1.100", port: "9090")
        XCTAssertEqual(service.baseURL, "http://192.168.1.100:9090")
    }

    func testSavedSettingsUsed() {
        UserDefaults.standard.set("172.16.0.5", forKey: "serverIP")
        UserDefaults.standard.set("7777", forKey: "serverPort")

        let service = FinSavvyAIService()
        XCTAssertEqual(service.baseURL, "http://172.16.0.5:7777")

        // Cleanup
        UserDefaults.standard.removeObject(forKey: "serverIP")
        UserDefaults.standard.removeObject(forKey: "serverPort")
    }

    func testGetClusterStatusInvalidURL() async {
        let service = FinSavvyAIService(baseURL: "not a url %%%")
        // Should throw because URL is invalid
        do {
            _ = try await service.getClusterStatus()
            XCTFail("Expected error")
        } catch {
            // Expected
        }
    }

    func testGetNodesUnreachableServer() async {
        let service = FinSavvyAIService(baseURL: "http://127.0.0.1:19999")
        do {
            _ = try await service.getNodes()
            XCTFail("Expected error for unreachable server")
        } catch let error as ClusterError {
            // Should be serverUnreachable or timeout
            switch error {
            case .serverUnreachable, .timeout:
                break  // Expected
            default:
                XCTFail("Unexpected error type: \(error)")
            }
        } catch {
            // Other URLSession errors are also acceptable
        }
    }
}

// MARK: - WebSocketEvent Tests

final class WebSocketEventTests: XCTestCase {

    func testNodeEvent() {
        let event = WebSocketEvent(type: "node_added", payload: "worker-1")
        XCTAssertTrue(event.isNodeEvent)
        XCTAssertFalse(event.isClusterEvent)
        XCTAssertFalse(event.isConfigEvent)
    }

    func testClusterEvent() {
        let event = WebSocketEvent(type: "cluster_started", payload: nil)
        XCTAssertFalse(event.isNodeEvent)
        XCTAssertTrue(event.isClusterEvent)
        XCTAssertFalse(event.isConfigEvent)
    }

    func testConfigEvent() {
        let event = WebSocketEvent(type: "config_updated", payload: ["key": "value"])
        XCTAssertFalse(event.isNodeEvent)
        XCTAssertFalse(event.isClusterEvent)
        XCTAssertTrue(event.isConfigEvent)
    }

    func testEventHasTimestamp() {
        let event = WebSocketEvent(type: "test", payload: nil)
        XCTAssertNotNil(event.timestamp)
        XCTAssertNotNil(event.id)
    }
}

// MARK: - KeychainManager Tests

final class KeychainManagerTests: XCTestCase {

    override func tearDown() {
        // Clean up after each test
        KeychainManager.removeAPIKey()
        super.tearDown()
    }

    func testSaveAndReadAPIKey() {
        let key = "finsavvy-test1234567890ab"
        XCTAssertTrue(KeychainManager.storeAPIKey(key))
        XCTAssertEqual(KeychainManager.getAPIKey(), key)
    }

    func testRemoveAPIKey() {
        KeychainManager.storeAPIKey("finsavvy-toremove")
        XCTAssertNotNil(KeychainManager.getAPIKey())

        XCTAssertTrue(KeychainManager.removeAPIKey())
        XCTAssertNil(KeychainManager.getAPIKey())
    }

    func testReadNonExistentKey() {
        XCTAssertNil(KeychainManager.getAPIKey())
    }

    func testOverwriteExistingKey() {
        KeychainManager.storeAPIKey("finsavvy-old")
        KeychainManager.storeAPIKey("finsavvy-new")
        XCTAssertEqual(KeychainManager.getAPIKey(), "finsavvy-new")
    }

    func testSaveAndReadGenericKey() {
        XCTAssertTrue(KeychainManager.save(key: .serverIP, value: "192.168.1.1"))
        XCTAssertEqual(KeychainManager.read(key: .serverIP), "192.168.1.1")
        KeychainManager.delete(key: .serverIP)
    }
}
