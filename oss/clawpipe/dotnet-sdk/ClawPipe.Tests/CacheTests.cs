using ClawPipe;
using Xunit;

namespace ClawPipe.Tests;

public sealed class CacheTests
{
    // ── Basic get/set ─────────────────────────────────────────────────────

    [Fact]
    public void Set_ThenGet_ReturnsCachedValue()
    {
        var cache = new Cache();
        cache.Set("hello world", "response text");
        var result = cache.Get("hello world");
        Assert.Equal("response text", result);
    }

    [Fact]
    public void Get_MissingKey_ReturnsNull()
    {
        var cache = new Cache();
        Assert.Null(cache.Get("nonexistent prompt"));
    }

    [Fact]
    public void Set_Overwrite_ReturnsNewValue()
    {
        var cache = new Cache();
        cache.Set("prompt", "first");
        cache.Set("prompt", "second");
        Assert.Equal("second", cache.Get("prompt"));
    }

    [Fact]
    public void Get_ExpiredEntry_ReturnsNull()
    {
        var cache = new Cache(defaultTtl: TimeSpan.FromMilliseconds(1));
        cache.Set("expired prompt", "value");
        System.Threading.Thread.Sleep(20); // wait for expiry
        Assert.Null(cache.Get("expired prompt"));
    }

    // ── SHA-256 keying ────────────────────────────────────────────────────

    [Fact]
    public void ComputeKey_SamePrompt_SameKey()
    {
        var k1 = Cache.ComputeKey("hello");
        var k2 = Cache.ComputeKey("hello");
        Assert.Equal(k1, k2);
    }

    [Fact]
    public void ComputeKey_DifferentPrompts_DifferentKeys()
    {
        var k1 = Cache.ComputeKey("hello");
        var k2 = Cache.ComputeKey("world");
        Assert.NotEqual(k1, k2);
    }

    [Fact]
    public void ComputeKey_Is64HexChars()
    {
        var key = Cache.ComputeKey("test");
        Assert.Equal(64, key.Length);
        Assert.Matches("^[0-9a-f]+$", key);
    }

    [Fact]
    public void ComputeKey_EmptyString_IsDefined()
    {
        var key = Cache.ComputeKey("");
        Assert.Equal(64, key.Length);
    }

    // ── TTL per-entry override ────────────────────────────────────────────

    [Fact]
    public void Set_WithCustomTtl_RespectsOverride()
    {
        var cache = new Cache(defaultTtl: TimeSpan.FromHours(1));
        cache.Set("prompt", "value", ttl: TimeSpan.FromMilliseconds(1));
        System.Threading.Thread.Sleep(20);
        Assert.Null(cache.Get("prompt"));
    }

    [Fact]
    public void Set_NoTtlOverride_UsesDefault()
    {
        var cache = new Cache(defaultTtl: TimeSpan.FromHours(1));
        cache.Set("prompt", "value");
        Assert.Equal("value", cache.Get("prompt"));
    }

    // ── Delete / Clear ────────────────────────────────────────────────────

    [Fact]
    public void Delete_ExistingKey_RemovesEntry()
    {
        var cache = new Cache();
        cache.Set("del me", "v");
        Assert.True(cache.Delete("del me"));
        Assert.Null(cache.Get("del me"));
    }

    [Fact]
    public void Delete_NonExistentKey_ReturnsFalse()
    {
        var cache = new Cache();
        Assert.False(cache.Delete("ghost"));
    }

    [Fact]
    public void Clear_RemovesAllEntries()
    {
        var cache = new Cache();
        cache.Set("a", "1");
        cache.Set("b", "2");
        cache.Clear();
        Assert.Null(cache.Get("a"));
        Assert.Null(cache.Get("b"));
    }

    // ── Stats ─────────────────────────────────────────────────────────────

    [Fact]
    public void Stats_TracksHitsAndMisses()
    {
        var cache = new Cache();
        cache.Set("x", "val");
        _ = cache.Get("x");        // hit
        _ = cache.Get("missing");  // miss

        var stats = cache.Stats();
        Assert.Equal(1, stats.Hits);
        Assert.Equal(1, stats.Misses);
        Assert.Equal("50.0%", stats.HitRate);
    }

    [Fact]
    public void Stats_Empty_ZeroHitRate()
    {
        var cache = new Cache();
        var stats = cache.Stats();
        Assert.Equal("0.0%", stats.HitRate);
    }

    // ── Prune ─────────────────────────────────────────────────────────────

    [Fact]
    public void Prune_RemovesExpiredEntries()
    {
        var cache = new Cache(defaultTtl: TimeSpan.FromMilliseconds(1));
        cache.Set("p1", "v1");
        cache.Set("p2", "v2");
        System.Threading.Thread.Sleep(30);
        var removed = cache.Prune();
        Assert.Equal(2, removed);
    }

    [Fact]
    public void Prune_NoExpired_Returns0()
    {
        var cache = new Cache(defaultTtl: TimeSpan.FromHours(1));
        cache.Set("fresh", "val");
        var removed = cache.Prune();
        Assert.Equal(0, removed);
    }

    // ── Eviction ─────────────────────────────────────────────────────────

    [Fact]
    public void Eviction_FullCache_EvictsLeastHit()
    {
        var cache = new Cache(maxEntries: 10);
        for (int i = 0; i < 10; i++)
            cache.Set($"prompt{i}", $"val{i}");

        // Adding one more should trigger eviction
        cache.Set("new-prompt", "new-val");
        Assert.Equal("new-val", cache.Get("new-prompt"));
    }
}
