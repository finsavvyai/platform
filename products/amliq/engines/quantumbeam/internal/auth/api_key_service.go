package auth

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"
	"quantumbeam/internal/interfaces"
	"quantumbeam/internal/models"
)

// APIKeyService implements API key management functionality
type APIKeyService struct {
	db               *gorm.DB
	redisClient      *redis.Client
	rateLimitService interfaces.RateLimitService
}

// APIKeyConfig holds API key service configuration
type APIKeyConfig struct {
	DB               *gorm.DB
	RedisClient      *redis.Client
	RateLimitService interfaces.RateLimitService
}

// NewAPIKeyService creates a new API key service instance
func NewAPIKeyService(config *APIKeyConfig) *APIKeyService {
	return &APIKeyService{
		db:               config.DB,
		redisClient:      config.RedisClient,
		rateLimitService: config.RateLimitService,
	}
}

// GenerateAPIKey creates a new API key for the specified user
func (s *APIKeyService) GenerateAPIKey(ctx context.Context, userID string, tier models.PricingTier, name string) (*interfaces.APIKeyResponse, error) {
	if userID == "" {
		return nil, fmt.Errorf("user ID cannot be empty")
	}

	if name == "" {
		return nil, fmt.Errorf("API key name cannot be empty")
	}

	// Validate pricing tier
	if !isValidPricingTier(tier) {
		return nil, fmt.Errorf("invalid pricing tier: %s", tier)
	}

	// Check if user exists
	var userExists bool
	err := s.db.WithContext(ctx).Model(&models.User{}).
		Select("1").
		Where("user_id = ?", userID).
		Limit(1).
		Find(&userExists).Error
	if err != nil {
		return nil, fmt.Errorf("failed to verify user existence: %w", err)
	}
	if !userExists {
		return nil, fmt.Errorf("user not found: %s", userID)
	}

	// Check API key limit per user (prevent abuse)
	var keyCount int64
	err = s.db.WithContext(ctx).Model(&models.APIKey{}).
		Where("user_id = ? AND is_active = ?", userID, true).
		Count(&keyCount).Error
	if err != nil {
		return nil, fmt.Errorf("failed to count existing API keys: %w", err)
	}

	maxKeys := getMaxAPIKeysForTier(tier)
	if keyCount >= int64(maxKeys) {
		return nil, fmt.Errorf("maximum number of API keys (%d) reached for tier %s", maxKeys, tier)
	}

	// Create new API key
	apiKey := &models.APIKey{
		KeyID:     generateAPIKeyID(),
		UserID:    userID,
		Name:      name,
		UsageTier: tier,
		RateLimit: getRateLimitForTier(tier),
		IsActive:  true,
	}

	// Generate the actual key
	key, err := apiKey.GenerateKey()
	if err != nil {
		return nil, fmt.Errorf("failed to generate API key: %w", err)
	}

	// Save to database
	err = s.db.WithContext(ctx).Create(apiKey).Error
	if err != nil {
		return nil, fmt.Errorf("failed to save API key: %w", err)
	}

	// Cache key data in Redis for faster validation
	err = s.cacheAPIKey(ctx, apiKey)
	if err != nil {
		// Log error but don't fail the operation
		// In production, you'd use proper logging
		fmt.Printf("Warning: failed to cache API key: %v\n", err)
	}

	return &interfaces.APIKeyResponse{
		KeyID:     apiKey.KeyID,
		Key:       key,
		Name:      apiKey.Name,
		UsageTier: apiKey.UsageTier,
		RateLimit: apiKey.RateLimit,
		CreatedAt: apiKey.CreatedAt.Unix(),
		ExpiresAt: nil, // No expiration by default
	}, nil
}

// ValidateAPIKey validates an API key and returns the key data
func (s *APIKeyService) ValidateAPIKey(ctx context.Context, key string) (*models.APIKey, error) {
	if key == "" {
		return nil, fmt.Errorf("API key cannot be empty")
	}

	// Validate key format
	if !isValidAPIKeyFormat(key) {
		return nil, fmt.Errorf("invalid API key format")
	}

	// Hash the key for lookup
	hash := sha256.Sum256([]byte(key))
	keyHash := hex.EncodeToString(hash[:])

	// Try to get from cache first
	apiKey, err := s.getCachedAPIKey(ctx, keyHash)
	if err == nil && apiKey != nil {
		// Validate cached key
		if !apiKey.IsValid() {
			s.removeCachedAPIKey(ctx, keyHash)
			return nil, fmt.Errorf("API key is inactive or expired")
		}

		// Update usage tracking
		go s.trackAPIKeyUsage(context.Background(), apiKey)

		return apiKey, nil
	}

	// Fallback to database lookup
	apiKey = &models.APIKey{}
	err = s.db.WithContext(ctx).
		Where("key_hash = ?", keyHash).
		First(apiKey).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, fmt.Errorf("invalid API key")
		}
		return nil, fmt.Errorf("failed to validate API key: %w", err)
	}

	// Validate key
	if !apiKey.IsValid() {
		return nil, fmt.Errorf("API key is inactive or expired")
	}

	// Cache for future use
	s.cacheAPIKey(ctx, apiKey)

	// Update usage tracking
	go s.trackAPIKeyUsage(context.Background(), apiKey)

	return apiKey, nil
}

