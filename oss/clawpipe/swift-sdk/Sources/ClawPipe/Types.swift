/// Core types shared across the ClawPipe Swift SDK.

import Foundation

// MARK: - Public result types

/// The result of running a prompt through the full ClawPipe pipeline.
public struct PipelineResult: Sendable {
    /// The resolved or generated text.
    public let text: String
    /// Number of input tokens consumed (0 when boosted or cached).
    public let tokensIn: Int
    /// Number of output tokens generated (0 when boosted or cached).
    public let tokensOut: Int
    /// End-to-end wall-clock latency in milliseconds.
    public let latencyMs: Double
    /// Whether the answer was resolved locally without an LLM call.
    public let boosted: Bool
    /// Whether the response was served from the in-process cache.
    public let cached: Bool

    public init(
        text: String,
        tokensIn: Int,
        tokensOut: Int,
        latencyMs: Double,
        boosted: Bool,
        cached: Bool
    ) {
        self.text = text
        self.tokensIn = tokensIn
        self.tokensOut = tokensOut
        self.latencyMs = latencyMs
        self.boosted = boosted
        self.cached = cached
    }
}

/// The result of packing (compressing) a prompt.
public struct PackResult: Sendable {
    /// The packed / compressed text.
    public let text: String
    /// Percentage of tokens saved, e.g. 12.5 means 12.5 % reduction.
    public let savingsPct: Double

    public init(text: String, savingsPct: Double) {
        self.text = text
        self.savingsPct = savingsPct
    }
}

// MARK: - Internal Codable wire types

struct GatewayRequest: Encodable {
    let prompt: String
    let provider: String
    let model: String
    let projectId: String

    enum CodingKeys: String, CodingKey {
        case prompt
        case provider
        case model
        case projectId = "project_id"
    }
}

struct GatewayResponse: Decodable {
    let text: String
    let tokensIn: Int
    let tokensOut: Int
    let cached: Bool

    enum CodingKeys: String, CodingKey {
        case text
        case tokensIn  = "tokens_in"
        case tokensOut = "tokens_out"
        case cached
    }
}
