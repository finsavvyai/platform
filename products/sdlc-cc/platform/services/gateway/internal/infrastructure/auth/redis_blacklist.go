package auth

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"
	"github.com/sirupsen/logrus"
)

// BlacklistEntry represents a blacklisted token entry
type BlacklistEntry struct {
	TokenID   string            `json:"token_id"`
	ExpiresAt time.Time         `json:"expires_at"`
	RevokedAt time.Time         `json:"revoked_at"`
	Reason    string            `json:"reason,omitempty"`
	RevokedBy string            `json:"revoked_by,omitempty"`
	IPAddress string            `json:"ip_address,omitempty"`
	UserAgent string            `json:"user_agent,omitempty"`
	Metadata  map[string]string `json:"metadata,omitempty"`
}

// BlacklistService interface for token blacklisting
type BlacklistService interface {
	AddToBlacklist(ctx context.Context, tokenID string, expiresAt time.Time) error
	IsBlacklisted(ctx context.Context, tokenID string) (bool, error)
	RemoveFromBlacklist(ctx context.Context, tokenID string) error
	CleanupExpired(ctx context.Context) error
}

// RedisBlacklistService implements the BlacklistService interface using Redis
type RedisBlacklistService struct {
	redisClient   redis.Cmdable
	keyPrefix     string
	logger        *logrus.Logger
	cleanupTicker *time.Ticker
}

// NewRedisBlacklistService creates a new Redis-based blacklist service
func NewRedisBlacklistService(redisClient redis.Cmdable, keyPrefix string, logger *logrus.Logger) *RedisBlacklistService {
	if logger == nil {
		logger = logrus.New()
	}

	if keyPrefix == "" {
		keyPrefix = "jwt_blacklist:"
	}

	service := &RedisBlacklistService{
		redisClient: redisClient,
		keyPrefix:   keyPrefix,
		logger:      logger,
	}

	// Start cleanup goroutine
	service.startCleanupRoutine()

	return service
}

// AddToBlacklist adds a token to the blacklist
func (r *RedisBlacklistService) AddToBlacklist(ctx context.Context, tokenID string, expiresAt time.Time) error {
	return r.AddToBlacklistWithReason(ctx, tokenID, expiresAt, "manual_revocation", "", "", "", nil)
}

// AddToBlacklistWithReason adds a token to the blacklist with additional metadata
func (r *RedisBlacklistService) AddToBlacklistWithReason(
	ctx context.Context,
	tokenID string,
	expiresAt time.Time,
	reason, revokedBy, ipAddress, userAgent string,
	metadata map[string]string,
) error {
	entry := BlacklistEntry{
		TokenID:   tokenID,
		ExpiresAt: expiresAt,
		RevokedAt: time.Now(),
		Reason:    reason,
		RevokedBy: revokedBy,
		IPAddress: ipAddress,
		UserAgent: userAgent,
		Metadata:  metadata,
	}

	entryJSON, err := json.Marshal(entry)
	if err != nil {
		r.logger.WithError(err).WithField("token_id", tokenID).Error("Failed to marshal blacklist entry")
		return fmt.Errorf("failed to marshal blacklist entry: %w", err)
	}

	key := r.getKey(tokenID)

	// Store with TTL to auto-cleanup expired entries
	ttl := time.Until(expiresAt)
	if ttl <= 0 {
		ttl = time.Minute // Minimum TTL for immediate revocation
	}

	err = r.redisClient.Set(ctx, key, entryJSON, ttl).Err()
	if err != nil {
		r.logger.WithError(err).WithField("token_id", tokenID).Error("Failed to add token to blacklist")
		return fmt.Errorf("failed to add token to blacklist: %w", err)
	}

	r.logger.WithFields(logrus.Fields{
		"token_id":   tokenID,
		"reason":     reason,
		"revoked_by": revokedBy,
		"expires_at": expiresAt,
	}).Info("Token added to blacklist")

	return nil
}

// IsBlacklisted checks if a token is blacklisted
func (r *RedisBlacklistService) IsBlacklisted(ctx context.Context, tokenID string) (bool, error) {
	key := r.getKey(tokenID)

	result, err := r.redisClient.Get(ctx, key).Result()
	if err != nil {
		if err == redis.Nil {
			return false, nil
		}
		r.logger.WithError(err).WithField("token_id", tokenID).Error("Failed to check blacklist status")
		return false, fmt.Errorf("failed to check blacklist status: %w", err)
	}

	var entry BlacklistEntry
	err = json.Unmarshal([]byte(result), &entry)
	if err != nil {
		r.logger.WithError(err).WithField("token_id", tokenID).Error("Failed to unmarshal blacklist entry")
		return false, fmt.Errorf("failed to unmarshal blacklist entry: %w", err)
	}

	// Additional check for expired entries (in case TTL didn't work)
	if time.Now().After(entry.ExpiresAt) {
		// Clean up expired entry; failure is non-fatal (TTL will eventually evict).
		if rmErr := r.RemoveFromBlacklist(ctx, tokenID); rmErr != nil {
			r.logger.WithError(rmErr).WithField("token_id", tokenID).Warn("Failed to remove expired blacklist entry")
		}
		return false, nil
	}

	return true, nil
}

// RemoveFromBlacklist removes a token from the blacklist
func (r *RedisBlacklistService) RemoveFromBlacklist(ctx context.Context, tokenID string) error {
	key := r.getKey(tokenID)

	err := r.redisClient.Del(ctx, key).Err()
	if err != nil {
		r.logger.WithError(err).WithField("token_id", tokenID).Error("Failed to remove token from blacklist")
		return fmt.Errorf("failed to remove token from blacklist: %w", err)
	}

	r.logger.WithField("token_id", tokenID).Info("Token removed from blacklist")
	return nil
}

