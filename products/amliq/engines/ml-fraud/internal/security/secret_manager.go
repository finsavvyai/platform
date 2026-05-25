package security

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/secretsmanager"
	"github.com/aws/aws-sdk-go-v2/service/secretsmanager/types"
)

// SecretManager handles secure secret management and rotation
type SecretManager struct {
	client        *secretsmanager.Client
	logger        *log.Logger
	kmsKeyID      string
	encryptionKey []byte
}

// Secret represents a secret in the system
type Secret struct {
	ID           string            `json:"id"`
	Name         string            `json:"name"`
	Value        []byte            `json:"-"` // Never exposed
	Type         SecretType        `json:"type"`
	Description  string            `json:"description"`
	Environment  string            `json:"environment"`
	Version      int               `json:"version"`
	RotationDays int               `json:"rotation_days"`
	LastRotated  time.Time         `json:"last_rotated"`
	NextRotation time.Time         `json:"next_rotation"`
	CreatedAt    time.Time         `json:"created_at"`
	UpdatedAt    time.Time         `json:"updated_at"`
	Tags         map[string]string `json:"tags"`
	Enabled      bool              `json:"enabled"`
}

// SecretType represents the type of secret
type SecretType string

const (
	SecretTypeAPIKey      SecretType = "API_KEY"
	SecretTypePassword    SecretType = "PASSWORD"
	SecretTypeCertificate SecretType = "CERTIFICATE"
	SecretTypeDatabase    SecretType = "DATABASE"
	SecretTypeSSHKey      SecretType = "SSH_KEY"
	SecretTypeOAuth       SecretType = "OAUTH"
	SecretTypeToken       SecretType = "TOKEN"
)

// SecretMetadata represents metadata about a secret
type SecretMetadata struct {
	ID           string            `json:"id"`
	Name         string            `json:"name"`
	Type         SecretType        `json:"type"`
	Description  string            `json:"description"`
	Environment  string            `json:"environment"`
	Version      int               `json:"version"`
	CreatedAt    time.Time         `json:"created_at"`
	LastRotated  time.Time         `json:"last_rotated"`
	NextRotation time.Time         `json:"next_rotation"`
	Tags         map[string]string `json:"tags"`
}

// RotationConfig defines configuration for secret rotation
type RotationConfig struct {
	Enabled      bool               `json:"enabled"`
	Schedule     RotationSchedule   `json:"schedule"`
	Notification NotificationConfig `json:"notification"`
	PreRotation  []string           `json:"pre_rotation_hooks"`
	PostRotation []string           `json:"post_rotation_hooks"`
}

// RotationSchedule defines the rotation schedule
type RotationSchedule struct {
	Type     string        `json:"type"` // CRON, INTERVAL
	Value    string        `json:"value"`
	Duration time.Duration `json:"duration"`
}

// NotificationConfig defines notification configuration
type NotificationConfig struct {
	Channels   []string `json:"channels"` // EMAIL, SLACK, WEBHOOK
	Template   string   `json:"template"`
	Recipients []string `json:"recipients"`
}

// NewSecretManager creates a new secret manager
func NewSecretManager(region string, kmsKeyID string) (*SecretManager, error) {
	cfg, err := config.LoadDefaultConfig(context.TODO(), config.WithRegion(region))
	if err != nil {
		return nil, fmt.Errorf("failed to load AWS config: %w", err)
	}

	client := secretsmanager.NewFromConfig(cfg)

	// Generate encryption key for local encryption
	encryptionKey := make([]byte, 32)
	if _, err := rand.Read(encryptionKey); err != nil {
		return nil, fmt.Errorf("failed to generate encryption key: %w", err)
	}

	return &SecretManager{
		client:        client,
		logger:        log.New(log.Writer(), "[SECRET-MANAGER] ", log.LstdFlags|log.Lmsgprefix),
		kmsKeyID:      kmsKeyID,
		encryptionKey: encryptionKey,
	}, nil
}

