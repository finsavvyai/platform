package com.queryflux.querylens.service;

import com.queryflux.querylens.dto.NlpQueryResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

class ReasoningCacheServiceTest {

    private ReasoningCacheService service;

    @BeforeEach
    void setUp() {
        service = new ReasoningCacheService(60, 100);
    }

    @Test
    void shouldReturnEmptyOnCacheMiss() {
        Optional<NlpQueryResponse> result =
            service.get("unknown question", "db1");
        assertThat(result).isEmpty();
    }

    @Test
    void shouldReturnCachedResponse() {
        NlpQueryResponse response = NlpQueryResponse.builder()
            .sql("SELECT * FROM users")
            .confidence(0.9)
            .explanation("test")
            .build();

        service.put("show me all users", "db1", response);

        Optional<NlpQueryResponse> cached =
            service.get("show me all users", "db1");
        assertThat(cached).isPresent();
        assertThat(cached.get().getSql())
            .isEqualTo("SELECT * FROM users");
    }

    @Test
    void shouldNormalizeQuestionForCacheKey() {
        NlpQueryResponse response = NlpQueryResponse.builder()
            .sql("SELECT COUNT(*) FROM orders")
            .confidence(0.9)
            .explanation("test")
            .build();

        service.put("  Show me ALL users  ", "db1", response);

        // Same question with different casing/spacing should hit
        Optional<NlpQueryResponse> cached =
            service.get("show me all users", "db1");
        assertThat(cached).isPresent();
    }

    @Test
    void shouldScopeCacheByDatabaseId() {
        NlpQueryResponse resp1 = NlpQueryResponse.builder()
            .sql("SELECT * FROM users")
            .confidence(0.9)
            .explanation("db1")
            .build();

        service.put("show users", "db1", resp1);

        // Different database ID should miss
        Optional<NlpQueryResponse> cached =
            service.get("show users", "db2");
        assertThat(cached).isEmpty();

        // Same database ID should hit
        cached = service.get("show users", "db1");
        assertThat(cached).isPresent();
    }

    @Test
    void shouldHandleNullDatabaseId() {
        NlpQueryResponse response = NlpQueryResponse.builder()
            .sql("SELECT 1")
            .confidence(1.0)
            .explanation("test")
            .build();

        service.put("test query", null, response);
        Optional<NlpQueryResponse> cached =
            service.get("test query", null);
        assertThat(cached).isPresent();
    }

    @Test
    void shouldTrackCacheSize() {
        assertThat(service.size()).isZero();

        service.put("q1", "db", response("sql1"));
        assertThat(service.size()).isEqualTo(1);

        service.put("q2", "db", response("sql2"));
        assertThat(service.size()).isEqualTo(2);
    }

    @Test
    void shouldClearCache() {
        service.put("q1", "db", response("sql1"));
        service.put("q2", "db", response("sql2"));
        assertThat(service.size()).isEqualTo(2);

        service.clear();
        assertThat(service.size()).isZero();
    }

    @Test
    void shouldNotExceedMaxSize() {
        ReasoningCacheService small =
            new ReasoningCacheService(60, 3);

        small.put("q1", "db", response("sql1"));
        small.put("q2", "db", response("sql2"));
        small.put("q3", "db", response("sql3"));
        assertThat(small.size()).isEqualTo(3);

        // 4th entry should be skipped (no expired entries)
        small.put("q4", "db", response("sql4"));
        assertThat(small.size()).isEqualTo(3);
    }

    @Test
    void shouldExpireOldEntries() throws InterruptedException {
        // TTL of 0 minutes = immediate expiry is race-prone,
        // so we use a very short TTL and wait briefly.
        // Instead, test eviction by verifying expired entries
        // are removed on next get().
        ReasoningCacheService expiring =
            new ReasoningCacheService(0, 100);

        expiring.put("q1", "db", response("sql1"));
        // TTL is 0 ms, so entry is expired at next millisecond
        Thread.sleep(1);
        Optional<NlpQueryResponse> cached =
            expiring.get("q1", "db");
        assertThat(cached).isEmpty();
    }

    @Test
    void shouldBuildNormalizedKey() {
        String key1 = service.buildKey("  Show Me Users  ", "db1");
        String key2 = service.buildKey("show me users", "db1");
        assertThat(key1).isEqualTo(key2);
    }

    @Test
    void shouldBuildKeyWithDefaultDb() {
        String key = service.buildKey("test", null);
        assertThat(key).startsWith("default::");
    }

    private NlpQueryResponse response(String sql) {
        return NlpQueryResponse.builder()
            .sql(sql)
            .confidence(0.9)
            .explanation("test")
            .build();
    }
}
