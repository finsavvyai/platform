/// Cache — in-process SHA-256-keyed prompt cache with TTL expiry.
///
/// Uses Swift `actor` for safe concurrent access.

import CryptoKit
import Foundation

public actor Cache {

    private struct Entry {
        let value: String
        let expiry: Date
    }

    private var store: [String: Entry] = [:]

    public init() {}

    // MARK: - Public API

    /// Return the cached response for `prompt`, or `nil` if missing / expired.
    public func get(_ prompt: String) -> String? {
        let key = sha256Key(prompt)
        guard let entry = store[key] else { return nil }
        if Date() > entry.expiry {
            store.removeValue(forKey: key)
            return nil
        }
        return entry.value
    }

    /// Store `response` for `prompt` with a time-to-live of `ttl` seconds (default 300 s).
    public func set(_ prompt: String, _ response: String, ttl: TimeInterval = 300) {
        let key = sha256Key(prompt)
        store[key] = Entry(value: response, expiry: Date().addingTimeInterval(ttl))
    }

    /// Remove all entries from the cache.
    public func clear() {
        store.removeAll()
    }

    /// Remove expired entries and return the count pruned.
    @discardableResult
    public func prune() -> Int {
        let now = Date()
        let expired = store.filter { $0.value.expiry <= now }.map(\.key)
        expired.forEach { store.removeValue(forKey: $0) }
        return expired.count
    }

    /// Number of live (non-expired) entries currently in the cache.
    public var count: Int {
        let now = Date()
        return store.values.filter { $0.expiry > now }.count
    }

    // MARK: - Private helpers

    private func sha256Key(_ text: String) -> String {
        let data = Data(text.utf8)
        let digest = SHA256.hash(data: data)
        return digest.compactMap { String(format: "%02x", $0) }.joined()
    }
}