// StoreSecret stores a secret in AWS Secrets Manager
func (sm *SecretManager) StoreSecret(key string, value []byte, metadata map[string]string) error {
	ctx := context.Background()

	// Encrypt the value locally before storing
	encryptedValue, err := sm.encryptValue(value)
	if err != nil {
		return fmt.Errorf("failed to encrypt secret value: %w", err)
	}

	// Parse metadata
	secretType := SecretType(metadata["type"])
	environment := metadata["environment"]
	description := metadata["description"]
	rotationDays := 30 // Default

	if days, ok := metadata["rotation_days"]; ok {
		_, err := fmt.Sscanf(days, "%d", &rotationDays)
		if err != nil {
			rotationDays = 30
		}
	}

	// Calculate next rotation time
	nextRotation := time.Now().AddDate(0, 0, rotationDays)

	// Prepare secret string with metadata
	secretString := sm.prepareSecretString(encryptedValue, metadata)

	// Store in AWS Secrets Manager
	input := &secretsmanager.CreateSecretInput{
		Name:         aws.String(key),
		SecretString: aws.String(secretString),
		Description:  aws.String(description),
		KmsKeyId:     aws.String(sm.kmsKeyID),
		Tags: []types.Tag{
			{
				Key:   aws.String("Type"),
				Value: aws.String(string(secretType)),
			},
			{
				Key:   aws.String("Environment"),
				Value: aws.String(environment),
			},
			{
				Key:   aws.String("RotationDays"),
				Value: aws.String(fmt.Sprintf("%d", rotationDays)),
			},
			{
				Key:   aws.String("NextRotation"),
				Value: aws.String(nextRotation.Format(time.RFC3339)),
			},
		},
	}

	// Add custom tags
	for k, v := range metadata {
		if k != "type" && k != "environment" && k != "rotation_days" {
			input.Tags = append(input.Tags, types.Tag{
				Key:   aws.String(k),
				Value: aws.String(v),
			})
		}
	}

	_, err = sm.client.CreateSecret(ctx, input)
	if err != nil {
		return fmt.Errorf("failed to create secret: %w", err)
	}

	sm.logger.Printf("Successfully stored secret: %s", key)
	return nil
}

// RetrieveSecret retrieves a secret from AWS Secrets Manager
func (sm *SecretManager) RetrieveSecret(key string) ([]byte, error) {
	ctx := context.Background()

	input := &secretsmanager.GetSecretValueInput{
		SecretId: aws.String(key),
	}

	result, err := sm.client.GetSecretValue(ctx, input)
	if err != nil {
		return nil, fmt.Errorf("failed to retrieve secret: %w", err)
	}

	// Parse the secret string to extract encrypted value
	secretString := *result.SecretString
	encryptedValue, err := sm.parseSecretString(secretString)
	if err != nil {
		return nil, fmt.Errorf("failed to parse secret string: %w", err)
	}

	// Decrypt the value
	value, err := sm.decryptValue(encryptedValue)
	if err != nil {
		return nil, fmt.Errorf("failed to decrypt secret value: %w", err)
	}

	sm.logger.Printf("Successfully retrieved secret: %s", key)
	return value, nil
}

// RotateSecret rotates a secret
func (sm *SecretManager) RotateSecret(key string) error {
	ctx := context.Background()

	// Get current secret value
	currentValue, err := sm.RetrieveSecret(key)
	if err != nil {
		return fmt.Errorf("failed to get current secret value: %w", err)
	}

	// Generate new secret value based on type
	newValue, err := sm.generateNewSecretValue(key, currentValue)
	if err != nil {
		return fmt.Errorf("failed to generate new secret value: %w", err)
	}

	// Store new version
	input := &secretsmanager.UpdateSecretInput{
		SecretId:     aws.String(key),
		SecretString: aws.String(string(newValue)),
	}

	_, err = sm.client.UpdateSecret(ctx, input)
	if err != nil {
		return fmt.Errorf("failed to update secret: %w", err)
	}

	sm.logger.Printf("Successfully rotated secret: %s", key)
	return nil
}

