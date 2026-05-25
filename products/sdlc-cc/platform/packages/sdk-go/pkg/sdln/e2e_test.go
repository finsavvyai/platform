//go:build never
// +build never

// e2e_test.go - End-to-End Tests for Critical User Journeys
package sdln

import (
	"context"
	"errors"
	"fmt"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
	"github.com/stretchr/testify/suite"
)

// E2ETestSuite tests complete user journeys
type E2ETestSuite struct {
	suite.Suite
	config      *Config
	client      *Client
	adminClient *Client
	testUsers   []*User
	testTenants []*Tenant
	cleanupData []string
}

// SetupSuite runs once before all E2E tests
func (suite *E2ETestSuite) SetupSuite() {
	// Load configuration from environment
	suite.config = &Config{
		APIBaseURL: getEnvOrDefault("SDLC_E2E_API_URL", "https://api.sdln.ai"),
		APIKey:     getEnvOrDefault("SDLC_E2E_API_KEY", ""),
		AdminKey:   getEnvOrDefault("SDLC_E2E_ADMIN_KEY", ""),
		Timeout:    60 * time.Second,
	}

	require.NotEmpty(suite.T(), suite.config.APIKey, "API key is required for E2E tests")

	// Initialize clients
	suite.initializeClients()

	// Setup test data
	suite.setupTestData()

	suite.T().Log("E2E test suite setup complete")
}

// TearDownSuite runs once after all E2E tests
func (suite *E2ETestSuite) TearDownSuite() {
	// Cleanup test data
	suite.cleanupTestData()

	suite.T().Log("E2E test suite teardown complete")
}

// initializeClients creates authenticated clients
func (suite *E2ETestSuite) initializeClients() {
	var err error

	// Regular user client
	suite.client, err = NewClient(suite.config.APIBaseURL, suite.config.APIKey)
	require.NoError(suite.T(), err)
	suite.client.SetTimeout(suite.config.Timeout)

	// Admin client
	if suite.config.AdminKey != "" {
		suite.adminClient, err = NewClient(suite.config.APIBaseURL, suite.config.AdminKey)
		require.NoError(suite.T(), err)
		suite.adminClient.SetTimeout(suite.config.Timeout)
	}
}

// setupTestData creates test tenants and users
func (suite *E2ETestSuite) setupTestData() {
	ctx := context.Background()

	// Create test tenants
	suite.testTenants = []*Tenant{
		{
			ID:          uuid.New().String(),
			Name:        "E2E Test Organization",
			Description: "Organization for end-to-end testing",
			Settings: map[string]interface{}{
				"max_users":     100,
				"storage_limit": 1000000,
				"allow_ai":      true,
			},
		},
		{
			ID:          uuid.New().String(),
			Name:        "E2E Test Department",
			Description: "Department for testing multi-tenant features",
			ParentID:    "", // Will be set to first tenant
			Settings: map[string]interface{}{
				"max_users":     50,
				"storage_limit": 500000,
				"allow_ai":      true,
			},
		},
	}

	// Create test users
	suite.testUsers = []*User{
		{
			ID:       uuid.New().String(),
			Email:    "admin@e2e.test",
			Name:     "E2E Admin User",
			Role:     "admin",
			TenantID: suite.testTenants[0].ID,
		},
		{
			ID:       uuid.New().String(),
			Email:    "user1@e2e.test",
			Name:     "E2E Regular User 1",
			Role:     "user",
			TenantID: suite.testTenants[0].ID,
		},
		{
			ID:       uuid.New().String(),
			Email:    "user2@e2e.test",
			Name:     "E2E Regular User 2",
			Role:     "user",
			TenantID: suite.testTenants[1].ID,
		},
	}

	// Store IDs for cleanup
	for _, tenant := range suite.testTenants {
		suite.cleanupData = append(suite.cleanupData, fmt.Sprintf("tenant:%s", tenant.ID))
	}
	for _, user := range suite.testUsers {
		suite.cleanupData = append(suite.cleanupData, fmt.Sprintf("user:%s", user.ID))
	}
}

