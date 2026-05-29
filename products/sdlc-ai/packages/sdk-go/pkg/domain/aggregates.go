package domain

import (
	"errors"
	"fmt"
	"time"
)

// AggregateRoot represents the base for all aggregates
type AggregateRoot struct {
	ID      string
	Version int
	Events  []Event
}

// ApplyEvent applies an event to the aggregate
func (a *AggregateRoot) ApplyEvent(event Event) {
	a.Version = event.GetVersion()
	a.Events = append(a.Events, event)
}

// GetUncommittedEvents returns events that haven't been saved
func (a *AggregateRoot) GetUncommittedEvents() []Event {
	return a.Events
}

// MarkEventsAsCommitted marks all events as committed
func (a *AggregateRoot) MarkEventsAsCommitted() {
	a.Events = []Event{}
}

// UserAggregate represents the user aggregate
type UserAggregate struct {
	AggregateRoot
	Email     string
	TenantID  string
	Role      string
	CreatedAt time.Time
	UpdatedAt time.Time
	Active    bool
	Profile   UserProfile
}

type UserProfile struct {
	FirstName string
	LastName  string
	AvatarURL string
	Settings  map[string]interface{}
}

// NewUserAggregate creates a new user aggregate
func NewUserAggregate(id, email, tenantID, role string) *UserAggregate {
	aggregate := &UserAggregate{
		AggregateRoot: AggregateRoot{
			ID:      id,
			Version: 0,
		},
		Email:     email,
		TenantID:  tenantID,
		Role:      role,
		CreatedAt: time.Now().UTC(),
		UpdatedAt: time.Now().UTC(),
		Active:    true,
		Profile: UserProfile{
			Settings: make(map[string]interface{}),
		},
	}

	event := &UserRegisteredEvent{
		BaseEvent: NewBaseEvent(id, "user", "user_registered", 1, map[string]interface{}{
			"email":     email,
			"tenant_id": tenantID,
			"role":      role,
		}),
		Email:    email,
		TenantID: tenantID,
		Role:     role,
	}

	aggregate.ApplyEvent(event)
	return aggregate
}

// UpdateProfile updates user profile
func (u *UserAggregate) UpdateProfile(firstName, lastName, avatarURL string) error {
	u.Profile.FirstName = firstName
	u.Profile.LastName = lastName
	u.Profile.AvatarURL = avatarURL
	u.UpdatedAt = time.Now().UTC()

	event := &UserUpdatedEvent{
		BaseEvent: NewBaseEvent(u.ID, "user", "user_updated", u.Version+1, map[string]interface{}{
			"first_name": firstName,
			"last_name":  lastName,
			"avatar_url": avatarURL,
		}),
		UserID:        u.ID,
		UpdatedFields: []string{"first_name", "last_name", "avatar_url"},
	}

	u.ApplyEvent(event)
	return nil
}

// Authenticate records user authentication
func (u *UserAggregate) Authenticate(sessionID, ipAddress, userAgent string) error {
	if !u.Active {
		return errors.New("user is not active")
	}

	event := &UserAuthenticatedEvent{
		BaseEvent: NewBaseEvent(u.ID, "user", "user_authenticated", u.Version+1, map[string]interface{}{
			"session_id": sessionID,
			"ip_address": ipAddress,
			"user_agent": userAgent,
		}),
		UserID:    u.ID,
		SessionID: sessionID,
		IPAddress: ipAddress,
		UserAgent: userAgent,
	}

	u.ApplyEvent(event)
	return nil
}

// Deactivate deactivates user
func (u *UserAggregate) Deactivate() error {
	if !u.Active {
		return errors.New("user is already inactive")
	}

	u.Active = false
	u.UpdatedAt = time.Now().UTC()

	event := &UserUpdatedEvent{
		BaseEvent: NewBaseEvent(u.ID, "user", "user_deactivated", u.Version+1, map[string]interface{}{
			"active": false,
		}),
		UserID:        u.ID,
		UpdatedFields: []string{"active"},
	}

	u.ApplyEvent(event)
	return nil
}

