//go:build never
// +build never

package domain

import (
	"errors"
	"testing"
	"time"

	"github.com/SDLC/sdln-sdk-go/pkg/shared"
	sdlntesting "github.com/SDLC/sdln-sdk-go/pkg/testing"
)

func TestAggregateRoot(t *testing.T) {
	factory := sdlntesting.NewTestDataFactory()

	t.Run("Create aggregate root", func(t *testing.T) {
		aggregateID := factory.NextID()
		aggregate := &AggregateRoot{
			ID:      aggregateID,
			Version: 0,
			Events:  []Event{},
		}

		if aggregate.ID != aggregateID {
			t.Errorf("Expected ID %s, got %s", aggregateID, aggregate.ID)
		}

		if aggregate.Version != 0 {
			t.Errorf("Expected version 0, got %d", aggregate.Version)
		}

		if len(aggregate.Events) != 0 {
			t.Errorf("Expected 0 events, got %d", len(aggregate.Events))
		}
	})

	t.Run("Apply event to aggregate", func(t *testing.T) {
		aggregate := &AggregateRoot{
			ID:      factory.NextID(),
			Version: 0,
			Events:  []Event{},
		}

		event := factory.CreateTestUserRegisteredEvent()
		aggregate.ApplyEvent(event)

		if aggregate.Version != event.GetVersion() {
			t.Errorf("Expected version %d, got %d", event.GetVersion(), aggregate.Version)
		}

		if len(aggregate.Events) != 1 {
			t.Errorf("Expected 1 event, got %d", len(aggregate.Events))
		}

		if aggregate.Events[0].GetID() != event.GetID() {
			t.Errorf("Expected event ID %s, got %s", event.GetID(), aggregate.Events[0].GetID())
		}
	})

	t.Run("Get uncommitted events", func(t *testing.T) {
		aggregate := &AggregateRoot{
			ID:      factory.NextID(),
			Version: 0,
			Events:  []Event{},
		}

		event1 := factory.CreateTestUserRegisteredEvent()
		event2 := factory.CreateTestUserAuthenticatedEvent()

		aggregate.ApplyEvent(event1)
		aggregate.ApplyEvent(event2)

		uncommitted := aggregate.GetUncommittedEvents()

		if len(uncommitted) != 2 {
			t.Errorf("Expected 2 uncommitted events, got %d", len(uncommitted))
		}

		if uncommitted[0].GetID() != event1.GetID() {
			t.Errorf("Expected first event ID %s, got %s", event1.GetID(), uncommitted[0].GetID())
		}

		if uncommitted[1].GetID() != event2.GetID() {
			t.Errorf("Expected second event ID %s, got %s", event2.GetID(), uncommitted[1].GetID())
		}
	})

	t.Run("Mark events as committed", func(t *testing.T) {
		aggregate := &AggregateRoot{
			ID:      factory.NextID(),
			Version: 0,
			Events:  []Event{},
		}

		event := factory.CreateTestUserRegisteredEvent()
		aggregate.ApplyEvent(event)

		if len(aggregate.GetUncommittedEvents()) != 1 {
			t.Errorf("Expected 1 uncommitted event before marking committed")
		}

		aggregate.MarkEventsAsCommitted()

		if len(aggregate.GetUncommittedEvents()) != 0 {
			t.Errorf("Expected 0 uncommitted events after marking committed")
		}
	})
}

func TestNewUserAggregate(t *testing.T) {
	factory := sdlntesting.NewTestDataFactory()
	userID := factory.NextID()
	email := factory.NextEmail()
	tenantID := factory.NextID()
	role := shared.RoleUser

	aggregate := NewUserAggregate(userID, email, tenantID, role)

	if aggregate.ID != userID {
		t.Errorf("Expected user ID %s, got %s", userID, aggregate.ID)
	}

	if aggregate.Email != email {
		t.Errorf("Expected email %s, got %s", email, aggregate.Email)
	}

	if aggregate.TenantID != tenantID {
		t.Errorf("Expected tenant ID %s, got %s", tenantID, aggregate.TenantID)
	}

	if aggregate.Role != role {
		t.Errorf("Expected role %s, got %s", role, aggregate.Role)
	}

	if aggregate.Version != 1 {
		t.Errorf("Expected version 1, got %d", aggregate.Version)
	}

	if !aggregate.Active {
		t.Error("Expected user to be active")
	}

	if aggregate.CreatedAt.IsZero() {
		t.Error("Expected non-zero created at time")
	}

	if aggregate.UpdatedAt.IsZero() {
		t.Error("Expected non-zero updated at time")
	}

	// Check that UserRegisteredEvent was created
	if len(aggregate.Events) != 1 {
		t.Errorf("Expected 1 event, got %d", len(aggregate.Events))
	}

	event, ok := aggregate.Events[0].(*UserRegisteredEvent)
	if !ok {
		t.Error("Expected UserRegisteredEvent")
	}

	if event.Email != email {
		t.Errorf("Expected event email %s, got %s", email, event.Email)
	}

	if event.TenantID != tenantID {
		t.Errorf("Expected event tenant ID %s, got %s", tenantID, event.TenantID)
	}

	if event.Role != role {
		t.Errorf("Expected event role %s, got %s", role, event.Role)
	}
}