// cleanupTestData removes all created test data
func (suite *E2ETestSuite) cleanupTestData() {
	ctx := context.Background()

	if suite.adminClient == nil {
		suite.T().Log("No admin client available for cleanup")
		return
	}

	// Cleanup documents, policies, etc. before cleaning users and tenants
	for _, id := range suite.cleanupData {
		parts := strings.Split(id, ":")
		if len(parts) != 2 {
			continue
		}

		switch parts[0] {
		case "document":
			suite.adminClient.Documents().Delete(ctx, parts[1])
		case "policy":
			suite.adminClient.Policies().Delete(ctx, parts[1])
		case "user":
			suite.adminClient.Users().Delete(ctx, parts[1])
		case "tenant":
			suite.adminClient.Tenants().Delete(ctx, parts[1])
		}
	}
}

// TestUserOnboardingJourney tests the complete user onboarding flow
func (suite *E2ETestSuite) TestUserOnboardingJourney() {
	ctx := context.Background()

	suite.Run("Step1_UserRegistration", func() {
		// Register new user
		newUser := &User{
			Email:    fmt.Sprintf("newuser+%s@e2e.test", uuid.New().String()[:8]),
			Name:     "New Test User",
			Password: "SecurePassword123!",
			TenantID: suite.testTenants[0].ID,
		}

		createdUser, err := suite.client.Users().Create(ctx, newUser)
		require.NoError(suite.T(), err)
		require.NotEmpty(suite.T(), createdUser.ID)
		require.Equal(suite.T(), newUser.Email, createdUser.Email)

		// Store for cleanup
		suite.cleanupData = append(suite.cleanupData, fmt.Sprintf("user:%s", createdUser.ID))

		// Verify user can login
		token, err := suite.client.Auth().Login(ctx, newUser.Email, newUser.Password)
		require.NoError(suite.T(), err)
		require.NotEmpty(suite.T(), token)

		// Set token for subsequent requests
		suite.client.SetAuthToken(token)
	})

	suite.Run("Step2_EmailVerification", func() {
		// Simulate email verification
		verificationCode := "123456"

		err := suite.client.Auth().VerifyEmail(ctx, verificationCode)
		require.NoError(suite.T(), err)

		// Check user status
		user, err := suite.client.Users().GetMe(ctx)
		require.NoError(suite.T(), err)
		require.True(suite.T(), user.EmailVerified)
	})

	suite.Run("Step3_ProfileSetup", func() {
		// Update user profile
		profile := &UserProfile{
			FirstName:  "John",
			LastName:   "Doe",
			Title:      "Software Engineer",
			Department: "Engineering",
			Avatar:     "https://example.com/avatar.jpg",
		}

		updatedUser, err := suite.client.Users().UpdateProfile(ctx, profile)
		require.NoError(suite.T(), err)
		require.Equal(suite.T(), profile.FirstName, updatedUser.FirstName)
		require.Equal(suite.T(), profile.LastName, updatedUser.LastName)
	})

	suite.Run("Step4_APIKeyGeneration", func() {
		// Generate API key for the user
		apiKey, err := suite.client.Users().GenerateAPIKey(ctx, &APIKeyRequest{
			Name:        "E2E Test Key",
			Permissions: []string{"read", "write"},
			ExpiresAt:   time.Now().Add(30 * 24 * time.Hour), // 30 days
		})
		require.NoError(suite.T(), err)
		require.NotEmpty(suite.T(), apiKey.Key)

		// Test API key works
		newClient, err := NewClient(suite.config.APIBaseURL, apiKey.Key)
		require.NoError(suite.T(), err)

		me, err := newClient.Users().GetMe(ctx)
		require.NoError(suite.T(), err)
		require.NotEmpty(suite.T(), me.ID)
	})
}

