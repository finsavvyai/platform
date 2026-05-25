<?php

declare(strict_types=1);

namespace ClawPipe;

/**
 * In-memory prompt cache with SHA-256 keying and TTL expiry.
 */
class Cache
{
    /** @var array<string, array{value: string, expires_at: int}> */
    private array $store = [];

    private int $hits   = 0;
    private int $misses = 0;

    /**
     * @param int $defaultTtl Default TTL in seconds (default 300 = 5 min).
     * @param int $maxEntries Maximum entries before LRU eviction.
     */
    public function __construct(
        private int $defaultTtl  = 300,
        private int $maxEntries  = 10_000,
    ) {}

    /**
     * Retrieve a cached response for a prompt.
     *
     * @param string $prompt The original prompt text.
     * @return string|null Cached response, or null on miss / expiry.
     */
    public function get(string $prompt): ?string
    {
        $key   = $this->hashKey($prompt);
        $entry = $this->store[$key] ?? null;

        if ($entry === null) {
            $this->misses++;
            return null;
        }

        if (time() >= $entry['expires_at']) {
            unset($this->store[$key]);
            $this->misses++;
            return null;
        }

        $this->hits++;
        return $entry['value'];
    }

    /**
     * Store a response in the cache.
     *
     * @param string $prompt   The original prompt text used as cache key.
     * @param string $response The LLM response to cache.
     * @param int    $ttl      TTL in seconds (0 = use default).
     */
    public function set(string $prompt, string $response, int $ttl = 0): void
    {
        $this->evictIfFull();

        $key = $this->hashKey($prompt);
        $this->store[$key] = [
            'value'      => $response,
            'expires_at' => time() + ($ttl > 0 ? $ttl : $this->defaultTtl),
        ];
    }

    /**
     * Check whether a valid (non-expired) entry exists.
     */
    public function has(string $prompt): bool
    {
        return $this->get($prompt) !== null;
    }

    /**
     * Remove a specific cached prompt.
     */
    public function delete(string $prompt): bool
    {
        $key = $this->hashKey($prompt);
        if (isset($this->store[$key])) {
            unset($this->store[$key]);
            return true;
        }
        return false;
    }

    /**
     * Flush the entire cache and reset statistics.
     */
    public function clear(): void
    {
        $this->store  = [];
        $this->hits   = 0;
        $this->misses = 0;
    }

    /**
     * Remove all expired entries and return count removed.
     */
    public function prune(): int
    {
        $now     = time();
        $removed = 0;
        foreach (array_keys($this->store) as $key) {
            if ($now >= $this->store[$key]['expires_at']) {
                unset($this->store[$key]);
                $removed++;
            }
        }
        return $removed;
    }

    /**
     * Return cache performance statistics.
     *
     * @return array{size: int, hits: int, misses: int, hit_rate: string}
     */
    public function stats(): array
    {
        $total   = $this->hits + $this->misses;
        $hitRate = $total > 0 ? round($this->hits / $total * 100, 1) . '%' : '0.0%';

        return [
            'size'     => count($this->store),
            'hits'     => $this->hits,
            'misses'   => $this->misses,
            'hit_rate' => $hitRate,
        ];
    }

    /**
     * SHA-256 hash of the prompt, prefixed with "cp_".
     */
    private function hashKey(string $prompt): string
    {
        return 'cp_' . hash('sha256', $prompt);
    }

    /**
     * Evict expired entries first; if still full, drop oldest by expiry.
     */
    private function evictIfFull(): void
    {
        if (count($this->store) < $this->maxEntries) {
            return;
        }

        // First pass: remove expired
        $this->prune();

        if (count($this->store) < $this->maxEntries) {
            return;
        }

        // Second pass: evict 10% oldest entries
        uasort($this->store, fn($a, $b) => $a['expires_at'] <=> $b['expires_at']);
        $toRemove = (int) ceil($this->maxEntries * 0.1);
        $keys     = array_keys($this->store);
        for ($i = 0; $i < min($toRemove, count($keys)); $i++) {
            unset($this->store[$keys[$i]]);
        }
    }
}
