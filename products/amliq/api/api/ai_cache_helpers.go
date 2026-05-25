package api

import (
	"context"

	"github.com/aegis-aml/aegis/internal/ai"
)

// cacheGet wraps ai.CacheLookup so handlers don't need to import
// the internal/ai package directly when they only touch cache.
func cacheGet(c *ai.PromptCache, tenantID, prompt string) (string, bool, string) {
	return ai.CacheLookup(c, context.Background(), tenantID, prompt)
}

// cacheSet writes a successful response to the cache. nil-tolerant.
func cacheSet(c *ai.PromptCache, tenantID, prompt, response string) {
	if c == nil {
		return
	}
	c.Set(c.Key(tenantID, prompt), response)
}
