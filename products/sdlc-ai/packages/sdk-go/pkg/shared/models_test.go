package shared

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/shaharsolomon/sdln/pkg/testing"
)

func TestBaseRequest(t *testing.T) {
	factory := testing.NewTestDataFactory()

	t.Run("Create base request", func(t *testing.T) {
		request := BaseRequest{
			RequestID: factory.NextID(),
			UserID:    factory.NextID(),
			TenantID:  factory.NextID(),
			SessionID: factory.NextID(),
			IPAddress: "192.168.1.1",
			UserAgent: "Mozilla/5.0 (Test Browser)",
			Timestamp: factory.GetClock().Now(),
			Metadata:  map[string]interface{}{"test": "value"},
		}

		if request.RequestID == "" {
			t.Error("Expected non-empty request ID")
		}

		if request.UserID == "" {
			t.Error("Expected non-empty user ID")
		}

		if request.TenantID == "" {
			t.Error("Expected non-empty tenant ID")
		}

		if request.Timestamp.IsZero() {
			t.Error("Expected non-zero timestamp")
		}

		if request.Metadata == nil {
			t.Error("Expected non-nil metadata")
		}

		if request.Metadata["test"] != "value" {
			t.Error("Expected metadata value")
		}
	})

	t.Run("Base request with minimal data", func(t *testing.T) {
		request := BaseRequest{
			RequestID: factory.NextID(),
			Timestamp: factory.GetClock().Now(),
			Metadata:  map[string]interface{}{},
		}

		if request.UserID != "" {
			t.Error("Expected empty user ID")
		}

		if request.TenantID != "" {
			t.Error("Expected empty tenant ID")
		}

		if len(request.Metadata) != 0 {
			t.Error("Expected empty metadata")
		}
	})
}

func TestBaseResponse(t *testing.T) {
	factory := testing.NewTestDataFactory()

	t.Run("Create successful response", func(t *testing.T) {
		response := BaseResponse{
			RequestID: factory.NextID(),
			Success:   true,
			Message:   "Operation completed successfully",
			Data:      map[string]interface{}{"result": "success"},
			Metadata:  map[string]interface{}{"processing_time": 100},
			Timestamp: factory.GetClock().Now(),
		}

		if !response.Success {
			t.Error("Expected success to be true")
		}

		if response.Message != "Operation completed successfully" {
			t.Error("Expected success message")
		}

		if response.Data == nil {
			t.Error("Expected non-nil data")
		}

		if response.Error != nil {
			t.Error("Expected nil error for successful response")
		}
	})

	t.Run("Create error response", func(t *testing.T) {
		errorDetail := &ErrorDetail{
			Code:      "VALIDATION_ERROR",
			Message:   "Invalid input provided",
			Details:   map[string]interface{}{"field": "email"},
			Retryable: false,
		}

		response := BaseResponse{
			RequestID: factory.NextID(),
			Success:   false,
			Message:   "Operation failed",
			Error:     errorDetail,
			Timestamp: factory.GetClock().Now(),
		}

		if response.Success {
			t.Error("Expected success to be false")
		}

		if response.Error == nil {
			t.Error("Expected non-nil error for error response")
		}

		if response.Error.Code != "VALIDATION_ERROR" {
			t.Error("Expected error code")
		}

		if response.Error.Retryable {
			t.Error("Expected non-retryable error")
		}
	})

	t.Run("Error with retry", func(t *testing.T) {
		retryAfter := 30
		errorDetail := &ErrorDetail{
			Code:       "RATE_LIMIT_EXCEEDED",
			Message:    "Too many requests",
			Retryable:  true,
			RetryAfter: &retryAfter,
		}

		response := BaseResponse{
			RequestID: factory.NextID(),
			Success:   false,
			Error:     errorDetail,
			Timestamp: factory.GetClock().Now(),
		}

		if !response.Error.Retryable {
			t.Error("Expected retryable error")
		}

		if response.Error.RetryAfter == nil {
			t.Error("Expected retry after to be set")
		}

		if *response.Error.RetryAfter != retryAfter {
			t.Errorf("Expected retry after %d, got %d", retryAfter, *response.Error.RetryAfter)
		}
	})
}