// ListSecrets lists all secrets with optional prefix filtering
func (sm *SecretManager) ListSecrets(prefix string) ([]SecretMetadata, error) {
	ctx := context.Background()

	input := &secretsmanager.ListSecretsInput{
		Filters: []types.Filter{
			{
				Key:    types.FilterNameStringTypeName,
				Values: []string{prefix + "*"},
			},
		},
	}

	result, err := sm.client.ListSecrets(ctx, input)
	if err != nil {
		return nil, fmt.Errorf("failed to list secrets: %w", err)
	}

	var secrets []SecretMetadata
	for _, secretListEntry := range result.SecretList {
		metadata := sm.extractSecretMetadata(secretListEntry)
		secrets = append(secrets, metadata)
	}

	return secrets, nil
}

// DeleteSecret deletes a secret
func (sm *SecretManager) DeleteSecret(key string) error {
	ctx := context.Background()

	input := &secretsmanager.DeleteSecretInput{
		SecretId:             aws.String(key),
		RecoveryWindowInDays: aws.Int64(7), // 7-day recovery window
	}

	_, err := sm.client.DeleteSecret(ctx, input)
	if err != nil {
		return fmt.Errorf("failed to delete secret: %w", err)
	}

	sm.logger.Printf("Successfully deleted secret: %s", key)
	return nil
}

// encryptValue encrypts a value using AES-GCM
func (sm *SecretManager) encryptValue(value []byte) ([]byte, error) {
	block, err := aes.NewCipher(sm.encryptionKey)
	if err != nil {
		return nil, err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}

	nonce := make([]byte, gcm.NonceSize())
	if _, err = rand.Read(nonce); err != nil {
		return nil, err
	}

	ciphertext := gcm.Seal(nonce, nonce, value, nil)
	return ciphertext, nil
}

// decryptValue decrypts a value using AES-GCM
func (sm *SecretManager) decryptValue(encryptedValue []byte) ([]byte, error) {
	block, err := aes.NewCipher(sm.encryptionKey)
	if err != nil {
		return nil, err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}

	nonceSize := gcm.NonceSize()
	if len(encryptedValue) < nonceSize {
		return nil, errors.New("encrypted value too short")
	}

	nonce, ciphertext := encryptedValue[:nonceSize], encryptedValue[nonceSize:]
	return gcm.Open(nil, nonce, ciphertext, nil)
}

// prepareSecretString prepares the secret string for storage
func (sm *SecretManager) prepareSecretString(encryptedValue []byte, metadata map[string]string) string {
	// Encode encrypted value as base64
	encodedValue := base64.StdEncoding.EncodeToString(encryptedValue)

	// Add metadata
	secretString := fmt.Sprintf("version=1\n")
	secretString += fmt.Sprintf("encrypted=true\n")
	secretString += fmt.Sprintf("value=%s\n", encodedValue)

	for k, v := range metadata {
		secretString += fmt.Sprintf("%s=%s\n", k, v)
	}

	return secretString
}

// parseSecretString parses the secret string to extract encrypted value
func (sm *SecretManager) parseSecretString(secretString string) ([]byte, error) {
	lines := strings.Split(secretString, "\n")
	var encodedValue string

	for _, line := range lines {
		if strings.HasPrefix(line, "value=") {
			encodedValue = strings.TrimPrefix(line, "value=")
			break
		}
	}

	if encodedValue == "" {
		return nil, errors.New("no value found in secret string")
	}

	return base64.StdEncoding.DecodeString(encodedValue)
}