// RebuildFromEvents rebuilds aggregate from events
func (u *UserAggregate) RebuildFromEvents(events []Event) error {
	for _, event := range events {
		switch e := event.(type) {
		case *UserRegisteredEvent:
			u.ID = e.GetAggregateID()
			u.Email = e.Email
			u.TenantID = e.TenantID
			u.Role = e.Role
			u.CreatedAt = e.GetOccurredAt()
			u.UpdatedAt = e.GetOccurredAt()
			u.Active = true
		case *UserUpdatedEvent:
			u.UpdatedAt = e.GetOccurredAt()
			// Apply field updates based on UpdatedFields
			if firstName, ok := e.GetData()["first_name"].(string); ok {
				u.Profile.FirstName = firstName
			}
			if lastName, ok := e.GetData()["last_name"].(string); ok {
				u.Profile.LastName = lastName
			}
			if avatarURL, ok := e.GetData()["avatar_url"].(string); ok {
				u.Profile.AvatarURL = avatarURL
			}
			if active, ok := e.GetData()["active"].(bool); ok {
				u.Active = active
			}
		case *UserAuthenticatedEvent:
			// Authentication events don't change state but are recorded
			u.UpdatedAt = e.GetOccurredAt()
		}
		u.Version = e.GetVersion()
	}
	return nil
}

// TenantAggregate represents the tenant aggregate
type TenantAggregate struct {
	AggregateRoot
	Name      string
	Plan      string
	OwnerID   string
	CreatedAt time.Time
	UpdatedAt time.Time
	Status    string // ACTIVE, SUSPENDED, DELETED
	Config    TenantConfig
}

type TenantConfig struct {
	AllowedDomains []string
	MaxUsers       int
	MaxDocuments   int
	Features       []string
	Settings       map[string]interface{}
}

// NewTenantAggregate creates a new tenant aggregate
func NewTenantAggregate(id, name, plan, ownerID string) *TenantAggregate {
	aggregate := &TenantAggregate{
		AggregateRoot: AggregateRoot{
			ID:      id,
			Version: 0,
		},
		Name:      name,
		Plan:      plan,
		OwnerID:   ownerID,
		CreatedAt: time.Now().UTC(),
		UpdatedAt: time.Now().UTC(),
		Status:    "ACTIVE",
		Config: TenantConfig{
			Settings: make(map[string]interface{}),
		},
	}

	event := &TenantCreatedEvent{
		BaseEvent: NewBaseEvent(id, "tenant", "tenant_created", 1, map[string]interface{}{
			"name":     name,
			"plan":     plan,
			"owner_id": ownerID,
		}),
		TenantID:  id,
		Name:      name,
		Plan:      plan,
		CreatedBy: ownerID,
	}

	aggregate.ApplyEvent(event)
	return aggregate
}

// UpdatePlan updates tenant plan
func (t *TenantAggregate) UpdatePlan(plan string) error {
	if t.Status != "ACTIVE" {
		return errors.New("tenant is not active")
	}

	t.Plan = plan
	t.UpdatedAt = time.Now().UTC()

	event := &TenantUpdatedEvent{
		BaseEvent: NewBaseEvent(t.ID, "tenant", "tenant_plan_updated", t.Version+1, map[string]interface{}{
			"plan": plan,
		}),
		TenantID:      t.ID,
		UpdatedFields: []string{"plan"},
	}

	t.ApplyEvent(event)
	return nil
}

// Suspend suspends tenant
func (t *TenantAggregate) Suspend(reason, suspendedBy string) error {
	if t.Status == "SUSPENDED" {
		return errors.New("tenant is already suspended")
	}

	t.Status = "SUSPENDED"
	t.UpdatedAt = time.Now().UTC()

	event := &TenantSuspendedEvent{
		BaseEvent: NewBaseEvent(t.ID, "tenant", "tenant_suspended", t.Version+1, map[string]interface{}{
			"reason": reason,
		}),
		TenantID:    t.ID,
		Reason:      reason,
		SuspendedBy: suspendedBy,
	}

	t.ApplyEvent(event)
	return nil
}

// Reactivate reactivates suspended tenant
func (t *TenantAggregate) Reactivate() error {
	if t.Status != "SUSPENDED" {
		return errors.New("tenant is not suspended")
	}

	t.Status = "ACTIVE"
	t.UpdatedAt = time.Now().UTC()

	event := &TenantUpdatedEvent{
		BaseEvent: NewBaseEvent(t.ID, "tenant", "tenant_reactivated", t.Version+1, map[string]interface{}{
			"status": "ACTIVE",
		}),
		TenantID:      t.ID,
		UpdatedFields: []string{"status"},
	}

	t.ApplyEvent(event)
	return nil
}

// UpdateConfig updates tenant configuration
func (t *TenantAggregate) UpdateConfig(config TenantConfig) error {
	if t.Status != "ACTIVE" {
		return errors.New("tenant is not active")
	}

	t.Config = config
	t.UpdatedAt = time.Now().UTC()

	event := &TenantUpdatedEvent{
		BaseEvent: NewBaseEvent(t.ID, "tenant", "tenant_config_updated", t.Version+1, map[string]interface{}{
			"config": config,
		}),
		TenantID:      t.ID,
		UpdatedFields: []string{"config"},
	}

	t.ApplyEvent(event)
	return nil
}

