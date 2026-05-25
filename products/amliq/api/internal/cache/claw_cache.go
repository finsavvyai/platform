package cache

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// ClawCache calls the Claw Gateway ReasoningBank for persistent screening cache.
type ClawCache struct {
	baseURL string
	apiKey  string
	client  *http.Client
}

// NewClawCache creates a cache backed by the Claw Gateway ReasoningBank.
func NewClawCache(baseURL, apiKey string) *ClawCache {
	return &ClawCache{
		baseURL: baseURL,
		apiKey:  apiKey,
		client:  &http.Client{Timeout: 5 * time.Second},
	}
}

type clawGetResp struct {
	Result   json.RawMessage `json:"result"`
	CachedAt string          `json:"cached_at"`
	TTL      int             `json:"ttl_seconds"`
}

// Get retrieves a cached result from the Claw ReasoningBank.
func (cc *ClawCache) Get(key ScreeningCacheKey) (*CacheEntry, error) {
	url := cc.baseURL + "/v1/reasoning-bank/" + CacheKeyString(key)
	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("claw get: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+cc.apiKey)

	resp, err := cc.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("claw get: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusNotFound {
		return nil, nil
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("claw get: status %d", resp.StatusCode)
	}
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("claw read: %w", err)
	}
	var cr clawGetResp
	if err := json.Unmarshal(body, &cr); err != nil {
		return nil, fmt.Errorf("claw decode: %w", err)
	}
	cachedAt, _ := time.Parse(time.RFC3339, cr.CachedAt)
	return &CacheEntry{
		Result: cr.Result, CachedAt: cachedAt,
		TTL: time.Duration(cr.TTL) * time.Second,
	}, nil
}

// Set stores a screening result in the Claw ReasoningBank.
func (cc *ClawCache) Set(
	key ScreeningCacheKey, result []byte, ttl time.Duration,
) error {
	payload, _ := json.Marshal(map[string]any{
		"key":         CacheKeyString(key),
		"result":      json.RawMessage(result),
		"ttl_seconds": int(ttl.Seconds()),
	})
	url := cc.baseURL + "/v1/reasoning-bank"
	req, err := http.NewRequest(http.MethodPost, url, bytes.NewReader(payload))
	if err != nil {
		return fmt.Errorf("claw set: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+cc.apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := cc.client.Do(req)
	if err != nil {
		return fmt.Errorf("claw set: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		return fmt.Errorf("claw set: status %d", resp.StatusCode)
	}
	return nil
}
