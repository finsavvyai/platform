/// Gateway — URLSession HTTP client for the ClawPipe gateway API.
///
/// POSTs to https://api.clawpipe.ai/v1/prompt and decodes the JSON response.

import Foundation

// MARK: - Error type

public struct GatewayError: Error, LocalizedError {
    public let statusCode: Int
    public let body: String

    public var errorDescription: String? {
        "ClawPipe gateway error \(statusCode)\(body.isEmpty ? "" : ": \(body.prefix(200))")"
    }
}

// MARK: - Gateway

public struct Gateway: Sendable {

    private let baseURL: URL
    private let apiKey: String
    private let projectId: String
    private let session: URLSession

    /// - Parameters:
    ///   - baseURL: Root URL of the gateway (defaults to `https://api.clawpipe.ai/v1`).
    ///   - apiKey:  ClawPipe project API key.
    ///   - projectId: ClawPipe project identifier.
    ///   - session: URLSession to use (injectable for testing).
    public init(
        baseURL: URL = URL(string: "https://api.clawpipe.ai/v1")!,
        apiKey: String,
        projectId: String,
        session: URLSession = .shared
    ) {
        self.baseURL = baseURL
        self.apiKey = apiKey
        self.projectId = projectId
        self.session = session
    }

    /// Dispatch a prompt to the gateway and return a `PipelineResult`.
    public func call(
        prompt: String,
        provider: String,
        model: String
    ) async throws -> PipelineResult {
        let requestBody = GatewayRequest(
            prompt: prompt,
            provider: provider,
            model: model,
            projectId: projectId
        )
        let url = baseURL.appendingPathComponent("prompt")
        var urlRequest = URLRequest(url: url)
        urlRequest.httpMethod = "POST"
        urlRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
        urlRequest.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")
        urlRequest.setValue(projectId, forHTTPHeaderField: "X-Project-Id")
        urlRequest.httpBody = try JSONEncoder().encode(requestBody)

        let start = Date()
        let (data, response) = try await session.data(for: urlRequest)
        let latency = Date().timeIntervalSince(start) * 1_000

        guard let http = response as? HTTPURLResponse else {
            throw GatewayError(statusCode: -1, body: "Non-HTTP response")
        }
        guard http.statusCode < 400 else {
            let body = String(data: data, encoding: .utf8) ?? ""
            throw GatewayError(statusCode: http.statusCode, body: body)
        }

        let decoded = try JSONDecoder().decode(GatewayResponse.self, from: data)
        return PipelineResult(
            text: decoded.text,
            tokensIn: decoded.tokensIn,
            tokensOut: decoded.tokensOut,
            latencyMs: latency,
            boosted: false,
            cached: decoded.cached
        )
    }
}
