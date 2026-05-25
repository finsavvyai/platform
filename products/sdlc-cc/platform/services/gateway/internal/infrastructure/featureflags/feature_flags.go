package featureflags

import (
	"context"
	"encoding/json"
	"sync"
	"time"

	"github.com/go-redis/redis/v8"
	"github.com/sirupsen/logrus"
)

// Flag represents a feature flag definition
type Flag struct {
	Name        string            `json:"name"`
	Enabled     bool              `json:"enabled"`
	Description string            `json:"description,omitempty"`
	Rollout     *RolloutConfig    `json:"rollout,omitempty"`
	Conditions  []Condition       `json:"conditions,omitempty"`
	Metadata    map[string]string `json:"metadata,omitempty"`
	UpdatedAt   time.Time         `json:"updated_at"`
}

// RolloutConfig defines gradual rollout parameters
type RolloutConfig struct {
	Percentage float64  `json:"percentage"`
	TenantIDs  []string `json:"tenant_ids,omitempty"`
}

// Condition defines a targeting condition
type Condition struct {
	Attribute string `json:"attribute"`
	Operator  string `json:"operator"`
	Value     string `json:"value"`
}

// EvaluationContext provides context for flag evaluation
type EvaluationContext struct {
	TenantID string
	UserID   string
	Attrs    map[string]string
}

// Manager manages feature flags with Redis-backed storage and local caching
type Manager struct {
	redis      *redis.Client
	logger     *logrus.Logger
	cache      map[string]*Flag
	mu         sync.RWMutex
	prefix     string
	refreshTTL time.Duration
	stopCh     chan struct{}
}

// NewManager creates a new feature flag manager
func NewManager(redisClient *redis.Client, logger *logrus.Logger) *Manager {
	m := &Manager{
		redis:      redisClient,
		logger:     logger,
		cache:      make(map[string]*Flag),
		prefix:     "ff:",
		refreshTTL: 30 * time.Second,
		stopCh:     make(chan struct{}),
	}
	go m.refreshLoop()
	return m
}

// IsEnabled checks if a feature flag is enabled for the given context
func (m *Manager) IsEnabled(ctx context.Context, flagName string, evalCtx *EvaluationContext) bool {
	flag, err := m.getFlag(ctx, flagName)
	if err != nil || flag == nil {
		return false
	}

	if !flag.Enabled {
		return false
	}

	if flag.Rollout != nil {
		return m.evaluateRollout(flag.Rollout, evalCtx)
	}

	if len(flag.Conditions) > 0 {
		return m.evaluateConditions(flag.Conditions, evalCtx)
	}

	return true
}

// SetFlag creates or updates a feature flag
func (m *Manager) SetFlag(ctx context.Context, flag *Flag) error {
	flag.UpdatedAt = time.Now().UTC()
	data, err := json.Marshal(flag)
	if err != nil {
		return err
	}

	if err := m.redis.Set(ctx, m.prefix+flag.Name, data, 0).Err(); err != nil {
		return err
	}

	m.mu.Lock()
	m.cache[flag.Name] = flag
	m.mu.Unlock()

	m.logger.WithFields(logrus.Fields{
		"flag":    flag.Name,
		"enabled": flag.Enabled,
	}).Info("Feature flag updated")

	return nil
}

// DeleteFlag removes a feature flag
func (m *Manager) DeleteFlag(ctx context.Context, flagName string) error {
	if err := m.redis.Del(ctx, m.prefix+flagName).Err(); err != nil {
		return err
	}

	m.mu.Lock()
	delete(m.cache, flagName)
	m.mu.Unlock()

	return nil
}

// ListFlags returns all feature flags
func (m *Manager) ListFlags(ctx context.Context) ([]*Flag, error) {
	keys, err := m.redis.Keys(ctx, m.prefix+"*").Result()
	if err != nil {
		return nil, err
	}

	flags := make([]*Flag, 0, len(keys))
	for _, key := range keys {
		data, err := m.redis.Get(ctx, key).Result()
		if err != nil {
			continue
		}
		var flag Flag
		if err := json.Unmarshal([]byte(data), &flag); err != nil {
			continue
		}
		flags = append(flags, &flag)
	}

	return flags, nil
}

// Stop gracefully shuts down the manager
func (m *Manager) Stop() {
	close(m.stopCh)
}

func (m *Manager) getFlag(ctx context.Context, name string) (*Flag, error) {
	m.mu.RLock()
	if flag, ok := m.cache[name]; ok {
		m.mu.RUnlock()
		return flag, nil
	}
	m.mu.RUnlock()

	data, err := m.redis.Get(ctx, m.prefix+name).Result()
	if err == redis.Nil {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	var flag Flag
	if err := json.Unmarshal([]byte(data), &flag); err != nil {
		return nil, err
	}

	m.mu.Lock()
	m.cache[name] = &flag
	m.mu.Unlock()

	return &flag, nil
}

func (m *Manager) evaluateRollout(rollout *RolloutConfig, evalCtx *EvaluationContext) bool {
	if evalCtx == nil {
		return rollout.Percentage >= 100
	}

	// Check tenant allowlist first
	for _, tid := range rollout.TenantIDs {
		if tid == evalCtx.TenantID {
			return true
		}
	}

	// Simple deterministic hash-based percentage rollout
	if rollout.Percentage > 0 && evalCtx.TenantID != "" {
		hash := fnvHash(evalCtx.TenantID)
		bucket := float64(hash%100) + 1
		return bucket <= rollout.Percentage
	}

	return false
}

func (m *Manager) evaluateConditions(conditions []Condition, evalCtx *EvaluationContext) bool {
	if evalCtx == nil || evalCtx.Attrs == nil {
		return false
	}

	for _, cond := range conditions {
		val, ok := evalCtx.Attrs[cond.Attribute]
		if !ok {
			return false
		}
		switch cond.Operator {
		case "eq":
			if val != cond.Value {
				return false
			}
		case "neq":
			if val == cond.Value {
				return false
			}
		case "contains":
			if len(val) < len(cond.Value) {
				return false
			}
			found := false
			for i := 0; i <= len(val)-len(cond.Value); i++ {
				if val[i:i+len(cond.Value)] == cond.Value {
					found = true
					break
				}
			}
			if !found {
				return false
			}
		default:
			return false
		}
	}

	return true
}

func (m *Manager) refreshLoop() {
	ticker := time.NewTicker(m.refreshTTL)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			m.refreshCache()
		case <-m.stopCh:
			return
		}
	}
}

func (m *Manager) refreshCache() {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	keys, err := m.redis.Keys(ctx, m.prefix+"*").Result()
	if err != nil {
		m.logger.WithError(err).Warn("Failed to refresh feature flag cache")
		return
	}

	newCache := make(map[string]*Flag, len(keys))
	for _, key := range keys {
		data, err := m.redis.Get(ctx, key).Result()
		if err != nil {
			continue
		}
		var flag Flag
		if err := json.Unmarshal([]byte(data), &flag); err != nil {
			continue
		}
		newCache[flag.Name] = &flag
	}

	m.mu.Lock()
	m.cache = newCache
	m.mu.Unlock()
}

func fnvHash(s string) uint32 {
	h := uint32(2166136261)
	for i := 0; i < len(s); i++ {
		h ^= uint32(s[i])
		h *= 16777619
	}
	return h
}