// generateNewSecretValue generates a new secret value based on the current type
func (sm *SecretManager) generateNewSecretValue(key string, currentValue []byte) ([]byte, error) {
	// This would implement different generation strategies based on secret type
	// For now, generate a random API key as an example
	randomBytes := make([]byte, 32)
	if _, err := rand.Read(randomBytes); err != nil {
		return nil, err
	}

	return []byte(base64.URLEncoding.EncodeToString(randomBytes)), nil
}

// extractSecretMetadata extracts metadata from AWS Secrets Manager response
func (sm *SecretManager) extractSecretMetadata(secretListEntry types.SecretListEntry) SecretMetadata {
	metadata := SecretMetadata{
		ID:          *secretListEntry.ARN,
		Name:        *secretListEntry.Name,
		Description: aws.ToString(secretListEntry.Description),
		Version:     1, // Default version
		CreatedAt:   aws.ToTime(secretListEntry.CreatedDate),
	}

	// Extract tags
	for _, tag := range secretListEntry.Tags {
		switch *tag.Key {
		case "Type":
			metadata.Type = SecretType(*tag.Value)
		case "Environment":
			metadata.Environment = *tag.Value
		case "LastRotated":
			if parsedTime, err := time.Parse(time.RFC3339, *tag.Value); err == nil {
				metadata.LastRotated = parsedTime
			}
		case "NextRotation":
			if parsedTime, err := time.Parse(time.RFC3339, *tag.Value); err == nil {
				metadata.NextRotation = parsedTime
			}
		}
	}

	return metadata
}

// ScheduleRotation schedules automatic rotation for a secret
func (sm *SecretManager) ScheduleRotation(key string, config RotationConfig) error {
	ctx := context.Background()

	if !config.Enabled {
		return fmt.Errorf("rotation is not enabled for this secret")
	}

	// Prepare rotation schedule (unused for now, but kept for future use)
	_ = fmt.Sprintf("rate(%d days)", config.Schedule.Duration/(24*time.Hour))

	input := &secretsmanager.RotateSecretInput{
		SecretId:          aws.String(key),
		RotationLambdaARN: aws.String("arn:aws:lambda:us-east-1:123456789012:function:rotate-secrets"),
		RotationRules: &types.RotationRulesType{
			AutomaticallyAfterDays: aws.Int64(int64(config.Schedule.Duration / (24 * time.Hour))),
		},
	}

	_, err := sm.client.RotateSecret(ctx, input)
	if err != nil {
		return fmt.Errorf("failed to schedule rotation: %w", err)
	}

	sm.logger.Printf("Successfully scheduled rotation for secret: %s", key)
	return nil
}

// GetSecretRotationStatus gets the rotation status of a secret
func (sm *SecretManager) GetSecretRotationStatus(key string) (*secretsmanager.DescribeSecretOutput, error) {
	ctx := context.Background()

	input := &secretsmanager.DescribeSecretInput{
		SecretId: aws.String(key),
	}

	result, err := sm.client.DescribeSecret(ctx, input)
	if err != nil {
		return nil, fmt.Errorf("failed to describe secret: %w", err)
	}

	return result, nil
}

// ValidateSecretAccess validates access to a secret
func (sm *SecretManager) ValidateSecretAccess(key string) error {
	ctx := context.Background()

	// Check if secret exists and we have access to describe it
	_, err := sm.client.DescribeSecret(ctx, &secretsmanager.DescribeSecretInput{
		SecretId: aws.String(key),
	})

	if err != nil {
		return fmt.Errorf("failed to validate secret access: %w", err)
	}

	return nil
}

// AuditSecretAccess logs secret access for audit purposes
func (sm *SecretManager) AuditSecretAccess(key, operation, user string) error {
	// This would integrate with your audit logging system
	// For now, just log locally
	auditLog := fmt.Sprintf("AUDIT: %s - %s - %s - %s",
		time.Now().Format(time.RFC3339), user, operation, key)

	sm.logger.Printf("%s", auditLog)

	// In production, this would send to centralized logging system
	return nil
}