// RebuildFromEvents rebuilds tenant aggregate from events
func (t *TenantAggregate) RebuildFromEvents(events []Event) error {
	for _, event := range events {
		switch e := event.(type) {
		case *TenantCreatedEvent:
			t.ID = e.GetAggregateID()
			t.Name = e.Name
			t.Plan = e.Plan
			t.OwnerID = e.CreatedBy
			t.CreatedAt = e.GetOccurredAt()
			t.UpdatedAt = e.GetOccurredAt()
			t.Status = "ACTIVE"
		case *TenantUpdatedEvent:
			t.UpdatedAt = e.GetOccurredAt()
			// Apply field updates based on UpdatedFields
			if plan, ok := e.GetData()["plan"].(string); ok {
				t.Plan = plan
			}
			if status, ok := e.GetData()["status"].(string); ok {
				t.Status = status
			}
			if config, ok := e.GetData()["config"].(TenantConfig); ok {
				t.Config = config
			}
		case *TenantSuspendedEvent:
			t.Status = "SUSPENDED"
			t.UpdatedAt = e.GetOccurredAt()
		}
		t.Version = e.GetVersion()
	}
	return nil
}

// DocumentAggregate represents the document aggregate
type DocumentAggregate struct {
	AggregateRoot
	TenantID    string
	UserID      string
	FileName    string
	FileSize    int64
	ContentType string
	Checksum    string
	Status      string // UPLOADED, PROCESSING, PROCESSED, FAILED, DELETED
	CreatedAt   time.Time
	UpdatedAt   time.Time
	Metadata    DocumentMetadata
}

type DocumentMetadata struct {
	Tags        []string
	VectorCount int
	ChunksCount int
	Language    string
	Title       string
	Author      string
	Summary     string
	Processing  ProcessingMetadata
}

type ProcessingMetadata struct {
	StartedAt   *time.Time
	CompletedAt *time.Time
	DurationMs  int64
	Error       *string
	ProcessedBy string
}

// NewDocumentAggregate creates a new document aggregate
func NewDocumentAggregate(id, tenantID, userID, fileName, contentType, checksum string, fileSize int64) *DocumentAggregate {
	aggregate := &DocumentAggregate{
		AggregateRoot: AggregateRoot{
			ID:      id,
			Version: 0,
		},
		TenantID:    tenantID,
		UserID:      userID,
		FileName:    fileName,
		FileSize:    fileSize,
		ContentType: contentType,
		Checksum:    checksum,
		Status:      "UPLOADED",
		CreatedAt:   time.Now().UTC(),
		UpdatedAt:   time.Now().UTC(),
		Metadata: DocumentMetadata{
			Tags: []string{},
		},
	}

	event := &DocumentUploadedEvent{
		BaseEvent: NewBaseEvent(id, "document", "document_uploaded", 1, map[string]interface{}{
			"tenant_id":    tenantID,
			"user_id":      userID,
			"file_name":    fileName,
			"content_type": contentType,
			"checksum":     checksum,
			"file_size":    fileSize,
		}),
		DocumentID:  id,
		TenantID:    tenantID,
		UserID:      userID,
		FileName:    fileName,
		ContentType: contentType,
		Checksum:    checksum,
		FileSize:    fileSize,
	}

	aggregate.ApplyEvent(event)
	return aggregate
}

// StartProcessing marks document as processing started
func (d *DocumentAggregate) StartProcessing() error {
	if d.Status != "UPLOADED" {
		return fmt.Errorf("document status is not UPLOADED: %s", d.Status)
	}

	now := time.Now().UTC()
	d.Status = "PROCESSING"
	d.UpdatedAt = now
	d.Metadata.Processing.StartedAt = &now

	event := &DocumentUpdatedEvent{
		BaseEvent: NewBaseEvent(d.ID, "document", "document_processing_started", d.Version+1, map[string]interface{}{
			"status":                "PROCESSING",
			"processing_started_at": now,
		}),
		DocumentID:    d.ID,
		UpdatedFields: []string{"status", "processing_started_at"},
	}

	d.ApplyEvent(event)
	return nil
}