func TestPagination(t *testing.T) {
	t.Run("Create pagination", func(t *testing.T) {
		pagination := Pagination{
			Page:       2,
			PerPage:    25,
			TotalItems: 100,
			TotalPages: 4,
			HasNext:    true,
			HasPrev:    true,
		}

		if pagination.Page != 2 {
			t.Errorf("Expected page 2, got %d", pagination.Page)
		}

		if pagination.PerPage != 25 {
			t.Errorf("Expected per page 25, got %d", pagination.PerPage)
		}

		if pagination.TotalItems != 100 {
			t.Errorf("Expected total items 100, got %d", pagination.TotalItems)
		}

		if pagination.TotalPages != 4 {
			t.Errorf("Expected total pages 4, got %d", pagination.TotalPages)
		}

		if !pagination.HasNext {
			t.Error("Expected has next to be true")
		}

		if !pagination.HasPrev {
			t.Error("Expected has prev to be true")
		}
	})

	t.Run("First page pagination", func(t *testing.T) {
		pagination := Pagination{
			Page:       1,
			PerPage:    10,
			TotalItems: 5,
			TotalPages: 1,
			HasNext:    false,
			HasPrev:    false,
		}

		if pagination.Page != 1 {
			t.Errorf("Expected page 1, got %d", pagination.Page)
		}

		if pagination.HasNext {
			t.Error("Expected has next to be false")
		}

		if pagination.HasPrev {
			t.Error("Expected has prev to be false")
		}
	})

	t.Run("Last page pagination", func(t *testing.T) {
		pagination := Pagination{
			Page:       3,
			PerPage:    10,
			TotalItems: 25,
			TotalPages: 3,
			HasNext:    false,
			HasPrev:    true,
		}

		if !pagination.HasPrev {
			t.Error("Expected has prev to be true")
		}

		if pagination.HasNext {
			t.Error("Expected has next to be false")
		}
	})
}

func TestSort(t *testing.T) {
	t.Run("Create sort", func(t *testing.T) {
		sort := Sort{
			Field: "created_at",
			Order: "DESC",
		}

		if sort.Field != "created_at" {
			t.Errorf("Expected field 'created_at', got '%s'", sort.Field)
		}

		if sort.Order != "DESC" {
			t.Errorf("Expected order 'DESC', got '%s'", sort.Order)
		}
	})

	t.Run("Invalid sort order", func(t *testing.T) {
		sort := Sort{
			Field: "name",
			Order: "INVALID",
		}

		// This should still be valid, as validation happens at a higher level
		if sort.Field != "name" {
			t.Errorf("Expected field 'name', got '%s'", sort.Field)
		}

		if sort.Order != "INVALID" {
			t.Errorf("Expected order 'INVALID', got '%s'", sort.Order)
		}
	})
}

func TestFilter(t *testing.T) {
	t.Run("Create filter with string value", func(t *testing.T) {
		filter := Filter{
			Field:    "status",
			Operator: "eq",
			Value:    "active",
		}

		if filter.Field != "status" {
			t.Errorf("Expected field 'status', got '%s'", filter.Field)
		}

		if filter.Operator != "eq" {
			t.Errorf("Expected operator 'eq', got '%s'", filter.Operator)
		}

		if filter.Value != "active" {
			t.Errorf("Expected value 'active', got '%v'", filter.Value)
		}
	})

	t.Run("Create filter with array value", func(t *testing.T) {
		filter := Filter{
			Field:    "tags",
			Operator: "in",
			Value:    []string{"test", "document"},
		}

		if filter.Field != "tags" {
			t.Errorf("Expected field 'tags', got '%s'", filter.Field)
		}

		if filter.Operator != "in" {
			t.Errorf("Expected operator 'in', got '%s'", filter.Operator)
		}

		value, ok := filter.Value.([]string)
		if !ok {
			t.Error("Expected string array value")
		}

		if len(value) != 2 {
			t.Errorf("Expected 2 values, got %d", len(value))
		}
	})
}

