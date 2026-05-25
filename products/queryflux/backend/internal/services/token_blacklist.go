package services

import (
	"context"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
)

// TokenBlacklistService manages blacklisted tokens
type TokenBlacklistService struct {
	redisClient *redis.Client
	defaultTTL  time.Duration
}

// NewTokenBlacklistService creates a new token blacklist service
func NewTokenBlacklistService(redisClient *redis.Client) *TokenBlacklistService {
	return &TokenBlacklistService{
		redisClient: redisClient,
		defaultTTL:  24 * time.Hour, // Default blacklist TTL
	}
}

// BlacklistToken adds a token to the blacklist
func (s *TokenBlacklistService) BlacklistToken(ctx context.Context, token string, expiration time.Time) error {
	if token == "" {
		return fmt.Errorf("token cannot be empty")
	}

	// Calculate TTL until token expiration
	ttl := time.Until(expiration)
	if ttl <= 0 {
		// Token already expired, no need to blacklist
		return nil
	}

	// Use default TTL if it's shorter than token expiration
	if ttl > s.defaultTTL {
		ttl = s.defaultTTL
	}

	key := s.getTokenKey(token)
	return s.redisClient.Set(ctx, key, "1", ttl).Err()
}

// IsTokenBlacklisted checks if a token is blacklisted
func (s *TokenBlacklistService) IsTokenBlacklisted(ctx context.Context, token string) (bool, error) {
	if token == "" {
		return false, fmt.Errorf("token cannot be empty")
	}

	key := s.getTokenKey(token)
	exists, err := s.redisClient.Exists(ctx, key).Result()
	if err != nil {
		return false, fmt.Errorf("failed to check token blacklist: %w", err)
	}

	return exists > 0, nil
}

// RemoveFromBlacklist removes a token from the blacklist
func (s *TokenBlacklistService) RemoveFromBlacklist(ctx context.Context, token string) error {
	if token == "" {
		return fmt.Errorf("token cannot be empty")
	}

	key := s.getTokenKey(token)
	return s.redisClient.Del(ctx, key).Err()
}

// BlacklistUserTokens blacklists all tokens for a user
func (s *TokenBlacklistService) BlacklistUserTokens(ctx context.Context, userID string, ttl time.Duration) error {
	if userID == "" {
		return fmt.Errorf("user ID cannot be empty")
	}

	if ttl <= 0 {
		ttl = s.defaultTTL
	}

	key := s.getUserTokensKey(userID)
	return s.redisClient.Set(ctx, key, "1", ttl).Err()
}

// AreUserTokensBlacklisted checks if all tokens for a user are blacklisted
func (s *TokenBlacklistService) AreUserTokensBlacklisted(ctx context.Context, userID string) (bool, error) {
	if userID == "" {
		return false, fmt.Errorf("user ID cannot be empty")
	}

	key := s.getUserTokensKey(userID)
	exists, err := s.redisClient.Exists(ctx, key).Result()
	if err != nil {
		return false, fmt.Errorf("failed to check user blacklist: %w", err)
	}

	return exists > 0, nil
}

// ClearUserBlacklist removes user-level blacklist
func (s *TokenBlacklistService) ClearUserBlacklist(ctx context.Context, userID string) error {
	if userID == "" {
		return fmt.Errorf("user ID cannot be empty")
	}

	key := s.getUserTokensKey(userID)
	return s.redisClient.Del(ctx, key).Err()
}

// getTokenKey generates the Redis key for a token
func (s *TokenBlacklistService) getTokenKey(token string) string {
	return fmt.Sprintf("blacklist:token:%s", token)
}

// getUserTokensKey generates the Redis key for user tokens blacklist
func (s *TokenBlacklistService) getUserTokensKey(userID string) string {
	return fmt.Sprintf("blacklist:user:%s", userID)
}

// GetBlacklistedTokensCount returns the count of blacklisted tokens
func (s *TokenBlacklistService) GetBlacklistedTokensCount(ctx context.Context) (int64, error) {
	var cursor uint64
	count := int64(0)

	pattern := "blacklist:token:*"
	for {
		keys, nextCursor, err := s.redisClient.Scan(ctx, cursor, pattern, 100).Result()
		if err != nil {
			return 0, fmt.Errorf("failed to scan blacklisted tokens: %w", err)
		}

		count += int64(len(keys))
		cursor = nextCursor

		if cursor == 0 {
			break
		}
	}

	return count, nil
}

// CleanupExpiredBlacklists removes expired entries from blacklist
func (s *TokenBlacklistService) CleanupExpiredBlacklists(ctx context.Context) error {
	// Redis automatically handles TTL, so this is a no-op
	// But we can add logging or metrics here if needed
	return nil
}
