package api

import (
	"os"
	"strconv"
	"time"

	"github.com/aegis-aml/aegis/internal/ai"
)

// newAIHandlerDeps assembles every dependency the AI endpoints need
// from the global Dependencies struct + env. Cache TTL is configurable
// via AEGIS_AI_CACHE_TTL_SECONDS (default 300 = 5 minutes); 0 disables.
// Cache size via AEGIS_AI_CACHE_MAX_ENTRIES (default 1000).
func newAIHandlerDeps(deps *Dependencies) aiHandlerDeps {
	ttl := envSeconds("AEGIS_AI_CACHE_TTL_SECONDS", 300)
	max := envInt("AEGIS_AI_CACHE_MAX_ENTRIES", 1000)
	return aiHandlerDeps{
		client: newAnthropicSummarizer(),
		audit:  deps.Audit,
		quota:  NewAIQuotaEnforcer(),
		reqLog: deps.AIRequestLog,
		cache:  ai.NewPromptCache(time.Duration(ttl)*time.Second, max),
	}
}

func envSeconds(key string, def int) int { return envInt(key, def) }

func envInt(key string, def int) int {
	v, err := strconv.Atoi(os.Getenv(key))
	if err != nil || v < 0 {
		return def
	}
	return v
}