func TestQueryOptions(t *testing.T) {
	factory := testing.NewTestDataFactory()

	t.Run("Create query options with all fields", func(t *testing.T) {
		pagination := Pagination{
			Page:       1,
			PerPage:    20,
			TotalItems: 100,
			TotalPages: 5,
			HasNext:    true,
			HasPrev:    false,
		}

		sort := Sort{
			Field: "created_at",
			Order: "DESC",
		}

		filters := []Filter{
			{Field: "status", Operator: "eq", Value: "active"},
			{Field: "type", Operator: "in", Value: []string{"user", "admin"}},
		}

		options := QueryOptions{
			Pagination: &pagination,
			Sort:       &sort,
			Filters:    filters,
			Search:     "test query",
			Fields:     []string{"id", "name", "email"},
		}

		if options.Pagination == nil {
			t.Error("Expected non-nil pagination")
		}

		if options.Sort == nil {
			t.Error("Expected non-nil sort")
		}

		if len(options.Filters) != 2 {
			t.Errorf("Expected 2 filters, got %d", len(options.Filters))
		}

		if options.Search != "test query" {
			t.Errorf("Expected search 'test query', got '%s'", options.Search)
		}

		if len(options.Fields) != 3 {
			t.Errorf("Expected 3 fields, got %d", len(options.Fields))
		}
	})

	t.Run("Create minimal query options", func(t *testing.T) {
		options := QueryOptions{}

		if options.Pagination != nil {
			t.Error("Expected nil pagination")
		}

		if options.Sort != nil {
			t.Error("Expected nil sort")
		}

		if len(options.Filters) != 0 {
			t.Errorf("Expected 0 filters, got %d", len(options.Filters))
		}

		if options.Search != "" {
			t.Errorf("Expected empty search, got '%s'", options.Search)
		}

		if len(options.Fields) != 0 {
			t.Errorf("Expected 0 fields, got %d", len(options.Fields))
		}
	})
}

func TestTenantContext(t *testing.T) {
	factory := testing.NewTestDataFactory()
	tenant := factory.CreateTestTenant()

	t.Run("Create tenant context", func(t *testing.T) {
		if tenant.TenantID == "" {
			t.Error("Expected non-empty tenant ID")
		}

		if tenant.Name == "" {
			t.Error("Expected non-empty name")
		}

		if tenant.Plan == "" {
			t.Error("Expected non-empty plan")
		}

		if tenant.Status != StatusActive {
			t.Errorf("Expected status %s, got %s", StatusActive, tenant.Status)
		}

		if tenant.CreatedAt.IsZero() {
			t.Error("Expected non-zero created at time")
		}

		if tenant.Config.AllowedDomains == nil {
			t.Error("Expected non-nil allowed domains")
		}

		if len(tenant.Features) == 0 {
			t.Error("Expected non-empty features")
		}

		if tenant.Settings == nil {
			t.Error("Expected non-nil settings")
		}
	})

	t.Run("Tenant configuration", func(t *testing.T) {
		config := tenant.Config

		if config.MaxUsers <= 0 {
			t.Error("Expected positive max users")
		}

		if config.MaxDocuments <= 0 {
			t.Error("Expected positive max documents")
		}

		if config.MaxStorage <= 0 {
			t.Error("Expected positive max storage")
		}

		// Check security configuration
		if !config.Security.RequireMFA {
			t.Error("Expected MFA requirement")
		}

		if config.Security.PasswordPolicy.MinLength <= 0 {
			t.Error("Expected positive password min length")
		}

		// Check AI configuration
		if config.AI.Model == "" {
			t.Error("Expected non-empty AI model")
		}

		if config.AI.MaxTokens <= 0 {
			t.Error("Expected positive max tokens")
		}
	})
}

func TestUserContext(t *testing.T) {
	factory := testing.NewTestDataFactory()
	user := factory.CreateTestUser()

	t.Run("Create user context", func(t *testing.T) {
		if user.UserID == "" {
			t.Error("Expected non-empty user ID")
		}

		if user.TenantID == "" {
			t.Error("Expected non-empty tenant ID")
		}

		if user.Email == "" {
			t.Error("Expected non-empty email")
		}

		if user.Role == "" {
			t.Error("Expected non-empty role")
		}

		if !user.Active {
			t.Error("Expected user to be active")
		}

		if user.CreatedAt.IsZero() {
			t.Error("Expected non-zero created at time")
		}

		if user.UpdatedAt.IsZero() {
			t.Error("Expected non-zero updated at time")
		}
	})

	t.Run("User profile", func(t *testing.T) {
		profile := user.Profile

		if profile.FirstName == "" {
			t.Error("Expected non-empty first name")
		}

		if profile.LastName == "" {
			t.Error("Expected non-empty last name")
		}

		if profile.Timezone == "" {
			t.Error("Expected non-empty timezone")
		}

		if profile.Language == "" {
			t.Error("Expected non-empty language")
		}

		if len(user.Permissions) == 0 {
			t.Error("Expected non-empty permissions")
		}

		if user.Preferences == nil {
			t.Error("Expected non-nil preferences")
		}
	})
}