// RotateAPIKey generates a new key for an existing API key ID
func (s *APIKeyService) RotateAPIKey(ctx context.Context, keyID string) (*interfaces.APIKeyResponse, error) {
	if keyID == "" {
		return nil, fmt.Errorf("key ID cannot be empty")
	}

	// Get existing API key
	apiKey := &models.APIKey{}
	err := s.db.WithContext(ctx).
		Where("key_id = ?", keyID).
		First(apiKey).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, fmt.Errorf("API key not found")
		}
		return nil, fmt.Errorf("failed to find API key: %w", err)
	}

	// Remove old key from cache
	s.removeCachedAPIKey(ctx, apiKey.KeyHash)

	// Generate new key
	newKey, err := apiKey.GenerateKey()
	if err != nil {
		return nil, fmt.Errorf("failed to generate new API key: %w", err)
	}

	// Update in database
	err = s.db.WithContext(ctx).
		Model(apiKey).
		Updates(map[string]interface{}{
			"key_hash":   apiKey.KeyHash,
			"updated_at": time.Now(),
		}).Error
	if err != nil {
		return nil, fmt.Errorf("failed to update API key: %w", err)
	}

	// Cache new key
	s.cacheAPIKey(ctx, apiKey)

	return &interfaces.APIKeyResponse{
		KeyID:     apiKey.KeyID,
		Key:       newKey,
		Name:      apiKey.Name,
		UsageTier: apiKey.UsageTier,
		RateLimit: apiKey.RateLimit,
		CreatedAt: apiKey.CreatedAt.Unix(),
		ExpiresAt: nil,
	}, nil
}

// RevokeAPIKey deactivates an API key
func (s *APIKeyService) RevokeAPIKey(ctx context.Context, keyID string) error {
	if keyID == "" {
		return fmt.Errorf("key ID cannot be empty")
	}

	// Get API key to remove from cache
	apiKey := &models.APIKey{}
	err := s.db.WithContext(ctx).
		Where("key_id = ?", keyID).
		First(apiKey).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return fmt.Errorf("API key not found")
		}
		return fmt.Errorf("failed to find API key: %w", err)
	}

	// Deactivate in database
	err = s.db.WithContext(ctx).
		Model(&models.APIKey{}).
		Where("key_id = ?", keyID).
		Update("is_active", false).Error
	if err != nil {
		return fmt.Errorf("failed to revoke API key: %w", err)
	}

	// Remove from cache
	s.removeCachedAPIKey(ctx, apiKey.KeyHash)

	return nil
}

// ListAPIKeys returns all API keys for a user
func (s *APIKeyService) ListAPIKeys(ctx context.Context, userID string) ([]*models.APIKey, error) {
	if userID == "" {
		return nil, fmt.Errorf("user ID cannot be empty")
	}

	var apiKeys []*models.APIKey
	err := s.db.WithContext(ctx).
		Where("user_id = ?", userID).
		Order("created_at DESC").
		Find(&apiKeys).Error
	if err != nil {
		return nil, fmt.Errorf("failed to list API keys: %w", err)
	}

	return apiKeys, nil
}

// trackAPIKeyUsage updates usage statistics for an API key
func (s *APIKeyService) trackAPIKeyUsage(ctx context.Context, apiKey *models.APIKey) {
	// Update last used timestamp and increment usage counter
	err := s.db.WithContext(ctx).
		Model(&models.APIKey{}).
		Where("key_id = ?", apiKey.KeyID).
		Updates(map[string]interface{}{
			"last_used":     time.Now(),
			"request_count": gorm.Expr("request_count + 1"),
		}).Error
	if err != nil {
		// Log error but don't fail the request
		fmt.Printf("Warning: failed to track API key usage: %v\n", err)
	}

	// Check rate limiting if service is available
	if s.rateLimitService != nil {
		rateLimitKey := fmt.Sprintf("api_key:%s", apiKey.KeyID)
		result, err := s.rateLimitService.CheckRateLimit(ctx, rateLimitKey, apiKey.RateLimit, 60)
		if err != nil {
			fmt.Printf("Warning: failed to check rate limit: %v\n", err)
		} else if !result.Allowed {
			// In a real implementation, you'd handle rate limit exceeded
			fmt.Printf("Rate limit exceeded for API key: %s\n", apiKey.KeyID)
		}
	}
}