// TestDocumentManagementJourney tests document lifecycle
func (suite *E2ETestSuite) TestDocumentManagementJourney() {
	ctx := context.Background()
	var createdDocument *Document

	suite.Run("Step1_DocumentUpload", func() {
		// Upload a document
		doc := &Document{
			Title:       "E2E Test Document",
			Description: "Document created during E2E testing",
			Content:     strings.Repeat("This is test content for E2E testing. ", 100),
			Tags:        []string{"e2e", "test", "document"},
			Metadata: map[string]interface{}{
				"author":      "E2E Test Suite",
				"department":  "QA",
				"sensitivity": "internal",
			},
			Visibility: "private",
		}

		createdDoc, err := suite.client.Documents().Create(ctx, doc)
		require.NoError(suite.T(), err)
		require.NotEmpty(suite.T(), createdDoc.ID)

		createdDocument = createdDoc
		suite.cleanupData = append(suite.cleanupData, fmt.Sprintf("document:%s", createdDoc.ID))
	})

	suite.Run("Step2_DocumentProcessing", func() {
		// Wait for document to be processed
		require.Eventually(suite.T(), func() bool {
			doc, err := suite.client.Documents().Get(ctx, createdDocument.ID)
			if err != nil {
				return false
			}
			return doc.Status == "processed"
		}, 30*time.Second, 1*time.Second, "Document should be processed within 30 seconds")

		// Check extracted entities
		doc, err := suite.client.Documents().Get(ctx, createdDocument.ID)
		require.NoError(suite.T(), err)
		require.NotEmpty(suite.T(), doc.Entities)
	})

	suite.Run("Step3_DocumentSearch", func() {
		// Search for the document
		filter := &DocumentFilter{
			Query:    "E2E Test",
			TenantID: suite.testTenants[0].ID,
			Limit:    10,
		}

		docs, total, err := suite.client.Documents().List(ctx, filter)
		require.NoError(suite.T(), err)
		require.GreaterOrEqual(suite.T(), len(docs), 1)
		require.GreaterOrEqual(suite.T(), total, int64(1))

		// Verify our document is in results
		found := false
		for _, d := range docs {
			if d.ID == createdDocument.ID {
				found = true
				break
			}
		}
		require.True(suite.T(), found, "Created document should be found in search results")
	})

	suite.Run("Step4_DocumentUpdate", func() {
		// Update document
		createdDocument.Title = "Updated E2E Test Document"
		createdDocument.Tags = append(createdDocument.Tags, "updated")

		updatedDoc, err := suite.client.Documents().Update(ctx, createdDocument)
		require.NoError(suite.T(), err)
		require.Equal(suite.T(), createdDocument.Title, updatedDoc.Title)
		require.Contains(suite.T(), updatedDoc.Tags, "updated")
	})

	suite.Run("Step5_DocumentSharing", func() {
		// Share document with another user
		shareRequest := &ShareRequest{
			DocumentID: createdDocument.ID,
			UserEmail:  suite.testUsers[1].Email,
			Permission: "read",
			ExpiresAt:  time.Now().Add(7 * 24 * time.Hour),
		}

		share, err := suite.client.Documents().Share(ctx, shareRequest)
		require.NoError(suite.T(), err)
		require.NotEmpty(suite.T(), share.ID)

		// Verify shared user can access document
		userClient, err := suite.client.Impersonate(suite.testUsers[1].ID)
		require.NoError(suite.T(), err)

		sharedDoc, err := userClient.Documents().Get(ctx, createdDocument.ID)
		require.NoError(suite.T(), err)
		require.Equal(suite.T(), createdDocument.ID, sharedDoc.ID)
	})

	suite.Run("Step6_DocumentVersioning", func() {
		// Create a new version
		newContent := "Updated content with additional information for version 2"

		newVersion, err := suite.client.Documents().CreateVersion(ctx, createdDocument.ID, &DocumentVersion{
			Content: newContent,
			Comment: "Added more details",
		})
		require.NoError(suite.T(), err)
		require.NotEmpty(suite.T(), newVersion.ID)
		require.Equal(suite.T(), 2, newVersion.Version)

		// List versions
		versions, err := suite.client.Documents().ListVersions(ctx, createdDocument.ID)
		require.NoError(suite.T(), err)
		require.Len(suite.T(), versions, 2)
	})
}