// CompleteProcessing marks document as processing completed
func (d *DocumentAggregate) CompleteProcessing(vectorCount, chunksCount int, tags []string, summary string) error {
	if d.Status != "PROCESSING" {
		return fmt.Errorf("document status is not PROCESSING: %s", d.Status)
	}

	now := time.Now().UTC()
	d.Status = "PROCESSED"
	d.UpdatedAt = now
	d.Metadata.Processing.CompletedAt = &now
	d.Metadata.VectorCount = vectorCount
	d.Metadata.ChunksCount = chunksCount
	d.Metadata.Tags = tags
	d.Metadata.Summary = summary

	if d.Metadata.Processing.StartedAt != nil {
		d.Metadata.Processing.DurationMs = now.Sub(*d.Metadata.Processing.StartedAt).Milliseconds()
	}

	event := &DocumentProcessedEvent{
		BaseEvent: NewBaseEvent(d.ID, "document", "document_processed", d.Version+1, map[string]interface{}{
			"vector_count":  vectorCount,
			"chunks_count":  chunksCount,
			"tags":          tags,
			"summary":       summary,
			"processing_ms": d.Metadata.Processing.DurationMs,
		}),
		DocumentID:   d.ID,
		ChunksCount:  chunksCount,
		VectorCount:  vectorCount,
		ProcessingMs: d.Metadata.Processing.DurationMs,
		Tags:         tags,
	}

	d.ApplyEvent(event)
	return nil
}

// FailProcessing marks document processing as failed
func (d *DocumentAggregate) FailProcessing(err error) error {
	if d.Status != "PROCESSING" {
		return fmt.Errorf("document status is not PROCESSING: %s", d.Status)
	}

	errorMsg := err.Error()
	now := time.Now().UTC()
	d.Status = "FAILED"
	d.UpdatedAt = now
	d.Metadata.Processing.CompletedAt = &now
	d.Metadata.Processing.Error = &errorMsg

	if d.Metadata.Processing.StartedAt != nil {
		d.Metadata.Processing.DurationMs = now.Sub(*d.Metadata.Processing.StartedAt).Milliseconds()
	}

	event := &DocumentUpdatedEvent{
		BaseEvent: NewBaseEvent(d.ID, "document", "document_processing_failed", d.Version+1, map[string]interface{}{
			"status":        "FAILED",
			"error":         errorMsg,
			"processing_ms": d.Metadata.Processing.DurationMs,
		}),
		DocumentID:    d.ID,
		UpdatedFields: []string{"status", "error", "processing_completed_at", "processing_duration_ms"},
	}

	d.ApplyEvent(event)
	return nil
}

// Delete marks document as deleted
func (d *DocumentAggregate) Delete(deletedBy string) error {
	if d.Status == "DELETED" {
		return errors.New("document is already deleted")
	}

	d.Status = "DELETED"
	d.UpdatedAt = time.Now().UTC()

	event := &DocumentDeletedEvent{
		BaseEvent: NewBaseEvent(d.ID, "document", "document_deleted", d.Version+1, map[string]interface{}{
			"deleted_by": deletedBy,
		}),
		DocumentID: d.ID,
		DeletedBy:  deletedBy,
	}

	d.ApplyEvent(event)
	return nil
}

// RebuildFromEvents rebuilds document aggregate from events
func (d *DocumentAggregate) RebuildFromEvents(events []Event) error {
	for _, event := range events {
		switch e := event.(type) {
		case *DocumentUploadedEvent:
			d.ID = e.GetAggregateID()
			d.TenantID = e.TenantID
			d.UserID = e.UserID
			d.FileName = e.FileName
			d.FileSize = e.FileSize
			d.ContentType = e.ContentType
			d.Checksum = e.Checksum
			d.Status = "UPLOADED"
			d.CreatedAt = e.GetOccurredAt()
			d.UpdatedAt = e.GetOccurredAt()
		case *DocumentProcessedEvent:
			d.Status = "PROCESSED"
			d.UpdatedAt = e.GetOccurredAt()
			d.Metadata.VectorCount = e.VectorCount
			d.Metadata.ChunksCount = e.ChunksCount
			d.Metadata.Tags = e.Tags
		case *DocumentUpdatedEvent:
			d.UpdatedAt = e.GetOccurredAt()
			// Apply field updates based on UpdatedFields
			if status, ok := e.GetData()["status"].(string); ok {
				d.Status = status
			}
			if vectorCount, ok := e.GetData()["vector_count"].(int); ok {
				d.Metadata.VectorCount = vectorCount
			}
			if chunksCount, ok := e.GetData()["chunks_count"].(int); ok {
				d.Metadata.ChunksCount = chunksCount
			}
			if tags, ok := e.GetData()["tags"].([]string); ok {
				d.Metadata.Tags = tags
			}
			if summary, ok := e.GetData()["summary"].(string); ok {
				d.Metadata.Summary = summary
			}
		case *DocumentDeletedEvent:
			d.Status = "DELETED"
			d.UpdatedAt = e.GetOccurredAt()
		}
		d.Version = e.GetVersion()
	}
	return nil
}