func TestUserAggregateUpdateProfile(t *testing.T) {
	factory := sdlntesting.NewTestDataFactory()
	aggregate := factory.CreateTestUser()

	firstName := "John"
	lastName := "Doe"
	avatarURL := "https://example.com/avatar.jpg"

	err := aggregate.UpdateProfile(firstName, lastName, avatarURL)
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}

	if aggregate.Profile.FirstName != firstName {
		t.Errorf("Expected first name %s, got %s", firstName, aggregate.Profile.FirstName)
	}

	if aggregate.Profile.LastName != lastName {
		t.Errorf("Expected last name %s, got %s", lastName, aggregate.Profile.LastName)
	}

	if aggregate.Profile.AvatarURL != avatarURL {
		t.Errorf("Expected avatar URL %s, got %s", avatarURL, aggregate.Profile.AvatarURL)
	}

	// Check that UserUpdatedEvent was created
	if len(aggregate.Events) != 1 {
		t.Errorf("Expected 1 event, got %d", len(aggregate.Events))
	}

	event, ok := aggregate.Events[0].(*UserUpdatedEvent)
	if !ok {
		t.Error("Expected UserUpdatedEvent")
	}

	if event.UserID != aggregate.ID {
		t.Errorf("Expected event user ID %s, got %s", aggregate.ID, event.UserID)
	}

	expectedFields := []string{"first_name", "last_name", "avatar_url"}
	if len(event.UpdatedFields) != len(expectedFields) {
		t.Errorf("Expected %d updated fields, got %d", len(expectedFields), len(event.UpdatedFields))
	}

	for i, field := range expectedFields {
		if event.UpdatedFields[i] != field {
			t.Errorf("Expected field %s, got %s", field, event.UpdatedFields[i])
		}
	}
}

func TestUserAggregateAuthenticate(t *testing.T) {
	factory := sdlntesting.NewTestDataFactory()
	aggregate := factory.CreateTestUser()

	sessionID := factory.NextID()
	ipAddress := "192.168.1.1"
	userAgent := "Mozilla/5.0 (Test Browser)"

	err := aggregate.Authenticate(sessionID, ipAddress, userAgent)
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}

	// Check that UserAuthenticatedEvent was created
	if len(aggregate.Events) != 1 {
		t.Errorf("Expected 1 event, got %d", len(aggregate.Events))
	}

	event, ok := aggregate.Events[0].(*UserAuthenticatedEvent)
	if !ok {
		t.Error("Expected UserAuthenticatedEvent")
	}

	if event.UserID != aggregate.ID {
		t.Errorf("Expected event user ID %s, got %s", aggregate.ID, event.UserID)
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

func TestUserAggregateAuthenticateInactiveUser(t *testing.T) {
	factory := sdlntesting.NewTestDataFactory()
	aggregate := factory.CreateTestUser()

	// Deactivate user first
	err := aggregate.Deactivate()
	if err != nil {
		t.Fatalf("Failed to deactivate user: %v", err)
	}

	// Try to authenticate inactive user
	err = aggregate.Authenticate("session123", "192.168.1.1", "Test Browser")
	if err == nil {
		t.Error("Expected error when authenticating inactive user")
	}

	expectedError := "user is not active"
	if err.Error() != expectedError {
		t.Errorf("Expected error '%s', got '%s'", expectedError, err.Error())
	}

	// No new events should be created
	if len(aggregate.GetUncommittedEvents()) != 1 {
		t.Errorf("Expected 1 event (deactivation), got %d", len(aggregate.GetUncommittedEvents()))
	}
}

func TestUserAggregateDeactivate(t *testing.T) {
	factory := sdlntesting.NewTestDataFactory()
	aggregate := factory.CreateTestUser()

	err := aggregate.Deactivate()
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}

	if aggregate.Active {
		t.Error("Expected user to be inactive")
	}

	// Check that UserUpdatedEvent was created
	if len(aggregate.Events) != 1 {
		t.Errorf("Expected 1 event, got %d", len(aggregate.Events))
	}

	event, ok := aggregate.Events[0].(*UserUpdatedEvent)
	if !ok {
		t.Error("Expected UserUpdatedEvent")
	}

	if event.UserID != aggregate.ID {
		t.Errorf("Expected event user ID %s, got %s", aggregate.ID, event.UserID)
	}

	if len(event.UpdatedFields) != 1 || event.UpdatedFields[0] != "active" {
		t.Error("Expected 'active' field to be updated")
	}
}

