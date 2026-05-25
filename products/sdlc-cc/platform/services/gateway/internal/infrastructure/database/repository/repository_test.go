package repository

import (
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/sdlc-ai/platform/services/gateway/internal/domain/models"
)

// TestTenantRepository tests tenant repository operations
func TestTenantRepository(t *testing.T) {
	// This is a placeholder test for the tenant repository
	// In a real implementation, you would set up a test database and test actual CRUD operations

	t.Run("Tenant model validation", func(t *testing.T) {
		tenant := &models.Tenant{
			ID:     uuid.New(),
			Name:   "Test Tenant",
			Domain: "test.example.com",
			Status: models.TenantStatusActive,
		}

		assert.NotNil(t, tenant.ID)
		assert.Equal(t, "Test Tenant", tenant.Name)
		assert.Equal(t, "test.example.com", tenant.Domain)
		assert.Equal(t, models.TenantStatusActive, tenant.Status)
		assert.True(t, tenant.IsActive())
	})

	t.Run("Tenant status transitions", func(t *testing.T) {
		tenant := &models.Tenant{
			ID:     uuid.New(),
			Name:   "Test Tenant",
			Status: models.TenantStatusActive,
		}

		// Test active status
		assert.True(t, tenant.IsActive())
		assert.False(t, tenant.IsSuspended())

		// Test suspended status
		tenant.Status = models.TenantStatusSuspended
		assert.False(t, tenant.IsActive())
		assert.True(t, tenant.IsSuspended())
	})
}

// TestUserRepository tests user repository operations
func TestUserRepository(t *testing.T) {
	t.Run("User model validation", func(t *testing.T) {
		userID := uuid.New()
		tenantID := uuid.New()

		user := &models.User{
			ID:            userID,
			TenantID:      tenantID,
			Email:         "test@example.com",
			Role:          models.RoleUser,
			IsActive:      true,
			EmailVerified: true,
			Permissions:   models.JSONB{"documents": "read"},
			Profile:       models.JSONB{"first_name": "Test"},
		}

		assert.NotNil(t, user.ID)
		assert.Equal(t, "test@example.com", user.Email)
		assert.Equal(t, models.RoleUser, user.Role)
		assert.True(t, user.IsActive)
		assert.True(t, user.EmailVerified)
		assert.NotEmpty(t, user.Permissions)
	})

	t.Run("User account locking", func(t *testing.T) {
		user := &models.User{
			ID:       uuid.New(),
			TenantID: uuid.New(),
			Email:    "locked@example.com",
		}

		// Test unlocked state
		assert.False(t, user.IsLocked())

		// Lock the account for 30 minutes
		lockDuration := 30 * time.Minute
		user.LockAccount(lockDuration)

		// Verify locked state
		assert.True(t, user.IsLocked(), "User should be locked after LockAccount")
		assert.NotNil(t, user.LockedUntil, "LockedUntil should be set")

		// Verify the lock time is approximately correct
		expectedLockTime := time.Now().Add(lockDuration)
		timeDiff := expectedLockTime.Sub(*user.LockedUntil)
		assert.Less(t, timeDiff.Abs(), time.Second, "Lock time should be within 1 second of expected")

		// Unlock the account
		user.UnlockAccount()

		// Verify unlocked state
		assert.False(t, user.IsLocked(), "User should be unlocked after UnlockAccount")
		assert.Nil(t, user.LockedUntil, "LockedUntil should be nil after unlock")
		assert.Equal(t, 0, user.FailedLoginAttempts, "Failed login attempts should be reset")
	})

	t.Run("User failed login tracking", func(t *testing.T) {
		user := &models.User{
			ID:       uuid.New(),
			TenantID: uuid.New(),
			Email:    "user@example.com",
		}

		// Increment failed logins
		for i := 0; i < 3; i++ {
			user.IncrementFailedLogin()
		}

		assert.Equal(t, 3, user.FailedLoginAttempts)

		// Reset failed logins
		user.ResetFailedLogin()
		assert.Equal(t, 0, user.FailedLoginAttempts)
	})
}

