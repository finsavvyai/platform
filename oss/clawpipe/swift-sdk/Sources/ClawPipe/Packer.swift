/// Packer — context compression to reduce token count.
///
/// Collapses excess whitespace, trims lines, and deduplicates repeated blocks.

import Foundation

public struct Packer: Sendable {

    public init() {}

    /// Pack `text` and return the compressed result with savings percentage.
    public func pack(_ text: String) -> PackResult {
        let original = text
        let originalLen = original.utf16.count   // proxy for token estimation

        var packed = collapseWhitespace(original)
        packed = deduplicate(packed)

        let packedLen = packed.utf16.count
        let savings: Double
        if originalLen > 0 {
            savings = Double(originalLen - packedLen) / Double(originalLen) * 100.0
        } else {
            savings = 0
        }

        return PackResult(
            text: packed,
            savingsPct: max(0, savings)
        )
    }

    // MARK: - Private helpers

    /// Trim each line and collapse runs of 3+ newlines to a double newline.
    private func collapseWhitespace(_ text: String) -> String {
        let lines = text.components(separatedBy: "\n").map {
            $0.trimmingCharacters(in: .init(charactersIn: " \t"))
        }
        let joined = lines.joined(separator: "\n")
        // Collapse 3+ consecutive newlines → 2
        var result = joined
        while result.contains("\n\n\n") {
            result = result.replacingOccurrences(of: "\n\n\n", with: "\n\n")
        }
        return result.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    /// Remove duplicate paragraph-level blocks (>50 chars, case-insensitive).
    private func deduplicate(_ text: String) -> String {
        let blocks = text.components(separatedBy: "\n\n")
        var seen = Set<String>()
        var unique: [String] = []
        for block in blocks {
            let normalized = block.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
            if normalized.isEmpty { continue }
            if normalized.count > 50 && seen.contains(normalized) { continue }
            seen.insert(normalized)
            unique.append(block)
        }
        return unique.joined(separator: "\n\n")
    }
}