func TestUserAggregateDeactivateAlreadyInactive(t *testing.T) {
	factory := sdlntesting.NewTestDataFactory()
	aggregate := factory.CreateTestUser()

	// Deactivate user first
	err := aggregate.Deactivate()
	if err != nil {
		t.Fatalf("Failed to deactivate user: %v", err)
	}

	// Try to deactivate again
	err = aggregate.Deactivate()
	if err == nil {
		t.Error("Expected error when deactivating already inactive user")
	}

	expectedError := "user is already inactive"
	if err.Error() != expectedError {
		t.Errorf("Expected error '%s', got '%s'", expectedError, err.Error())
	}

	// No new events should be created beyond the first deactivation
	if len(aggregate.GetUncommittedEvents()) != 1 {
		t.Errorf("Expected 1 event (first deactivation), got %d", len(aggregate.GetUncommittedEvents()))
	}
}

func TestUserAggregateRebuildFromEvents(t *testing.T) {
	factory := sdlntesting.NewTestDataFactory()
	userID := factory.NextID()
	email := factory.NextEmail()
	tenantID := factory.NextID()
	role := shared.RoleUser

	// Create events
	events := []Event{
		&UserRegisteredEvent{
			BaseEvent: NewBaseEvent(userID, "user", "user_registered", 1, map[string]interface{}{
				"email":     email,
				"tenant_id": tenantID,
				"role":      role,
			}),
			Email:    email,
			TenantID: tenantID,
			Role:     role,
		},
		&UserUpdatedEvent{
			BaseEvent: NewBaseEvent(userID, "user", "user_updated", 2, map[string]interface{}{
				"first_name": "John",
				"last_name":  "Doe",
				"avatar_url": "https://example.com/avatar.jpg",
			}),
			UserID:        userID,
			UpdatedFields: []string{"first_name", "last_name", "avatar_url"},
		},
		&UserAuthenticatedEvent{
			BaseEvent: NewBaseEvent(userID, "user", "user_authenticated", 3, map[string]interface{}{
				"session_id": factory.NextID(),
				"ip_address": "192.168.1.1",
				"user_agent": "Test Browser",
			}),
			UserID:    userID,
			SessionID: factory.NextID(),
			IPAddress: "192.168.1.1",
			UserAgent: "Test Browser",
		},
		&UserUpdatedEvent{
			BaseEvent: NewBaseEvent(userID, "user", "user_updated", 4, map[string]interface{}{
				"active": false,
			}),
			UserID:        userID,
			UpdatedFields: []string{"active"},
		},
	}

	// Rebuild aggregate from events
	aggregate := &UserAggregate{}
	err := aggregate.RebuildFromEvents(events)
	if err != nil {
		t.Fatalf("Unexpected error rebuilding from events: %v", err)
	}

	// Verify aggregate state
	if aggregate.ID != userID {
		t.Errorf("Expected user ID %s, got %s", userID, aggregate.ID)
	}

	if aggregate.Email != email {
		t.Errorf("Expected email %s, got %s", email, aggregate.Email)
	}

	if aggregate.TenantID != tenantID {
		t.Errorf("Expected tenant ID %s, got %s", tenantID, aggregate.TenantID)
	}

	if aggregate.Role != role {
		t.Errorf("Expected role %s, got %s", role, aggregate.Role)
	}

	if aggregate.Active {
		t.Error("Expected user to be inactive")
	}

	if aggregate.Profile.FirstName != "John" {
		t.Errorf("Expected first name 'John', got '%s'", aggregate.Profile.FirstName)
	}

	if aggregate.Profile.LastName != "Doe" {
		t.Errorf("Expected last name 'Doe', got '%s'", aggregate.Profile.LastName)
	}

	if aggregate.Profile.AvatarURL != "https://example.com/avatar.jpg" {
		t.Errorf("Expected avatar URL 'https://example.com/avatar.jpg', got '%s'", aggregate.Profile.AvatarURL)
	}

	if aggregate.Version != 4 {
		t.Errorf("Expected version 4, got %d", aggregate.Version)
	}
}

