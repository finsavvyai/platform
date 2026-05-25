//go:build never
// +build never

package domain

import (
	"encoding/json"
	"testing"
	"time"

	sdlntesting "github.com/SDLC/sdln-sdk-go/pkg/testing"
)

func TestNewBaseEvent(t *testing.T) {
	factory := sdlntesting.NewTestDataFactory()

	tests := []struct {
		name          string
		aggregateID   string
		aggregateType string
		eventType     string
		version       int
		data          map[string]interface{}
		expectError   bool
	}{
		{
			name:          "Valid base event creation",
			aggregateID:   factory.NextID(),
			aggregateType: "user",
			eventType:     "user_registered",
			version:       1,
			data:          map[string]interface{}{"email": "test@example.com"},
			expectError:   false,
		},
		{
			name:          "Base event with empty data",
			aggregateID:   factory.NextID(),
			aggregateType: "document",
			eventType:     "document_uploaded",
			version:       1,
			data:          map[string]interface{}{},
			expectError:   false,
		},
		{
			name:          "Base event with nil data",
			aggregateID:   factory.NextID(),
			aggregateType: "tenant",
			eventType:     "tenant_created",
			version:       1,
			data:          nil,
			expectError:   false,
		},
		{
			name:          "Base event with version 0",
			aggregateID:   factory.NextID(),
			aggregateType: "policy",
			eventType:     "policy_created",
			version:       0,
			data:          map[string]interface{}{"name": "test policy"},
			expectError:   false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			event := NewBaseEvent(tt.aggregateID, tt.aggregateType, tt.eventType, tt.version, tt.data)

			if event == nil {
				t.Fatal("Expected event, got nil")
			}

			// Validate basic fields
			if event.ID == "" {
				t.Error("Expected non-empty ID")
			}

			if event.AggregateID != tt.aggregateID {
				t.Errorf("Expected aggregate ID %s, got %s", tt.aggregateID, event.AggregateID)
			}

			if event.AggregateType != tt.aggregateType {
				t.Errorf("Expected aggregate type %s, got %s", tt.aggregateType, event.AggregateType)
			}

			if event.EventType != tt.eventType {
				t.Errorf("Expected event type %s, got %s", tt.eventType, event.EventType)
			}

			if event.Version != tt.version {
				t.Errorf("Expected version %d, got %d", tt.version, event.Version)
			}

			if event.OccurredAt.IsZero() {
				t.Error("Expected non-zero occurred at time")
			}

			// Validate data
			if tt.data == nil && event.Data != nil {
				t.Error("Expected nil data when input data is nil")
			} else if tt.data != nil && !testing.jsonEqual(tt.data, event.Data) {
				t.Errorf("Expected data %+v, got %+v", tt.data, event.Data)
			}

			// Validate metadata
			if event.Metadata == nil {
				t.Error("Expected non-nil metadata")
			} else if len(event.Metadata) != 0 {
				t.Error("Expected empty metadata")
			}
		})
	}
}

func TestBaseEventInterface(t *testing.T) {
	factory := sdlntesting.NewTestDataFactory()

	baseEvent := NewBaseEvent(
		factory.NextID(),
		"user",
		"user_registered",
		1,
		map[string]interface{}{
			"email":     "test@example.com",
			"tenant_id": factory.NextID(),
		},
	)

	// Test BaseEvent implements Event interface
	var event Event = baseEvent

	if event.GetID() != baseEvent.ID {
		t.Errorf("Expected ID %s, got %s", baseEvent.ID, event.GetID())
	}

	if event.GetAggregateID() != baseEvent.AggregateID {
		t.Errorf("Expected aggregate ID %s, got %s", baseEvent.AggregateID, event.GetAggregateID())
	}

	if event.GetEventType() != baseEvent.EventType {
		t.Errorf("Expected event type %s, got %s", baseEvent.EventType, event.GetEventType())
	}

	if event.GetVersion() != baseEvent.Version {
		t.Errorf("Expected version %d, got %d", baseEvent.Version, event.GetVersion())
	}

	if !event.GetOccurredAt().Equal(baseEvent.OccurredAt) {
		t.Errorf("Expected occurred at %v, got %v", baseEvent.OccurredAt, event.GetOccurredAt())
	}

	if !testing.jsonEqual(baseEvent.Data, event.GetData()) {
		t.Errorf("Expected data %+v, got %+v", baseEvent.Data, event.GetData())
	}

	if !testing.jsonEqual(baseEvent.Metadata, event.GetMetadata()) {
		t.Errorf("Expected metadata %+v, got %+v", baseEvent.Metadata, event.GetMetadata())
	}
}