func TestDocumentContext(t *testing.T) {
	factory := testing.NewTestDataFactory()
	document := factory.CreateTestDocument()

	t.Run("Create document context", func(t *testing.T) {
		if document.DocumentID == "" {
			t.Error("Expected non-empty document ID")
		}

		if document.TenantID == "" {
			t.Error("Expected non-empty tenant ID")
		}

		if document.UserID == "" {
			t.Error("Expected non-empty user ID")
		}

		if document.Name == "" {
			t.Error("Expected non-empty name")
		}

		if document.Type == "" {
			t.Error("Expected non-empty type")
		}

		if document.MimeType == "" {
			t.Error("Expected non-empty mime type")
		}

		if document.Size <= 0 {
			t.Error("Expected positive size")
		}

		if document.Checksum == "" {
			t.Error("Expected non-empty checksum")
		}

		if document.Status != DocumentStatusProcessed {
			t.Errorf("Expected status %s, got %s", DocumentStatusProcessed, document.Status)
		}

		if document.CreatedAt.IsZero() {
			t.Error("Expected non-zero created at time")
		}

		if document.UpdatedAt.IsZero() {
			t.Error("Expected non-zero updated at time")
		}
	})

	t.Run("Document access control", func(t *testing.T) {
		accessControl := document.AccessControl

		if accessControl.Owner == "" {
			t.Error("Expected non-empty owner")
		}

		if accessControl.Permissions == nil {
			t.Error("Expected non-nil permissions")
		}

		if accessControl.Public {
			t.Error("Expected document to be private by default")
		}
	})
}

func TestRAGContext(t *testing.T) {
	factory := testing.NewTestDataFactory()
	rag := factory.CreateTestRAGContext()

	t.Run("Create RAG context", func(t *testing.T) {
		if rag.QueryID == "" {
			t.Error("Expected non-empty query ID")
		}

		if rag.TenantID == "" {
			t.Error("Expected non-empty tenant ID")
		}

		if rag.UserID == "" {
			t.Error("Expected non-empty user ID")
		}

		if rag.Query == "" {
			t.Error("Expected non-empty query")
		}

		if rag.Response == "" {
			t.Error("Expected non-empty response")
		}

		if len(rag.Citations) == 0 {
			t.Error("Expected non-empty citations")
		}

		if rag.Confidence <= 0 {
			t.Error("Expected positive confidence")
		}

		if rag.ResponseTime <= 0 {
			t.Error("Expected positive response time")
		}

		if rag.Model == "" {
			t.Error("Expected non-empty model")
		}

		if rag.Status != "completed" {
			t.Errorf("Expected status 'completed', got '%s'", rag.Status)
		}

		if rag.CreatedAt.IsZero() {
			t.Error("Expected non-zero created at time")
		}

		if rag.ProcessedAt == nil {
			t.Error("Expected non-nil processed at time")
		}
	})

	t.Run("Token usage", func(t *testing.T) {
		tokenUsage := rag.TokenUsage

		if tokenUsage.InputTokens <= 0 {
			t.Error("Expected positive input tokens")
		}

		if tokenUsage.OutputTokens <= 0 {
			t.Error("Expected positive output tokens")
		}

		if tokenUsage.TotalTokens != tokenUsage.InputTokens+tokenUsage.OutputTokens {
			t.Error("Expected total tokens to equal input + output tokens")
		}
	})

	t.Run("Citations", func(t *testing.T) {
		citation := rag.Citations[0]

		if citation.DocumentID == "" {
			t.Error("Expected non-empty document ID")
		}

		if citation.DocumentName == "" {
			t.Error("Expected non-empty document name")
		}

		if citation.ChunkID == "" {
			t.Error("Expected non-empty chunk ID")
		}

		if citation.Text == "" {
			t.Error("Expected non-empty text")
		}

		if citation.Score <= 0 {
			t.Error("Expected positive score")
		}

		if citation.Position <= 0 {
			t.Error("Expected positive position")
		}
	})
}

func TestPaymentContext(t *testing.T) {
	factory := testing.NewTestDataFactory()
	payment := factory.CreateTestPaymentContext()

	t.Run("Create payment context", func(t *testing.T) {
		if payment.PaymentID == "" {
			t.Error("Expected non-empty payment ID")
		}

		if payment.TenantID == "" {
			t.Error("Expected non-empty tenant ID")
		}

		if payment.UserID == "" {
			t.Error("Expected non-empty user ID")
		}

		if payment.Amount <= 0 {
			t.Error("Expected positive amount")
		}

		if payment.Currency == "" {
			t.Error("Expected non-empty currency")
		}

		if payment.Status != PaymentStatusCompleted {
			t.Errorf("Expected status %s, got %s", PaymentStatusCompleted, payment.Status)
		}

		if payment.TokenID == "" {
			t.Error("Expected non-empty token ID")
		}

		if payment.ProcessorID == "" {
			t.Error("Expected non-empty processor ID")
		}

		if payment.GatewayTxnID == "" {
			t.Error("Expected non-empty gateway transaction ID")
		}

		if payment.CreatedAt.IsZero() {
			t.Error("Expected non-zero created at time")
		}

		if payment.ProcessedAt == nil {
			t.Error("Expected non-nil processed at time")
		}
	})
}

