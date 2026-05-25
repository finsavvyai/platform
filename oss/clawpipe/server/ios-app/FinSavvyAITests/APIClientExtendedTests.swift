//
//  APIClientExtendedTests.swift
//  Extended tests for FinSavvyAIService API client
//

import XCTest

@testable import FinSavvyAI

// MARK: - Request URL Construction Tests

final class APIClientURLTests: XCTestCase {

    func testClusterStatusURL() {
        let service = FinSavvyAIService(baseURL: "http://10.0.0.10:8000")
        let expected = "http://10.0.0.10:8000/cluster/status"
        let url = URL(string: "\(service.baseURL)/cluster/status")
        XCTAssertNotNil(url)
        XCTAssertEqual(url?.absoluteString, expected)
    }

    func testClusterNodesURL() {
        let service = FinSavvyAIService(baseURL: "http://10.0.0.10:8000")
        let expected = "http://10.0.0.10:8000/cluster/nodes"
        let url = URL(string: "\(service.baseURL)/cluster/nodes")
        XCTAssertNotNil(url)
        XCTAssertEqual(url?.absoluteString, expected)
    }

    func testHealthURL() {
        let service = FinSavvyAIService(baseURL: "http://10.0.0.10:8000")
        let url = URL(string: "\(service.baseURL)/health")
        XCTAssertNotNil(url)
        XCTAssertEqual(url?.absoluteString, "http://10.0.0.10:8000/health")
    }

    func testServiceStartURL() {
        let service = FinSavvyAIService(baseURL: "http://10.0.0.10:8000")
        let url = URL(string: "\(service.baseURL)/api/services/start")
        XCTAssertNotNil(url)
        XCTAssertEqual(url?.absoluteString, "http://10.0.0.10:8000/api/services/start")
    }

    func testServiceStopURL() {
        let service = FinSavvyAIService(baseURL: "http://10.0.0.10:8000")
        let url = URL(string: "\(service.baseURL)/api/services/stop")
        XCTAssertNotNil(url)
        XCTAssertEqual(url?.absoluteString, "http://10.0.0.10:8000/api/services/stop")
    }

    func testCustomPortURL() {
        let service = FinSavvyAIService(baseURL: "http://192.168.1.1:9090")
        XCTAssertEqual(service.baseURL, "http://192.168.1.1:9090")
    }
}

// MARK: - Base URL Update Tests

final class APIClientBaseURLTests: XCTestCase {

    func testUpdateBaseURLChangesURL() {
        let service = FinSavvyAIService(baseURL: "http://old:8000")
        service.updateBaseURL(ip: "new-host", port: "9999")
        XCTAssertEqual(service.baseURL, "http://new-host:9999")
    }

    func testUpdateBaseURLWithIPv4() {
        let service = FinSavvyAIService(baseURL: "http://localhost:8000")
        service.updateBaseURL(ip: "192.168.1.50", port: "8001")
        XCTAssertEqual(service.baseURL, "http://192.168.1.50:8001")
    }

    func testUpdateBaseURLWithHostname() {
        let service = FinSavvyAIService(baseURL: "http://localhost:8000")
        service.updateBaseURL(ip: "cluster.local", port: "8000")
        XCTAssertEqual(service.baseURL, "http://cluster.local:8000")
    }
}

// MARK: - Error Response Handling Tests

final class APIClientErrorTests: XCTestCase {

    func testInvalidURLThrowsError() async {
        let service = FinSavvyAIService(baseURL: "not a url %%%")
        do {
            _ = try await service.getClusterStatus()
            XCTFail("Expected ClusterError.invalidURL")
        } catch let error as ClusterError {
            switch error {
            case .invalidURL:
                break  // Expected
            default:
                XCTFail("Expected invalidURL, got \(error)")
            }
        } catch {
            XCTFail("Unexpected error type: \(error)")
        }
    }

    func testUnreachableServerThrowsError() async {
        let service = FinSavvyAIService(baseURL: "http://127.0.0.1:19999")
        do {
            _ = try await service.getClusterStatus()
            XCTFail("Expected error for unreachable server")
        } catch let error as ClusterError {
            switch error {
            case .serverUnreachable, .timeout:
                break  // Expected
            default:
                XCTFail("Unexpected ClusterError: \(error)")
            }
        } catch {
            // URLSession errors are also acceptable
        }
    }

    func testHealthCheckOnUnreachableServer() async {
        let service = FinSavvyAIService(baseURL: "http://127.0.0.1:19999")
        do {
            let result = try await service.checkHealth()
            XCTAssertFalse(result)
        } catch {
            // Connection errors are expected
        }
    }
}

// MARK: - Response Decoding Tests

final class APIClientDecodingTests: XCTestCase {

    func testDecodeClusterStatusResponse() throws {
        let json = """
            {
                "cluster_id": "prod-1",
                "status": "healthy",
                "master": "10.0.0.10:8000",
                "total_nodes": 5,
                "online_nodes": 4,
                "total_models": 10,
                "timestamp": "2026-02-28T12:00:00"
            }
            """.data(using: .utf8)!

        let status = try JSONDecoder().decode(ClusterStatus.self, from: json)
        XCTAssertEqual(status.clusterId, "prod-1")
        XCTAssertEqual(status.status, "healthy")
        XCTAssertEqual(status.totalNodes, 5)
        XCTAssertEqual(status.onlineNodes, 4)
        XCTAssertEqual(status.totalModels, 10)
    }

    func testDecodeNodesResponseWithModels() throws {
        let json = """
            {
                "nodes": [
                    {
                        "id": "gpu-worker-1",
                        "name": "GPU Node",
                        "host": "10.0.0.20",
                        "port": 8001,
                        "status": "online",
                        "models": ["phi-2", "mistral-7b-instruct", "codellama-7b-instruct"],
                        "load": 7,
                        "request_count": 150
                    }
                ]
            }
            """.data(using: .utf8)!

        let response = try JSONDecoder().decode(NodesResponse.self, from: json)
        XCTAssertEqual(response.nodes.count, 1)
        XCTAssertEqual(response.nodes[0].models.count, 3)
        XCTAssertEqual(response.nodes[0].loadPercent, 70.0)
        XCTAssertEqual(response.nodes[0].requestCount, 150)
    }

    func testDecodeInvalidJSONThrows() {
        let badJSON = "not json at all".data(using: .utf8)!
        XCTAssertThrowsError(
            try JSONDecoder().decode(ClusterStatus.self, from: badJSON)
        )
    }
}