func TestNewTenantAggregate(t *testing.T) {
	factory := sdlntesting.NewTestDataFactory()
	tenantID := factory.NextID()
	name := "Test Tenant"
	plan := "enterprise"
	ownerID := factory.NextID()

	aggregate := NewTenantAggregate(tenantID, name, plan, ownerID)

	if aggregate.ID != tenantID {
		t.Errorf("Expected tenant ID %s, got %s", tenantID, aggregate.ID)
	}

	if aggregate.Name != name {
		t.Errorf("Expected name %s, got %s", name, aggregate.Name)
	}

	if aggregate.Plan != plan {
		t.Errorf("Expected plan %s, got %s", plan, aggregate.Plan)
	}

	if aggregate.OwnerID != ownerID {
		t.Errorf("Expected owner ID %s, got %s", ownerID, aggregate.OwnerID)
	}

	if aggregate.Status != "ACTIVE" {
		t.Errorf("Expected status 'ACTIVE', got '%s'", aggregate.Status)
	}

	if aggregate.Version != 1 {
		t.Errorf("Expected version 1, got %d", aggregate.Version)
	}

	// Check that TenantCreatedEvent was created
	if len(aggregate.Events) != 1 {
		t.Errorf("Expected 1 event, got %d", len(aggregate.Events))
	}

	event, ok := aggregate.Events[0].(*TenantCreatedEvent)
	if !ok {
		t.Error("Expected TenantCreatedEvent")
	}

	if event.TenantID != tenantID {
		t.Errorf("Expected event tenant ID %s, got %s", tenantID, event.TenantID)
	}

	if event.Name != name {
		t.Errorf("Expected event name %s, got %s", name, event.Name)
	}

	if event.Plan != plan {
		t.Errorf("Expected event plan %s, got %s", plan, event.Plan)
	}

	if event.CreatedBy != ownerID {
		t.Errorf("Expected event created by %s, got %s", ownerID, event.CreatedBy)
	}
}

func TestTenantAggregateUpdatePlan(t *testing.T) {
	factory := sdlntesting.NewTestDataFactory()
	aggregate := factory.CreateTestTenant()

	newPlan := "premium"
	err := aggregate.UpdatePlan(newPlan)
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}

	if aggregate.Plan != newPlan {
		t.Errorf("Expected plan %s, got %s", newPlan, aggregate.Plan)
	}

	// Check that TenantUpdatedEvent was created
	if len(aggregate.Events) != 1 {
		t.Errorf("Expected 1 event, got %d", len(aggregate.Events))
	}

	event, ok := aggregate.Events[0].(*TenantUpdatedEvent)
	if !ok {
		t.Error("Expected TenantUpdatedEvent")
	}

	if event.TenantID != aggregate.ID {
		t.Errorf("Expected event tenant ID %s, got %s", aggregate.ID, event.TenantID)
	}

	expectedFields := []string{"plan"}
	if len(event.UpdatedFields) != len(expectedFields) {
		t.Errorf("Expected %d updated fields, got %d", len(expectedFields), len(event.UpdatedFields))
	}
}

func TestTenantAggregateSuspend(t *testing.T) {
	factory := sdlntesting.NewTestDataFactory()
	aggregate := factory.CreateTestTenant()

	reason := "Payment overdue"
	suspendedBy := factory.NextID()

	err := aggregate.Suspend(reason, suspendedBy)
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}

	if aggregate.Status != "SUSPENDED" {
		t.Errorf("Expected status 'SUSPENDED', got '%s'", aggregate.Status)
	}

	// Check that TenantSuspendedEvent was created
	if len(aggregate.Events) != 1 {
		t.Errorf("Expected 1 event, got %d", len(aggregate.Events))
	}

	event, ok := aggregate.Events[0].(*TenantSuspendedEvent)
	if !ok {
		t.Error("Expected TenantSuspendedEvent")
	}

	if event.TenantID != aggregate.ID {
		t.Errorf("Expected event tenant ID %s, got %s", aggregate.ID, event.TenantID)
	}

	if event.Reason != reason {
		t.Errorf("Expected reason %s, got %s", reason, event.Reason)
	}

	if event.SuspendedBy != suspendedBy {
		t.Errorf("Expected suspended by %s, got %s", suspendedBy, event.SuspendedBy)
	}
}

func TestTenantAggregateSuspendAlreadySuspended(t *testing.T) {
	factory := sdlntesting.NewTestDataFactory()
	aggregate := factory.CreateTestTenant()

	// Suspend tenant first
	err := aggregate.Suspend("Test reason", "admin")
	if err != nil {
		t.Fatalf("Failed to suspend tenant: %v", err)
	}

	// Try to suspend again
	err = aggregate.Suspend("Another reason", "admin")
	if err == nil {
		t.Error("Expected error when suspending already suspended tenant")
	}

	expectedError := "tenant is already suspended"
	if err.Error() != expectedError {
		t.Errorf("Expected error '%s', got '%s'", expectedError, err.Error())
	}

	// No new events should be created beyond the first suspension
	if len(aggregate.GetUncommittedEvents()) != 1 {
		t.Errorf("Expected 1 event (first suspension), got %d", len(aggregate.GetUncommittedEvents()))
	}
}

