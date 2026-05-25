using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace ClawPipe;

/// <summary>
/// HTTP client for the ClawPipe gateway API.
/// Posts prompts to https://api.clawpipe.ai/v1/prompt and returns structured results.
/// </summary>
public sealed class Gateway : IDisposable
{
    private readonly HttpClient _http;
    private readonly string _apiKey;
    private readonly string _gatewayUrl;

    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    };

    public Gateway(string apiKey, string? gatewayUrl = null, HttpClient? httpClient = null)
    {
        _apiKey = apiKey;
        _gatewayUrl = (gatewayUrl ?? "https://api.clawpipe.ai/v1").TrimEnd('/');
        _http = httpClient ?? new HttpClient { Timeout = TimeSpan.FromSeconds(60) };
    }

    /// <summary>Send a prompt to the gateway and return a PipelineResult.</summary>
    public async Task<PipelineResult> CallAsync(
        string prompt,
        string provider = "openai",
        string model = "gpt-4o-mini",
        CancellationToken ct = default)
    {
        var payload = new GatewayRequest(prompt, provider, model);
        var json = JsonSerializer.Serialize(payload, JsonOpts);
        using var req = new HttpRequestMessage(HttpMethod.Post, $"{_gatewayUrl}/prompt")
        {
            Content = new StringContent(json, Encoding.UTF8, "application/json"),
        };
        req.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", _apiKey);

        var sw = System.Diagnostics.Stopwatch.StartNew();
        using var resp = await _http.SendAsync(req, ct).ConfigureAwait(false);
        sw.Stop();

        if (!resp.IsSuccessStatusCode)
        {
            var body = await resp.Content.ReadAsStringAsync(ct).ConfigureAwait(false);
            throw new GatewayException((int)resp.StatusCode, body);
        }

        var envelope = await resp.Content.ReadFromJsonAsync<GatewayResponse>(JsonOpts, ct).ConfigureAwait(false)
            ?? throw new InvalidOperationException("Empty response from gateway");

        return new PipelineResult(
            Text: envelope.Text,
            TokensIn: envelope.TokensIn,
            TokensOut: envelope.TokensOut,
            LatencyMs: sw.Elapsed.TotalMilliseconds,
            Boosted: false,
            Cached: false
        );
    }

    public void Dispose() => _http.Dispose();

    // ── internal DTO ──────────────────────────────────────────────────────

    private sealed record GatewayRequest(string Prompt, string Provider, string Model);
}