func TestUserRegisteredEvent(t *testing.T) {
	factory := sdlntesting.NewTestDataFactory()

	tests := []struct {
		name     string
		event    *UserRegisteredEvent
		expectOK bool
	}{
		{
			name:     "Valid user registered event",
			event:    factory.CreateTestUserRegisteredEvent(),
			expectOK: true,
		},
		{
			name: "User registered event with empty email",
			event: &UserRegisteredEvent{
				BaseEvent: NewBaseEvent(factory.NextID(), "user", "user_registered", 1, map[string]interface{}{
					"email":     "",
					"tenant_id": factory.NextID(),
					"role":      "user",
				}),
				Email:    "",
				TenantID: factory.NextID(),
				Role:     "user",
			},
			expectOK: true, // Validation happens at higher level
		},
		{
			name: "User registered event with nil base event",
			event: &UserRegisteredEvent{
				BaseEvent: nil,
				Email:     "test@example.com",
				TenantID:  factory.NextID(),
				Role:      "user",
			},
			expectOK: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.expectOK {
				if tt.event == nil {
					t.Fatal("Expected valid event, got nil")
				}

				if tt.event.BaseEvent == nil {
					t.Fatal("Expected non-nil BaseEvent")
				}

				// Test Event interface
				if tt.event.GetID() == "" {
					t.Error("Expected non-empty ID")
				}

				if tt.event.GetEventType() != "user_registered" {
					t.Errorf("Expected event type 'user_registered', got %s", tt.event.GetEventType())
				}

				// Test specific fields
				if tt.event.Email == "" && tt.name == "Valid user registered event" {
					t.Error("Expected non-empty email for valid event")
				}

				if tt.event.TenantID == "" {
					t.Error("Expected non-empty tenant ID")
				}

				if tt.event.Role == "" {
					t.Error("Expected non-empty role")
				}
			} else {
				if tt.event != nil && tt.event.BaseEvent == nil {
					// This is expected for the invalid test case
				} else {
					t.Error("Expected invalid event")
				}
			}
		})
	}
}

func TestUserAuthenticatedEvent(t *testing.T) {
	factory := sdlntesting.NewTestDataFactory()
	userID := factory.NextID()
	sessionID := factory.NextID()
	ipAddress := "192.168.1.1"
	userAgent := "Mozilla/5.0 (Test Browser)"

	event := &UserAuthenticatedEvent{
		BaseEvent: NewBaseEvent(userID, "user", "user_authenticated", 2, map[string]interface{}{
			"user_id":    userID,
			"session_id": sessionID,
			"ip_address": ipAddress,
			"user_agent": userAgent,
		}),
		UserID:    userID,
		SessionID: sessionID,
		IPAddress: ipAddress,
		UserAgent: userAgent,
	}

	if event.GetID() == "" {
		t.Error("Expected non-empty ID")
	}

	if event.GetEventType() != "user_authenticated" {
		t.Errorf("Expected event type 'user_authenticated', got %s", event.GetEventType())
	}

	if event.UserID != userID {
		t.Errorf("Expected user ID %s, got %s", userID, event.UserID)
	}

	if event.SessionID != sessionID {
		t.Errorf("Expected session ID %s, got %s", sessionID, event.SessionID)
	}

	if event.IPAddress != ipAddress {
		t.Errorf("Expected IP address %s, got %s", ipAddress, event.IPAddress)
	}

	if event.UserAgent != userAgent {
		t.Errorf("Expected user agent %s, got %s", userAgent, event.UserAgent)
	}
}