// TestAIInteractionJourney tests AI-powered features
func (suite *E2ETestSuite) TestAIInteractionJourney() {
	ctx := context.Background()
	var testDocument *Document

	// First create a document for AI processing
	suite.Run("Prepare_TestDocument", func() {
		doc := &Document{
			Title: "AI Test Document - Machine Learning Basics",
			Content: `
				Machine learning is a subset of artificial intelligence that enables systems to learn and improve from experience without being explicitly programmed.
				It focuses on developing computer programs that can access data and use it to learn for themselves.

				The process of learning begins with observations or data, such as examples, direct experience, or instruction, in order to look for patterns in data and make better decisions in the future based on the examples that we provide.

				The primary aim is to allow the computers to learn automatically without human intervention or assistance and adjust actions accordingly.
			`,
			TenantID: suite.testTenants[0].ID,
			Tags:     []string{"ml", "ai", "basics"},
		}

		created, err := suite.client.Documents().Create(ctx, doc)
		require.NoError(suite.T(), err)
		testDocument = created
		suite.cleanupData = append(suite.cleanupData, fmt.Sprintf("document:%s", created.ID))
	})

	suite.Run("Step1_DocumentSummarization", func() {
		// Generate AI summary
		summary, err := suite.client.AI().SummarizeDocument(ctx, &SummarizeRequest{
			DocumentID: testDocument.ID,
			Length:     "short",        // short, medium, long
			Style:      "professional", // casual, professional, technical
		})
		require.NoError(suite.T(), err)
		require.NotEmpty(suite.T(), summary.Text)
		require.Contains(suite.T(), summary.Text, "machine learning")
	})

	suite.Run("Step2_QuestionAnswering", func() {
		// Ask questions about the document
		questions := []string{
			"What is machine learning?",
			"How does machine learning work?",
			"What is the primary aim of machine learning?",
		}

		for _, question := range questions {
			answer, err := suite.client.AI().AskAboutDocument(ctx, &QuestionRequest{
				DocumentID: testDocument.ID,
				Question:   question,
			})
			require.NoError(suite.T(), err)
			require.NotEmpty(suite.T(), answer.Text)
			require.NotEqual(suite.T(), answer.Text, "I don't know")
		}
	})

	suite.Run("Step3_SemanticSearch", func() {
		// Semantic search across documents
		query := "How do computers learn from experience?"

		results, err := suite.client.AI().SemanticSearch(ctx, &SemanticSearchRequest{
			Query:    query,
			TopK:     5,
			TenantID: suite.testTenants[0].ID,
		})
		require.NoError(suite.T(), err)
		require.GreaterOrEqual(suite.T(), len(results), 1)

		// Our test document should be in results
		found := false
		for _, result := range results {
			if result.DocumentID == testDocument.ID {
				found = true
				require.Greater(suite.T(), result.Score, float32(0.5))
				break
			}
		}
		require.True(suite.T(), found)
	})

	suite.Run("Step4_DocumentClassification", func() {
		// Classify document
		classification, err := suite.client.AI().ClassifyDocument(ctx, &ClassificationRequest{
			DocumentID: testDocument.ID,
			Categories: []string{"Technology", "Business", "Science", "Education", "Other"},
		})
		require.NoError(suite.T(), err)
		require.NotEmpty(suite.T(), classification.Category)
		require.Equal(suite.T(), "Technology", classification.Category)
		require.Greater(suite.T(), classification.Confidence, float32(0.8))
	})

	suite.Run("Step5_ContentGeneration", func() {
		// Generate related content
		content, err := suite.client.AI().GenerateContent(ctx, &GenerateContentRequest{
			Prompt: fmt.Sprintf("Based on this document about machine learning, write a beginner-friendly introduction to the topic. Reference the key concepts from: %s", testDocument.ID),
			Type:   "blog_post",   // blog_post, tutorial, summary, etc.
			Length: 300,           // words
			Tone:   "educational", // educational, casual, professional
		})
		require.NoError(suite.T(), err)
		require.NotEmpty(suite.T(), content.Text)
		require.Greater(suite.T(), len(content.Text), 100)
	})
}

