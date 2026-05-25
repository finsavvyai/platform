package llm

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/SDLC/llm-gateway/pkg/models"
	"github.com/sirupsen/logrus"
)

// DefaultCacheTTL is the default time-to-live for cached responses (24h).
const DefaultCacheTTL = 86400 * time.Second

// CacheStore abstracts the KV backend (Redis, in-memory, Cloudflare KV, etc.).
type CacheStore interface {
	Get(ctx context.Context, key string) (string, error)
	Put(ctx context.Context, key string, value string, ttl time.Duration) error
}

// ReasoningBank provides prompt-level caching for LLM completions.
// Cache key = SHA-256(provider + systemPrompt + userMessage).
type ReasoningBank struct {
	store  CacheStore
	ttl    time.Duration
	logger *logrus.Logger
}

// NewReasoningBank creates a ReasoningBank with the given store and TTL.
// If ttl is 0, DefaultCacheTTL is used.
func NewReasoningBank(store CacheStore, ttl time.Duration, logger *logrus.Logger) *ReasoningBank {
	if ttl <= 0 {
		ttl = DefaultCacheTTL
	}
	return &ReasoningBank{store: store, ttl: ttl, logger: logger}
}

// IsEnabled checks the REASONING_BANK_ENABLED env var (default true).
func IsEnabled() bool {
	v := os.Getenv("REASONING_BANK_ENABLED")
	if v == "" {
		return true
	}
	return strings.EqualFold(v, "true") || v == "1"
}

// BuildCacheKey returns a SHA-256 hex digest of (provider, systemPrompt, userMessage).
func BuildCacheKey(provider, systemPrompt, userMessage string) string {
	h := sha256.New()
	h.Write([]byte(provider))
	h.Write([]byte("\x00"))
	h.Write([]byte(systemPrompt))
	h.Write([]byte("\x00"))
	h.Write([]byte(userMessage))
	return fmt.Sprintf("rb:%x", h.Sum(nil))
}

// CheckCache looks up a cached response. Returns nil if not found or on error.
func (rb *ReasoningBank) CheckCache(ctx context.Context, key string) *models.CompletionResponse {
	raw, err := rb.store.Get(ctx, key)
	if err != nil || raw == "" {
		return nil
	}
	var resp models.CompletionResponse
	if err := json.Unmarshal([]byte(raw), &resp); err != nil {
		rb.logger.WithError(err).Warn("ReasoningBank: failed to unmarshal cached response")
		return nil
	}
	return &resp
}

// StoreInCache saves a completion response with the configured TTL.
func (rb *ReasoningBank) StoreInCache(ctx context.Context, key string, resp *models.CompletionResponse) {
	data, err := json.Marshal(resp)
	if err != nil {
		rb.logger.WithError(err).Warn("ReasoningBank: failed to marshal response for cache")
		return
	}
	if err := rb.store.Put(ctx, key, string(data), rb.ttl); err != nil {
		rb.logger.WithError(err).Warn("ReasoningBank: failed to store response in cache")
	}
}

// extractPromptsFromRequest pulls the system prompt and last user message from a
// CompletionRequest for cache-key generation.
func extractPromptsFromRequest(req *models.CompletionRequest) (systemPrompt, userMessage string) {
	for _, m := range req.Messages {
		if m.Role == "system" {
			systemPrompt = m.Content
		}
	}
	// Use the last user message as the cache discriminator.
	for i := len(req.Messages) - 1; i >= 0; i-- {
		if req.Messages[i].Role == "user" {
			userMessage = req.Messages[i].Content
			break
		}
	}
	return
}
