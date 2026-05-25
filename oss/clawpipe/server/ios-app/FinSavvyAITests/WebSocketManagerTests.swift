//
//  WebSocketManagerTests.swift
//  Tests for WebSocketManager and event handling
//

import XCTest

@testable import FinSavvyAI

// MARK: - WebSocketManager Initialization Tests

final class WebSocketManagerInitTests: XCTestCase {

    func testInitialStateDisconnected() {
        let manager = WebSocketManager()
        XCTAssertFalse(manager.isConnected)
        XCTAssertNil(manager.lastMessage)
    }

    func testOnEventCallbackIsNilByDefault() {
        let manager = WebSocketManager()
        XCTAssertNil(manager.onEvent)
    }

    func testOnEventCallbackCanBeSet() {
        let manager = WebSocketManager()
        var receivedEvent: WebSocketEvent?

        manager.onEvent = { event in
            receivedEvent = event
        }

        XCTAssertNotNil(manager.onEvent)
        // Invoke to verify it compiles and works
        let testEvent = WebSocketEvent(type: "test", payload: nil)
        manager.onEvent?(testEvent)
        XCTAssertEqual(receivedEvent?.type, "test")
    }
}

// MARK: - WebSocket URL Construction Tests

final class WebSocketURLTests: XCTestCase {

    func testHTTPToWSConversion() {
        let httpURL = "http://192.168.1.50:8000"
        let wsURL = httpURL
            .replacingOccurrences(of: "http://", with: "ws://")
            .replacingOccurrences(of: "https://", with: "wss://")
        XCTAssertEqual(wsURL, "ws://192.168.1.50:8000")
    }

    func testHTTPSToWSSConversion() {
        let httpsURL = "https://cluster.example.com:8000"
        let wsURL = httpsURL
            .replacingOccurrences(of: "http://", with: "ws://")
            .replacingOccurrences(of: "https://", with: "wss://")
        XCTAssertEqual(wsURL, "wss://cluster.example.com:8000")
    }

    func testWSURLWithPath() {
        let baseURL = "http://10.0.0.10:8000"
        let wsURL = baseURL
            .replacingOccurrences(of: "http://", with: "ws://")
        let fullURL = "\(wsURL)/ws"
        XCTAssertEqual(fullURL, "ws://10.0.0.10:8000/ws")
    }

    func testInvalidURLDoesNotCrashConnect() {
        let manager = WebSocketManager()
        // Connecting to an invalid URL should not crash
        manager.connect(to: "not a valid url %%%")
        // Should remain disconnected
        XCTAssertFalse(manager.isConnected)
        manager.disconnect()
    }
}

// MARK: - WebSocket Event Type Classification Tests

final class WebSocketEventClassificationTests: XCTestCase {

    func testNodeAddedEvent() {
        let event = WebSocketEvent(type: "node_added", payload: "worker-1")
        XCTAssertTrue(event.isNodeEvent)
        XCTAssertFalse(event.isClusterEvent)
        XCTAssertFalse(event.isConfigEvent)
    }

    func testNodeRemovedEvent() {
        let event = WebSocketEvent(type: "node_removed", payload: "worker-2")
        XCTAssertTrue(event.isNodeEvent)
        XCTAssertFalse(event.isClusterEvent)
    }

    func testNodeStatusChangedEvent() {
        let event = WebSocketEvent(type: "node_status_changed", payload: nil)
        XCTAssertTrue(event.isNodeEvent)
    }

    func testClusterStartedEvent() {
        let event = WebSocketEvent(type: "cluster_started", payload: nil)
        XCTAssertTrue(event.isClusterEvent)
        XCTAssertFalse(event.isNodeEvent)
    }

    func testClusterStoppedEvent() {
        let event = WebSocketEvent(type: "cluster_stopped", payload: nil)
        XCTAssertTrue(event.isClusterEvent)
    }

    func testConfigUpdatedEvent() {
        let event = WebSocketEvent(type: "config_updated", payload: ["key": "val"])
        XCTAssertTrue(event.isConfigEvent)
        XCTAssertFalse(event.isNodeEvent)
        XCTAssertFalse(event.isClusterEvent)
    }

    func testUnknownEventType() {
        let event = WebSocketEvent(type: "custom_event", payload: nil)
        XCTAssertFalse(event.isNodeEvent)
        XCTAssertFalse(event.isClusterEvent)
        XCTAssertFalse(event.isConfigEvent)
    }

    func testEventHasUniqueID() {
        let event1 = WebSocketEvent(type: "test", payload: nil)
        let event2 = WebSocketEvent(type: "test", payload: nil)
        XCTAssertNotEqual(event1.id, event2.id)
    }

    func testEventTimestampIsRecent() {
        let event = WebSocketEvent(type: "test", payload: nil)
        let elapsed = Date().timeIntervalSince(event.timestamp)
        XCTAssertLessThan(elapsed, 1.0, "Timestamp should be within 1s of now")
    }
}

// MARK: - Disconnect Tests

final class WebSocketDisconnectTests: XCTestCase {

    func testDisconnectSetsIsConnectedFalse() {
        let manager = WebSocketManager()
        manager.disconnect()
        XCTAssertFalse(manager.isConnected)
    }

    func testMultipleDisconnectsDoNotCrash() {
        let manager = WebSocketManager()
        manager.disconnect()
        manager.disconnect()
        manager.disconnect()
        XCTAssertFalse(manager.isConnected)
    }
}