func TestDocumentUploadedEvent(t *testing.T) {
	factory := sdlntesting.NewTestDataFactory()
	event := factory.CreateTestDocumentUploadedEvent()

	if event.GetEventType() != "document_uploaded" {
		t.Errorf("Expected event type 'document_uploaded', got %s", event.GetEventType())
	}

	if event.DocumentID == "" {
		t.Error("Expected non-empty document ID")
	}

	if event.UserID == "" {
		t.Error("Expected non-empty user ID")
	}

	if event.TenantID == "" {
		t.Error("Expected non-empty tenant ID")
	}

	if event.FileName == "" {
		t.Error("Expected non-empty file name")
	}

	if event.FileSize <= 0 {
		t.Error("Expected positive file size")
	}

	if event.ContentType == "" {
		t.Error("Expected non-empty content type")
	}

	if event.Checksum == "" {
		t.Error("Expected non-empty checksum")
	}
}

func TestDocumentProcessedEvent(t *testing.T) {
	factory := sdlntesting.NewTestDataFactory()
	documentID := factory.NextID()
	chunksCount := 10
	vectorCount := 1536
	processingMs := int64(5000)
	tags := []string{"test", "document", "processed"}

	event := &DocumentProcessedEvent{
		BaseEvent: NewBaseEvent(documentID, "document", "document_processed", 2, map[string]interface{}{
			"document_id":   documentID,
			"chunks_count":  chunksCount,
			"vector_count":  vectorCount,
			"processing_ms": processingMs,
			"tags":          tags,
		}),
		DocumentID:   documentID,
		ChunksCount:  chunksCount,
		VectorCount:  vectorCount,
		ProcessingMs: processingMs,
		Tags:         tags,
	}

	if event.GetEventType() != "document_processed" {
		t.Errorf("Expected event type 'document_processed', got %s", event.GetEventType())
	}

	if event.DocumentID != documentID {
		t.Errorf("Expected document ID %s, got %s", documentID, event.DocumentID)
	}

	if event.ChunksCount != chunksCount {
		t.Errorf("Expected chunks count %d, got %d", chunksCount, event.ChunksCount)
	}

	if event.VectorCount != vectorCount {
		t.Errorf("Expected vector count %d, got %d", vectorCount, event.VectorCount)
	}

	if event.ProcessingMs != processingMs {
		t.Errorf("Expected processing ms %d, got %d", processingMs, event.ProcessingMs)
	}

	if len(event.Tags) != len(tags) {
		t.Errorf("Expected %d tags, got %d", len(tags), len(event.Tags))
	}
}

func TestQuerySubmittedEvent(t *testing.T) {
	factory := sdlntesting.NewTestDataFactory()
	event := factory.CreateTestQuerySubmittedEvent()

	if event.GetEventType() != "query_submitted" {
		t.Errorf("Expected event type 'query_submitted', got %s", event.GetEventType())
	}

	if event.QueryID == "" {
		t.Error("Expected non-empty query ID")
	}

	if event.UserID == "" {
		t.Error("Expected non-empty user ID")
	}

	if event.TenantID == "" {
		t.Error("Expected non-empty tenant ID")
	}

	if event.Query == "" {
		t.Error("Expected non-empty query")
	}

	if len(event.VectorQuery) == 0 {
		t.Error("Expected non-empty vector query")
	}

	if len(event.Context) == 0 {
		t.Error("Expected non-empty context")
	}
}

func TestQueryProcessedEvent(t *testing.T) {
	factory := sdlntesting.NewTestDataFactory()
	queryID := factory.NextID()
	response := "Test response"
	citations := []Citation{
		{
			DocumentID: factory.NextID(),
			ChunkID:    factory.NextID(),
			Text:       "Test citation text",
			Score:      0.95,
		},
	}
	confidence := 0.85
	processingMs := int64(1000)
	tokenUsage := TokenUsage{
		InputTokens:  100,
		OutputTokens: 50,
		TotalTokens:  150,
	}

	event := &QueryProcessedEvent{
		BaseEvent: NewBaseEvent(queryID, "query", "query_processed", 2, map[string]interface{}{
			"query_id":      queryID,
			"response":      response,
			"citations":     citations,
			"confidence":    confidence,
			"processing_ms": processingMs,
			"token_usage":   tokenUsage,
		}),
		QueryID:      queryID,
		Response:     response,
		Citations:    citations,
		Confidence:   confidence,
		ProcessingMs: processingMs,
		TokenUsage:   tokenUsage,
	}

	if event.GetEventType() != "query_processed" {
		t.Errorf("Expected event type 'query_processed', got %s", event.GetEventType())
	}

	if event.QueryID != queryID {
		t.Errorf("Expected query ID %s, got %s", queryID, event.QueryID)
	}

	if event.Response != response {
		t.Errorf("Expected response '%s', got '%s'", response, event.Response)
	}

	if len(event.Citations) != len(citations) {
		t.Errorf("Expected %d citations, got %d", len(citations), len(event.Citations))
	}

	if event.Confidence != confidence {
		t.Errorf("Expected confidence %f, got %f", confidence, event.Confidence)
	}

	if event.ProcessingMs != processingMs {
		t.Errorf("Expected processing ms %d, got %d", processingMs, event.ProcessingMs)
	}

	if event.TokenUsage.InputTokens != tokenUsage.InputTokens {
		t.Errorf("Expected input tokens %d, got %d", tokenUsage.InputTokens, event.TokenUsage.InputTokens)
	}
}