func TestAuditContext(t *testing.T) {
	factory := testing.NewTestDataFactory()
	now := factory.GetClock().Now()

	audit := &AuditContext{
		AuditID:      factory.NextID(),
		TenantID:     factory.NextID(),
		UserID:       factory.NextID(),
		ResourceID:   factory.NextID(),
		ResourceType: "document",
		Action:       "read",
		Resource:     "test_document.pdf",
		Outcome:      "SUCCESS",
		Description:  "User accessed document",
		Details:      map[string]interface{}{"ip_address": "192.168.1.1"},
		IPAddress:    "192.168.1.1",
		UserAgent:    "Mozilla/5.0 (Test Browser)",
		Timestamp:    now,
		Severity:     SeverityLow,
		Category:     "data_access",
		Tags:         []string{"test", "audit"},
	}

	t.Run("Create audit context", func(t *testing.T) {
		if audit.AuditID == "" {
			t.Error("Expected non-empty audit ID")
		}

		if audit.TenantID == "" {
			t.Error("Expected non-empty tenant ID")
		}

		if audit.Action == "" {
			t.Error("Expected non-empty action")
		}

		if audit.Resource == "" {
			t.Error("Expected non-empty resource")
		}

		if audit.Outcome == "" {
			t.Error("Expected non-empty outcome")
		}

		if audit.Timestamp.IsZero() {
			t.Error("Expected non-zero timestamp")
		}

		if audit.Severity == "" {
			t.Error("Expected non-empty severity")
		}

		if audit.Category == "" {
			t.Error("Expected non-empty category")
		}

		if audit.Details == nil {
			t.Error("Expected non-nil details")
		}

		if audit.IPAddress == "" {
			t.Error("Expected non-empty IP address")
		}

		if audit.UserAgent == "" {
			t.Error("Expected non-empty user agent")
		}
	})

	t.Run("Audit tags", func(t *testing.T) {
		if len(audit.Tags) == 0 {
			t.Error("Expected non-empty tags")
		}

		expectedTags := []string{"test", "audit"}
		if len(audit.Tags) != len(expectedTags) {
			t.Errorf("Expected %d tags, got %d", len(expectedTags), len(audit.Tags))
		}
	})
}

func TestSecurityContext(t *testing.T) {
	factory := testing.NewTestDataFactory()
	now := factory.GetClock().Now()

	security := &SecurityContext{
		IncidentID:   factory.NextID(),
		TenantID:     factory.NextID(),
		UserID:       factory.NextID(),
		Type:         "unauthorized_access",
		Severity:     SeverityHigh,
		Status:       "OPEN",
		Title:        "Unauthorized Access Attempt",
		Description:  "User attempted to access restricted resource",
		IPAddress:    "192.168.1.100",
		UserAgent:    "Mozilla/5.0 (Test Browser)",
		ResourceID:   factory.NextID(),
		ResourceType: "document",
		Details:      map[string]interface{}{"attempts": 3},
		Actions:      []string{"blocked_ip", "notified_admin"},
		CreatedAt:    now,
		UpdatedAt:    now,
	}

	t.Run("Create security context", func(t *testing.T) {
		if security.IncidentID == "" {
			t.Error("Expected non-empty incident ID")
		}

		if security.Type == "" {
			t.Error("Expected non-empty type")
		}

		if security.Severity == "" {
			t.Error("Expected non-empty severity")
		}

		if security.Status == "" {
			t.Error("Expected non-empty status")
		}

		if security.Title == "" {
			t.Error("Expected non-empty title")
		}

		if security.Description == "" {
			t.Error("Expected non-empty description")
		}

		if security.CreatedAt.IsZero() {
			t.Error("Expected non-zero created at time")
		}

		if security.UpdatedAt.IsZero() {
			t.Error("Expected non-zero updated at time")
		}
	})

	t.Run("Security incident resolution", func(t *testing.T) {
		resolvedTime := now.Add(time.Hour * 24)
		resolvedBy := "security_admin"
		security.ResolvedAt = &resolvedTime
		security.ResolvedBy = resolvedBy
		security.Status = "RESOLVED"

		if security.ResolvedAt == nil {
			t.Error("Expected non-nil resolved at time")
		}

		if security.ResolvedBy == "" {
			t.Error("Expected non-empty resolved by")
		}

		if security.Status != "RESOLVED" {
			t.Errorf("Expected status 'RESOLVED', got '%s'", security.Status)
		}
	})
}

