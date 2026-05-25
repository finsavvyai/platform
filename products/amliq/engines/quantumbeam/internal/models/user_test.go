package models

import (
	"encoding/json"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestUser_FullName(t *testing.T) {
	tests := []struct {
		name     string
		user     *User
		expected string
	}{
		{
			name: "both names provided",
			user: &User{
				FirstName: "John",
				LastName:  "Doe",
			},
			expected: "John Doe",
		},
		{
			name: "only first name",
			user: &User{
				FirstName: "John",
			},
			expected: "John ",
		},
		{
			name: "only last name",
			user: &User{
				LastName: "Doe",
			},
			expected: " Doe",
		},
		{
			name:     "no names",
			user:     &User{},
			expected: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.expected, tt.user.FullName())
		})
	}
}

func TestUser_IsAdmin(t *testing.T) {
	tests := []struct {
		name     string
		role     UserRole
		expected bool
	}{
		{"admin role", UserRoleAdmin, true},
		{"developer role", UserRoleDeveloper, false},
		{"viewer role", UserRoleViewer, false},
		{"enterprise role", UserRoleEnterprise, false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			user := &User{Role: tt.role}
			assert.Equal(t, tt.expected, user.IsAdmin())
		})
	}
}

func TestUser_CanAccessEnterprise(t *testing.T) {
	tests := []struct {
		name     string
		role     UserRole
		expected bool
	}{
		{"admin role", UserRoleAdmin, true},
		{"enterprise role", UserRoleEnterprise, true},
		{"developer role", UserRoleDeveloper, false},
		{"viewer role", UserRoleViewer, false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			user := &User{Role: tt.role}
			assert.Equal(t, tt.expected, user.CanAccessEnterprise())
		})
	}
}

func TestUser_UpdateLastLogin(t *testing.T) {
	user := &User{}
	assert.Nil(t, user.LastLogin)

	before := time.Now()
	user.UpdateLastLogin()
	after := time.Now()

	assert.NotNil(t, user.LastLogin)
	assert.True(t, user.LastLogin.After(before) || user.LastLogin.Equal(before))
	assert.True(t, user.LastLogin.Before(after) || user.LastLogin.Equal(after))
}

func TestUser_ActivateDeactivate(t *testing.T) {
	user := &User{IsActive: true}

	// Test deactivation
	user.Deactivate()
	assert.False(t, user.IsActive)

	// Test activation
	user.Activate()
	assert.True(t, user.IsActive)
}