// CleanupExpired removes expired entries from the blacklist
func (r *RedisBlacklistService) CleanupExpired(ctx context.Context) error {
	pattern := r.keyPrefix + "*"

	iter := r.redisClient.Scan(ctx, 0, pattern, 100).Iterator()

	cleaned := 0
	for iter.Next(ctx) {
		key := iter.Val()

		result, err := r.redisClient.Get(ctx, key).Result()
		if err != nil {
			if err != redis.Nil {
				r.logger.WithError(err).WithField("key", key).Warn("Failed to get blacklist entry during cleanup")
			}
			continue
		}

		var entry BlacklistEntry
		err = json.Unmarshal([]byte(result), &entry)
		if err != nil {
			r.logger.WithError(err).WithField("key", key).Warn("Failed to unmarshal blacklist entry during cleanup")
			// Remove malformed entry
			r.redisClient.Del(ctx, key)
			cleaned++
			continue
		}

		// Check if entry is expired
		if time.Now().After(entry.ExpiresAt) {
			err = r.redisClient.Del(ctx, key).Err()
			if err != nil {
				r.logger.WithError(err).WithField("token_id", entry.TokenID).Warn("Failed to remove expired blacklist entry")
			} else {
				cleaned++
			}
		}
	}

	if err := iter.Err(); err != nil {
		r.logger.WithError(err).Error("Iterator error during cleanup")
		return fmt.Errorf("iterator error during cleanup: %w", err)
	}

	if cleaned > 0 {
		r.logger.WithField("cleaned_count", cleaned).Info("Cleaned up expired blacklist entries")
	}

	return nil
}

// Helper methods

func (r *RedisBlacklistService) getKey(tokenID string) string {
	return r.keyPrefix + tokenID
}

func (r *RedisBlacklistService) startCleanupRoutine() {
	// Run cleanup every hour
	r.cleanupTicker = time.NewTicker(time.Hour)

	go func() {
		ctx := context.Background()
		for range r.cleanupTicker.C {
			err := r.CleanupExpired(ctx)
			if err != nil {
				r.logger.WithError(err).Error("Failed to cleanup expired blacklist entries")
			}
		}
	}()
}

// Stop stops the cleanup routine
func (r *RedisBlacklistService) Stop() {
	if r.cleanupTicker != nil {
		r.cleanupTicker.Stop()
	}
}

// InMemoryBlacklistService implements the BlacklistService interface using in-memory storage
// This is useful for testing or small-scale deployments
type InMemoryBlacklistService struct {
	entries map[string]*BlacklistEntry
	mutex   sync.RWMutex
	logger  *logrus.Logger
}

// NewInMemoryBlacklistService creates a new in-memory blacklist service
func NewInMemoryBlacklistService(logger *logrus.Logger) *InMemoryBlacklistService {
	if logger == nil {
		logger = logrus.New()
	}

	service := &InMemoryBlacklistService{
		entries: make(map[string]*BlacklistEntry),
		logger:  logger,
	}

	// Start cleanup goroutine
	service.startCleanupRoutine()

	return service
}

// AddToBlacklist adds a token to the blacklist
func (m *InMemoryBlacklistService) AddToBlacklist(ctx context.Context, tokenID string, expiresAt time.Time) error {
	m.mutex.Lock()
	defer m.mutex.Unlock()

	entry := &BlacklistEntry{
		TokenID:   tokenID,
		ExpiresAt: expiresAt,
		RevokedAt: time.Now(),
		Reason:    "manual_revocation",
	}

	m.entries[tokenID] = entry

	m.logger.WithFields(logrus.Fields{
		"token_id":   tokenID,
		"expires_at": expiresAt,
	}).Info("Token added to in-memory blacklist")

	return nil
}

// IsBlacklisted checks if a token is blacklisted
func (m *InMemoryBlacklistService) IsBlacklisted(ctx context.Context, tokenID string) (bool, error) {
	m.mutex.RLock()
	defer m.mutex.RUnlock()

	entry, exists := m.entries[tokenID]
	if !exists {
		return false, nil
	}

	// Check if entry is expired
	if time.Now().After(entry.ExpiresAt) {
		delete(m.entries, tokenID)
		return false, nil
	}

	return true, nil
}

// RemoveFromBlacklist removes a token from the blacklist
func (m *InMemoryBlacklistService) RemoveFromBlacklist(ctx context.Context, tokenID string) error {
	m.mutex.Lock()
	defer m.mutex.Unlock()

	delete(m.entries, tokenID)

	m.logger.WithField("token_id", tokenID).Info("Token removed from in-memory blacklist")

	return nil
}

// CleanupExpired removes expired entries from the blacklist
func (m *InMemoryBlacklistService) CleanupExpired(ctx context.Context) error {
	m.mutex.Lock()
	defer m.mutex.Unlock()

	now := time.Now()
	cleaned := 0

	for tokenID, entry := range m.entries {
		if now.After(entry.ExpiresAt) {
			delete(m.entries, tokenID)
			cleaned++
		}
	}

	if cleaned > 0 {
		m.logger.WithField("cleaned_count", cleaned).Info("Cleaned up expired in-memory blacklist entries")
	}

	return nil
}

func (m *InMemoryBlacklistService) startCleanupRoutine() {
	// Run cleanup every 5 minutes
	ticker := time.NewTicker(5 * time.Minute)

	go func() {
		ctx := context.Background()
		for range ticker.C {
			err := m.CleanupExpired(ctx)
			if err != nil {
				m.logger.WithError(err).Error("Failed to cleanup expired in-memory blacklist entries")
			}
		}
	}()
}

// Stop stops the cleanup routine
func (m *InMemoryBlacklistService) Stop() {
	// No ticker to stop for in-memory service
}
