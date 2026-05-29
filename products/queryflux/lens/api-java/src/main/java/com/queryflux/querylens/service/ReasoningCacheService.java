package com.queryflux.querylens.service;

import com.queryflux.querylens.dto.NlpQueryResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Caches NL-to-SQL translations so identical natural-language
 * questions return the same SQL without calling the AI model.
 *
 * <p>Cache entries expire after a configurable TTL (default 1 hour).
 * Keys are normalized (lowercased, trimmed, collapsed whitespace)
 * so minor phrasing differences still hit the cache.</p>
 */
@Slf4j
@Service
public class ReasoningCacheService {

    private final Map<String, CacheEntry> cache =
        new ConcurrentHashMap<>();
    private final long ttlMillis;
    private final int maxSize;

    public ReasoningCacheService(
        @Value("${claw.cache.ttl-minutes:60}") long ttlMinutes,
        @Value("${claw.cache.max-size:10000}") int maxSize
    ) {
        this.ttlMillis = ttlMinutes * 60_000;
        this.maxSize = maxSize;
    }

    /**
     * Look up a cached response for the given question + schema key.
     *
     * @param question   Natural-language question
     * @param databaseId Database identifier (scope cache per DB)
     * @return Cached response if present and not expired
     */
    public Optional<NlpQueryResponse> get(
            String question, String databaseId) {
        String key = buildKey(question, databaseId);
        CacheEntry entry = cache.get(key);

        if (entry == null) {
            return Optional.empty();
        }

        if (entry.isExpired(ttlMillis)) {
            cache.remove(key);
            log.debug("Cache expired for key: {}", key);
            return Optional.empty();
        }

        log.info("Cache HIT for question: {}", question);
        return Optional.of(entry.response);
    }

    /**
     * Store an AI-generated response in the cache.
     */
    public void put(String question, String databaseId,
                    NlpQueryResponse response) {
        if (cache.size() >= maxSize) {
            evictExpired();
        }
        if (cache.size() >= maxSize) {
            log.warn("Cache full ({} entries), skipping put", maxSize);
            return;
        }

        String key = buildKey(question, databaseId);
        cache.put(key, new CacheEntry(response, Instant.now()));
        log.debug("Cached response for: {}", question);
    }

    /** Remove all expired entries. */
    public void evictExpired() {
        int before = cache.size();
        cache.entrySet().removeIf(
            e -> e.getValue().isExpired(ttlMillis));
        log.debug("Evicted {} expired entries",
            before - cache.size());
    }

    /** Clear the entire cache. */
    public void clear() {
        cache.clear();
    }

    /** Current cache size (for metrics/tests). */
    public int size() {
        return cache.size();
    }

    /**
     * Build a normalized cache key from question + database ID.
     */
    String buildKey(String question, String databaseId) {
        String normalized = question.trim()
            .toLowerCase(Locale.ROOT)
            .replaceAll("\\s+", " ");
        String db = databaseId != null ? databaseId : "default";
        return db + "::" + normalized;
    }

    private record CacheEntry(
        NlpQueryResponse response,
        Instant createdAt
    ) {
        boolean isExpired(long ttlMillis) {
            return Instant.now().toEpochMilli()
                - createdAt.toEpochMilli() > ttlMillis;
        }
    }
}