// cacheAPIKey stores API key data in Redis for faster validation
func (s *APIKeyService) cacheAPIKey(ctx context.Context, apiKey *models.APIKey) error {
	if s.redisClient == nil {
		return nil // No caching if Redis is not available
	}

	cacheKey := fmt.Sprintf("api_key:%s", apiKey.KeyHash)

	// Create a simplified version for caching (without sensitive data)
	cacheData := map[string]interface{}{
		"key_id":     apiKey.KeyID,
		"user_id":    apiKey.UserID,
		"name":       apiKey.Name,
		"usage_tier": string(apiKey.UsageTier),
		"rate_limit": apiKey.RateLimit,
		"is_active":  apiKey.IsActive,
		"created_at": apiKey.CreatedAt.Unix(),
	}

	if apiKey.ExpiresAt != nil {
		cacheData["expires_at"] = apiKey.ExpiresAt.Unix()
	}

	// Cache for 1 hour
	err := s.redisClient.HMSet(ctx, cacheKey, cacheData).Err()
	if err != nil {
		return fmt.Errorf("failed to cache API key: %w", err)
	}

	err = s.redisClient.Expire(ctx, cacheKey, time.Hour).Err()
	if err != nil {
		return fmt.Errorf("failed to set cache expiration: %w", err)
	}

	return nil
}

// getCachedAPIKey retrieves API key data from Redis cache
func (s *APIKeyService) getCachedAPIKey(ctx context.Context, keyHash string) (*models.APIKey, error) {
	if s.redisClient == nil {
		return nil, fmt.Errorf("Redis not available")
	}

	cacheKey := fmt.Sprintf("api_key:%s", keyHash)

	data, err := s.redisClient.HGetAll(ctx, cacheKey).Result()
	if err != nil {
		return nil, fmt.Errorf("failed to get cached API key: %w", err)
	}

	if len(data) == 0 {
		return nil, fmt.Errorf("API key not found in cache")
	}

	// Reconstruct API key from cache data
	apiKey := &models.APIKey{
		KeyID:     data["key_id"],
		KeyHash:   keyHash,
		UserID:    data["user_id"],
		Name:      data["name"],
		UsageTier: models.PricingTier(data["usage_tier"]),
		IsActive:  data["is_active"] == "1",
	}

	// Parse numeric fields
	if rateLimitStr, exists := data["rate_limit"]; exists {
		fmt.Sscanf(rateLimitStr, "%d", &apiKey.RateLimit)
	}

	if createdAtStr, exists := data["created_at"]; exists {
		var createdAtUnix int64
		fmt.Sscanf(createdAtStr, "%d", &createdAtUnix)
		apiKey.CreatedAt = time.Unix(createdAtUnix, 0)
	}

	if expiresAtStr, exists := data["expires_at"]; exists && expiresAtStr != "" {
		var expiresAtUnix int64
		fmt.Sscanf(expiresAtStr, "%d", &expiresAtUnix)
		expiresAt := time.Unix(expiresAtUnix, 0)
		apiKey.ExpiresAt = &expiresAt
	}

	return apiKey, nil
}

// removeCachedAPIKey removes API key data from Redis cache
func (s *APIKeyService) removeCachedAPIKey(ctx context.Context, keyHash string) {
	if s.redisClient == nil {
		return
	}

	cacheKey := fmt.Sprintf("api_key:%s", keyHash)
	s.redisClient.Del(ctx, cacheKey)
}

// Helper functions

// generateAPIKeyID generates a unique API key ID
func generateAPIKeyID() string {
	bytes := make([]byte, 8)
	rand.Read(bytes)
	return fmt.Sprintf("key_%s_%d", hex.EncodeToString(bytes), time.Now().Unix())
}

// isValidAPIKeyFormat validates the format of an API key
func isValidAPIKeyFormat(key string) bool {
	// API keys should start with "qb_" and be 67 characters total
	return len(key) == 67 && key[:3] == "qb_"
}

// isValidPricingTier validates if the pricing tier is valid
func isValidPricingTier(tier models.PricingTier) bool {
	switch tier {
	case models.PricingTierDeveloper, models.PricingTierGrowth,
		models.PricingTierScale, models.PricingTierEnterprise:
		return true
	default:
		return false
	}
}

// getRateLimitForTier returns the rate limit for a pricing tier
func getRateLimitForTier(tier models.PricingTier) int {
	switch tier {
	case models.PricingTierDeveloper:
		return 100 // 100 requests per minute
	case models.PricingTierGrowth:
		return 1000 // 1000 requests per minute
	case models.PricingTierScale:
		return 5000 // 5000 requests per minute
	case models.PricingTierEnterprise:
		return 10000 // 10000 requests per minute
	default:
		return 100
	}
}

// getMaxAPIKeysForTier returns the maximum number of API keys allowed per tier
func getMaxAPIKeysForTier(tier models.PricingTier) int {
	switch tier {
	case models.PricingTierDeveloper:
		return 3 // 3 API keys max
	case models.PricingTierGrowth:
		return 10 // 10 API keys max
	case models.PricingTierScale:
		return 25 // 25 API keys max
	case models.PricingTierEnterprise:
		return 100 // 100 API keys max
	default:
		return 3
	}
}