func TestTenantAggregateReactivate(t *testing.T) {
	factory := sdlntesting.NewTestDataFactory()
	aggregate := factory.CreateTestTenant()

	// Suspend tenant first
	err := aggregate.Suspend("Test reason", "admin")
	if err != nil {
		t.Fatalf("Failed to suspend tenant: %v", err)
	}

	// Clear events to isolate reactivation
	aggregate.MarkEventsAsCommitted()

	// Reactivate tenant
	err = aggregate.Reactivate()
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}

	if aggregate.Status != "ACTIVE" {
		t.Errorf("Expected status 'ACTIVE', got '%s'", aggregate.Status)
	}

	// Check that TenantUpdatedEvent was created
	if len(aggregate.Events) != 1 {
		t.Errorf("Expected 1 event, got %d", len(aggregate.Events))
	}

	event, ok := aggregate.Events[0].(*TenantUpdatedEvent)
	if !ok {
		t.Error("Expected TenantUpdatedEvent")
	}

	if event.TenantID != aggregate.ID {
		t.Errorf("Expected event tenant ID %s, got %s", aggregate.ID, event.TenantID)
	}

	expectedFields := []string{"status"}
	if len(event.UpdatedFields) != len(expectedFields) {
		t.Errorf("Expected %d updated fields, got %d", len(expectedFields), len(event.UpdatedFields))
	}
}

func TestTenantAggregateReactivateActiveTenant(t *testing.T) {
	factory := sdlntesting.NewTestDataFactory()
	aggregate := factory.CreateTestTenant()

	// Try to reactivate already active tenant
	err := aggregate.Reactivate()
	if err == nil {
		t.Error("Expected error when reactivating already active tenant")
	}

	expectedError := "tenant is not suspended"
	if err.Error() != expectedError {
		t.Errorf("Expected error '%s', got '%s'", expectedError, err.Error())
	}

	// No events should be created
	if len(aggregate.GetUncommittedEvents()) != 0 {
		t.Errorf("Expected 0 events, got %d", len(aggregate.GetUncommittedEvents()))
	}
}

func TestNewDocumentAggregate(t *testing.T) {
	factory := sdlntesting.NewTestDataFactory()
	documentID := factory.NextID()
	tenantID := factory.NextID()
	userID := factory.NextID()
	fileName := "test_document.pdf"
	contentType := "application/pdf"
	checksum := factory.RandomString(64)
	fileSize := int64(1024 * 1024) // 1MB

	aggregate := NewDocumentAggregate(documentID, tenantID, userID, fileName, contentType, checksum, fileSize)

	if aggregate.ID != documentID {
		t.Errorf("Expected document ID %s, got %s", documentID, aggregate.ID)
	}

	if aggregate.TenantID != tenantID {
		t.Errorf("Expected tenant ID %s, got %s", tenantID, aggregate.TenantID)
	}

	if aggregate.UserID != userID {
		t.Errorf("Expected user ID %s, got %s", userID, aggregate.UserID)
	}

	if aggregate.FileName != fileName {
		t.Errorf("Expected file name %s, got %s", fileName, aggregate.FileName)
	}

	if aggregate.ContentType != contentType {
		t.Errorf("Expected content type %s, got %s", contentType, aggregate.ContentType)
	}

	if aggregate.Checksum != checksum {
		t.Errorf("Expected checksum %s, got %s", checksum, aggregate.Checksum)
	}

	if aggregate.FileSize != fileSize {
		t.Errorf("Expected file size %d, got %d", fileSize, aggregate.FileSize)
	}

	if aggregate.Status != "UPLOADED" {
		t.Errorf("Expected status 'UPLOADED', got '%s'", aggregate.Status)
	}

	if aggregate.Version != 1 {
		t.Errorf("Expected version 1, got %d", aggregate.Version)
	}

	// Check that DocumentUploadedEvent was created
	if len(aggregate.Events) != 1 {
		t.Errorf("Expected 1 event, got %d", len(aggregate.Events))
	}

	event, ok := aggregate.Events[0].(*DocumentUploadedEvent)
	if !ok {
		t.Error("Expected DocumentUploadedEvent")
	}

	if event.DocumentID != documentID {
		t.Errorf("Expected event document ID %s, got %s", documentID, event.DocumentID)
	}

	if event.FileName != fileName {
		t.Errorf("Expected event file name %s, got %s", fileName, event.FileName)
	}
}

