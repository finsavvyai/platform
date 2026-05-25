using System.Net;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using ClawPipe;
using Moq;
using Moq.Protected;
using Xunit;

namespace ClawPipe.Tests;

public sealed class ClientTests
{
    // ── Helpers ───────────────────────────────────────────────────────────

    private static HttpClient BuildMockHttpClient(HttpStatusCode status, string body)
    {
        var handler = new Mock<HttpMessageHandler>(MockBehavior.Strict);
        handler.Protected()
            .Setup<Task<HttpResponseMessage>>(
                "SendAsync",
                ItExpr.IsAny<HttpRequestMessage>(),
                ItExpr.IsAny<CancellationToken>())
            .ReturnsAsync(new HttpResponseMessage
            {
                StatusCode = status,
                Content = new StringContent(body, Encoding.UTF8, "application/json"),
            });
        return new HttpClient(handler.Object);
    }

    private static string GatewayJson(string text, int tokensIn = 10, int tokensOut = 5, double latency = 120.0)
        => JsonSerializer.Serialize(new
        {
            text,
            tokens_in = tokensIn,
            tokens_out = tokensOut,
            latency_ms = latency,
        });

    // ── Booster short-circuits (no HTTP) ─────────────────────────────────

    [Fact]
    public async Task PromptAsync_Boostable_ReturnsWithoutHttpCall()
    {
        // No HttpClient needed — booster fires before any network call
        var client = new ClawPipeClient(apiKey: "cp_test",
            httpClient: BuildMockHttpClient(HttpStatusCode.OK, GatewayJson("should not reach")));

        var result = await client.PromptAsync("what is 2 + 2");

        Assert.Equal("4", result.Text);
        Assert.True(result.Boosted);
        Assert.False(result.Cached);
        Assert.Equal(0, result.TokensIn);
    }

    [Fact]
    public async Task PromptAsync_UuidBoost_ReturnsGuid()
    {
        var client = new ClawPipeClient(apiKey: "cp_test",
            httpClient: BuildMockHttpClient(HttpStatusCode.OK, GatewayJson("nope")));

        var result = await client.PromptAsync("generate a uuid");

        Assert.True(result.Boosted);
        Assert.True(Guid.TryParse(result.Text, out _));
    }

    // ── Cache short-circuits ──────────────────────────────────────────────

    [Fact]
    public async Task PromptAsync_CachedPrompt_DoesNotCallGateway()
    {
        var callCount = 0;
        var handler = new Mock<HttpMessageHandler>(MockBehavior.Strict);
        handler.Protected()
            .Setup<Task<HttpResponseMessage>>(
                "SendAsync",
                ItExpr.IsAny<HttpRequestMessage>(),
                ItExpr.IsAny<CancellationToken>())
            .ReturnsAsync(() =>
            {
                callCount++;
                return new HttpResponseMessage
                {
                    StatusCode = HttpStatusCode.OK,
                    Content = new StringContent(GatewayJson("live response"), Encoding.UTF8, "application/json"),
                };
            });

        var client = new ClawPipeClient(apiKey: "cp_test", httpClient: new HttpClient(handler.Object));

        // First call — goes to gateway, result gets cached
        var first = await client.PromptAsync("unique non-boostable prompt about space");
        Assert.Equal(1, callCount);
        Assert.False(first.Cached);

        // Second call — should hit cache, gateway not called again
        var second = await client.PromptAsync("unique non-boostable prompt about space");
        Assert.Equal(1, callCount); // still 1
        Assert.True(second.Cached);
        Assert.Equal("live response", second.Text);
    }

    // ── Gateway happy path ────────────────────────────────────────────────

    [Fact]
    public async Task PromptAsync_GatewaySuccess_ReturnsResult()
    {
        var responseBody = GatewayJson("Paris is the capital of France.", 12, 8, 95.0);
        var client = new ClawPipeClient(apiKey: "cp_test",
            httpClient: BuildMockHttpClient(HttpStatusCode.OK, responseBody));

        var result = await client.PromptAsync("what is the capital of France");

        Assert.Equal("Paris is the capital of France.", result.Text);
        Assert.False(result.Boosted);
        Assert.Equal(12, result.TokensIn);
        Assert.Equal(8, result.TokensOut);
    }

    [Fact]
    public async Task PromptAsync_GatewayError_ThrowsGatewayException()
    {
        var client = new ClawPipeClient(apiKey: "cp_test",
            httpClient: BuildMockHttpClient(HttpStatusCode.Unauthorized, @"{""error"":""invalid key""}"));

        var ex = await Assert.ThrowsAsync<GatewayException>(
            () => client.PromptAsync("tell me something interesting"));

        Assert.Equal(401, ex.StatusCode);
    }

    // ── Gateway direct tests ───────────────────────────────────────────────

    [Fact]
    public async Task Gateway_ServerError_ThrowsGatewayException()
    {
        var gw = new Gateway("cp_key",
            httpClient: BuildMockHttpClient(HttpStatusCode.InternalServerError, "Internal Server Error"));

        var ex = await Assert.ThrowsAsync<GatewayException>(
            () => gw.CallAsync("prompt", "openai", "gpt-4o-mini"));

        Assert.Equal(500, ex.StatusCode);
    }

    [Fact]
    public async Task Gateway_RateLimited_ThrowsGatewayException()
    {
        var gw = new Gateway("cp_key",
            httpClient: BuildMockHttpClient((HttpStatusCode)429, @"{""error"":""rate limited""}"));

        var ex = await Assert.ThrowsAsync<GatewayException>(
            () => gw.CallAsync("prompt", "openai", "gpt-4o-mini"));

        Assert.Equal(429, ex.StatusCode);
    }

    [Fact]
    public async Task Gateway_Success_DeserializesCorrectly()
    {
        var body = GatewayJson("The answer is 42.", 5, 6, 80.0);
        var gw = new Gateway("cp_key",
            httpClient: BuildMockHttpClient(HttpStatusCode.OK, body));

        var result = await gw.CallAsync("What is the answer?", "anthropic", "claude-3-haiku-20240307");

        Assert.Equal("The answer is 42.", result.Text);
        Assert.Equal(5, result.TokensIn);
        Assert.Equal(6, result.TokensOut);
        Assert.False(result.Boosted);
    }

    // ── Client expose helpers ─────────────────────────────────────────────

    [Fact]
    public void Client_Booster_IsAccessible()
    {
        var client = new ClawPipeClient(apiKey: "cp_test",
            httpClient: BuildMockHttpClient(HttpStatusCode.OK, GatewayJson("x")));
        Assert.NotNull(client.Booster);
        Assert.Equal(6, client.Booster.RuleCount);
    }

    [Fact]
    public void Client_Cache_IsAccessible()
    {
        var client = new ClawPipeClient(apiKey: "cp_test",
            httpClient: BuildMockHttpClient(HttpStatusCode.OK, GatewayJson("x")));
        var stats = client.Cache.Stats();
        Assert.Equal(0, stats.Hits);
    }
}