// TestDocumentRepository tests document repository operations
func TestDocumentRepository(t *testing.T) {
	t.Run("Document model validation", func(t *testing.T) {
		docID := uuid.New()
		tenantID := uuid.New()
		createdBy := uuid.New()

		doc := &models.Document{
			ID:               docID,
			TenantID:         tenantID,
			CreatedBy:        createdBy,
			Filename:         "test.pdf",
			OriginalFilename: "test.pdf",
			ContentType:      "application/pdf",
			FileSize:         1024,
			StoragePath:      "/test/path/test.pdf",
			ProcessingStatus: models.DocumentStatusPending,
			Classification:   models.ClassificationInternal,
		}

		assert.NotNil(t, doc.ID)
		assert.Equal(t, "test.pdf", doc.Filename)
		assert.Equal(t, "/test/path/test.pdf", doc.StoragePath)
		assert.Equal(t, models.DocumentStatusPending, doc.ProcessingStatus)
		assert.Equal(t, models.ClassificationInternal, doc.Classification)
	})

	t.Run("Document status transitions", func(t *testing.T) {
		doc := &models.Document{
			ID:               uuid.New(),
			ProcessingStatus: models.DocumentStatusPending,
			ExtractionStatus: models.DocumentStatusCompleted,
			DLPStatus:        models.DocumentStatusCompleted,
		}

		// Test processing complete
		doc.ProcessingStatus = models.DocumentStatusCompleted
		assert.True(t, doc.IsProcessingComplete())
		assert.False(t, doc.HasFailed())

		// Test failed processing
		doc.ProcessingStatus = models.DocumentStatusFailed
		assert.True(t, doc.HasFailed())
		assert.False(t, doc.IsProcessingComplete())
	})

	t.Run("Document processing progress", func(t *testing.T) {
		doc := &models.Document{
			ID:               uuid.New(),
			ExtractionStatus: models.DocumentStatusCompleted,
			ProcessingStatus: models.DocumentStatusPending,
			DLPStatus:        models.DocumentStatusPending,
		}

		// Should be approximately 33% complete (1 of 3 statuses complete)
		progress := doc.GetProcessingProgress()
		assert.InDelta(t, 33.33, progress, 0.01, "Progress should be approximately 33%")
	})
}

// TestAPIKeyRepository tests API key repository operations
func TestAPIKeyRepository(t *testing.T) {
	t.Run("API key model validation", func(t *testing.T) {
		keyID := uuid.New()
		tenantID := uuid.New()
		userID := uuid.New()

		apiKey := &models.APIKey{
			ID:          keyID,
			TenantID:    tenantID,
			UserID:      &userID,
			Name:        "Test API Key",
			KeyPrefix:   "sdli_test",
			KeyHash:     "hashed_key_value",
			RateLimit:   1000,
			RateWindow:  3600,
			CreatedBy:   userID,
			IsActive:    true,
			Permissions: models.JSONB{"documents": "read"},
		}

		assert.NotNil(t, apiKey.ID)
		assert.Equal(t, "Test API Key", apiKey.Name)
		assert.Equal(t, "sdli_test", apiKey.KeyPrefix)
		assert.True(t, apiKey.IsActive)
		assert.True(t, apiKey.IsValid())
	})

	t.Run("API key expiration", func(t *testing.T) {
		now := time.Now()
		past := now.Add(-1 * time.Hour)

		apiKey := &models.APIKey{
			ID:        uuid.New(),
			ExpiresAt: &past,
			IsActive:  true,
		}

		// Test expired key
		assert.True(t, apiKey.IsExpired())
		assert.False(t, apiKey.IsValid())
	})

	t.Run("API key usage tracking", func(t *testing.T) {
		apiKey := &models.APIKey{
			ID:         uuid.New(),
			IsActive:   true,
			UsageCount: 5,
		}

		// Update usage
		apiKey.UpdateUsage("192.168.1.1")

		assert.Equal(t, 6, apiKey.UsageCount)
		assert.NotNil(t, apiKey.LastUsed)
		assert.Equal(t, "192.168.1.1", apiKey.LastIPAddress)
	})

	t.Run("API key permissions", func(t *testing.T) {
		apiKey := &models.APIKey{
			ID: uuid.New(),
			Permissions: models.JSONB{
				"permissions": []interface{}{"documents:read", "documents:write"},
			},
		}

		assert.True(t, apiKey.HasPermission("documents:read"))
		assert.True(t, apiKey.HasPermission("documents:write"))
		assert.False(t, apiKey.HasPermission("documents:delete"))
	})
}