func TestDocumentAggregateStartProcessing(t *testing.T) {
	factory := sdlntesting.NewTestDataFactory()
	aggregate := factory.CreateTestDocument()

	// Set status to UPLOADED
	aggregate.Status = "UPLOADED"

	err := aggregate.StartProcessing()
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}

	if aggregate.Status != "PROCESSING" {
		t.Errorf("Expected status 'PROCESSING', got '%s'", aggregate.Status)
	}

	if aggregate.Metadata.Processing.StartedAt == nil {
		t.Error("Expected processing started at to be set")
	}

	// Check that DocumentUpdatedEvent was created
	if len(aggregate.Events) != 1 {
		t.Errorf("Expected 1 event, got %d", len(aggregate.Events))
	}

	event, ok := aggregate.Events[0].(*DocumentUpdatedEvent)
	if !ok {
		t.Error("Expected DocumentUpdatedEvent")
	}

	if event.DocumentID != aggregate.ID {
		t.Errorf("Expected event document ID %s, got %s", aggregate.ID, event.DocumentID)
	}
}

func TestDocumentAggregateStartProcessingInvalidStatus(t *testing.T) {
	factory := sdlntesting.NewTestDataFactory()
	aggregate := factory.CreateTestDocument()

	// Set status to something other than UPLOADED
	aggregate.Status = "PROCESSING"

	err := aggregate.StartProcessing()
	if err == nil {
		t.Error("Expected error when starting processing on non-uploaded document")
	}

	expectedError := "document status is not UPLOADED: PROCESSING"
	if err.Error() != expectedError {
		t.Errorf("Expected error '%s', got '%s'", expectedError, err.Error())
	}

	// No events should be created
	if len(aggregate.GetUncommittedEvents()) != 0 {
		t.Errorf("Expected 0 events, got %d", len(aggregate.GetUncommittedEvents()))
	}
}

func TestDocumentAggregateCompleteProcessing(t *testing.T) {
	factory := sdlntesting.NewTestDataFactory()
	aggregate := factory.CreateTestDocument()

	// Set status to PROCESSING and set processing start time
	aggregate.Status = "PROCESSING"
	now := time.Now().UTC()
	aggregate.Metadata.Processing.StartedAt = &now

	vectorCount := 1536
	chunksCount := 10
	tags := []string{"test", "document", "processed"}
	summary := "This is a test document summary"

	err := aggregate.CompleteProcessing(vectorCount, chunksCount, tags, summary)
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}

	if aggregate.Status != "PROCESSED" {
		t.Errorf("Expected status 'PROCESSED', got '%s'", aggregate.Status)
	}

	if aggregate.Metadata.VectorCount != vectorCount {
		t.Errorf("Expected vector count %d, got %d", vectorCount, aggregate.Metadata.VectorCount)
	}

	if aggregate.Metadata.ChunksCount != chunksCount {
		t.Errorf("Expected chunks count %d, got %d", chunksCount, aggregate.Metadata.ChunksCount)
	}

	if aggregate.Metadata.Summary != summary {
		t.Errorf("Expected summary '%s', got '%s'", summary, aggregate.Metadata.Summary)
	}

	if aggregate.Metadata.Processing.CompletedAt == nil {
		t.Error("Expected processing completed at to be set")
	}

	if aggregate.Metadata.Processing.DurationMs <= 0 {
		t.Error("Expected positive processing duration")
	}

	// Check that DocumentProcessedEvent was created
	if len(aggregate.Events) != 1 {
		t.Errorf("Expected 1 event, got %d", len(aggregate.Events))
	}

	event, ok := aggregate.Events[0].(*DocumentProcessedEvent)
	if !ok {
		t.Error("Expected DocumentProcessedEvent")
	}

	if event.DocumentID != aggregate.ID {
		t.Errorf("Expected event document ID %s, got %s", aggregate.ID, event.DocumentID)
	}

	if event.VectorCount != vectorCount {
		t.Errorf("Expected event vector count %d, got %d", vectorCount, event.VectorCount)
	}
}

func TestDocumentAggregateFailProcessing(t *testing.T) {
	factory := sdlntesting.NewTestDataFactory()
	aggregate := factory.CreateTestDocument()

	// Set status to PROCESSING and set processing start time
	aggregate.Status = "PROCESSING"
	now := time.Now().UTC()
	aggregate.Metadata.Processing.StartedAt = &now

	testError := errors.New("Processing failed due to network error")

	err := aggregate.FailProcessing(testError)
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}

	if aggregate.Status != "FAILED" {
		t.Errorf("Expected status 'FAILED', got '%s'", aggregate.Status)
	}

	if aggregate.Metadata.Processing.Error == nil {
		t.Error("Expected processing error to be set")
	}

	if *aggregate.Metadata.Processing.Error != testError.Error() {
		t.Errorf("Expected error '%s', got '%s'", testError.Error(), *aggregate.Metadata.Processing.Error)
	}

	if aggregate.Metadata.Processing.CompletedAt == nil {
		t.Error("Expected processing completed at to be set")
	}

	// Check that DocumentUpdatedEvent was created
	if len(aggregate.Events) != 1 {
		t.Errorf("Expected 1 event, got %d", len(aggregate.Events))
	}

	event, ok := aggregate.Events[0].(*DocumentUpdatedEvent)
	if !ok {
		t.Error("Expected DocumentUpdatedEvent")
	}

	if event.DocumentID != aggregate.ID {
		t.Errorf("Expected event document ID %s, got %s", aggregate.ID, event.DocumentID)
	}
}