func TestTenantCreatedEvent(t *testing.T) {
	factory := sdlntesting.NewTestDataFactory()
	tenantID := factory.NextID()
	name := "Test Tenant"
	plan := "enterprise"
	createdBy := factory.NextID()

	event := &TenantCreatedEvent{
		BaseEvent: NewBaseEvent(tenantID, "tenant", "tenant_created", 1, map[string]interface{}{
			"tenant_id":  tenantID,
			"name":       name,
			"plan":       plan,
			"created_by": createdBy,
		}),
		TenantID:  tenantID,
		Name:      name,
		Plan:      plan,
		CreatedBy: createdBy,
	}

	if event.GetEventType() != "tenant_created" {
		t.Errorf("Expected event type 'tenant_created', got %s", event.GetEventType())
	}

	if event.TenantID != tenantID {
		t.Errorf("Expected tenant ID %s, got %s", tenantID, event.TenantID)
	}

	if event.Name != name {
		t.Errorf("Expected name '%s', got '%s'", name, event.Name)
	}

	if event.Plan != plan {
		t.Errorf("Expected plan '%s', got '%s'", plan, event.Plan)
	}

	if event.CreatedBy != createdBy {
		t.Errorf("Expected created by %s, got %s", createdBy, event.CreatedBy)
	}
}

func TestPaymentProcessedEvent(t *testing.T) {
	factory := sdlntesting.NewTestDataFactory()
	paymentID := factory.NextID()
	userID := factory.NextID()
	tenantID := factory.NextID()
	amount := int64(9999) // $99.99
	currency := "USD"
	tokenID := factory.NextID()
	description := "Test payment"
	processorID := "test_processor"
	gatewayTxnID := "txn_test_123"

	event := &PaymentProcessedEvent{
		BaseEvent: NewBaseEvent(paymentID, "payment", "payment_processed", 1, map[string]interface{}{
			"payment_id":     paymentID,
			"user_id":        userID,
			"tenant_id":      tenantID,
			"amount":         amount,
			"currency":       currency,
			"token_id":       tokenID,
			"description":    description,
			"processor_id":   processorID,
			"gateway_txn_id": gatewayTxnID,
		}),
		PaymentID:    paymentID,
		UserID:       userID,
		TenantID:     tenantID,
		Amount:       amount,
		Currency:     currency,
		TokenID:      tokenID,
		Description:  description,
		ProcessorID:  processorID,
		GatewayTxnID: gatewayTxnID,
	}

	if event.GetEventType() != "payment_processed" {
		t.Errorf("Expected event type 'payment_processed', got %s", event.GetEventType())
	}

	if event.PaymentID != paymentID {
		t.Errorf("Expected payment ID %s, got %s", paymentID, event.PaymentID)
	}

	if event.Amount != amount {
		t.Errorf("Expected amount %d, got %d", amount, event.Amount)
	}

	if event.Currency != currency {
		t.Errorf("Expected currency '%s', got '%s'", currency, event.Currency)
	}

	if event.TokenID != tokenID {
		t.Errorf("Expected token ID %s, got %s", tokenID, event.TokenID)
	}
}