func TestHealthStatus(t *testing.T) {
	factory := testing.NewTestDataFactory()
	now := factory.GetClock().Now()

	services := []ServiceHealth{
		{
			Name:      "api",
			Status:    HealthHealthy,
			Message:   "All systems operational",
			LastCheck: now,
			Metrics:   map[string]interface{}{"response_time": 50},
		},
		{
			Name:      "database",
			Status:    HealthDegraded,
			Message:   "High CPU usage",
			LastCheck: now,
			Metrics:   map[string]interface{}{"cpu_usage": 85},
		},
	}

	health := &HealthStatus{
		Status:      HealthDegraded,
		Timestamp:   now,
		Version:     "1.0.0",
		Environment: "production",
		Services:    services,
		Metrics:     map[string]interface{}{"uptime": 0.999},
		Checks:      map[string]bool{"database": true, "redis": false},
	}

	t.Run("Create health status", func(t *testing.T) {
		if health.Status == "" {
			t.Error("Expected non-empty status")
		}

		if health.Timestamp.IsZero() {
			t.Error("Expected non-zero timestamp")
		}

		if health.Version == "" {
			t.Error("Expected non-empty version")
		}

		if health.Environment == "" {
			t.Error("Expected non-empty environment")
		}

		if len(health.Services) == 0 {
			t.Error("Expected non-empty services")
		}

		if health.Metrics == nil {
			t.Error("Expected non-nil metrics")
		}

		if health.Checks == nil {
			t.Error("Expected non-nil checks")
		}
	})

	t.Run("Service health", func(t *testing.T) {
		service := health.Services[0]

		if service.Name == "" {
			t.Error("Expected non-empty service name")
		}

		if service.Status == "" {
			t.Error("Expected non-empty service status")
		}

		if service.LastCheck.IsZero() {
			t.Error("Expected non-zero last check time")
		}
	})
}

func TestConstants(t *testing.T) {
	t.Run("Status constants", func(t *testing.T) {
		if StatusActive != "ACTIVE" {
			t.Errorf("Expected StatusActive to be 'ACTIVE', got '%s'", StatusActive)
		}

		if StatusInactive != "INACTIVE" {
			t.Errorf("Expected StatusInactive to be 'INACTIVE', got '%s'", StatusInactive)
		}

		if StatusSuspended != "SUSPENDED" {
			t.Errorf("Expected StatusSuspended to be 'SUSPENDED', got '%s'", StatusSuspended)
		}

		if DocumentStatusProcessed != "PROCESSED" {
			t.Errorf("Expected DocumentStatusProcessed to be 'PROCESSED', got '%s'", DocumentStatusProcessed)
		}

		if PaymentStatusCompleted != "COMPLETED" {
			t.Errorf("Expected PaymentStatusCompleted to be 'COMPLETED', got '%s'", PaymentStatusCompleted)
		}
	})

	t.Run("Role constants", func(t *testing.T) {
		if RoleAdmin != "ADMIN" {
			t.Errorf("Expected RoleAdmin to be 'ADMIN', got '%s'", RoleAdmin)
		}

		if RoleUser != "USER" {
			t.Errorf("Expected RoleUser to be 'USER', got '%s'", RoleUser)
		}

		if RoleViewer != "VIEWER" {
			t.Errorf("Expected RoleViewer to be 'VIEWER', got '%s'", RoleViewer)
		}
	})

	t.Run("Severity constants", func(t *testing.T) {
		if SeverityLow != "LOW" {
			t.Errorf("Expected SeverityLow to be 'LOW', got '%s'", SeverityLow)
		}

		if SeverityMedium != "MEDIUM" {
			t.Errorf("Expected SeverityMedium to be 'MEDIUM', got '%s'", SeverityMedium)
		}

		if SeverityHigh != "HIGH" {
			t.Errorf("Expected SeverityHigh to be 'HIGH', got '%s'", SeverityHigh)
		}

		if SeverityCritical != "CRITICAL" {
			t.Errorf("Expected SeverityCritical to be 'CRITICAL', got '%s'", SeverityCritical)
		}
	})

	t.Run("Health constants", func(t *testing.T) {
		if HealthHealthy != "HEALTHY" {
			t.Errorf("Expected HealthHealthy to be 'HEALTHY', got '%s'", HealthHealthy)
		}

		if HealthDegraded != "DEGRADED" {
			t.Errorf("Expected HealthDegraded to be 'DEGRADED', got '%s'", HealthDegraded)
		}

		if HealthUnhealthy != "UNHEALTHY" {
			t.Errorf("Expected HealthUnhealthy to be 'UNHEALTHY', got '%s'", HealthUnhealthy)
		}
	})
}