// TestComplianceAndSecurityJourney tests security and compliance features
func (suite *E2ETestSuite) TestComplianceAndSecurityJourney() {
	ctx := context.Background()
	var sensitiveDocument *Document

	suite.Run("Step1_CreateSensitiveDocument", func() {
		// Create document with PII
		doc := &Document{
			Title: "Employee Information - Sensitive",
			Content: `
				Employee Details:
				Name: John Doe
				Email: john.doe@company.com
				Phone: +1-555-0123
				SSN: 123-45-6789
				Address: 123 Main St, New York, NY 10001

				Performance Review:
				John has been performing excellently in his role as Senior Software Engineer.
				His SSN is 123-45-6789 for payroll purposes.
				Contact him at john.doe@company.com or +1-555-0123.
			`,
			TenantID: suite.testTenants[0].ID,
			Metadata: map[string]interface{}{
				"contains_pii": true,
				"department":   "HR",
			},
		}

		created, err := suite.client.Documents().Create(ctx, doc)
		require.NoError(suite.T(), err)
		sensitiveDocument = created
		suite.cleanupData = append(suite.cleanupData, fmt.Sprintf("document:%s", created.ID))
	})

	suite.Run("Step2_DLPScanning", func() {
		// Verify DLP scanning detected PII
		require.Eventually(suite.T(), func() bool {
			doc, err := suite.client.Documents().Get(ctx, sensitiveDocument.ID)
			if err != nil {
				return false
			}
			return doc.DLPStatus == "scanned"
		}, 10*time.Second, 1*time.Second)

		doc, err := suite.client.Documents().Get(ctx, sensitiveDocument.ID)
		require.NoError(suite.T(), err)
		require.True(suite.T(), doc.ContainsPII)
		require.NotEmpty(suite.T(), doc.PIIEntities)
	})

	suite.Run("Step3_ContentRedaction", func() {
		// Get redacted version
		redacted, err := suite.client.Documents().GetRedacted(ctx, sensitiveDocument.ID, &RedactionRequest{
			Types: []string{"ssn", "phone", "email"},
		})
		require.NoError(suite.T(), err)
		require.NotEmpty(suite.T(), redacted.Content)

		// Verify PII is redacted
		require.NotContains(suite.T(), redacted.Content, "123-45-6789")
		require.NotContains(suite.T(), redacted.Content, "+1-555-0123")
		require.NotContains(suite.T(), redacted.Content, "john.doe@company.com")
		require.Contains(suite.T(), redacted.Content, "[REDACTED]")
	})

	suite.Run("Step4_AccessControl", func() {
		// Create restrictive policy
		policy := &Policy{
			Name:        "Sensitive Document Access",
			Description: "Restricts access to documents with PII",
			TenantID:    suite.testTenants[0].ID,
			Rules: []PolicyRule{
				{
					Effect:   "allow",
					Action:   []string{"read"},
					Resource: []string{"documents"},
					Condition: map[string]interface{}{
						"document.attributes.contains_pii": map[string]interface{}{
							"eq": false,
						},
					},
				},
				{
					Effect:   "allow",
					Action:   []string{"read"},
					Resource: []string{"documents"},
					Condition: map[string]interface{}{
						"user.role": map[string]interface{}{
							"in": []string{"admin", "hr"},
						},
					},
				},
			},
		}

		createdPolicy, err := suite.client.Policies().Create(ctx, policy)
		require.NoError(suite.T(), err)
		suite.cleanupData = append(suite.cleanupData, fmt.Sprintf("policy:%s", createdPolicy.ID))

		// Test regular user cannot access
		userClient, err := suite.client.Impersonate(suite.testUsers[1].ID)
		require.NoError(suite.T(), err)

		_, err = userClient.Documents().Get(ctx, sensitiveDocument.ID)
		require.Error(suite.T(), err)
		require.True(suite.T(), errors.Is(err, ErrUnauthorized) || errors.Is(err, ErrForbidden))

		// Test admin can access
		adminClient, err := suite.client.Impersonate(suite.testUsers[0].ID)
		require.NoError(suite.T(), err)

		_, err = adminClient.Documents().Get(ctx, sensitiveDocument.ID)
		require.NoError(suite.T(), err)
	})

	suite.Run("Step5_AuditLogging", func() {
		// Check audit logs for access attempts
		auditFilter := &AuditFilter{
			ResourceID: sensitiveDocument.ID,
			Action:     []string{"read", "access_denied"},
			StartTime:  time.Now().Add(-1 * time.Hour),
			EndTime:    time.Now(),
		}

		logs, err := suite.client.Audit().List(ctx, auditFilter)
		require.NoError(suite.T(), err)
		require.GreaterOrEqual(suite.T(), len(logs), 1)

		// Verify denied access is logged
		foundDenied := false
		for _, log := range logs {
			if log.Action == "access_denied" && log.UserID == suite.testUsers[1].ID {
				foundDenied = true
				require.NotEmpty(suite.T(), log.Reason)
				break
			}
		}
		require.True(suite.T(), foundDenied, "Access denial should be logged")
	})
}

