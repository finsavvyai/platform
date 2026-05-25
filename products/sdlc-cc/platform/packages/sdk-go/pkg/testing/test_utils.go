package testing

import (
	"context"
	"encoding/json"
	"fmt"
	"math/rand"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/SDLC/sdln-sdk-go/pkg/domain"
	"github.com/SDLC/sdln-sdk-go/pkg/shared"
)

// TestClock provides controllable time for testing
type TestClock struct {
	currentTime time.Time
}

// NewTestClock creates a new test clock
func NewTestClock() *TestClock {
	return &TestClock{
		currentTime: time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC),
	}
}

// Now returns the current test time
func (c *TestClock) Now() time.Time {
	return c.currentTime
}

// SetTime sets the test time
func (c *TestClock) SetTime(t time.Time) {
	c.currentTime = t
}

// AdvanceTime advances the test time
func (c *TestClock) AdvanceTime(duration time.Duration) {
	c.currentTime = c.currentTime.Add(duration)
}

// TestDataFactory provides test data generation utilities
type TestDataFactory struct {
	clock   *TestClock
	counter int
}

// NewTestDataFactory creates a new test data factory
func NewTestDataFactory() *TestDataFactory {
	return &TestDataFactory{
		clock:   NewTestClock(),
		counter: 1,
	}
}

// GetClock returns the test clock
func (f *TestDataFactory) GetClock() *TestClock {
	return f.clock
}

// NextID returns a sequential ID
func (f *TestDataFactory) NextID() string {
	id := fmt.Sprintf("test_id_%d", f.counter)
	f.counter++
	return id
}

// NextEmail returns a test email
func (f *TestDataFactory) NextEmail() string {
	return fmt.Sprintf("user%d@test.com", f.counter)
}

// RandomEmail returns a random test email
func (f *TestDataFactory) RandomEmail() string {
	return fmt.Sprintf("user%d@test.com", rand.Intn(1000000))
}

// RandomString returns a random string of specified length
func (f *TestDataFactory) RandomString(length int) string {
	const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	b := make([]byte, length)
	for i := range b {
		b[i] = charset[rand.Intn(len(charset))]
	}
	return string(b)
}

// RandomUUID returns a random UUID
func (f *TestDataFactory) RandomUUID() string {
	return uuid.New().String()
}

// CreateTestUser creates a test user context
func (f *TestDataFactory) CreateTestUser() *shared.UserContext {
	userID := f.NextID()
	email := f.NextEmail()
	now := f.clock.Now()

	return &shared.UserContext{
		UserID:      userID,
		TenantID:    f.NextID(),
		Email:       email,
		Role:        shared.RoleUser,
		Permissions: []string{"read", "write"},
		Active:      true,
		Profile: shared.UserProfile{
			FirstName:  "Test",
			LastName:   "User",
			AvatarURL:  fmt.Sprintf("https://example.com/avatars/%s.png", userID),
			Timezone:   "UTC",
			Language:   "en",
			Department: "Engineering",
			Title:      "Software Engineer",
		},
		Sessions:    []shared.Session{},
		Preferences: map[string]interface{}{"theme": "dark"},
		LastLoginAt: &now,
		CreatedAt:   now,
		UpdatedAt:   now,
	}
}

// CreateTestTenant creates a test tenant context
func (f *TestDataFactory) CreateTestTenant() *shared.TenantContext {
	tenantID := f.NextID()
	now := f.clock.Now()

	return &shared.TenantContext{
		TenantID:  tenantID,
		Name:      "Test Tenant",
		Plan:      "enterprise",
		Status:    shared.StatusActive,
		CreatedAt: now,
		Config: shared.TenantConfig{
			AllowedDomains: []string{"test.com"},
			MaxUsers:       100,
			MaxDocuments:   1000,
			MaxStorage:     1024 * 1024 * 1024, // 1GB
			Features:       []string{"rag", "ai", "analytics"},
			Settings:       map[string]interface{}{"feature_flags": map[string]interface{}{"advanced_search": true}},
			Security: shared.SecurityConfig{
				RequireMFA:      true,
				AllowedIPRanges: []string{"192.168.1.0/24"},
				SessionTimeout:  30,
				PasswordPolicy: shared.PasswordPolicy{
					MinLength:        8,
					RequireUppercase: true,
					RequireLowercase: true,
					RequireNumbers:   true,
					RequireSymbols:   false,
					ExpiryDays:       90,
					HistoryCount:     5,
				},
				DataRetention:  365,
				AuditRetention: 2555, // 7 years
			},
			AI: shared.AIConfig{
				Model:       "gpt-4",
				MaxTokens:   4096,
				Temperature: 0.7,
				RAGEnabled:  true,
				VectorSearch: shared.VectorSearchConfig{
					Dimensions:          1536,
					SimilarityThreshold: 0.7,
					MaxResults:          10,
					IncludeMetadata:     true,
				},
				Prompts:  map[string]string{"system": "You are a helpful assistant."},
				Settings: map[string]interface{}{"cache_enabled": true},
			},
		},
		Features: []string{"rag", "ai", "analytics"},
		Settings: map[string]interface{}{"theme": "light"},
	}
}

