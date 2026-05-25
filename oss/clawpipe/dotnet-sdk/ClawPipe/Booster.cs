using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;

namespace ClawPipe;

/// <summary>
/// Deterministic transforms that resolve prompts locally without calling an LLM.
/// Rules: Math, Date, UUID, Uppercase, Lowercase, Reverse.
/// </summary>
public sealed partial class Booster
{
    private readonly List<BoosterRule> _rules = new();

    public Booster() => RegisterDefaults();

    /// <summary>Try to resolve a prompt locally. Returns null if no rule matches.</summary>
    public string? Boost(string prompt)
    {
        var trimmed = prompt.Trim();
        foreach (var rule in _rules)
        {
            if (!rule.Test(trimmed)) continue;
            try { return rule.Resolve(trimmed); }
            catch { /* try next rule */ }
        }
        return null;
    }

    /// <summary>Register a custom booster rule.</summary>
    public void AddRule(BoosterRule rule) => _rules.Add(rule);

    public int RuleCount => _rules.Count;

    // ── private rule registration ─────────────────────────────────────────

    private void RegisterDefaults()
    {
        _rules.Add(MathRule());
        _rules.Add(DateRule());
        _rules.Add(UuidRule());
        _rules.Add(UppercaseRule());
        _rules.Add(LowercaseRule());
        _rules.Add(ReverseRule());
    }

    [GeneratedRegex(@"^(?:calculate|compute|what is|evaluate|solve)\s+(.+)", RegexOptions.IgnoreCase)]
    private static partial Regex MathPrefix();

    [GeneratedRegex(@"^[\d\s+\-*/().,%^]+$")]
    private static partial Regex SafeExpr();

    private static BoosterRule MathRule() => new(
        "math",
        inp =>
        {
            var m = MathPrefix().Match(inp);
            return m.Success && SafeExpr().IsMatch(m.Groups[1].Value.Trim());
        },
        inp =>
        {
            var expr = MathPrefix().Match(inp).Groups[1].Value.Trim();
            var result = MathEval.Evaluate(expr);
            return result == Math.Floor(result) ? ((long)result).ToString() : result.ToString("G");
        }
    );

    [GeneratedRegex(@"what(?:'s| is) (?:the )?(?:current )?(?:date|time|day)", RegexOptions.IgnoreCase)]
    private static partial Regex DatePattern1();

    [GeneratedRegex(@"(?:today|now|current date)", RegexOptions.IgnoreCase)]
    private static partial Regex DatePattern2();

    private static BoosterRule DateRule() => new(
        "date",
        inp => (DatePattern1().IsMatch(inp) || DatePattern2().IsMatch(inp)) && inp.Length < 60,
        _ => DateTime.UtcNow.ToString("yyyy-MM-dd")
    );

    [GeneratedRegex(@"generate\s+(?:a\s+)?uuid", RegexOptions.IgnoreCase)]
    private static partial Regex UuidPattern();

    private static BoosterRule UuidRule() => new(
        "uuid",
        inp => UuidPattern().IsMatch(inp),
        _ => Guid.NewGuid().ToString()
    );

    // Rule 4: convert "hello" to uppercase
    [GeneratedRegex(@"convert\s+""([^""]+)""\s+to\s+uppercase", RegexOptions.IgnoreCase)]
    private static partial Regex UppercasePattern();

    private static BoosterRule UppercaseRule() => new(
        "uppercase",
        inp => UppercasePattern().IsMatch(inp),
        inp => UppercasePattern().Match(inp).Groups[1].Value.ToUpperInvariant()
    );

    // Rule 5: convert "HELLO" to lowercase
    [GeneratedRegex(@"convert\s+""([^""]+)""\s+to\s+lowercase", RegexOptions.IgnoreCase)]
    private static partial Regex LowercasePattern();

    private static BoosterRule LowercaseRule() => new(
        "lowercase",
        inp => LowercasePattern().IsMatch(inp),
        inp => LowercasePattern().Match(inp).Groups[1].Value.ToLowerInvariant()
    );

    // Rule 6: reverse "hello"
    [GeneratedRegex(@"reverse\s+""([^""]+)""", RegexOptions.IgnoreCase)]
    private static partial Regex ReversePattern();

    private static BoosterRule ReverseRule() => new(
        "reverse",
        inp => ReversePattern().IsMatch(inp),
        inp =>
        {
            var s = ReversePattern().Match(inp).Groups[1].Value;
            return new string(s.Reverse().ToArray());
        }
    );
}

/// <summary>A single booster rule pairing a test predicate with a resolver.</summary>
public sealed record BoosterRule(
    string Name,
    Func<string, bool> Test,
    Func<string, string> Resolve
);