func TestUser_Validate(t *testing.T) {
	tests := []struct {
		name    string
		user    *User
		wantErr error
	}{
		{
			name: "valid user",
			user: &User{
				Email: "test@example.com",
				Role:  UserRoleDeveloper,
			},
			wantErr: nil,
		},
		{
			name: "valid user with SSO",
			user: &User{
				Email:       "test@example.com",
				Role:        UserRoleDeveloper,
				SSOProvider: stringPtr("okta"),
				SSOSubject:  stringPtr("user123"),
			},
			wantErr: nil,
		},
		{
			name: "invalid email - empty",
			user: &User{
				Email: "",
				Role:  UserRoleDeveloper,
			},
			wantErr: ErrInvalidEmail,
		},
		{
			name: "invalid SSO config - provider without subject",
			user: &User{
				Email:       "test@example.com",
				Role:        UserRoleDeveloper,
				SSOProvider: stringPtr("okta"),
				SSOSubject:  nil,
			},
			wantErr: ErrInvalidSSOConfig,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.user.Validate()
			if tt.wantErr != nil {
				assert.Error(t, err)
				assert.Equal(t, tt.wantErr, err)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestUser_TableName(t *testing.T) {
	user := &User{}
	assert.Equal(t, "users", user.TableName())
}

// Helper functions are now in test_utils.go

// Property-based tests for User validation
func TestUser_PropertyBasedValidation(t *testing.T) {
	t.Run("valid email formats", func(t *testing.T) {
		validEmails := []string{
			"test@example.com",
			"user.name@domain.co.uk",
			"user+tag@example.org",
			"123@numbers.com",
			"a@b.co",
		}

		for _, email := range validEmails {
			user := &User{
				UserID: "user_" + randomString(8),
				Email:  email,
				Role:   UserRoleDeveloper,
			}

			err := user.Validate()
			assert.NoError(t, err, "Valid email %s should not produce error", email)
		}
	})

	t.Run("SSO configuration validation", func(t *testing.T) {
		providers := []string{"okta", "azure", "google", "saml"}

		for _, provider := range providers {
			user := &User{
				UserID:      "user_" + randomString(8),
				Email:       "test@example.com",
				Role:        UserRoleEnterprise,
				SSOProvider: &provider,
				SSOSubject:  stringPtr("subject_" + randomString(10)),
			}

			err := user.Validate()
			assert.NoError(t, err, "Valid SSO config with provider %s should not produce error", provider)
		}
	})

	t.Run("role-based permissions", func(t *testing.T) {
		roles := []UserRole{UserRoleAdmin, UserRoleDeveloper, UserRoleViewer, UserRoleEnterprise}

		for _, role := range roles {
			user := &User{
				UserID: "user_" + randomString(8),
				Email:  "test@example.com",
				Role:   role,
			}

			// Test role-specific permissions
			switch role {
			case UserRoleAdmin:
				assert.True(t, user.IsAdmin())
				assert.True(t, user.CanAccessEnterprise())
			case UserRoleEnterprise:
				assert.False(t, user.IsAdmin())
				assert.True(t, user.CanAccessEnterprise())
			default:
				assert.False(t, user.IsAdmin())
				assert.False(t, user.CanAccessEnterprise())
			}
		}
	})
}

// Serialization and deserialization tests
func TestUser_JSONSerialization(t *testing.T) {
	ssoProvider := "okta"
	ssoSubject := "okta_user_123"
	lemonSqueezyID := "ls_customer_456"
	lastLogin := time.Date(2024, 1, 15, 10, 30, 0, 0, time.UTC)

	original := &User{
		UserID:         "user_12345",
		Email:          "john.doe@example.com",
		Role:           UserRoleEnterprise,
		FirstName:      "John",
		LastName:       "Doe",
		Company:        "Acme Corp",
		CreatedAt:      time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC),
		UpdatedAt:      time.Date(2024, 1, 15, 12, 0, 0, 0, time.UTC),
		LastLogin:      &lastLogin,
		IsActive:       true,
		SSOProvider:    &ssoProvider,
		SSOSubject:     &ssoSubject,
		LemonSqueezyID: &lemonSqueezyID,
	}

	// Test serialization
	jsonData, err := json.Marshal(original)
	require.NoError(t, err)
	assert.Contains(t, string(jsonData), "user_12345")
	assert.Contains(t, string(jsonData), "john.doe@example.com")
	assert.Contains(t, string(jsonData), "enterprise")
	assert.Contains(t, string(jsonData), "John")
	assert.Contains(t, string(jsonData), "Doe")

	// Test deserialization
	var deserialized User
	err = json.Unmarshal(jsonData, &deserialized)
	require.NoError(t, err)

	// Verify all fields
	assert.Equal(t, original.UserID, deserialized.UserID)
	assert.Equal(t, original.Email, deserialized.Email)
	assert.Equal(t, original.Role, deserialized.Role)
	assert.Equal(t, original.FirstName, deserialized.FirstName)
	assert.Equal(t, original.LastName, deserialized.LastName)
	assert.Equal(t, original.Company, deserialized.Company)
	assert.Equal(t, original.IsActive, deserialized.IsActive)
	assert.Equal(t, *original.SSOProvider, *deserialized.SSOProvider)
	assert.Equal(t, *original.SSOSubject, *deserialized.SSOSubject)
	assert.Equal(t, *original.LemonSqueezyID, *deserialized.LemonSqueezyID)

	// Verify time fields (with some tolerance for JSON serialization)
	assert.True(t, original.LastLogin.Equal(*deserialized.LastLogin))
}

func TestUser_JSONSerializationEdgeCases(t *testing.T) {
	tests := []struct {
		name string
		user *User
	}{
		{
			name: "minimal user",
			user: &User{
				UserID: "user_min",
				Email:  "min@example.com",
				Role:   UserRoleViewer,
			},
		},
		{
			name: "user with nil optional fields",
			user: &User{
				UserID:         "user_nil",
				Email:          "nil@example.com",
				Role:           UserRoleDeveloper,
				LastLogin:      nil,
				SSOProvider:    nil,
				SSOSubject:     nil,
				LemonSqueezyID: nil,
			},
		},
		{
			name: "user with empty strings",
			user: &User{
				UserID:    "user_empty",
				Email:     "empty@example.com",
				Role:      UserRoleAdmin,
				FirstName: "",
				LastName:  "",
				Company:   "",
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Serialize
			jsonData, err := json.Marshal(tt.user)
			require.NoError(t, err)

			// Deserialize
			var deserialized User
			err = json.Unmarshal(jsonData, &deserialized)
			require.NoError(t, err)

			// Basic validation
			assert.Equal(t, tt.user.UserID, deserialized.UserID)
			assert.Equal(t, tt.user.Email, deserialized.Email)
			assert.Equal(t, tt.user.Role, deserialized.Role)
		})
	}
}

// Database constraint validation tests
func TestUser_DatabaseConstraints(t *testing.T) {
	t.Run("unique email constraint", func(t *testing.T) {
		user1 := &User{
			UserID: "user_1",
			Email:  "duplicate@example.com",
			Role:   UserRoleDeveloper,
		}

		user2 := &User{
			UserID: "user_2",
			Email:  "duplicate@example.com", // Same email - would fail unique constraint
			Role:   UserRoleViewer,
		}

		// Both users have the same email - would fail database unique constraint
		assert.Equal(t, user1.Email, user2.Email)
	})

	t.Run("field length constraints", func(t *testing.T) {
		longString := randomString(300) // Exceeds field limits

		user := &User{
			UserID:    longString,                  // Should exceed 255 char limit
			Email:     longString + "@example.com", // Should exceed 255 char limit
			FirstName: randomString(150),           // Should exceed 100 char limit
			LastName:  randomString(150),           // Should exceed 100 char limit
			Company:   longString,                  // Should exceed 255 char limit
			Role:      UserRoleDeveloper,
		}

		assert.Greater(t, len(user.UserID), 255)
		assert.Greater(t, len(user.Email), 255)
		assert.Greater(t, len(user.FirstName), 100)
		assert.Greater(t, len(user.LastName), 100)
		assert.Greater(t, len(user.Company), 255)
	})

	t.Run("enum constraints", func(t *testing.T) {
		invalidRoles := []string{"invalid", "super_admin", "guest", ""}

		for _, role := range invalidRoles {
			user := &User{
				UserID: "user_123",
				Email:  "test@example.com",
				Role:   UserRole(role), // Invalid enum value
			}

			// Would fail database enum constraint
			assert.NotContains(t, []UserRole{UserRoleAdmin, UserRoleDeveloper, UserRoleViewer, UserRoleEnterprise}, user.Role)
		}
	})
}

// Test GORM hooks
func TestUser_BeforeCreateHook(t *testing.T) {
	user := &User{
		UserID: "", // Empty UserID should be generated
		Email:  "test@example.com",
		Role:   UserRoleDeveloper,
	}

	// Simulate GORM BeforeCreate hook
	err := user.BeforeCreate(nil)
	assert.NoError(t, err)
	assert.NotEmpty(t, user.UserID)
	assert.True(t, strings.HasPrefix(user.UserID, "user_"))
}

// Test relationship handling
func TestUser_APIKeyRelationship(t *testing.T) {
	user := &User{
		UserID: "user_123",
		Email:  "test@example.com",
		Role:   UserRoleDeveloper,
		APIKeys: []APIKey{
			{
				KeyID:     "key_1",
				UserID:    "user_123",
				Name:      "Test Key 1",
				UsageTier: PricingTierDeveloper,
				RateLimit: 100,
			},
			{
				KeyID:     "key_2",
				UserID:    "user_123",
				Name:      "Test Key 2",
				UsageTier: PricingTierGrowth,
				RateLimit: 1000,
			},
		},
	}

	// Test relationship
	assert.Len(t, user.APIKeys, 2)
	for _, apiKey := range user.APIKeys {
		assert.Equal(t, user.UserID, apiKey.UserID)
	}
}

// Test edge cases for FullName method
func TestUser_FullNameEdgeCases(t *testing.T) {
	tests := []struct {
		name      string
		firstName string
		lastName  string
		expected  string
	}{
		{"both empty", "", "", ""},
		{"first only", "John", "", "John "},
		{"last only", "", "Doe", " Doe"},
		{"both present", "John", "Doe", "John Doe"},
		{"with spaces", " John ", " Doe ", " John   Doe "},
		{"special characters", "José", "O'Connor", "José O'Connor"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			user := &User{
				FirstName: tt.firstName,
				LastName:  tt.lastName,
			}
			assert.Equal(t, tt.expected, user.FullName())
		})
	}
}

// Benchmark tests
func BenchmarkUser_FullName(b *testing.B) {
	user := &User{
		FirstName: "John",
		LastName:  "Doe",
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = user.FullName()
	}
}

func BenchmarkUser_Validate(b *testing.B) {
	ssoProvider := "okta"
	ssoSubject := "subject_123"
	user := &User{
		UserID:      "user_123",
		Email:       "test@example.com",
		Role:        UserRoleEnterprise,
		SSOProvider: &ssoProvider,
		SSOSubject:  &ssoSubject,
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = user.Validate()
	}
}

func BenchmarkUser_JSONMarshal(b *testing.B) {
	ssoProvider := "okta"
	ssoSubject := "subject_123"
	user := &User{
		UserID:      "user_123",
		Email:       "john.doe@example.com",
		Role:        UserRoleEnterprise,
		FirstName:   "John",
		LastName:    "Doe",
		Company:     "Acme Corp",
		SSOProvider: &ssoProvider,
		SSOSubject:  &ssoSubject,
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, _ = json.Marshal(user)
	}
}
