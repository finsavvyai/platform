namespace ClawPipe;

/// <summary>Result returned from the full pipeline (boosted, cached, or live call).</summary>
public record PipelineResult(
    string Text,
    int TokensIn,
    int TokensOut,
    double LatencyMs,
    bool Boosted,
    bool Cached
);

/// <summary>Result of packing (compressing) a prompt.</summary>
public record PackResult(string Text, double SavingsPct);

/// <summary>Raw gateway response envelope.</summary>
internal record GatewayResponse(
    string Text,
    int TokensIn,
    int TokensOut,
    double LatencyMs
);

/// <summary>Exception thrown when the ClawPipe gateway returns an error.</summary>
public sealed class GatewayException : Exception
{
    public int StatusCode { get; }

    public GatewayException(int statusCode, string body = "")
        : base($"ClawPipe gateway error: {statusCode}" + (body.Length > 0 ? $" -- {body[..Math.Min(200, body.Length)]}" : ""))
    {
        StatusCode = statusCode;
    }
}
