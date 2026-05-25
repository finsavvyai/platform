package cache

import (
	"context"
	"time"
)

// evictLocked drops every expired entry; if still over cap, drops
// up to 10% of remaining at random (Go map iteration order). Caller
// must hold the lock.
func (c *PromptCache) evictLocked() {
	now := time.Now()
	for k, v := range c.entries {
		if now.After(v.ExpiresAt) {
			delete(c.entries, k)
		}
	}
	if len(c.entries) < c.maxSize {
		return
	}
	target := len(c.entries) / 10
	for k := range c.entries {
		if target == 0 {
			break
		}
		delete(c.entries, k)
		target--
	}
}

// CacheLookup is the handler-side helper. Returns (cachedResponse,
// hit, key). On a miss, the returned key is what to call Set with
// after a successful provider call.
func CacheLookup(c *PromptCache, _ context.Context, tenantID, prompt string) (string, bool, string) {
	if c == nil {
		return "", false, ""
	}
	k := c.Key(tenantID, prompt)
	resp, ok := c.Get(k)
	return resp, ok, k
}