func TestModelSerialization(t *testing.T) {
	factory := testing.NewTestDataFactory()

	t.Run("Serialize user context", func(t *testing.T) {
		user := factory.CreateTestUser()

		jsonData, err := json.Marshal(user)
		if err != nil {
			t.Fatalf("Failed to marshal user context: %v", err)
		}

		var deserializedUser UserContext
		err = json.Unmarshal(jsonData, &deserializedUser)
		if err != nil {
			t.Fatalf("Failed to unmarshal user context: %v", err)
		}

		if deserializedUser.UserID != user.UserID {
			t.Errorf("Expected user ID %s, got %s", user.UserID, deserializedUser.UserID)
		}

		if deserializedUser.Email != user.Email {
			t.Errorf("Expected email %s, got %s", user.Email, deserializedUser.Email)
		}

		if deserializedUser.Role != user.Role {
			t.Errorf("Expected role %s, got %s", user.Role, deserializedUser.Role)
		}
	})

	t.Run("Serialize document context", func(t *testing.T) {
		document := factory.CreateTestDocument()

		jsonData, err := json.Marshal(document)
		if err != nil {
			t.Fatalf("Failed to marshal document context: %v", err)
		}

		var deserializedDocument DocumentContext
		err = json.Unmarshal(jsonData, &deserializedDocument)
		if err != nil {
			t.Fatalf("Failed to unmarshal document context: %v", err)
		}

		if deserializedDocument.DocumentID != document.DocumentID {
			t.Errorf("Expected document ID %s, got %s", document.DocumentID, deserializedDocument.DocumentID)
		}

		if deserializedDocument.Name != document.Name {
			t.Errorf("Expected name %s, got %s", document.Name, deserializedDocument.Name)
		}

		if deserializedDocument.Status != document.Status {
			t.Errorf("Expected status %s, got %s", document.Status, deserializedDocument.Status)
		}
	})

	t.Run("Serialize RAG context", func(t *testing.T) {
		rag := factory.CreateTestRAGContext()

		jsonData, err := json.Marshal(rag)
		if err != nil {
			t.Fatalf("Failed to marshal RAG context: %v", err)
		}

		var deserializedRAG RAGContext
		err = json.Unmarshal(jsonData, &deserializedRAG)
		if err != nil {
			t.Fatalf("Failed to unmarshal RAG context: %v", err)
		}

		if deserializedRAG.QueryID != rag.QueryID {
			t.Errorf("Expected query ID %s, got %s", rag.QueryID, deserializedRAG.QueryID)
		}

		if deserializedRAG.Query != rag.Query {
			t.Errorf("Expected query %s, got %s", rag.Query, deserializedRAG.Query)
		}

		if deserializedRAG.Response != rag.Response {
			t.Errorf("Expected response %s, got %s", rag.Response, deserializedRAG.Response)
		}
	})
}