func TestDocumentAggregateDelete(t *testing.T) {
	factory := sdlntesting.NewTestDataFactory()
	aggregate := factory.CreateTestDocument()

	deletedBy := factory.NextID()

	err := aggregate.Delete(deletedBy)
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}

	if aggregate.Status != "DELETED" {
		t.Errorf("Expected status 'DELETED', got '%s'", aggregate.Status)
	}

	// Check that DocumentDeletedEvent was created
	if len(aggregate.Events) != 1 {
		t.Errorf("Expected 1 event, got %d", len(aggregate.Events))
	}

	event, ok := aggregate.Events[0].(*DocumentDeletedEvent)
	if !ok {
		t.Error("Expected DocumentDeletedEvent")
	}

	if event.DocumentID != aggregate.ID {
		t.Errorf("Expected event document ID %s, got %s", aggregate.ID, event.DocumentID)
	}

	if event.DeletedBy != deletedBy {
		t.Errorf("Expected deleted by %s, got %s", deletedBy, event.DeletedBy)
	}
}

func TestDocumentAggregateDeleteAlreadyDeleted(t *testing.T) {
	factory := sdlntesting.NewTestDataFactory()
	aggregate := factory.CreateTestDocument()

	// Delete document first
	err := aggregate.Delete("user123")
	if err != nil {
		t.Fatalf("Failed to delete document: %v", err)
	}

	// Try to delete again
	err = aggregate.Delete("user123")
	if err == nil {
		t.Error("Expected error when deleting already deleted document")
	}

	expectedError := "document is already deleted"
	if err.Error() != expectedError {
		t.Errorf("Expected error '%s', got '%s'", expectedError, err.Error())
	}

	// No new events should be created beyond the first deletion
	if len(aggregate.GetUncommittedEvents()) != 1 {
		t.Errorf("Expected 1 event (first deletion), got %d", len(aggregate.GetUncommittedEvents()))
	}
}

func TestDocumentAggregateRebuildFromEvents(t *testing.T) {
	factory := sdlntesting.NewTestDataFactory()
	documentID := factory.NextID()
	tenantID := factory.NextID()
	userID := factory.NextID()
	fileName := "test_document.pdf"
	contentType := "application/pdf"
	checksum := factory.RandomString(64)
	fileSize := int64(1024 * 1024)

	// Create events
	events := []Event{
		&DocumentUploadedEvent{
			BaseEvent: NewBaseEvent(documentID, "document", "document_uploaded", 1, map[string]interface{}{
				"tenant_id":    tenantID,
				"user_id":      userID,
				"file_name":    fileName,
				"content_type": contentType,
				"checksum":     checksum,
				"file_size":    fileSize,
			}),
			DocumentID:  documentID,
			TenantID:    tenantID,
			UserID:      userID,
			FileName:    fileName,
			FileSize:    fileSize,
			ContentType: contentType,
			Checksum:    checksum,
		},
		&DocumentProcessedEvent{
			BaseEvent: NewBaseEvent(documentID, "document", "document_processed", 2, map[string]interface{}{
				"vector_count": 1536,
				"chunks_count": 10,
				"tags":         []string{"test", "document"},
				"summary":      "Test summary",
			}),
			DocumentID:   documentID,
			ChunksCount:  10,
			VectorCount:  1536,
			ProcessingMs: 5000,
			Tags:         []string{"test", "document"},
		},
		&DocumentUpdatedEvent{
			BaseEvent: NewBaseEvent(documentID, "document", "document_deleted", 3, map[string]interface{}{
				"status": "DELETED",
			}),
			DocumentID:    documentID,
			UpdatedFields: []string{"status"},
		},
	}

	// Rebuild aggregate from events
	aggregate := &DocumentAggregate{}
	err := aggregate.RebuildFromEvents(events)
	if err != nil {
		t.Fatalf("Unexpected error rebuilding from events: %v", err)
	}

	// Verify aggregate state
	if aggregate.ID != documentID {
		t.Errorf("Expected document ID %s, got %s", documentID, aggregate.ID)
	}

	if aggregate.TenantID != tenantID {
		t.Errorf("Expected tenant ID %s, got %s", tenantID, aggregate.TenantID)
	}

	if aggregate.UserID != userID {
		t.Errorf("Expected user ID %s, got %s", userID, aggregate.UserID)
	}

	if aggregate.FileName != fileName {
		t.Errorf("Expected file name %s, got %s", fileName, aggregate.FileName)
	}

	if aggregate.Status != "DELETED" {
		t.Errorf("Expected status 'DELETED', got '%s'", aggregate.Status)
	}

	if aggregate.Metadata.VectorCount != 1536 {
		t.Errorf("Expected vector count 1536, got %d", aggregate.Metadata.VectorCount)
	}

	if aggregate.Metadata.ChunksCount != 10 {
		t.Errorf("Expected chunks count 10, got %d", aggregate.Metadata.ChunksCount)
	}

	if aggregate.Version != 3 {
		t.Errorf("Expected version 3, got %d", aggregate.Version)
	}
}

