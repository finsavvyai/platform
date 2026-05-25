/// ClawPipeClient — main entry point for the ClawPipe Swift SDK.
///
/// Runs the full pipeline: Booster → Packer → Cache → Gateway.

import Foundation

public final class ClawPipeClient: Sendable {

    private let apiKey: String
    private let projectId: String
    private let booster: Booster
    private let packer: Packer
    private let cache: Cache
    private let gateway: Gateway

    // MARK: - Init

    /// Create a client with your ClawPipe API key.
    /// - Parameters:
    ///   - apiKey:    Your project API key (starts with `cp_`).
    ///   - projectId: Project identifier (defaults to `"default"`).
    ///   - session:   URLSession used by the gateway (injectable for testing).
    public init(
        apiKey: String,
        projectId: String = "default",
        session: URLSession = .shared
    ) {
        self.apiKey = apiKey
        self.projectId = projectId
        self.booster = Booster()
        self.packer = Packer()
        self.cache = Cache()
        self.gateway = Gateway(
            apiKey: apiKey,
            projectId: projectId,
            session: session
        )
    }

    // MARK: - Public API

    /// Run `text` through the full pipeline and return the result.
    /// - Parameters:
    ///   - text:     The user prompt.
    ///   - provider: LLM provider name (default: `"openai"`).
    ///   - model:    Model identifier (default: `"auto"` for router selection).
    public func prompt(
        _ text: String,
        provider: String = "openai",
        model: String = "auto"
    ) async throws -> PipelineResult {
        let start = Date()

        // Stage 1: Booster — resolve locally without LLM
        if let boostedText = booster.boost(text) {
            let latency = Date().timeIntervalSince(start) * 1_000
            return PipelineResult(
                text: boostedText,
                tokensIn: 0,
                tokensOut: 0,
                latencyMs: latency,
                boosted: true,
                cached: false
            )
        }

        // Stage 2: Packer — compress context
        let packed = packer.pack(text)

        // Stage 3: Cache — check for prior response
        if let cached = await cache.get(packed.text) {
            let latency = Date().timeIntervalSince(start) * 1_000
            return PipelineResult(
                text: cached,
                tokensIn: 0,
                tokensOut: 0,
                latencyMs: latency,
                boosted: false,
                cached: true
            )
        }

        // Stage 4: Gateway — remote call
        let result = try await gateway.call(
            prompt: packed.text,
            provider: provider,
            model: model
        )

        // Populate cache for subsequent identical calls
        await cache.set(packed.text, result.text)

        // Re-measure end-to-end latency
        let totalLatency = Date().timeIntervalSince(start) * 1_000
        return PipelineResult(
            text: result.text,
            tokensIn: result.tokensIn,
            tokensOut: result.tokensOut,
            latencyMs: totalLatency,
            boosted: false,
            cached: false
        )
    }
}