// CreateTestDocument creates a test document context
func (f *TestDataFactory) CreateTestDocument() *shared.DocumentContext {
	documentID := f.NextID()
	now := f.clock.Now()

	return &shared.DocumentContext{
		DocumentID:  documentID,
		TenantID:    f.NextID(),
		UserID:      f.NextID(),
		Name:        "Test Document",
		Description: "A test document for unit testing",
		Type:        "pdf",
		MimeType:    "application/pdf",
		Size:        1024 * 1024, // 1MB
		Checksum:    f.RandomString(64),
		Status:      shared.DocumentStatusProcessed,
		Tags:        []string{"test", "document", "sample"},
		Metadata:    map[string]interface{}{"author": "Test User", "version": "1.0"},
		Version:     1,
		Chunks:      []shared.DocumentChunk{},
		VectorCount: 10,
		ProcessedAt: &now,
		CreatedAt:   now,
		UpdatedAt:   now,
		AccessControl: shared.AccessControl{
			Owner:       f.NextID(),
			Permissions: []shared.Permission{},
			Public:      false,
		},
	}
}

// CreateTestRAGContext creates a test RAG context
func (f *TestDataFactory) CreateTestRAGContext() *shared.RAGContext {
	queryID := f.NextID()
	now := f.clock.Now()

	return &shared.RAGContext{
		QueryID:     queryID,
		TenantID:    f.NextID(),
		UserID:      f.NextID(),
		Query:       "What is the meaning of life?",
		VectorQuery: []float32{0.1, 0.2, 0.3, 0.4, 0.5},
		Context:     []string{"Test context 1", "Test context 2"},
		Response:    "The meaning of life is 42, according to Douglas Adams.",
		Citations: []shared.Citation{
			{
				DocumentID:   f.NextID(),
				DocumentName: "The Hitchhiker's Guide to the Galaxy",
				ChunkID:      f.NextID(),
				Text:         "The answer to the ultimate question of life, the universe, and everything is 42.",
				Score:        0.95,
				Position:     1,
			},
		},
		Metadata: map[string]interface{}{
			"model":       "gpt-4",
			"temperature": 0.7,
			"max_tokens":  4096,
		},
		TokenUsage: shared.TokenUsage{
			InputTokens:  100,
			OutputTokens: 50,
			TotalTokens:  150,
		},
		Confidence:   0.85,
		ResponseTime: 1500,
		Model:        "gpt-4",
		Status:       "completed",
		CreatedAt:    now,
		ProcessedAt:  &now,
	}
}

// CreateTestPolicy creates a test policy context
func (f *TestDataFactory) CreateTestPolicy() *shared.PolicyContext {
	policyID := f.NextID()
	now := f.clock.Now()

	return &shared.PolicyContext{
		PolicyID: policyID,
		TenantID: f.NextID(),
		Name:     "Test Policy",
		Type:     "access_control",
		Status:   "active",
		Rules: []shared.PolicyRule{
			{
				ID:          f.NextID(),
				Name:        "Allow read access to documents",
				Description: "Users can read documents they have access to",
				Condition:   "user.role in ['admin', 'user'] && action == 'read'",
				Action:      "allow",
				Priority:    1,
				Enabled:     true,
				Parameters:  map[string]interface{}{"apply_to_all": true},
				Metadata:    map[string]interface{}{"category": "document_access"},
			},
		},
		Variables: map[string]interface{}{
			"user_roles":      []string{"admin", "user", "viewer"},
			"allowed_actions": []string{"read", "write", "delete"},
		},
		Metadata:  map[string]interface{}{"category": "security"},
		Version:   1,
		CreatedBy: f.NextID(),
		CreatedAt: now,
		UpdatedAt: now,
	}
}

// CreateTestPaymentContext creates a test payment context
func (f *TestDataFactory) CreateTestPaymentContext() *shared.PaymentContext {
	paymentID := f.NextID()
	now := f.clock.Now()

	return &shared.PaymentContext{
		PaymentID:    paymentID,
		TenantID:     f.NextID(),
		UserID:       f.NextID(),
		Amount:       9999, // $99.99 in cents
		Currency:     "USD",
		Status:       shared.PaymentStatusCompleted,
		Description:  "Test payment",
		TokenID:      f.NextID(),
		ProcessorID:  "test_processor",
		GatewayTxnID: fmt.Sprintf("txn_%s", f.RandomString(16)),
		Metadata:     map[string]interface{}{"source": "api"},
		CreatedAt:    now,
		ProcessedAt:  &now,
	}
}

