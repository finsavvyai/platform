using ClawPipe;
using Xunit;

namespace ClawPipe.Tests;

public sealed class PackerTests
{
    private readonly Packer _packer = new();

    // ── Basic compression ─────────────────────────────────────────────────

    [Fact]
    public void Pack_PlainText_ReturnsSameSavings0()
    {
        var result = _packer.Pack("Hello world");
        Assert.Equal("Hello world", result.Text);
        Assert.Equal(0.0, result.SavingsPct);
    }

    [Fact]
    public void Pack_ExcessiveWhitespace_Compressed()
    {
        var input = "Hello   \n\n\n\n   world   ";
        var result = _packer.Pack(input);
        Assert.DoesNotContain("\n\n\n", result.Text);
    }

    [Fact]
    public void Pack_DuplicateBlocks_Deduplicated()
    {
        var block = string.Concat(Enumerable.Repeat('x', 60));
        var input = $"{block}\n\n{block}\n\n{block}";
        var result = _packer.Pack(input);
        // After deduplication only one copy should remain
        Assert.Single(result.Text.Split($"{block}").Skip(1));
    }

    [Fact]
    public void Pack_Savings_PositiveForCompressibleText()
    {
        var repeated = string.Join("\n\n", Enumerable.Repeat(string.Concat(Enumerable.Repeat('a', 100)), 10));
        var result = _packer.Pack(repeated);
        Assert.True(result.SavingsPct > 0, $"Expected savings > 0 but got {result.SavingsPct}");
    }

    // ── Token estimation ──────────────────────────────────────────────────

    [Fact]
    public void EstimateTokens_4CharsPerToken()
    {
        Assert.Equal(3, Packer.EstimateTokens("abcd abcd ab")); // 12 chars / 4 = 3
    }

    [Fact]
    public void EstimateTokens_Empty_Returns0()
    {
        Assert.Equal(0, Packer.EstimateTokens(""));
    }

    [Fact]
    public void EstimateTokens_OddLength_CeilsUp()
    {
        Assert.Equal(1, Packer.EstimateTokens("abc")); // 3 / 4 = 0.75, ceil = 1
    }

    [Fact]
    public void EstimateTokens_SingleChar_Returns1()
    {
        Assert.Equal(1, Packer.EstimateTokens("a"));
    }

    // ── Boilerplate stripping ─────────────────────────────────────────────

    [Fact]
    public void Pack_EslintDisable_Stripped()
    {
        var input = "// eslint-disable-next-line\nconst x = 1;";
        var result = _packer.Pack(input);
        Assert.DoesNotContain("eslint-disable", result.Text);
    }

    [Fact]
    public void Pack_TsIgnore_Stripped()
    {
        var input = "// @ts-ignore\nconst x: any = 1;";
        var result = _packer.Pack(input);
        Assert.DoesNotContain("@ts-ignore", result.Text);
    }

    // ── Truncation ────────────────────────────────────────────────────────

    [Fact]
    public void Pack_ExceedsMaxTokens_Truncated()
    {
        var opts = new PackerOptions(MaxTokens: 10);
        var packer = new Packer(opts);
        var input = new string('a', 200); // 200 chars, way over 10*4=40 limit
        var result = packer.Pack(input);
        Assert.Contains("[Truncated", result.Text);
    }

    [Fact]
    public void Pack_WithinMaxTokens_NotTruncated()
    {
        var opts = new PackerOptions(MaxTokens: 1000);
        var packer = new Packer(opts);
        var input = "Short text.";
        var result = packer.Pack(input);
        Assert.DoesNotContain("[Truncated", result.Text);
    }

    // ── Options ───────────────────────────────────────────────────────────

    [Fact]
    public void Pack_CompressWhitespaceFalse_PreservesWhitespace()
    {
        var opts = new PackerOptions(CompressWhitespace: false, Deduplicate: false, StripBoilerplate: false);
        var packer = new Packer(opts);
        const string input = "line1\n\n\n\nline2";
        var result = packer.Pack(input);
        Assert.Contains("\n\n\n", result.Text);
    }

    [Fact]
    public void Pack_DeduplicateFalse_PreservesDuplicates()
    {
        var opts = new PackerOptions(Deduplicate: false, CompressWhitespace: false, StripBoilerplate: false);
        var packer = new Packer(opts);
        var block = string.Concat(Enumerable.Repeat('z', 80));
        var input = $"{block}\n\n{block}";
        var result = packer.Pack(input);
        // Both copies preserved
        Assert.Equal(2, result.Text.Split(block).Length - 1);
    }

    [Fact]
    public void Pack_SavingsPct_NeverNegative()
    {
        var result = _packer.Pack("tiny");
        Assert.True(result.SavingsPct >= 0);
    }
}
