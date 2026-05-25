/// Booster — deterministic transforms that skip LLM calls.
///
/// Six built-in rules resolve common prompts locally:
/// math, date, UUID, uppercase, lowercase, reverse.

import Foundation

public struct Booster: Sendable {

    public init() {}

    /// Attempt to resolve `prompt` locally.
    /// Returns the resolved string, or `nil` if no rule matched.
    public func boost(_ prompt: String) -> String? {
        let trimmed = prompt.trimmingCharacters(in: .whitespacesAndNewlines)
        for rule in rules {
            if let result = rule(trimmed) {
                return result
            }
        }
        return nil
    }

    // MARK: - Rule table

    private var rules: [(String) -> String?] {
        [mathRule, dateRule, uuidRule, uppercaseRule, lowercaseRule, reverseRule]
    }

    // MARK: Rule 1 — simple integer arithmetic

    private func mathRule(_ input: String) -> String? {
        let pattern = #"^(?:calculate|compute|what is|evaluate|solve)\s+([\d\s\+\-\*\/\(\)\.]+)$"#
        guard
            let regex = try? NSRegularExpression(pattern: pattern, options: .caseInsensitive),
            let match = regex.firstMatch(
                in: input,
                range: NSRange(input.startIndex..., in: input)
            ),
            let exprRange = Range(match.range(at: 1), in: input)
        else { return nil }

        let expr = String(input[exprRange]).trimmingCharacters(in: .whitespaces)
        // NSExpression supports basic arithmetic
        let nsExpr = NSExpression(format: expr)
        guard let value = nsExpr.expressionValue(with: nil, context: nil) as? NSNumber else {
            return nil
        }
        let d = value.doubleValue
        if d == d.rounded() && !d.isInfinite {
            return String(Int(d))
        }
        return String(d)
    }

    // MARK: Rule 2 — current date

    private func dateRule(_ input: String) -> String? {
        let patterns = [
            #"what(?:'s| is) (?:the )?(?:current )?(?:date|time|day)"#,
            #"(?:today|now|current date)"#,
        ]
        guard input.count < 60 else { return nil }
        for pattern in patterns {
            if input.range(
                of: pattern,
                options: [.regularExpression, .caseInsensitive]
            ) != nil {
                let formatter = ISO8601DateFormatter()
                formatter.formatOptions = [.withInternetDateTime]
                return formatter.string(from: Date())
            }
        }
        return nil
    }

    // MARK: Rule 3 — UUID generation

    private func uuidRule(_ input: String) -> String? {
        let pattern = #"generate\s+(?:a\s+)?uuid"#
        guard input.range(
            of: pattern,
            options: [.regularExpression, .caseInsensitive]
        ) != nil else { return nil }
        return UUID().uuidString.lowercased()
    }

    // MARK: Rule 4 — convert X to uppercase

    private func uppercaseRule(_ input: String) -> String? {
        let pattern = #"convert\s+"(.+)"\s+to\s+uppercase"#
        guard
            let regex = try? NSRegularExpression(pattern: pattern, options: .caseInsensitive),
            let match = regex.firstMatch(in: input, range: NSRange(input.startIndex..., in: input)),
            let wordRange = Range(match.range(at: 1), in: input)
        else { return nil }
        return String(input[wordRange]).uppercased()
    }

    // MARK: Rule 5 — convert X to lowercase

    private func lowercaseRule(_ input: String) -> String? {
        let pattern = #"convert\s+"(.+)"\s+to\s+lowercase"#
        guard
            let regex = try? NSRegularExpression(pattern: pattern, options: .caseInsensitive),
            let match = regex.firstMatch(in: input, range: NSRange(input.startIndex..., in: input)),
            let wordRange = Range(match.range(at: 1), in: input)
        else { return nil }
        return String(input[wordRange]).lowercased()
    }

    // MARK: Rule 6 — reverse X

    private func reverseRule(_ input: String) -> String? {
        let pattern = #"reverse\s+"(.+)""#
        guard
            let regex = try? NSRegularExpression(pattern: pattern, options: .caseInsensitive),
            let match = regex.firstMatch(in: input, range: NSRange(input.startIndex..., in: input)),
            let wordRange = Range(match.range(at: 1), in: input)
        else { return nil }
        return String(String(input[wordRange]).reversed())
    }
}