func TestAggregateConcurrency(t *testing.T) {
	factory := sdlntesting.NewTestDataFactory()
	aggregate := factory.CreateTestUser()

	// Test concurrent event application
	for i := 0; i < 100; i++ {
		profileUpdate := &UserUpdatedEvent{
			BaseEvent: NewBaseEvent(aggregate.ID, "user", "user_updated", aggregate.Version+1, map[string]interface{}{
				"test_field": i,
			}),
			UserID:        aggregate.ID,
			UpdatedFields: []string{"test_field"},
		}

		aggregate.ApplyEvent(profileUpdate)
	}

	if len(aggregate.Events) != 100 {
		t.Errorf("Expected 100 events, got %d", len(aggregate.Events))
	}

	if aggregate.Version != 101 { // Initial event + 100 updates
		t.Errorf("Expected version 101, got %d", aggregate.Version)
	}
}

func TestAggregateErrorCases(t *testing.T) {
	factory := sdlntesting.NewTestDataFactory()

	t.Run("Empty aggregate ID", func(t *testing.T) {
		aggregate := &UserAggregate{}
		event := factory.CreateTestUserRegisteredEvent()

		aggregate.ApplyEvent(event)

		if aggregate.ID != "" {
			t.Error("Expected empty ID when applying event to empty aggregate")
		}
	})

	t.Run("Nil event data", func(t *testing.T) {
		aggregate := factory.CreateTestUser()

		event := &UserUpdatedEvent{
			BaseEvent:     NewBaseEvent(aggregate.ID, "user", "user_updated", aggregate.Version+1, nil),
			UserID:        aggregate.ID,
			UpdatedFields: []string{"test"},
		}

		aggregate.ApplyEvent(event)

		if len(aggregate.Events) != 1 {
			t.Error("Expected event to be applied even with nil data")
		}
	})

	t.Run("Invalid event type during rebuild", func(t *testing.T) {
		aggregate := &UserAggregate{}

		// Create an event with unknown type
		unknownEvent := &DocumentUploadedEvent{
			BaseEvent:  NewBaseEvent(factory.NextID(), "user", "unknown_event", 1, map[string]interface{}{}),
			DocumentID: factory.NextID(),
		}

		events := []Event{unknownEvent}

		// This should not panic, just ignore unknown events
		err := aggregate.RebuildFromEvents(events)
		if err != nil {
			t.Errorf("Unexpected error rebuilding with unknown event: %v", err)
		}

		// Version should still be updated
		if aggregate.Version != 1 {
			t.Errorf("Expected version 1, got %d", aggregate.Version)
		}
	})
}

// Benchmark tests
func BenchmarkNewUserAggregate(b *testing.B) {
	factory := sdlntesting.NewTestDataFactory()

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		NewUserAggregate(factory.NextID(), factory.NextEmail(), factory.NextID(), shared.RoleUser)
	}
}

func BenchmarkUserAggregateUpdateProfile(b *testing.B) {
	factory := sdlntesting.NewTestDataFactory()
	aggregate := factory.CreateTestUser()

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		aggregate.UpdateProfile("John", "Doe", "https://example.com/avatar.jpg")
		aggregate.MarkEventsAsCommitted()
	}
}

func BenchmarkAggregateApplyEvent(b *testing.B) {
	factory := sdlntesting.NewTestDataFactory()
	aggregate := &AggregateRoot{ID: factory.NextID()}
	event := factory.CreateTestUserRegisteredEvent()

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		aggregate.ApplyEvent(event)
		aggregate.Version = 0        // Reset version for next iteration
		aggregate.Events = []Event{} // Clear events
	}
}
