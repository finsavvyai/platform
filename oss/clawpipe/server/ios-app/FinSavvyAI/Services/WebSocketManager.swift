//
//  WebSocketManager.swift
//  WebSocket client for real-time cluster updates
//

import Combine
import Foundation

/// Manages a WebSocket connection to the FinSavvyAI desktop backend
/// for real-time push notifications (node changes, config updates, etc.).
class WebSocketManager: NSObject, ObservableObject, URLSessionWebSocketDelegate {
    @Published var isConnected = false
    @Published var lastMessage: WebSocketEvent?

    private var webSocketTask: URLSessionWebSocketTask?
    private var session: URLSession?
    private var url: URL?
    private var reconnectAttempts = 0
    private let maxReconnectAttempts = 10
    private var reconnectTimer: Timer?

    /// Callback invoked on the main queue when a relevant event arrives.
    var onEvent: ((WebSocketEvent) -> Void)?

    override init() {
        super.init()
    }

    // MARK: - Connection

    func connect(to urlString: String) {
        disconnect()

        guard let url = URL(string: urlString) else { return }
        self.url = url

        let config = URLSessionConfiguration.default
        session = URLSession(configuration: config, delegate: self, delegateQueue: .main)
        webSocketTask = session?.webSocketTask(with: url)
        webSocketTask?.resume()

        receiveMessage()
        startPing()
    }

    func disconnect() {
        reconnectTimer?.invalidate()
        reconnectTimer = nil
        webSocketTask?.cancel(with: .goingAway, reason: nil)
        webSocketTask = nil
        session?.invalidateAndCancel()
        session = nil

        DispatchQueue.main.async {
            self.isConnected = false
        }
    }

    // MARK: - Messaging

    private func receiveMessage() {
        webSocketTask?.receive { [weak self] result in
            guard let self = self else { return }

            switch result {
            case .success(let message):
                self.handleMessage(message)
                self.receiveMessage()  // Continue listening
            case .failure(let error):
                print("WebSocket receive error: \(error.localizedDescription)")
                self.handleDisconnect()
            }
        }
    }

    private func handleMessage(_ message: URLSessionWebSocketTask.Message) {
        var text: String?
        switch message {
        case .string(let str):
            text = str
        case .data(let data):
            text = String(data: data, encoding: .utf8)
        @unknown default:
            break
        }

        guard let text = text,
            let data = text.data(using: .utf8),
            let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
            let eventType = json["type"] as? String
        else { return }

        let event = WebSocketEvent(
            type: eventType,
            payload: json["data"]
        )

        DispatchQueue.main.async {
            self.lastMessage = event
            self.onEvent?(event)
        }
    }

    // MARK: - Ping / Keep-alive

    private func startPing() {
        webSocketTask?.sendPing { [weak self] error in
            guard let self = self, error == nil else { return }
            DispatchQueue.main.asyncAfter(deadline: .now() + 30) {
                self.startPing()
            }
        }
    }

    // MARK: - Reconnection with Exponential Backoff

    private func handleDisconnect() {
        DispatchQueue.main.async {
            self.isConnected = false
        }

        guard reconnectAttempts < maxReconnectAttempts else {
            print("WebSocket: max reconnect attempts reached")
            return
        }

        let delay = min(pow(2.0, Double(reconnectAttempts)), 30.0)  // 1, 2, 4, 8, ... 30s max
        reconnectAttempts += 1

        print("WebSocket: reconnecting in \(delay)s (attempt \(reconnectAttempts))")

        DispatchQueue.main.asyncAfter(deadline: .now() + delay) { [weak self] in
            guard let self = self, let url = self.url else { return }
            self.connect(to: url.absoluteString)
        }
    }

    // MARK: - URLSessionWebSocketDelegate

    func urlSession(
        _ session: URLSession, webSocketTask: URLSessionWebSocketTask,
        didOpenWithProtocol protocol: String?
    ) {
        DispatchQueue.main.async {
            self.isConnected = true
            self.reconnectAttempts = 0
        }
    }

    func urlSession(
        _ session: URLSession, webSocketTask: URLSessionWebSocketTask,
        didCloseWith closeCode: URLSessionWebSocketTask.CloseCode, reason: Data?
    ) {
        handleDisconnect()
    }
}

// MARK: - Event Model

struct WebSocketEvent: Identifiable {
    let id = UUID()
    let type: String
    let payload: Any?
    let timestamp = Date()

    /// Common event types from the Go backend
    var isNodeEvent: Bool {
        type.hasPrefix("node_")
    }

    var isClusterEvent: Bool {
        type.hasPrefix("cluster_")
    }

    var isConfigEvent: Bool {
        type == "config_updated"
    }
}
