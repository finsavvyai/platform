namespace ClawPipe;

/// <summary>
/// Main entry point for the ClawPipe SDK.
/// Orchestrates Booster -> Packer -> Cache -> Gateway pipeline.
///
/// <example>
/// <code>
/// var pipe = new ClawPipeClient(apiKey: "cp_xxx");
/// var result = await pipe.PromptAsync("What is 2 + 2?");
/// Console.WriteLine(result.Text); // "4"
/// </code>
/// </example>
/// </summary>
public sealed class ClawPipeClient : IDisposable
{
    private readonly Booster _booster;
    private readonly Packer _packer;
    private readonly Cache _cache;
    private readonly Gateway _gateway;

    public ClawPipeClient(
        string apiKey,
        string? gatewayUrl = null,
        System.Net.Http.HttpClient? httpClient = null,
        ClawPipeOptions? options = null)
    {
        var opts = options ?? new();
        _booster = new Booster();
        _packer = new Packer(opts.PackerOptions);
        _cache = new Cache(opts.CacheTtl, opts.MaxCacheEntries);
        _gateway = new Gateway(apiKey, gatewayUrl, httpClient);
    }

    /// <summary>
    /// Run the full pipeline: Booster -> Cache -> Pack -> Gateway.
    /// Returns immediately for boosted/cached hits without any network call.
    /// </summary>
    public async Task<PipelineResult> PromptAsync(
        string prompt,
        string provider = "openai",
        string model = "gpt-4o-mini",
        CancellationToken ct = default)
    {
        // Stage 1: Booster — deterministic local resolve
        var boosted = _booster.Boost(prompt);
        if (boosted is not null)
            return new PipelineResult(boosted, 0, 0, 0, Boosted: true, Cached: false);

        // Stage 2: Cache hit
        var cached = _cache.Get(prompt);
        if (cached is not null)
            return new PipelineResult(cached, 0, 0, 0, Boosted: false, Cached: true);

        // Stage 3: Pack before sending
        var packed = _packer.Pack(prompt);

        // Stage 4: Gateway call
        var result = await _gateway.CallAsync(packed.Text, provider, model, ct).ConfigureAwait(false);

        // Stage 5: Cache the response
        _cache.Set(prompt, result.Text);

        return result;
    }

    /// <summary>Access the internal booster to add custom rules.</summary>
    public Booster Booster => _booster;

    /// <summary>Access the cache for stats or manual management.</summary>
    public Cache Cache => _cache;

    public void Dispose() => _gateway.Dispose();
}

/// <summary>Options for ClawPipeClient construction.</summary>
public sealed record ClawPipeOptions(
    PackerOptions? PackerOptions = null,
    TimeSpan? CacheTtl = null,
    int MaxCacheEntries = 10_000
);
