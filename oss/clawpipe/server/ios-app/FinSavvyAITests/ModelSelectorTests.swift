//
//  ModelSelectorTests.swift
//  Tests for AIModel data structure and model list operations
//

import XCTest

@testable import FinSavvyAI

// MARK: - AIModel Data Tests

final class AIModelTests: XCTestCase {

    func testActiveModelProperties() {
        let model = AIModel(
            name: "phi-2",
            description: "Microsoft's small but capable model",
            size: "2.8GB",
            layer: 1,
            isDownloaded: true,
            status: .active
        )

        XCTAssertEqual(model.name, "phi-2")
        XCTAssertEqual(model.description, "Microsoft's small but capable model")
        XCTAssertEqual(model.size, "2.8GB")
        XCTAssertEqual(model.layer, 1)
        XCTAssertTrue(model.isDownloaded)
    }

    func testAvailableModelProperties() {
        let model = AIModel(
            name: "deepseek-coder-6.7b",
            description: "Advanced code assistant",
            size: "6.5GB",
            layer: 2,
            isDownloaded: false,
            status: .available
        )

        XCTAssertEqual(model.name, "deepseek-coder-6.7b")
        XCTAssertFalse(model.isDownloaded)
    }

    func testModelHasUniqueID() {
        let model1 = AIModel(
            name: "phi-2", description: "", size: "1GB",
            layer: 1, isDownloaded: true, status: .active
        )
        let model2 = AIModel(
            name: "phi-2", description: "", size: "1GB",
            layer: 1, isDownloaded: true, status: .active
        )
        XCTAssertNotEqual(model1.id, model2.id)
    }
}

// MARK: - Model List from Node Tests

final class ModelListFromNodeTests: XCTestCase {

    func testExtractModelsFromNodes() throws {
        let json = """
            {
                "nodes": [
                    {
                        "id": "w1",
                        "host": "10.0.0.1",
                        "port": 8001,
                        "status": "online",
                        "models": ["phi-2", "mistral-7b-instruct"]
                    },
                    {
                        "id": "w2",
                        "host": "10.0.0.2",
                        "port": 8002,
                        "status": "online",
                        "models": ["codellama-7b-instruct", "phi-2"]
                    }
                ]
            }
            """.data(using: .utf8)!

        let response = try JSONDecoder().decode(NodesResponse.self, from: json)
        let allModels = response.nodes.flatMap { $0.models }
        XCTAssertEqual(allModels.count, 4)

        // Deduplicate
        let unique = Array(Set(allModels)).sorted()
        XCTAssertEqual(unique.count, 3)
        XCTAssertTrue(unique.contains("phi-2"))
        XCTAssertTrue(unique.contains("mistral-7b-instruct"))
        XCTAssertTrue(unique.contains("codellama-7b-instruct"))
    }

    func testEmptyNodeListYieldsNoModels() throws {
        let json = """
            {"nodes": []}
            """.data(using: .utf8)!

        let response = try JSONDecoder().decode(NodesResponse.self, from: json)
        let allModels = response.nodes.flatMap { $0.models }
        XCTAssertTrue(allModels.isEmpty)
    }

    func testNodeWithNoModels() throws {
        let json = """
            {
                "nodes": [
                    {
                        "id": "w1",
                        "host": "10.0.0.1",
                        "port": 8001,
                        "status": "online",
                        "models": []
                    }
                ]
            }
            """.data(using: .utf8)!

        let response = try JSONDecoder().decode(NodesResponse.self, from: json)
        XCTAssertEqual(response.nodes.count, 1)
        XCTAssertTrue(response.nodes[0].models.isEmpty)
    }
}

// MARK: - Model Display Status Tests

final class ModelDisplayStatusTests: XCTestCase {

    func testAllStatusValues() {
        let active = AIModel(
            name: "m1", description: "", size: "1GB",
            layer: 1, isDownloaded: true, status: .active
        )
        let available = AIModel(
            name: "m2", description: "", size: "1GB",
            layer: 1, isDownloaded: false, status: .available
        )
        let downloading = AIModel(
            name: "m3", description: "", size: "1GB",
            layer: 1, isDownloaded: false, status: .downloading
        )
        let error = AIModel(
            name: "m4", description: "", size: "1GB",
            layer: 1, isDownloaded: false, status: .error
        )

        // Verify they are distinguishable
        XCTAssertTrue(active.isDownloaded)
        XCTAssertFalse(available.isDownloaded)
        XCTAssertFalse(downloading.isDownloaded)
        XCTAssertFalse(error.isDownloaded)
    }
}

// MARK: - Model Name Sorting Tests

final class ModelSortingTests: XCTestCase {

    func testModelsSortAlphabetically() {
        let names = ["mistral-7b-instruct", "phi-2", "codellama-7b-instruct"]
        let sorted = names.sorted()
        XCTAssertEqual(sorted, ["codellama-7b-instruct", "mistral-7b-instruct", "phi-2"])
    }

    func testDeduplicationByName() {
        let names = ["phi-2", "mistral-7b-instruct", "phi-2", "phi-2"]
        var seen = Set<String>()
        let unique = names.filter { seen.insert($0).inserted }
        XCTAssertEqual(unique.count, 2)
    }
}