// TestBaseRepositoryOperations tests base repository operations
func TestBaseRepositoryOperations(t *testing.T) {
	t.Run("JSONB type handling", func(t *testing.T) {
		// Test JSONB creation and manipulation
		jsonData := models.JSONB{
			"key1": "value1",
			"key2": 123,
			"key3": true,
			"key4": map[string]interface{}{
				"nested": "data",
			},
		}

		assert.NotNil(t, jsonData)
		assert.Equal(t, "value1", jsonData["key1"])
		assert.Equal(t, 123, jsonData["key2"]) // JSONB stores as int, not int64
		assert.Equal(t, true, jsonData["key3"])
	})

	t.Run("UUID validation", func(t *testing.T) {
		// Test valid UUID
		validID := uuid.New()
		assert.NotEqual(t, uuid.Nil, validID)

		// Test UUID parsing
		parsedID, err := uuid.Parse(validID.String())
		require.NoError(t, err)
		assert.Equal(t, validID, parsedID)

		// Test invalid UUID
		_, err = uuid.Parse("invalid-uuid")
		assert.Error(t, err)
	})
}

// TestFilterStructures tests filter structures for repository queries
func TestFilterStructures(t *testing.T) {
	t.Run("UserFilter validation", func(t *testing.T) {
		role := models.RoleUser
		isActive := true
		limit := 10
		offset := 0

		filter := models.UserFilter{
			Role:     &role,
			IsActive: &isActive,
			Limit:    &limit,
			Offset:   &offset,
		}

		assert.Equal(t, models.RoleUser, *filter.Role)
		assert.True(t, *filter.IsActive)
		assert.Equal(t, 10, *filter.Limit)
		assert.Equal(t, 0, *filter.Offset)
	})

	t.Run("DocumentFilter validation", func(t *testing.T) {
		classification := models.ClassificationConfidential
		limit := 20
		offset := 0

		filter := models.DocumentFilter{
			Classification: &classification,
			Limit:          &limit,
			Offset:         &offset,
		}

		assert.Equal(t, models.ClassificationConfidential, *filter.Classification)
		assert.Equal(t, 20, *filter.Limit)
	})

	t.Run("PolicyFilter validation", func(t *testing.T) {
		policyType := models.PolicyTypeAuth
		isActive := true
		limit := 50

		filter := models.PolicyFilter{
			Type:     &policyType,
			IsActive: &isActive,
			Limit:    &limit,
		}

		assert.Equal(t, models.PolicyTypeAuth, *filter.Type)
		assert.Equal(t, true, *filter.IsActive)
		assert.Equal(t, 50, *filter.Limit)
	})
}

// Benchmark repository operations
func BenchmarkUUIDGeneration(b *testing.B) {
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = uuid.New()
	}
}

func BenchmarkJSONBCreation(b *testing.B) {
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = models.JSONB{
			"key1": "value1",
			"key2": 123,
			"key3": true,
		}
	}
}

func BenchmarkFilterCreation(b *testing.B) {
	role := models.RoleUser
	isActive := true
	limit := 10
	offset := 0

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = models.UserFilter{
			Role:     &role,
			IsActive: &isActive,
			Limit:    &limit,
			Offset:   &offset,
		}
	}
}
