//go:build legacy_migrated
// +build legacy_migrated

package secrets

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"sync"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/secretsmanager"
	"github.com/aws/aws-sdk-go-v2/service/secretsmanager/types"
)

// AWSSecretsManager handles secret management using AWS Secrets Manager
type AWSSecretsManager struct {
	client   *secretsmanager.Client
	cache    map[string]*SecretCache
	mu       sync.RWMutex
	cacheTTL time.Duration
}

// SecretCache represents a cached secret with expiration
type SecretCache struct {
	Value      string
	Expiry     time.Time
	CreateTime time.Time
}

// SecretMetadata contains metadata about a secret
type SecretMetadata struct {
	Name        string            `json:"name"`
	Description string            `json:"description"`
	Labels      map[string]string `json:"labels,omitempty"`
	CreatedAt   time.Time         `json:"created_at"`
	UpdatedAt   time.Time         `json:"updated_at"`
	VersionID   string            `json:"version_id"`
}

// NewAWSSecretsManager creates a new AWS Secrets Manager client
func NewAWSSecretsManager(ctx context.Context, region string) (*AWSSecretsManager, error) {
	// Load AWS configuration
	cfg, err := config.LoadDefaultConfig(ctx, config.WithRegion(region))
	if err != nil {
		return nil, fmt.Errorf("failed to load AWS configuration: %w", err)
	}

	// Create Secrets Manager client
	client := secretsmanager.NewFromConfig(cfg)

	// Set cache TTL (default 5 minutes)
	cacheTTL := 5 * time.Minute
	if ttl := os.Getenv("SECRETS_CACHE_TTL"); ttl != "" {
		if duration, err := time.ParseDuration(ttl); err == nil {
			cacheTTL = duration
		}
	}

	return &AWSSecretsManager{
		client:   client,
		cache:    make(map[string]*SecretCache),
		cacheTTL: cacheTTL,
	}, nil
}

// GetSecret retrieves a secret value, using cache if available
func (sm *AWSSecretsManager) GetSecret(ctx context.Context, secretName string) (string, error) {
	// Check cache first
	if secret := sm.getCachedSecret(secretName); secret != "" {
		return secret, nil
	}

	// Retrieve from AWS Secrets Manager
	input := &secretsmanager.GetSecretValueInput{
		SecretId: aws.String(secretName),
	}

	result, err := sm.client.GetSecretValue(ctx, input)
	if err != nil {
		// Handle specific error types
		var resourceNotFoundException *types.ResourceNotFoundException
		var invalidRequestException *types.InvalidRequestException
		var invalidParameterException *types.InvalidParameterException

		switch {
		case err.(types.ResourceNotFoundException) != nil:
			return "", fmt.Errorf("secret '%s' not found", secretName)
		case err.(types.InvalidRequestException) != nil:
			return "", fmt.Errorf("invalid request for secret '%s': %w", secretName, err)
		case err.(types.InvalidParameterException) != nil:
			return "", fmt.Errorf("invalid parameter for secret '%s': %w", secretName, err)
		default:
			return "", fmt.Errorf("failed to retrieve secret '%s': %w", secretName, err)
		}
	}

	var secretValue string
	if result.SecretString != nil {
		secretValue = *result.SecretString
	} else if result.SecretBinary != nil {
		secretValue = string(result.SecretBinary)
	} else {
		return "", fmt.Errorf("secret '%s' has no value", secretName)
	}

	// Cache the secret
	sm.setCachedSecret(secretName, secretValue)

	return secretValue, nil
}

// GetSecretJSON retrieves a secret and unmarshals it as JSON
func (sm *AWSSecretsManager) GetSecretJSON(ctx context.Context, secretName string, target interface{}) error {
	secretValue, err := sm.GetSecret(ctx, secretName)
	if err != nil {
		return err
	}

	if err := json.Unmarshal([]byte(secretValue), target); err != nil {
		return fmt.Errorf("failed to unmarshal secret '%s' as JSON: %w", secretName, err)
	}

	return nil
}