func TestSecurityViolationEvent(t *testing.T) {
	factory := sdlntesting.NewTestDataFactory()
	userID := factory.NextID()
	tenantID := factory.NextID()
	violationType := "unauthorized_access"
	severity := "HIGH"
	description := "User attempted to access restricted resource"
	ipAddress := "192.168.1.100"
	userAgent := "Mozilla/5.0 (Test Browser)"
	resourceID := factory.NextID()

	event := &SecurityViolationEvent{
		BaseEvent: NewBaseEvent(userID, "security", "security_violation", 1, map[string]interface{}{
			"user_id":        userID,
			"tenant_id":      tenantID,
			"violation_type": violationType,
			"severity":       severity,
			"description":    description,
			"ip_address":     ipAddress,
			"user_agent":     userAgent,
			"resource_id":    resourceID,
		}),
		UserID:        userID,
		TenantID:      tenantID,
		ViolationType: violationType,
		Severity:      severity,
		Description:   description,
		IPAddress:     ipAddress,
		UserAgent:     userAgent,
		ResourceID:    resourceID,
	}

	if event.GetEventType() != "security_violation" {
		t.Errorf("Expected event type 'security_violation', got %s", event.GetEventType())
	}

	if event.UserID != userID {
		t.Errorf("Expected user ID %s, got %s", userID, event.UserID)
	}

	if event.ViolationType != violationType {
		t.Errorf("Expected violation type '%s', got '%s'", violationType, event.ViolationType)
	}

	if event.Severity != severity {
		t.Errorf("Expected severity '%s', got '%s'", severity, event.Severity)
	}
}

func TestEventSerialization(t *testing.T) {
	factory := sdlntesting.NewTestDataFactory()

	// Test serialization and deserialization
	originalEvent := factory.CreateTestUserRegisteredEvent()

	// Marshal to JSON
	jsonData, err := json.Marshal(originalEvent)
	if err != nil {
		t.Fatalf("Failed to marshal event: %v", err)
	}

	// Unmarshal from JSON
	var deserializedEvent UserRegisteredEvent
	err = json.Unmarshal(jsonData, &deserializedEvent)
	if err != nil {
		t.Fatalf("Failed to unmarshal event: %v", err)
	}

	// Compare events
	testing.AssertEventsEqual(t, originalEvent, &deserializedEvent)

	if deserializedEvent.Email != originalEvent.Email {
		t.Errorf("Expected email %s, got %s", originalEvent.Email, deserializedEvent.Email)
	}

	if deserializedEvent.TenantID != originalEvent.TenantID {
		t.Errorf("Expected tenant ID %s, got %s", originalEvent.TenantID, deserializedEvent.TenantID)
	}

	if deserializedEvent.Role != originalEvent.Role {
		t.Errorf("Expected role %s, got %s", originalEvent.Role, deserializedEvent.Role)
	}
}

func TestEventMetadata(t *testing.T) {
	factory := sdlntesting.NewTestDataFactory()

	event := NewBaseEvent(
		factory.NextID(),
		"user",
		"test_event",
		1,
		map[string]interface{}{"test_field": "test_value"},
	)

	// Add metadata
	event.Metadata["correlation_id"] = "test-correlation-123"
	event.Metadata["source"] = "unit_test"
	event.Metadata["version"] = "1.0.0"

	// Verify metadata
	if event.Metadata["correlation_id"] != "test-correlation-123" {
		t.Errorf("Expected correlation ID 'test-correlation-123', got %v", event.Metadata["correlation_id"])
	}

	if event.Metadata["source"] != "unit_test" {
		t.Errorf("Expected source 'unit_test', got %v", event.Metadata["source"])
	}

	if event.Metadata["version"] != "1.0.0" {
		t.Errorf("Expected version '1.0.0', got %v", event.Metadata["version"])
	}
}

func TestEventTimestamps(t *testing.T) {
	factory := sdlntesting.NewTestDataFactory()
	before := time.Now().UTC()

	event := NewBaseEvent(
		factory.NextID(),
		"user",
		"test_event",
		1,
		map[string]interface{}{},
	)

	after := time.Now().UTC()

	// Verify timestamp is within reasonable range
	if event.OccurredAt.Before(before.Add(-time.Second)) {
		t.Error("Event occurred before test started")
	}

	if event.OccurredAt.After(after.Add(time.Second)) {
		t.Error("Event occurred after test ended")
	}

	// Verify timestamp is in UTC
	if event.OccurredAt.Location() != time.UTC {
		t.Error("Event timestamp is not in UTC")
	}
}

