using System.Collections.Concurrent;
using System.Security.Cryptography;
using System.Text;

namespace ClawPipe;

/// <summary>
/// In-memory prompt cache with SHA-256 keys, TTL expiry, and LRU-style eviction.
/// Thread-safe via ConcurrentDictionary.
/// </summary>
public sealed class Cache
{
    private readonly ConcurrentDictionary<string, CacheEntry> _store = new();
    private readonly TimeSpan _defaultTtl;
    private readonly int _maxEntries;
    private long _totalHits;
    private long _totalMisses;

    public Cache(TimeSpan? defaultTtl = null, int maxEntries = 10_000)
    {
        _defaultTtl = defaultTtl ?? TimeSpan.FromMinutes(5);
        _maxEntries = maxEntries;
    }

    /// <summary>Compute a SHA-256 cache key from a prompt string.</summary>
    public static string ComputeKey(string prompt)
    {
        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(prompt));
        return Convert.ToHexString(hash).ToLowerInvariant();
    }

    /// <summary>Retrieve a cached value. Returns null if missing or expired.</summary>
    public string? Get(string prompt)
    {
        var key = ComputeKey(prompt);
        if (!_store.TryGetValue(key, out var entry))
        {
            Interlocked.Increment(ref _totalMisses);
            return null;
        }

        if (DateTime.UtcNow > entry.Expiry)
        {
            _store.TryRemove(key, out _);
            Interlocked.Increment(ref _totalMisses);
            return null;
        }

        entry.IncrementHits();
        Interlocked.Increment(ref _totalHits);
        return entry.Value;
    }

    /// <summary>Store a value in cache with optional per-entry TTL override.</summary>
    public void Set(string prompt, string response, TimeSpan? ttl = null)
    {
        EvictIfFull();
        var key = ComputeKey(prompt);
        var expiry = DateTime.UtcNow + (ttl ?? _defaultTtl);
        _store[key] = new CacheEntry(response, expiry);
    }

    /// <summary>Remove a specific prompt from cache.</summary>
    public bool Delete(string prompt) => _store.TryRemove(ComputeKey(prompt), out _);

    /// <summary>Clear all cached entries and reset statistics.</summary>
    public void Clear()
    {
        _store.Clear();
        Interlocked.Exchange(ref _totalHits, 0);
        Interlocked.Exchange(ref _totalMisses, 0);
    }

    /// <summary>Remove all expired entries. Returns number removed.</summary>
    public int Prune()
    {
        var now = DateTime.UtcNow;
        var expired = _store.Where(kv => now > kv.Value.Expiry).Select(kv => kv.Key).ToList();
        foreach (var k in expired) _store.TryRemove(k, out _);
        return expired.Count;
    }

    /// <summary>Cache performance statistics.</summary>
    public CacheStats Stats()
    {
        var hits = Interlocked.Read(ref _totalHits);
        var misses = Interlocked.Read(ref _totalMisses);
        var total = hits + misses;
        var rate = total > 0 ? (double)hits / total * 100 : 0;
        return new CacheStats(_store.Count, hits, misses, $"{rate:F1}%");
    }

    private void EvictIfFull()
    {
        if (_store.Count < _maxEntries) return;
        var toRemove = (int)Math.Ceiling(_maxEntries * 0.1);
        var leastHit = _store.OrderBy(kv => kv.Value.Hits).Take(toRemove).Select(kv => kv.Key);
        foreach (var k in leastHit) _store.TryRemove(k, out _);
    }
}

/// <summary>A single entry in the cache.</summary>
internal sealed class CacheEntry(string value, DateTime expiry)
{
    public string Value { get; } = value;
    public DateTime Expiry { get; } = expiry;
    private long _hits;
    public long Hits => Interlocked.Read(ref _hits);
    public void IncrementHits() => Interlocked.Increment(ref _hits);
}

/// <summary>Cache performance statistics snapshot.</summary>
public sealed record CacheStats(long Size, long Hits, long Misses, string HitRate);