// TestMultiTenantWorkflow tests multi-tenant scenarios
func (suite *E2ETestSuite) TestMultiTenantWorkflow() {
	ctx := context.Background()

	suite.Run("Step1_TenantIsolation", func() {
		// Create documents in different tenants
		doc1 := &Document{
			Title:    "Tenant 1 Secret Document",
			Content:  "This is confidential information for tenant 1",
			TenantID: suite.testTenants[0].ID,
		}

		doc2 := &Document{
			Title:    "Tenant 2 Secret Document",
			Content:  "This is confidential information for tenant 2",
			TenantID: suite.testTenants[1].ID,
		}

		// Create documents with respective tenant contexts
		client1 := suite.client
		client1.SetTenantID(suite.testTenants[0].ID)

		client2 := suite.client
		client2.SetTenantID(suite.testTenants[1].ID)

		created1, err := client1.Documents().Create(ctx, doc1)
		require.NoError(suite.T(), err)
		suite.cleanupData = append(suite.cleanupData, fmt.Sprintf("document:%s", created1.ID))

		created2, err := client2.Documents().Create(ctx, doc2)
		require.NoError(suite.T(), err)
		suite.cleanupData = append(suite.cleanupData, fmt.Sprintf("document:%s", created2.ID))

		// Test isolation
		_, err = client1.Documents().Get(ctx, created2.ID)
		require.Error(suite.T(), err)

		_, err = client2.Documents().Get(ctx, created1.ID)
		require.Error(suite.T(), err)
	})

	suite.Run("Step2_CrossTenantSharing", func() {
		// Test controlled sharing between tenants
		shareRequest := &CrossTenantShareRequest{
			DocumentID:     "", // Will be set
			TargetTenantID: suite.testTenants[1].ID,
			Permission:     "read",
			Duration:       24 * time.Hour,
			Reason:         "Collaboration on project",
		}

		// Requires admin approval for cross-tenant sharing
		if suite.adminClient != nil {
			// Admin creates sharing approval
			approval, err := suite.adminClient.Tenants().ApproveCrossTenantShare(ctx, shareRequest)
			require.NoError(suite.T(), err)
			require.NotEmpty(suite.T(), approval.ID)
		}
	})
}

// TestDisasterRecovery tests backup and recovery scenarios
func (suite *E2ETestSuite) TestDisasterRecovery() {
	ctx := context.Background()

	suite.Run("Step1_DataBackup", func() {
		// Create backup request
		backup, err := suite.client.Backup().Create(ctx, &BackupRequest{
			Type:        "full", // full, incremental, differential
			Compression: true,
			Encryption:  true,
			Retention:   30 * 24 * time.Hour, // 30 days
		})
		require.NoError(suite.T(), err)
		require.NotEmpty(suite.T(), backup.ID)

		// Wait for backup to complete
		require.Eventually(suite.T(), func() bool {
			status, err := suite.client.Backup().GetStatus(ctx, backup.ID)
			if err != nil {
				return false
			}
			return status.State == "completed"
		}, 2*time.Minute, 5*time.Second, "Backup should complete within 2 minutes")
	})

	suite.Run("Step2_DataRestore", func() {
		// Test restore functionality (in non-production environment)
		if os.Getenv("SDLC_E2E_ALLOW_RESTORE") == "true" {
			restoreRequest := &RestoreRequest{
				BackupID:   "latest",
				TargetDate: time.Now().Add(-1 * time.Hour),
				DryRun:     true, // Don't actually restore in E2E tests
			}

			restore, err := suite.client.Backup().Restore(ctx, restoreRequest)
			require.NoError(suite.T(), err)
			require.NotNil(suite.T(), restore.Plan)
			require.Greater(suite.T(), len(restore.Plan.Steps), 0)
		}
	})
}

// Helper function
func getEnvOrDefault(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

// TestE2ESuiteRunner runs the E2E test suite
func TestE2ESuiteRunner(t *testing.T) {
	// Skip E2E tests if not enabled
	if os.Getenv("SKIP_E2E_TESTS") == "true" {
		t.Skip("Skipping E2E tests")
	}

	suite.Run(t, new(E2ETestSuite))
}