// CreateSecret creates a new secret
func (sm *AWSSecretsManager) CreateSecret(ctx context.Context, secretName, description string, secretValue string, tags map[string]string) error {
	// Prepare tags
	var secretTags []types.Tag
	for key, value := range tags {
		secretTags = append(secretTags, types.Tag{
			Key:   aws.String(key),
			Value: aws.String(value),
		})
	}

	input := &secretsmanager.CreateSecretInput{
		Name:         aws.String(secretName),
		Description:  aws.String(description),
		SecretString: aws.String(secretValue),
		Tags:         secretTags,
	}

	_, err := sm.client.CreateSecret(ctx, input)
	if err != nil {
		return fmt.Errorf("failed to create secret '%s': %w", secretName, err)
	}

	// Invalidate cache
	sm.invalidateCache(secretName)

	log.Printf("Secret '%s' created successfully", secretName)
	return nil
}

// UpdateSecret updates an existing secret
func (sm *AWSSecretsManager) UpdateSecret(ctx context.Context, secretName, secretValue string) error {
	input := &secretsmanager.UpdateSecretInput{
		SecretId:     aws.String(secretName),
		SecretString: aws.String(secretValue),
	}

	_, err := sm.client.UpdateSecret(ctx, input)
	if err != nil {
		return fmt.Errorf("failed to update secret '%s': %w", secretName, err)
	}

	// Invalidate cache
	sm.invalidateCache(secretName)

	log.Printf("Secret '%s' updated successfully", secretName)
	return nil
}

// RotateSecret rotates a secret (creates a new version)
func (sm *AWSSecretsManager) RotateSecret(ctx context.Context, secretName string) error {
	input := &secretsmanager.RotateSecretInput{
		SecretId: aws.String(secretName),
	}

	_, err := sm.client.RotateSecret(ctx, input)
	if err != nil {
		return fmt.Errorf("failed to rotate secret '%s': %w", secretName, err)
	}

	// Invalidate cache
	sm.invalidateCache(secretName)

	log.Printf("Secret '%s' rotation initiated", secretName)
	return nil
}

// ListSecrets lists all secrets with optional filtering
func (sm *AWSSecretsManager) ListSecrets(ctx context.Context, filters map[string]string) ([]SecretMetadata, error) {
	input := &secretsmanager.ListSecretsInput{
		MaxResults: aws.Int32(100), // AWS API limit
	}

	// Add filters if provided
	if len(filters) > 0 {
		var filtersList []types.Filter
		for key, value := range filters {
			filtersList = append(filtersList, types.Filter{
				Key:    aws.String(key),
				Values: []string{value},
			})
		}
		input.Filters = filtersList
	}

	var secrets []SecretMetadata
	var nextToken *string

	for {
		if nextToken != nil {
			input.NextToken = nextToken
		}

		result, err := sm.client.ListSecrets(ctx, input)
		if err != nil {
			return nil, fmt.Errorf("failed to list secrets: %w", err)
		}

		for _, secret := range result.SecretList {
			metadata := SecretMetadata{
				Name:        aws.ToString(secret.Name),
				Description: aws.ToString(secret.Description),
				CreatedAt:   aws.ToTime(secret.CreatedDate),
				UpdatedAt:   aws.ToTime(secret.LastChangedDate),
			}

			if secret.Tags != nil {
				metadata.Labels = make(map[string]string)
				for _, tag := range secret.Tags {
					metadata.Labels[aws.ToString(tag.Key)] = aws.ToString(tag.Value)
				}
			}

			if secret.VersionIdsToStages != nil {
				for versionID := range secret.VersionIdsToStages {
					metadata.VersionID = versionID
					break // Get the first version ID
				}
			}

			secrets = append(secrets, metadata)
		}

		if result.NextToken == nil {
			break
		}
		nextToken = result.NextToken
	}

	return secrets, nil
}

