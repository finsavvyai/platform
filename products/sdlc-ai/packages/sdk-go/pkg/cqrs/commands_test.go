package cqrs

import (
	"fmt"
	"testing"
	"time"

	"github.com/shaharsolomon/sdln/pkg/testing"
	"github.com/stretchr/testify/assert"
)

func TestBaseCommand_GetMethods(t *testing.T) {
	tests := []struct {
		name    string
		command *BaseCommand
	}{
		{
			name: "valid command",
			command: &BaseCommand{
				CommandID:   "cmd_123",
				AggregateID: "agg_456",
				UserID:      "user_789",
				TenantID:    "tenant_abc",
				Timestamp:   time.Now(),
				Metadata:    map[string]interface{}{"key": "value"},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.command.CommandID, tt.command.GetCommandID())
			assert.Equal(t, tt.command.AggregateID, tt.command.GetAggregateID())
			assert.Equal(t, tt.command.UserID, tt.command.GetUserID())
			assert.Equal(t, tt.command.TenantID, tt.command.GetTenantID())
			assert.Equal(t, tt.command.Timestamp, tt.command.GetTimestamp())
			assert.Equal(t, tt.command.Metadata, tt.command.GetMetadata())
		})
	}
}

func TestRegisterUserCommand_Validate(t *testing.T) {
	clock := testing.NewTestClock(time.Now())
	factory := testing.NewTestDataFactory(clock)

	tests := []struct {
		name        string
		command     *RegisterUserCommand
		expectError error
	}{
		{
			name: "valid command",
			command: &RegisterUserCommand{
				BaseCommand: BaseCommand{
					CommandID:   factory.GenerateID("cmd"),
					AggregateID: factory.GenerateID("user"),
					UserID:      factory.GenerateID("user"),
					TenantID:    factory.GenerateID("tenant"),
					Timestamp:   clock.Now(),
					Metadata:    map[string]interface{}{},
				},
				Email:     "test@example.com",
				Password:  "SecurePass123!",
				FirstName: "John",
				LastName:  "Doe",
				Role:      "USER",
				TenantID:  factory.GenerateID("tenant"),
			},
			expectError: nil,
		},
		{
			name: "empty email",
			command: &RegisterUserCommand{
				Email:     "",
				Password:  "SecurePass123!",
				FirstName: "John",
				LastName:  "Doe",
				Role:      "USER",
				TenantID:  factory.GenerateID("tenant"),
			},
			expectError: ErrInvalidEmail,
		},
		{
			name: "empty password",
			command: &RegisterUserCommand{
				Email:     "test@example.com",
				Password:  "",
				FirstName: "John",
				LastName:  "Doe",
				Role:      "USER",
				TenantID:  factory.GenerateID("tenant"),
			},
			expectError: ErrInvalidPassword,
		},
		{
			name: "empty first name",
			command: &RegisterUserCommand{
				Email:     "test@example.com",
				Password:  "SecurePass123!",
				FirstName: "",
				LastName:  "Doe",
				Role:      "USER",
				TenantID:  factory.GenerateID("tenant"),
			},
			expectError: ErrInvalidFirstName,
		},
		{
			name: "empty last name",
			command: &RegisterUserCommand{
				Email:     "test@example.com",
				Password:  "SecurePass123!",
				FirstName: "John",
				LastName:  "",
				Role:      "USER",
				TenantID:  factory.GenerateID("tenant"),
			},
			expectError: ErrInvalidLastName,
		},
		{
			name: "empty role",
			command: &RegisterUserCommand{
				Email:     "test@example.com",
				Password:  "SecurePass123!",
				FirstName: "John",
				LastName:  "Doe",
				Role:      "",
				TenantID:  factory.GenerateID("tenant"),
			},
			expectError: ErrInvalidRole,
		},
		{
			name: "empty tenant ID",
			command: &RegisterUserCommand{
				Email:     "test@example.com",
				Password:  "SecurePass123!",
				FirstName: "John",
				LastName:  "Doe",
				Role:      "USER",
				TenantID:  "",
			},
			expectError: ErrInvalidTenantID,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.command.Validate()
			if tt.expectError != nil {
				assert.Error(t, err)
				assert.Equal(t, tt.expectError, err)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestAuthenticateUserCommand_Validate(t *testing.T) {
	tests := []struct {
		name        string
		command     *AuthenticateUserCommand
		expectError error
	}{
		{
			name: "valid command",
			command: &AuthenticateUserCommand{
				Email:     "test@example.com",
				Password:  "password123",
				TenantID:  "tenant_123",
				IPAddress: "192.168.1.1",
				UserAgent: "Mozilla/5.0",
				MFA:       "123456",
			},
			expectError: nil,
		},
		{
			name: "empty email",
			command: &AuthenticateUserCommand{
				Email:    "",
				Password: "password123",
			},
			expectError: ErrInvalidEmail,
		},
		{
			name: "empty password",
			command: &AuthenticateUserCommand{
				Email:    "test@example.com",
				Password: "",
			},
			expectError: ErrInvalidPassword,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.command.Validate()
			if tt.expectError != nil {
				assert.Error(t, err)
				assert.Equal(t, tt.expectError, err)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestUpdateUserProfileCommand_Validate(t *testing.T) {
	tests := []struct {
		name        string
		command     *UpdateUserProfileCommand
		expectError error
	}{
		{
			name: "valid command",
			command: &UpdateUserProfileCommand{
				FirstName: "John",
				LastName:  "Doe",
				AvatarURL: "https://example.com/avatar.jpg",
				Timezone:  "UTC",
				Language:  "en",
			},
			expectError: nil,
		},
		{
			name: "empty first name",
			command: &UpdateUserProfileCommand{
				FirstName: "",
				LastName:  "Doe",
			},
			expectError: ErrInvalidFirstName,
		},
		{
			name: "empty last name",
			command: &UpdateUserProfileCommand{
				FirstName: "John",
				LastName:  "",
			},
			expectError: ErrInvalidLastName,
		},
		{
			name: "valid command with minimal fields",
			command: &UpdateUserProfileCommand{
				FirstName: "John",
				LastName:  "Doe",
			},
			expectError: nil,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.command.Validate()
			if tt.expectError != nil {
				assert.Error(t, err)
				assert.Equal(t, tt.expectError, err)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestDeactivateUserCommand_Validate(t *testing.T) {
	tests := []struct {
		name        string
		command     *DeactivateUserCommand
		expectError error
	}{
		{
			name: "valid command with reason",
			command: &DeactivateUserCommand{
				BaseCommand: BaseCommand{
					CommandID:   "cmd_123",
					AggregateID: "user_456",
					Timestamp:   time.Now(),
				},
				Reason: "User requested account deletion",
			},
			expectError: nil,
		},
		{
			name: "valid command without reason",
			command: &DeactivateUserCommand{
				BaseCommand: BaseCommand{
					CommandID:   "cmd_123",
					AggregateID: "user_456",
					Timestamp:   time.Now(),
				},
				Reason: "",
			},
			expectError: nil,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.command.Validate()
			assert.Equal(t, tt.expectError, err)
		})
	}
}

func TestUploadDocumentCommand_Validate(t *testing.T) {
	tests := []struct {
		name        string
		command     *UploadDocumentCommand
		expectError error
	}{
		{
			name: "valid command",
			command: &UploadDocumentCommand{
				FileName:    "document.pdf",
				FileSize:    1024 * 1024, // 1MB
				ContentType: "application/pdf",
				Checksum:    "sha256:abc123",
				Description: "Test document",
				Tags:        []string{"test", "document"},
				AccessControl: testing.AccessControl{
					Owner:     "user_123",
					Public:    false,
					ExpiresAt: &time.Time{},
				},
			},
			expectError: nil,
		},
		{
			name: "empty file name",
			command: &UploadDocumentCommand{
				FileSize:    1024,
				ContentType: "application/pdf",
				Checksum:    "sha256:abc123",
			},
			expectError: ErrInvalidFileName,
		},
		{
			name: "zero file size",
			command: &UploadDocumentCommand{
				FileName:    "document.pdf",
				FileSize:    0,
				ContentType: "application/pdf",
				Checksum:    "sha256:abc123",
			},
			expectError: ErrInvalidFileSize,
		},
		{
			name: "negative file size",
			command: &UploadDocumentCommand{
				FileName:    "document.pdf",
				FileSize:    -100,
				ContentType: "application/pdf",
				Checksum:    "sha256:abc123",
			},
			expectError: ErrInvalidFileSize,
		},
		{
			name: "empty content type",
			command: &UploadDocumentCommand{
				FileName: "document.pdf",
				FileSize: 1024,
				Checksum: "sha256:abc123",
			},
			expectError: ErrInvalidContentType,
		},
		{
			name: "empty checksum",
			command: &UploadDocumentCommand{
				FileName:    "document.pdf",
				FileSize:    1024,
				ContentType: "application/pdf",
				Checksum:    "",
			},
			expectError: ErrInvalidChecksum,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.command.Validate()
			if tt.expectError != nil {
				assert.Error(t, err)
				assert.Equal(t, tt.expectError, err)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestProcessDocumentCommand_Validate(t *testing.T) {
	tests := []struct {
		name        string
		command     *ProcessDocumentCommand
		expectError error
	}{
		{
			name: "valid command",
			command: &ProcessDocumentCommand{
				BaseCommand: BaseCommand{
					CommandID:   "cmd_123",
					AggregateID: "doc_456",
					Timestamp:   time.Now(),
				},
				DocumentID: "doc_456",
				Options: ProcessOptions{
					GenerateVectors: true,
					ExtractText:     true,
					Language:        "en",
					Model:           "text-embedding-ada-002",
					ChunkSize:       1000,
					ChunkOverlap:    200,
					EnableOCR:       true,
					Tags:            []string{"processed"},
				},
			},
			expectError: nil,
		},
		{
			name: "empty document ID",
			command: &ProcessDocumentCommand{
				DocumentID: "",
				Options: ProcessOptions{
					GenerateVectors: true,
				},
			},
			expectError: ErrInvalidDocumentID,
		},
		{
			name: "valid command with minimal options",
			command: &ProcessDocumentCommand{
				DocumentID: "doc_456",
				Options: ProcessOptions{
					GenerateVectors: false,
					ExtractText:     true,
				},
			},
			expectError: nil,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.command.Validate()
			if tt.expectError != nil {
				assert.Error(t, err)
				assert.Equal(t, tt.expectError, err)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestDeleteDocumentCommand_Validate(t *testing.T) {
	tests := []struct {
		name        string
		command     *DeleteDocumentCommand
		expectError error
	}{
		{
			name: "valid command - soft delete",
			command: &DeleteDocumentCommand{
				BaseCommand: BaseCommand{
					CommandID:   "cmd_123",
					AggregateID: "doc_456",
					Timestamp:   time.Now(),
				},
				DocumentID: "doc_456",
				Permanent:  false,
			},
			expectError: nil,
		},
		{
			name: "valid command - permanent delete",
			command: &DeleteDocumentCommand{
				BaseCommand: BaseCommand{
					CommandID:   "cmd_123",
					AggregateID: "doc_456",
					Timestamp:   time.Now(),
				},
				DocumentID: "doc_456",
				Permanent:  true,
			},
			expectError: nil,
		},
		{
			name: "empty document ID",
			command: &DeleteDocumentCommand{
				DocumentID: "",
				Permanent:  false,
			},
			expectError: ErrInvalidDocumentID,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.command.Validate()
			if tt.expectError != nil {
				assert.Error(t, err)
				assert.Equal(t, tt.expectError, err)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestSubmitQueryCommand_Validate(t *testing.T) {
	tests := []struct {
		name        string
		command     *SubmitQueryCommand
		expectError error
	}{
		{
			name: "valid command with all options",
			command: &SubmitQueryCommand{
				BaseCommand: BaseCommand{
					CommandID:   "cmd_123",
					AggregateID: "query_456",
					Timestamp:   time.Now(),
				},
				Query:       "What is the meaning of life?",
				Context:     []string{"context1", "context2"},
				MaxResults:  10,
				Model:       "gpt-4",
				Temperature: 0.7,
				MaxTokens:   1000,
				Options: QueryOptions{
					IncludeCitations:    true,
					IncludeMetadata:     true,
					FilterDocuments:     []string{"doc1", "doc2"},
					SimilarityThreshold: 0.8,
				},
				Metadata: map[string]interface{}{
					"source": "web",
				},
			},
			expectError: nil,
		},
		{
			name: "valid command with minimal fields",
			command: &SubmitQueryCommand{
				Query: "Test query",
			},
			expectError: nil,
		},
		{
			name: "empty query",
			command: &SubmitQueryCommand{
				Query: "",
			},
			expectError: ErrInvalidQuery,
		},
		{
			name: "valid command with empty context",
			command: &SubmitQueryCommand{
				Query:   "Test query",
				Context: []string{},
			},
			expectError: nil,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.command.Validate()
			if tt.expectError != nil {
				assert.Error(t, err)
				assert.Equal(t, tt.expectError, err)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestCreateTenantCommand_Validate(t *testing.T) {
	tests := []struct {
		name        string
		command     *CreateTenantCommand
		expectError error
	}{
		{
			name: "valid command",
			command: &CreateTenantCommand{
				BaseCommand: BaseCommand{
					CommandID:   "cmd_123",
					AggregateID: "tenant_456",
					Timestamp:   time.Now(),
				},
				Name:       "Acme Corp",
				Plan:       "ENTERPRISE",
				OwnerEmail: "admin@acme.com",
				OwnerName:  "John Doe",
				Domain:     "acme.com",
				Config: testing.TenantConfig{
					MaxUsers:     100,
					MaxDocuments: 10000,
					Features:     []string{"rag", "analytics"},
				},
				Metadata: map[string]interface{}{
					"industry": "technology",
				},
			},
			expectError: nil,
		},
		{
			name: "empty name",
			command: &CreateTenantCommand{
				Plan:       "ENTERPRISE",
				OwnerEmail: "admin@acme.com",
				OwnerName:  "John Doe",
			},
			expectError: ErrInvalidTenantName,
		},
		{
			name: "empty plan",
			command: &CreateTenantCommand{
				Name:       "Acme Corp",
				OwnerEmail: "admin@acme.com",
				OwnerName:  "John Doe",
			},
			expectError: ErrInvalidPlan,
		},
		{
			name: "empty owner email",
			command: &CreateTenantCommand{
				Name:      "Acme Corp",
				Plan:      "ENTERPRISE",
				OwnerName: "John Doe",
			},
			expectError: ErrInvalidOwnerEmail,
		},
		{
			name: "empty owner name",
			command: &CreateTenantCommand{
				Name:       "Acme Corp",
				Plan:       "ENTERPRISE",
				OwnerEmail: "admin@acme.com",
			},
			expectError: ErrInvalidOwnerName,
		},
		{
			name: "valid command with minimal fields",
			command: &CreateTenantCommand{
				Name:       "Acme Corp",
				Plan:       "BASIC",
				OwnerEmail: "admin@acme.com",
				OwnerName:  "John Doe",
			},
			expectError: nil,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.command.Validate()
			if tt.expectError != nil {
				assert.Error(t, err)
				assert.Equal(t, tt.expectError, err)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestUpdateTenantCommand_Validate(t *testing.T) {
	tests := []struct {
		name        string
		command     *UpdateTenantCommand
		expectError error
	}{
		{
			name: "valid command with all fields",
			command: &UpdateTenantCommand{
				BaseCommand: BaseCommand{
					CommandID:   "cmd_123",
					AggregateID: "tenant_456",
					Timestamp:   time.Now(),
				},
				Name:   pointerToString("Acme Corp Updated"),
				Plan:   pointerToString("ENTERPRISE"),
				Status: pointerToString("ACTIVE"),
				Config: &testing.TenantConfig{
					MaxUsers:     200,
					MaxDocuments: 20000,
				},
				Settings: map[string]interface{}{
					"theme": "dark",
				},
			},
			expectError: nil,
		},
		{
			name: "valid command with no fields",
			command: &UpdateTenantCommand{
				BaseCommand: BaseCommand{
					CommandID:   "cmd_123",
					AggregateID: "tenant_456",
					Timestamp:   time.Now(),
				},
			},
			expectError: nil,
		},
		{
			name: "valid command with single field",
			command: &UpdateTenantCommand{
				BaseCommand: BaseCommand{
					CommandID:   "cmd_123",
					AggregateID: "tenant_456",
					Timestamp:   time.Now(),
				},
				Name: pointerToString("Updated Name"),
			},
			expectError: nil,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.command.Validate()
			assert.Equal(t, tt.expectError, err)
		})
	}
}

func TestSuspendTenantCommand_Validate(t *testing.T) {
	tests := []struct {
		name        string
		command     *SuspendTenantCommand
		expectError error
	}{
		{
			name: "valid command with reason",
			command: &SuspendTenantCommand{
				BaseCommand: BaseCommand{
					CommandID:   "cmd_123",
					AggregateID: "tenant_456",
					Timestamp:   time.Now(),
				},
				Reason: "Violation of terms of service",
			},
			expectError: nil,
		},
		{
			name: "empty reason",
			command: &SuspendTenantCommand{
				BaseCommand: BaseCommand{
					CommandID:   "cmd_123",
					AggregateID: "tenant_456",
					Timestamp:   time.Now(),
				},
				Reason: "",
			},
			expectError: ErrInvalidReason,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.command.Validate()
			if tt.expectError != nil {
				assert.Error(t, err)
				assert.Equal(t, tt.expectError, err)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestCreatePolicyCommand_Validate(t *testing.T) {
	tests := []struct {
		name        string
		command     *CreatePolicyCommand
		expectError error
	}{
		{
			name: "valid command",
			command: &CreatePolicyCommand{
				BaseCommand: BaseCommand{
					CommandID:   "cmd_123",
					AggregateID: "policy_456",
					Timestamp:   time.Now(),
				},
				Name:        "Data Access Policy",
				Type:        "ACCESS_CONTROL",
				Description: "Policy for controlling data access",
				Rules: []testing.PolicyRule{
					{
						ID:        "rule_1",
						Name:      "Allow read access",
						Condition: "user.role == 'admin'",
						Action:    "ALLOW",
						Priority:  1,
						Enabled:   true,
					},
				},
				Variables: map[string]interface{}{
					"max_access_level": "admin",
				},
				Enabled: true,
			},
			expectError: nil,
		},
		{
			name: "empty name",
			command: &CreatePolicyCommand{
				Type:  "ACCESS_CONTROL",
				Rules: []testing.PolicyRule{{}},
			},
			expectError: ErrInvalidPolicyName,
		},
		{
			name: "empty type",
			command: &CreatePolicyCommand{
				Name:  "Test Policy",
				Rules: []testing.PolicyRule{{}},
			},
			expectError: ErrInvalidPolicyType,
		},
		{
			name: "empty rules",
			command: &CreatePolicyCommand{
				Name: "Test Policy",
				Type: "ACCESS_CONTROL",
			},
			expectError: ErrInvalidPolicyRules,
		},
		{
			name: "valid command with minimal fields",
			command: &CreatePolicyCommand{
				BaseCommand: BaseCommand{
					CommandID:   "cmd_123",
					AggregateID: "policy_456",
					Timestamp:   time.Now(),
				},
				Name:  "Test Policy",
				Type:  "ACCESS_CONTROL",
				Rules: []testing.PolicyRule{{}},
			},
			expectError: nil,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.command.Validate()
			if tt.expectError != nil {
				assert.Error(t, err)
				assert.Equal(t, tt.expectError, err)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestPaymentCommands_Validate(t *testing.T) {
	t.Run("AddPaymentMethodCommand", func(t *testing.T) {
		tests := []struct {
			name        string
			command     *AddPaymentMethodCommand
			expectError error
		}{
			{
				name: "valid credit card",
				command: &AddPaymentMethodCommand{
					Type:        "credit_card",
					Token:       "tok_123456789",
					CardType:    "VISA",
					LastFour:    "4242",
					ExpiryMonth: "12",
					ExpiryYear:  "2025",
					CardBrand:   "VISA",
					Nickname:    "My Visa Card",
					Default:     true,
				},
				expectError: nil,
			},
			{
				name: "empty type",
				command: &AddPaymentMethodCommand{
					Token:    "tok_123456789",
					LastFour: "4242",
				},
				expectError: ErrInvalidPaymentType,
			},
			{
				name: "empty token",
				command: &AddPaymentMethodCommand{
					Type:     "credit_card",
					LastFour: "4242",
				},
				expectError: ErrInvalidPaymentToken,
			},
			{
				name: "empty last four",
				command: &AddPaymentMethodCommand{
					Type:  "credit_card",
					Token: "tok_123456789",
				},
				expectError: ErrInvalidLastFour,
			},
		}

		for _, tt := range tests {
			t.Run(tt.name, func(t *testing.T) {
				err := tt.command.Validate()
				if tt.expectError != nil {
					assert.Error(t, err)
					assert.Equal(t, tt.expectError, err)
				} else {
					assert.NoError(t, err)
				}
			})
		}
	})

	t.Run("ProcessPaymentCommand", func(t *testing.T) {
		tests := []struct {
			name        string
			command     *ProcessPaymentCommand
			expectError error
		}{
			{
				name: "valid payment",
				command: &ProcessPaymentCommand{
					BaseCommand: BaseCommand{
						CommandID:   "cmd_123",
						AggregateID: "payment_456",
						Timestamp:   time.Now(),
					},
					Amount:      10000, // $100.00 in cents
					Currency:    "USD",
					TokenID:     "tok_123456789",
					Description: "Monthly subscription",
				},
				expectError: nil,
			},
			{
				name: "zero amount",
				command: &ProcessPaymentCommand{
					Amount:   0,
					Currency: "USD",
					TokenID:  "tok_123456789",
				},
				expectError: ErrInvalidAmount,
			},
			{
				name: "negative amount",
				command: &ProcessPaymentCommand{
					Amount:   -100,
					Currency: "USD",
					TokenID:  "tok_123456789",
				},
				expectError: ErrInvalidAmount,
			},
			{
				name: "empty currency",
				command: &ProcessPaymentCommand{
					Amount:  10000,
					TokenID: "tok_123456789",
				},
				expectError: ErrInvalidCurrency,
			},
			{
				name: "empty token ID",
				command: &ProcessPaymentCommand{
					Amount:   10000,
					Currency: "USD",
				},
				expectError: ErrInvalidTokenID,
			},
		}

		for _, tt := range tests {
			t.Run(tt.name, func(t *testing.T) {
				err := tt.command.Validate()
				if tt.expectError != nil {
					assert.Error(t, err)
					assert.Equal(t, tt.expectError, err)
				} else {
					assert.NoError(t, err)
				}
			})
		}
	})

	t.Run("RefundPaymentCommand", func(t *testing.T) {
		tests := []struct {
			name        string
			command     *RefundPaymentCommand
			expectError error
		}{
			{
				name: "valid full refund",
				command: &RefundPaymentCommand{
					BaseCommand: BaseCommand{
						CommandID:   "cmd_123",
						AggregateID: "payment_456",
						Timestamp:   time.Now(),
					},
					PaymentID: "payment_123",
					Reason:    "Customer requested refund",
				},
				expectError: nil,
			},
			{
				name: "valid partial refund",
				command: &RefundPaymentCommand{
					PaymentID: "payment_123",
					Amount:    5000, // $50.00 in cents
					Reason:    "Partial refund for service issue",
				},
				expectError: nil,
			},
			{
				name: "empty payment ID",
				command: &RefundPaymentCommand{
					Reason: "Customer requested refund",
				},
				expectError: ErrInvalidPaymentID,
			},
		}

		for _, tt := range tests {
			t.Run(tt.name, func(t *testing.T) {
				err := tt.command.Validate()
				if tt.expectError != nil {
					assert.Error(t, err)
					assert.Equal(t, tt.expectError, err)
				} else {
					assert.NoError(t, err)
				}
			})
		}
	})
}

func TestSecurityCommands_Validate(t *testing.T) {
	t.Run("CreateSecurityIncidentCommand", func(t *testing.T) {
		tests := []struct {
			name        string
			command     *CreateSecurityIncidentCommand
			expectError error
		}{
			{
				name: "valid command",
				command: &CreateSecurityIncidentCommand{
					BaseCommand: BaseCommand{
						CommandID:   "cmd_123",
						AggregateID: "incident_456",
						Timestamp:   time.Now(),
					},
					Type:         "DATA_BREACH",
					Severity:     "HIGH",
					Title:        "Unauthorized data access",
					Description:  "Suspicious activity detected on user account",
					IPAddress:    "192.168.1.100",
					UserAgent:    "Mozilla/5.0",
					ResourceID:   "user_123",
					ResourceType: "USER_ACCOUNT",
					Details: map[string]interface{}{
						"failed_attempts": 5,
					},
					Tags: []string{"data_breach", "unauthorized_access"},
				},
				expectError: nil,
			},
			{
				name: "empty type",
				command: &CreateSecurityIncidentCommand{
					Severity:    "HIGH",
					Title:       "Test incident",
					Description: "Test description",
				},
				expectError: ErrInvalidIncidentType,
			},
			{
				name: "empty severity",
				command: &CreateSecurityIncidentCommand{
					Type:        "DATA_BREACH",
					Title:       "Test incident",
					Description: "Test description",
				},
				expectError: ErrInvalidSeverity,
			},
			{
				name: "empty title",
				command: &CreateSecurityIncidentCommand{
					Type:        "DATA_BREACH",
					Severity:    "HIGH",
					Description: "Test description",
				},
				expectError: ErrInvalidTitle,
			},
			{
				name: "empty description",
				command: &CreateSecurityIncidentCommand{
					Type:     "DATA_BREACH",
					Severity: "HIGH",
					Title:    "Test incident",
				},
				expectError: ErrInvalidDescription,
			},
		}

		for _, tt := range tests {
			t.Run(tt.name, func(t *testing.T) {
				err := tt.command.Validate()
				if tt.expectError != nil {
					assert.Error(t, err)
					assert.Equal(t, tt.expectError, err)
				} else {
					assert.NoError(t, err)
				}
			})
		}
	})

	t.Run("ResolveSecurityIncidentCommand", func(t *testing.T) {
		tests := []struct {
			name        string
			command     *ResolveSecurityIncidentCommand
			expectError error
		}{
			{
				name: "valid command",
				command: &ResolveSecurityIncidentCommand{
					BaseCommand: BaseCommand{
						CommandID:   "cmd_123",
						AggregateID: "incident_456",
						Timestamp:   time.Now(),
					},
					Resolution: "False positive - user account was secured",
					Actions: []string{
						"Reset user password",
						"Enable MFA",
						"Review access logs",
					},
					Details: map[string]interface{}{
						"review_duration_hours": 2,
					},
				},
				expectError: nil,
			},
			{
				name: "empty resolution",
				command: &ResolveSecurityIncidentCommand{
					Actions: []string{"Action 1"},
				},
				expectError: ErrInvalidResolution,
			},
			{
				name: "valid command with minimal fields",
				command: &ResolveSecurityIncidentCommand{
					BaseCommand: BaseCommand{
						CommandID:   "cmd_123",
						AggregateID: "incident_456",
						Timestamp:   time.Now(),
					},
					Resolution: "Resolved",
					Actions:    []string{"Action 1"},
				},
				expectError: nil,
			},
		}

		for _, tt := range tests {
			t.Run(tt.name, func(t *testing.T) {
				err := tt.command.Validate()
				if tt.expectError != nil {
					assert.Error(t, err)
					assert.Equal(t, tt.expectError, err)
				} else {
					assert.NoError(t, err)
				}
			})
		}
	})
}

// Benchmark tests
func BenchmarkCommandValidation(b *testing.B) {
	clock := testing.NewTestClock(time.Now())
	factory := testing.NewTestDataFactory(clock)

	b.Run("RegisterUserCommand", func(b *testing.B) {
		cmd := &RegisterUserCommand{
			Email:     "test@example.com",
			Password:  "SecurePass123!",
			FirstName: "John",
			LastName:  "Doe",
			Role:      "USER",
			TenantID:  factory.GenerateID("tenant"),
		}

		b.ResetTimer()
		for i := 0; i < b.N; i++ {
			_ = cmd.Validate()
		}
	})

	b.Run("UploadDocumentCommand", func(b *testing.B) {
		cmd := &UploadDocumentCommand{
			FileName:    "document.pdf",
			FileSize:    1024 * 1024,
			ContentType: "application/pdf",
			Checksum:    "sha256:abc123",
		}

		b.ResetTimer()
		for i := 0; i < b.N; i++ {
			_ = cmd.Validate()
		}
	})

	b.Run("SubmitQueryCommand", func(b *testing.B) {
		cmd := &SubmitQueryCommand{
			Query: "What is the meaning of life?",
		}

		b.ResetTimer()
		for i := 0; i < b.N; i++ {
			_ = cmd.Validate()
		}
	})
}

// Helper function
func pointerToString(s string) *string {
	return &s
}

// Example tests
func ExampleRegisterUserCommand_Validate() {
	cmd := &RegisterUserCommand{
		Email:     "user@example.com",
		Password:  "SecurePass123!",
		FirstName: "John",
		LastName:  "Doe",
		Role:      "USER",
		TenantID:  "tenant_123",
	}

	err := cmd.Validate()
	if err != nil {
		fmt.Printf("Validation error: %v\n", err)
		return
	}

	fmt.Println("Command is valid")
	// Output: Command is valid
}

func ExampleUploadDocumentCommand_Validate() {
	cmd := &UploadDocumentCommand{
		FileName:    "document.pdf",
		FileSize:    1024 * 1024,
		ContentType: "application/pdf",
		Checksum:    "sha256:abc123def456",
		Description: "Important document",
	}

	err := cmd.Validate()
	if err != nil {
		fmt.Printf("Validation error: %v\n", err)
		return
	}

	fmt.Println("Document upload command is valid")
	// Output: Document upload command is valid
}