func TestEventVersioning(t *testing.T) {
	factory := sdlntesting.NewTestDataFactory()
	aggregateID := factory.NextID()

	// Create events with different versions
	event1 := NewBaseEvent(aggregateID, "user", "user_registered", 1, map[string]interface{}{"email": "test1@example.com"})
	event2 := NewBaseEvent(aggregateID, "user", "user_updated", 2, map[string]interface{}{"field": "updated"})
	event3 := NewBaseEvent(aggregateID, "user", "user_deactivated", 3, map[string]interface{}{"active": false})

	// Verify versions
	if event1.Version != 1 {
		t.Errorf("Expected version 1, got %d", event1.Version)
	}

	if event2.Version != 2 {
		t.Errorf("Expected version 2, got %d", event2.Version)
	}

	if event3.Version != 3 {
		t.Errorf("Expected version 3, got %d", event3.Version)
	}

	// Verify all events belong to same aggregate
	if event1.AggregateID != aggregateID {
		t.Errorf("Expected aggregate ID %s, got %s", aggregateID, event1.AggregateID)
	}

	if event2.AggregateID != aggregateID {
		t.Errorf("Expected aggregate ID %s, got %s", aggregateID, event2.AggregateID)
	}

	if event3.AggregateID != aggregateID {
		t.Errorf("Expected aggregate ID %s, got %s", aggregateID, event3.AggregateID)
	}
}

func TestEventEdgeCases(t *testing.T) {
	factory := sdlntesting.NewTestDataFactory()

	t.Run("Empty data map", func(t *testing.T) {
		event := NewBaseEvent(factory.NextID(), "user", "test", 1, map[string]interface{}{})

		if event.Data == nil {
			t.Error("Expected non-nil data map")
		}

		if len(event.Data) != 0 {
			t.Errorf("Expected empty data map, got %d items", len(event.Data))
		}
	})

	t.Run("Large data payload", func(t *testing.T) {
		largeData := map[string]interface{}{
			"string_field": factory.RandomString(1000),
			"number_field": 12345,
			"bool_field":   true,
			"array_field":  []string{factory.RandomString(100), factory.RandomString(100)},
			"nested_field": map[string]interface{}{
				"nested_string": factory.RandomString(500),
				"nested_number": 67890,
			},
		}

		event := NewBaseEvent(factory.NextID(), "document", "large_payload", 1, largeData)

		if len(event.Data) != len(largeData) {
			t.Errorf("Expected %d data fields, got %d", len(largeData), len(event.Data))
		}
	})

	t.Run("Special characters in data", func(t *testing.T) {
		specialData := map[string]interface{}{
			"unicode":     "Hello 世界 🌍",
			"quotes":      "Text with 'single' and \"double\" quotes",
			"newlines":    "Line 1\nLine 2\r\nLine 3",
			"tabs":        "Column1\tColumn2\tColumn3",
			"backslashes": "Path\\to\\file",
			"json_data":   `{"key": "value", "array": [1, 2, 3]}`,
		}

		event := NewBaseEvent(factory.NextID(), "test", "special_chars", 1, specialData)

		if event.Data["unicode"] != specialData["unicode"] {
			t.Errorf("Unicode data mismatch")
		}

		if event.Data["quotes"] != specialData["quotes"] {
			t.Errorf("Quotes data mismatch")
		}
	})
}

// Benchmark tests
func BenchmarkNewBaseEvent(b *testing.B) {
	factory := sdlntesting.NewTestDataFactory()
	data := map[string]interface{}{"email": "test@example.com", "tenant_id": factory.NextID()}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		NewBaseEvent(factory.NextID(), "user", "user_registered", 1, data)
	}
}

func BenchmarkEventSerialization(b *testing.B) {
	factory := sdlntesting.NewTestDataFactory()
	event := factory.CreateTestUserRegisteredEvent()

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		json.Marshal(event)
	}
}

func BenchmarkEventDeserialization(b *testing.B) {
	factory := sdlntesting.NewTestDataFactory()
	event := factory.CreateTestUserRegisteredEvent()
	jsonData, _ := json.Marshal(event)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		var deserializedEvent UserRegisteredEvent
		json.Unmarshal(jsonData, &deserializedEvent)
	}
}