// CreateTestUserRegisteredEvent creates a test user registered event
func (f *TestDataFactory) CreateTestUserRegisteredEvent() *domain.UserRegisteredEvent {
	userID := f.NextID()
	email := f.NextEmail()
	tenantID := f.NextID()

	return &domain.UserRegisteredEvent{
		BaseEvent: domain.NewBaseEvent(userID, "user", "user_registered", 1, map[string]interface{}{
			"email":     email,
			"tenant_id": tenantID,
			"role":      shared.RoleUser,
		}),
		Email:    email,
		TenantID: tenantID,
		Role:     shared.RoleUser,
	}
}

// CreateTestDocumentUploadedEvent creates a test document uploaded event
func (f *TestDataFactory) CreateTestDocumentUploadedEvent() *domain.DocumentUploadedEvent {
	documentID := f.NextID()
	userID := f.NextID()
	tenantID := f.NextID()

	return &domain.DocumentUploadedEvent{
		BaseEvent: domain.NewBaseEvent(documentID, "document", "document_uploaded", 1, map[string]interface{}{
			"tenant_id":    tenantID,
			"user_id":      userID,
			"file_name":    "test_document.pdf",
			"content_type": "application/pdf",
			"checksum":     f.RandomString(64),
			"file_size":    1024 * 1024,
		}),
		DocumentID:  documentID,
		UserID:      userID,
		TenantID:    tenantID,
		FileName:    "test_document.pdf",
		FileSize:    1024 * 1024,
		ContentType: "application/pdf",
		Checksum:    f.RandomString(64),
	}
}

// CreateTestQuerySubmittedEvent creates a test query submitted event
func (f *TestDataFactory) CreateTestQuerySubmittedEvent() *domain.QuerySubmittedEvent {
	queryID := f.NextID()
	userID := f.NextID()
	tenantID := f.NextID()

	return &domain.QuerySubmittedEvent{
		BaseEvent: domain.NewBaseEvent(queryID, "query", "query_submitted", 1, map[string]interface{}{
			"query_id":     queryID,
			"user_id":      userID,
			"tenant_id":    tenantID,
			"query":        "What is testing?",
			"vector_query": []float32{0.1, 0.2, 0.3, 0.4, 0.5},
			"context":      []string{"test context"},
		}),
		QueryID:     queryID,
		UserID:      userID,
		TenantID:    tenantID,
		Query:       "What is testing?",
		VectorQuery: []float32{0.1, 0.2, 0.3, 0.4, 0.5},
		Context:     []string{"test context"},
	}
}

// MockEventStore provides a mock implementation of EventStore for testing
type MockEventStore struct {
	events    map[string][]domain.Event
	snapshots map[string]*domain.Snapshot
	saveError error
	getError  error
}

// NewMockEventStore creates a new mock event store
func NewMockEventStore() *MockEventStore {
	return &MockEventStore{
		events:    make(map[string][]domain.Event),
		snapshots: make(map[string]*domain.Snapshot),
	}
}

// SaveEvents saves events to the mock store
func (m *MockEventStore) SaveEvents(aggregateID string, events []domain.Event, expectedVersion int) error {
	if m.saveError != nil {
		return m.saveError
	}

	if m.events[aggregateID] == nil {
		m.events[aggregateID] = []domain.Event{}
	}

	m.events[aggregateID] = append(m.events[aggregateID], events...)
	return nil
}

// GetEvents gets events from the mock store
func (m *MockEventStore) GetEvents(aggregateID string, fromVersion int) ([]domain.Event, error) {
	if m.getError != nil {
		return nil, m.getError
	}

	events, exists := m.events[aggregateID]
	if !exists {
		return []domain.Event{}, nil
	}

	if fromVersion <= 0 {
		return events, nil
	}

	if fromVersion > len(events) {
		return []domain.Event{}, nil
	}

	return events[fromVersion:], nil
}

// GetEventsFromSnapshot gets events from the latest snapshot
func (m *MockEventStore) GetEventsFromSnapshot(aggregateID string, fromVersion int) ([]domain.Event, error) {
	snapshot, exists := m.snapshots[aggregateID]
	if exists && snapshot.Version >= fromVersion {
		return m.GetEvents(aggregateID, snapshot.Version)
	}

	return m.GetEvents(aggregateID, fromVersion)
}

