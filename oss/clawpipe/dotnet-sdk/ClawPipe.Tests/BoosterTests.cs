using ClawPipe;
using Xunit;

namespace ClawPipe.Tests;

public sealed class BoosterTests
{
    private readonly Booster _booster = new();

    // ── Rule 1: Math ───────────────────────────────────────────────────────

    [Fact]
    public void Math_WhatIs_ReturnsResult()
    {
        var result = _booster.Boost("what is 2 + 2");
        Assert.Equal("4", result);
    }

    [Fact]
    public void Math_Calculate_ReturnsResult()
    {
        var result = _booster.Boost("calculate 10 * 5");
        Assert.Equal("50", result);
    }

    [Fact]
    public void Math_Complex_ReturnsDecimal()
    {
        var result = _booster.Boost("compute 10 / 3");
        Assert.NotNull(result);
        Assert.StartsWith("3.3", result);
    }

    [Fact]
    public void Math_NonMathPrompt_ReturnsNull()
    {
        var result = _booster.Boost("what is the capital of France");
        Assert.Null(result);
    }

    // ── Rule 2: Date ───────────────────────────────────────────────────────

    [Fact]
    public void Date_WhatIsToday_ReturnsDate()
    {
        var result = _booster.Boost("what is today");
        Assert.NotNull(result);
        Assert.Matches(@"^\d{4}-\d{2}-\d{2}$", result!);
    }

    [Fact]
    public void Date_WhatIsTheCurrentDate_ReturnsDate()
    {
        var result = _booster.Boost("what is the current date");
        Assert.NotNull(result);
        Assert.Equal(DateTime.UtcNow.ToString("yyyy-MM-dd"), result);
    }

    [Fact]
    public void Date_NowKeyword_ReturnsDate()
    {
        var result = _booster.Boost("now");
        Assert.NotNull(result);
        Assert.Matches(@"^\d{4}-\d{2}-\d{2}$", result!);
    }

    [Fact]
    public void Date_LongPrompt_ReturnsNull()
    {
        // Over 60 chars — should not match date rule
        var result = _booster.Boost("what is the current date and time in the United States Eastern timezone today");
        Assert.Null(result);
    }

    // ── Rule 3: UUID ──────────────────────────────────────────────────────

    [Fact]
    public void Uuid_GenerateAUuid_ReturnsGuid()
    {
        var result = _booster.Boost("generate a uuid");
        Assert.NotNull(result);
        Assert.True(Guid.TryParse(result, out _));
    }

    [Fact]
    public void Uuid_GenerateUuid_ReturnsGuid()
    {
        var result = _booster.Boost("generate uuid");
        Assert.NotNull(result);
        Assert.True(Guid.TryParse(result, out _));
    }

    [Fact]
    public void Uuid_CaseInsensitive_ReturnsGuid()
    {
        var result = _booster.Boost("GENERATE A UUID");
        Assert.NotNull(result);
        Assert.True(Guid.TryParse(result, out _));
    }

    [Fact]
    public void Uuid_EachCallProducesDifferentValue()
    {
        var a = _booster.Boost("generate a uuid");
        var b = _booster.Boost("generate a uuid");
        Assert.NotEqual(a, b);
    }

    // ── Rule 4: Uppercase ─────────────────────────────────────────────────

    [Fact]
    public void Uppercase_ConvertHello_ReturnsHELLO()
    {
        var result = _booster.Boost(@"convert ""hello"" to uppercase");
        Assert.Equal("HELLO", result);
    }

    [Fact]
    public void Uppercase_MixedCase_ReturnsAllUpper()
    {
        var result = _booster.Boost(@"convert ""HeLLo WoRLd"" to uppercase");
        Assert.Equal("HELLO WORLD", result);
    }

    // ── Rule 5: Lowercase ─────────────────────────────────────────────────

    [Fact]
    public void Lowercase_ConvertHELLO_Returnshello()
    {
        var result = _booster.Boost(@"convert ""HELLO"" to lowercase");
        Assert.Equal("hello", result);
    }

    [Fact]
    public void Lowercase_MixedCase_ReturnsAllLower()
    {
        var result = _booster.Boost(@"convert ""Hello World"" to lowercase");
        Assert.Equal("hello world", result);
    }

    // ── Rule 6: Reverse ───────────────────────────────────────────────────

    [Fact]
    public void Reverse_Hello_ReturnsOlleh()
    {
        var result = _booster.Boost(@"reverse ""hello""");
        Assert.Equal("olleh", result);
    }

    [Fact]
    public void Reverse_Palindrome_ReturnsSame()
    {
        var result = _booster.Boost(@"reverse ""racecar""");
        Assert.Equal("racecar", result);
    }

    // ── Custom rules ──────────────────────────────────────────────────────

    [Fact]
    public void AddRule_CustomRule_IsInvoked()
    {
        var booster = new Booster();
        booster.AddRule(new BoosterRule(
            "ping",
            inp => inp.Equals("ping", StringComparison.OrdinalIgnoreCase),
            _ => "pong"
        ));
        Assert.Equal("pong", booster.Boost("ping"));
    }

    [Fact]
    public void RuleCount_DefaultRules_Is6()
    {
        Assert.Equal(6, _booster.RuleCount);
    }

    [Fact]
    public void Boost_NoMatch_ReturnsNull()
    {
        var result = _booster.Boost("Tell me a story about a dragon");
        Assert.Null(result);
    }

    [Fact]
    public void Boost_TrimsWhitespace()
    {
        var result = _booster.Boost("   what is 1 + 1   ");
        Assert.Equal("2", result);
    }
}