func TestModelValidation(t *testing.T) {
	factory := testing.NewTestDataFactory()

	t.Run("Valid user context", func(t *testing.T) {
		user := factory.CreateTestUser()

		// Basic validation
		if user.UserID == "" {
			t.Error("User ID should not be empty")
		}

		if user.Email == "" {
			t.Error("Email should not be empty")
		}

		if user.TenantID == "" {
			t.Error("Tenant ID should not be empty")
		}

		if user.CreatedAt.IsZero() {
			t.Error("Created at should not be zero")
		}

		if user.UpdatedAt.Before(user.CreatedAt) {
			t.Error("Updated at should not be before created at")
		}
	})

	t.Run("Valid document context", func(t *testing.T) {
		document := factory.CreateTestDocument()

		if document.DocumentID == "" {
			t.Error("Document ID should not be empty")
		}

		if document.TenantID == "" {
			t.Error("Tenant ID should not be empty")
		}

		if document.UserID == "" {
			t.Error("User ID should not be empty")
		}

		if document.Size <= 0 {
			t.Error("Size should be positive")
		}

		if document.Checksum == "" {
			t.Error("Checksum should not be empty")
		}

		if document.CreatedAt.IsZero() {
			t.Error("Created at should not be zero")
		}
	})

	t.Run("Valid pagination", func(t *testing.T) {
		pagination := Pagination{
			Page:       1,
			PerPage:    10,
			TotalItems: 100,
			TotalPages: 10,
			HasNext:    true,
			HasPrev:    false,
		}

		if pagination.Page <= 0 {
			t.Error("Page should be positive")
		}

		if pagination.PerPage <= 0 {
			t.Error("Per page should be positive")
		}

		if pagination.TotalItems < 0 {
			t.Error("Total items should not be negative")
		}

		if pagination.TotalPages <= 0 {
			t.Error("Total pages should be positive")
		}

		// Validate consistency
		expectedTotalPages := (pagination.TotalItems + pagination.PerPage - 1) / pagination.PerPage
		if pagination.TotalPages != int(expectedTotalPages) {
			t.Errorf("Expected total pages %d, got %d", expectedTotalPages, pagination.TotalPages)
		}

		// Validate HasNext and HasPrev
		expectedHasNext := pagination.Page < pagination.TotalPages
		if pagination.HasNext != expectedHasNext {
			t.Errorf("Expected HasNext %t, got %t", expectedHasNext, pagination.HasNext)
		}

		expectedHasPrev := pagination.Page > 1
		if pagination.HasPrev != expectedHasPrev {
			t.Errorf("Expected HasPrev %t, got %t", expectedHasPrev, pagination.HasPrev)
		}
	})
}

func TestModelEdgeCases(t *testing.T) {
	factory := testing.NewTestDataFactory()

	t.Run("Empty contexts", func(t *testing.T) {
		user := UserContext{}
		document := DocumentContext{}
		pagination := Pagination{}

		// Empty user should still serialize
		if _, err := json.Marshal(user); err != nil {
			t.Errorf("Failed to marshal empty user context: %v", err)
		}

		// Empty document should still serialize
		if _, err := json.Marshal(document); err != nil {
			t.Errorf("Failed to marshal empty document context: %v", err)
		}

		// Empty pagination should still serialize
		if _, err := json.Marshal(pagination); err != nil {
			t.Errorf("Failed to marshal empty pagination: %v", err)
		}
	})

	t.Run("Nil slices and maps", func(t *testing.T) {
		user := UserContext{
			Permissions: []string{},
			Sessions:    []Session{},
			Preferences: map[string]interface{}{},
		}

		document := DocumentContext{
			Tags:     []string{},
			Metadata: map[string]interface{}{},
			AccessControl: AccessControl{
				Permissions: []Permission{},
			},
		}

		// Should handle empty slices and maps gracefully
		if _, err := json.Marshal(user); err != nil {
			t.Errorf("Failed to marshal user with empty slices: %v", err)
		}

		if _, err := json.Marshal(document); err != nil {
			t.Errorf("Failed to marshal document with empty slices: %v", err)
		}
	})

	t.Run("Special characters in strings", func(t *testing.T) {
		user := UserContext{
			UserID:    factory.NextID(),
			TenantID:  factory.NextID(),
			Email:     "test@example.com",
			Role:      "user",
			Active:    true,
			CreatedAt: factory.GetClock().Now(),
			UpdatedAt: factory.GetClock().Now(),
			Profile: UserProfile{
				FirstName: "John \"The Rock\"",
				LastName:  "Doe's Test",
				AvatarURL: "https://example.com/path/to/file?param=value&other=123",
				Timezone:  "America/New_York",
				Language:  "en-US",
			},
		}

		// Should handle special characters
		if _, err := json.Marshal(user); err != nil {
			t.Errorf("Failed to marshal user with special characters: %v", err)
		}
	})
}

// Benchmark tests
func BenchmarkCreateUserContext(b *testing.B) {
	factory := testing.NewTestDataFactory()

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		factory.CreateTestUser()
	}
}

func BenchmarkCreateDocumentContext(b *testing.B) {
	factory := testing.NewTestDataFactory()

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		factory.CreateTestDocument()
	}
}

func BenchmarkCreateRAGContext(b *testing.B) {
	factory := testing.NewTestDataFactory()

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		factory.CreateTestRAGContext()
	}
}

func BenchmarkSerializeUserContext(b *testing.B) {
	factory := testing.NewTestDataFactory()
	user := factory.CreateTestUser()

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		json.Marshal(user)
	}
}

func BenchmarkDeserializeUserContext(b *testing.B) {
	factory := testing.NewTestDataFactory()
	user := factory.CreateTestUser()
	jsonData, _ := json.Marshal(user)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		var deserializedUser UserContext
		json.Unmarshal(jsonData, &deserializedUser)
	}
}