// DeleteSecret deletes a secret (with recovery window)
func (sm *AWSSecretsManager) DeleteSecret(ctx context.Context, secretName string, forceDelete bool) error {
	input := &secretsmanager.DeleteSecretInput{
		SecretId: aws.String(secretName),
	}

	if !forceDelete {
		// Use recovery window (default 30 days)
		recoverWindow := int64(30)
		input.RecoveryWindowInDays = &recoverWindow
	} else {
		// Force immediate deletion (no recovery)
		input.ForceDeleteWithoutRecovery = aws.Bool(true)
	}

	_, err := sm.client.DeleteSecret(ctx, input)
	if err != nil {
		return fmt.Errorf("failed to delete secret '%s': %w", secretName, err)
	}

	// Invalidate cache
	sm.invalidateCache(secretName)

	if forceDelete {
		log.Printf("Secret '%s' deleted permanently", secretName)
	} else {
		log.Printf("Secret '%s' scheduled for deletion (30-day recovery window)", secretName)
	}

	return nil
}

// RestoreSecret restores a previously deleted secret
func (sm *AWSSecretsManager) RestoreSecret(ctx context.Context, secretName string) error {
	input := &secretsmanager.RestoreSecretInput{
		SecretId: aws.String(secretName),
	}

	_, err := sm.client.RestoreSecret(ctx, input)
	if err != nil {
		return fmt.Errorf("failed to restore secret '%s': %w", secretName, err)
	}

	log.Printf("Secret '%s' restored successfully", secretName)
	return nil
}

// getCachedSecret retrieves a secret from cache if not expired
func (sm *AWSSecretsManager) getCachedSecret(secretName string) string {
	sm.mu.RLock()
	defer sm.mu.RUnlock()

	if cached, exists := sm.cache[secretName]; exists {
		if time.Now().Before(cached.Expiry) {
			return cached.Value
		}
		// Remove expired entry
		delete(sm.cache, secretName)
	}

	return ""
}

// setCachedSecret stores a secret in cache
func (sm *AWSSecretsManager) setCachedSecret(secretName, value string) {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	sm.cache[secretName] = &SecretCache{
		Value:      value,
		Expiry:     time.Now().Add(sm.cacheTTL),
		CreateTime: time.Now(),
	}
}

// invalidateCache removes a secret from cache
func (sm *AWSSecretsManager) invalidateCache(secretName string) {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	delete(sm.cache, secretName)
}

// ClearCache clears all cached secrets
func (sm *AWSSecretsManager) ClearCache() {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	sm.cache = make(map[string]*SecretCache)
}

// GetCacheInfo returns information about cached secrets
func (sm *AWSSecretsManager) GetCacheInfo() map[string]interface{} {
	sm.mu.RLock()
	defer sm.mu.RUnlock()

	info := make(map[string]interface{})
	info["total_cached"] = len(sm.cache)
	info["cache_ttl"] = sm.cacheTTL.String()

	var cacheDetails []map[string]interface{}
	for name, cached := range sm.cache {
		details := map[string]interface{}{
			"name":         name,
			"created_at":   cached.CreateTime,
			"expires_at":   cached.Expiry,
			"time_to_live": time.Until(cached.Expiry),
		}
		cacheDetails = append(cacheDetails, details)
	}
	info["cache_entries"] = cacheDetails

	return info
}

// HealthCheck performs a health check on the secrets manager
func (sm *AWSSecretsManager) HealthCheck(ctx context.Context) error {
	// Try to list secrets to verify connectivity
	input := &secretsmanager.ListSecretsInput{
		MaxResults: aws.Int32(1),
	}

	_, err := sm.client.ListSecrets(ctx, input)
	if err != nil {
		return fmt.Errorf("secrets manager health check failed: %w", err)
	}

	return nil
}