// SaveSnapshot saves a snapshot to the mock store
func (m *MockEventStore) SaveSnapshot(aggregateID string, snapshot domain.Snapshot) error {
	m.snapshots[aggregateID] = &snapshot
	return nil
}

// GetSnapshot gets a snapshot from the mock store
func (m *MockEventStore) GetSnapshot(aggregateID string) (*domain.Snapshot, error) {
	snapshot, exists := m.snapshots[aggregateID]
	if !exists {
		return nil, nil
	}

	return snapshot, nil
}

// SetSaveError sets an error to be returned by SaveEvents
func (m *MockEventStore) SetSaveError(err error) {
	m.saveError = err
}

// SetGetError sets an error to be returned by GetEvents
func (m *MockEventStore) SetGetError(err error) {
	m.getError = err
}

// GetStoredEvents returns all stored events for testing
func (m *MockEventStore) GetStoredEvents() map[string][]domain.Event {
	return m.events
}

// GetStoredSnapshots returns all stored snapshots for testing
func (m *MockEventStore) GetStoredSnapshots() map[string]*domain.Snapshot {
	return m.snapshots
}

// AssertEventsEqual asserts that two events are equal
func AssertEventsEqual(t *testing.T, expected, actual domain.Event) {
	t.Helper()

	if expected.GetID() != actual.GetID() {
		t.Errorf("Expected event ID %s, got %s", expected.GetID(), actual.GetID())
	}

	if expected.GetAggregateID() != actual.GetAggregateID() {
		t.Errorf("Expected aggregate ID %s, got %s", expected.GetAggregateID(), actual.GetAggregateID())
	}

	if expected.GetEventType() != actual.GetEventType() {
		t.Errorf("Expected event type %s, got %s", expected.GetEventType(), actual.GetEventType())
	}

	if expected.GetVersion() != actual.GetVersion() {
		t.Errorf("Expected version %d, got %d", expected.GetVersion(), actual.GetVersion())
	}

	// Compare data
	expectedData := expected.GetData()
	actualData := actual.GetData()
	if !jsonEqual(expectedData, actualData) {
		t.Errorf("Expected event data %+v, got %+v", expectedData, actualData)
	}
}

// AssertUsersEqual asserts that two user contexts are equal
func AssertUsersEqual(t *testing.T, expected, actual *shared.UserContext) {
	t.Helper()

	if expected.UserID != actual.UserID {
		t.Errorf("Expected user ID %s, got %s", expected.UserID, actual.UserID)
	}

	if expected.Email != actual.Email {
		t.Errorf("Expected email %s, got %s", expected.Email, actual.Email)
	}

	if expected.TenantID != actual.TenantID {
		t.Errorf("Expected tenant ID %s, got %s", expected.TenantID, actual.TenantID)
	}

	if expected.Role != actual.Role {
		t.Errorf("Expected role %s, got %s", expected.Role, actual.Role)
	}
}

// jsonEqual compares two JSON objects for equality
func jsonEqual(a, b map[string]interface{}) bool {
	aBytes, _ := json.Marshal(a)
	bBytes, _ := json.Marshal(b)
	return string(aBytes) == string(bBytes)
}

// TestContext provides test context for concurrent testing
type TestContext struct {
	Context   context.Context
	Cancel    context.CancelFunc
	Timeout   time.Duration
	StartTime time.Time
	Factory   *TestDataFactory
	MockStore *MockEventStore
}

// NewTestContext creates a new test context
func NewTestContext(t *testing.T, timeout time.Duration) *TestContext {
	ctx, cancel := context.WithTimeout(context.Background(), timeout)

	return &TestContext{
		Context:   ctx,
		Cancel:    cancel,
		Timeout:   timeout,
		StartTime: time.Now(),
		Factory:   NewTestDataFactory(),
		MockStore: NewMockEventStore(),
	}
}

// Cleanup cleans up the test context
func (tc *TestContext) Cleanup() {
	if tc.Cancel != nil {
		tc.Cancel()
	}
}

// Elapsed returns the elapsed time since test context creation
func (tc *TestContext) Elapsed() time.Duration {
	return time.Since(tc.StartTime)
}

// AssertNoError asserts that there is no error
func (tc *TestContext) AssertNoError(t *testing.T, err error) {
	t.Helper()
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}
}

// AssertError asserts that there is an error
func (tc *TestContext) AssertError(t *testing.T, err error, expectedMessage string) {
	t.Helper()
	if err == nil {
		t.Fatal("Expected error but got nil")
	}
	if expectedMessage != "" && err.Error() != expectedMessage {
		t.Errorf("Expected error message '%s', got '%s'", expectedMessage, err.Error())
	}
}
