using System.Text.RegularExpressions;

namespace ClawPipe;

/// <summary>
/// Context Packer — compress prompt text to reduce token count.
/// Strategies: whitespace compression, deduplication, boilerplate stripping.
/// </summary>
public sealed partial class Packer
{
    private readonly PackerOptions _options;

    public Packer(PackerOptions? options = null) => _options = options ?? new();

    /// <summary>Pack a prompt, returning compressed text and savings percentage.</summary>
    public PackResult Pack(string text)
    {
        var original = text;
        var originalTokens = EstimateTokens(original);

        var packed = original;
        if (_options.CompressWhitespace) packed = CompressWhitespace(packed);
        if (_options.Deduplicate) packed = Deduplicate(packed);
        if (_options.StripBoilerplate) packed = StripBoilerplate(packed);
        packed = TruncateToLimit(packed);

        var packedTokens = EstimateTokens(packed);
        var savingsPct = originalTokens > 0
            ? Math.Max(0.0, (1.0 - (double)packedTokens / originalTokens) * 100)
            : 0.0;

        return new PackResult(packed, Math.Round(savingsPct, 1));
    }

    /// <summary>Rough token estimate: ~4 characters per token.</summary>
    public static int EstimateTokens(string text) => (int)Math.Ceiling(text.Length / 4.0);

    // ── private helpers ────────────────────────────────────────────────────

    private static string CompressWhitespace(string text)
    {
        var lines = text.Split('\n').Select(l => l.TrimEnd());
        var joined = string.Join('\n', lines);
        return MultipleNewlines().Replace(joined, "\n\n").Trim();
    }

    private static string Deduplicate(string text)
    {
        var blocks = text.Split("\n\n");
        var seen = new HashSet<string>();
        var unique = new List<string>();
        foreach (var block in blocks)
        {
            var normalized = block.Trim().ToLowerInvariant();
            if (string.IsNullOrEmpty(normalized)) continue;
            if (normalized.Length > 50 && seen.Contains(normalized)) continue;
            seen.Add(normalized);
            unique.Add(block);
        }
        return string.Join("\n\n", unique);
    }

    [GeneratedRegex(@"^/\*\*?\s*\n(\s*\*\s*@(param|returns|throws|example).*\n)*\s*\*/", RegexOptions.Multiline)]
    private static partial Regex JsDocPattern();

    [GeneratedRegex(@"^//\s*eslint-disable.*$", RegexOptions.Multiline)]
    private static partial Regex EslintDisablePattern();

    [GeneratedRegex(@"^//\s*@ts-(ignore|expect-error|nocheck).*$", RegexOptions.Multiline)]
    private static partial Regex TsIgnorePattern();

    [GeneratedRegex(@"^'use strict';?\s*$", RegexOptions.Multiline)]
    private static partial Regex UseStrictPattern();

    [GeneratedRegex(@"^\n{3,}", RegexOptions.Multiline)]
    private static partial Regex MultipleNewlines();

    private static string StripBoilerplate(string text)
    {
        var result = JsDocPattern().Replace(text, "");
        result = EslintDisablePattern().Replace(result, "");
        result = TsIgnorePattern().Replace(result, "");
        result = UseStrictPattern().Replace(result, "");
        return MultipleNewlines().Replace(result, "\n\n").Trim();
    }

    private string TruncateToLimit(string text)
    {
        var maxChars = _options.MaxTokens * 4;
        if (text.Length <= maxChars) return text;
        var truncated = text[..maxChars];
        var lastNl = truncated.LastIndexOf('\n');
        var cut = lastNl > maxChars * 0.8 ? lastNl : maxChars;
        return truncated[..cut] + "\n\n[Truncated -- context exceeded budget]";
    }
}

/// <summary>Options for the Packer.</summary>
public sealed record PackerOptions(
    int MaxTokens = 100_000,
    bool Deduplicate = true,
    bool StripBoilerplate = true,
    bool CompressWhitespace = true
);
