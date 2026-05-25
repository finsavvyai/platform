package models

import (
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
)

// BaseEntity provides common fields for all entities
type BaseEntity struct {
	ID        string            `json:"id" db:"id"`
	CreatedAt time.Time         `json:"created_at" db:"created_at"`
	UpdatedAt time.Time         `json:"updated_at" db:"updated_at"`
	CreatedBy string            `json:"created_by,omitempty" db:"created_by"`
	UpdatedBy string            `json:"updated_by,omitempty" db:"updated_by"`
	Version   int               `json:"version" db:"version"`
	Metadata  map[string]string `json:"metadata,omitempty" db:"metadata"`
	TenantID  string            `json:"tenant_id,omitempty" db:"tenant_id"`
}

// NewBaseEntity creates a new base entity
func NewBaseEntity(createdBy, tenantID string) BaseEntity {
	now := time.Now().UTC()
	return BaseEntity{
		ID:        uuid.New().String(),
		CreatedAt: now,
		UpdatedAt: now,
		CreatedBy: createdBy,
		UpdatedBy: createdBy,
		Version:   1,
		Metadata:  make(map[string]string),
		TenantID:  tenantID,
	}
}

// MarkUpdated marks the entity as updated
func (e *BaseEntity) MarkUpdated(updatedBy string) {
	e.UpdatedAt = time.Now().UTC()
	e.UpdatedBy = updatedBy
	e.Version++
}

// SetMetadata sets metadata key-value pair
func (e *BaseEntity) SetMetadata(key, value string) {
	if e.Metadata == nil {
		e.Metadata = make(map[string]string)
	}
	e.Metadata[key] = value
}

// GetMetadata gets metadata value
func (e *BaseEntity) GetMetadata(key string) string {
	if e.Metadata == nil {
		return ""
	}
	return e.Metadata[key]
}

// AuditableEntity provides audit fields
type AuditableEntity struct {
	BaseEntity
	LastAccessedAt *time.Time `json:"last_accessed_at,omitempty" db:"last_accessed_at"`
	AccessCount    int        `json:"access_count" db:"access_count"`
	IsDeleted      bool       `json:"is_deleted" db:"is_deleted"`
	DeletedAt      *time.Time `json:"deleted_at,omitempty" db:"deleted_at"`
	DeletedBy      string     `json:"deleted_by,omitempty" db:"deleted_by"`
}

// MarkAccessed marks the entity as accessed
func (e *AuditableEntity) MarkAccessed() {
	now := time.Now().UTC()
	e.LastAccessedAt = &now
	e.AccessCount++
}

// SoftDelete performs soft delete
func (e *AuditableEntity) SoftDelete(deletedBy string) {
	now := time.Now().UTC()
	e.IsDeleted = true
	e.DeletedAt = &now
	e.DeletedBy = deletedBy
	e.MarkUpdated(deletedBy)
}

// Restore restores a soft-deleted entity
func (e *AuditableEntity) Restore(restoredBy string) {
	e.IsDeleted = false
	e.DeletedAt = nil
	e.DeletedBy = ""
	e.MarkUpdated(restoredBy)
}

// EntityStatus represents entity status
type EntityStatus string

const (
	StatusActive    EntityStatus = "active"
	StatusInactive  EntityStatus = "inactive"
	StatusPending   EntityStatus = "pending"
	StatusSuspended EntityStatus = "suspended"
	StatusArchived  EntityStatus = "archived"
)

// StatusEntity provides status field
type StatusEntity struct {
	Status          EntityStatus `json:"status" db:"status"`
	StatusReason    string       `json:"status_reason,omitempty" db:"status_reason"`
	StatusChangedAt *time.Time   `json:"status_changed_at,omitempty" db:"status_changed_at"`
}

// SetStatus updates entity status
func (e *StatusEntity) SetStatus(status EntityStatus, reason string) {
	e.Status = status
	e.StatusReason = reason
	now := time.Now().UTC()
	e.StatusChangedAt = &now
}

// IsActive checks if entity is active
func (e *StatusEntity) IsActive() bool {
	return e.Status == StatusActive
}

// SearchableEntity provides search capabilities
type SearchableEntity struct {
	SearchText string   `json:"search_text" db:"search_text"`
	Tags       []string `json:"tags,omitempty" db:"tags"`
}

// UpdateSearchText updates searchable text based on provided fields
func (e *SearchableEntity) UpdateSearchText(fields ...string) {
	searchText := ""
	for _, field := range fields {
		if field != "" {
			if searchText != "" {
				searchText += " "
			}
			searchText += field
		}
	}
	e.SearchText = searchText
}

// AddTag adds a tag
func (e *SearchableEntity) AddTag(tag string) {
	for _, existing := range e.Tags {
		if existing == tag {
			return // Tag already exists
		}
	}
	e.Tags = append(e.Tags, tag)
}

// RemoveTag removes a tag
func (e *SearchableEntity) RemoveTag(tag string) {
	for i, existing := range e.Tags {
		if existing == tag {
			e.Tags = append(e.Tags[:i], e.Tags[i+1:]...)
			return
		}
	}
}

// PaginationParams represents pagination parameters
type PaginationParams struct {
	Page     int    `json:"page" form:"page"`
	PageSize int    `json:"page_size" form:"page_size"`
	OrderBy  string `json:"order_by" form:"order_by"`
	OrderDir string `json:"order_dir" form:"order_dir"`
}

// DefaultPagination returns default pagination parameters
func DefaultPagination() PaginationParams {
	return PaginationParams{
		Page:     1,
		PageSize: 20,
		OrderBy:  "created_at",
		OrderDir: "desc",
	}
}

// GetOffset calculates offset for database query
func (p PaginationParams) GetOffset() int {
	if p.Page < 1 {
		p.Page = 1
	}
	return (p.Page - 1) * p.PageSize
}

// Validate validates pagination parameters
func (p *PaginationParams) Validate() PaginationParams {
	if p.Page < 1 {
		p.Page = 1
	}
	if p.PageSize < 1 || p.PageSize > 1000 {
		p.PageSize = 20
	}
	if p.OrderBy == "" {
		p.OrderBy = "created_at"
	}
	if p.OrderDir != "asc" && p.OrderDir != "desc" {
		p.OrderDir = "desc"
	}
	return *p
}

// PaginatedResult represents a paginated result
type PaginatedResult[T any] struct {
	Data       []T        `json:"data"`
	Pagination Pagination `json:"pagination"`
}

// Pagination represents pagination information
type Pagination struct {
	Page       int   `json:"page"`
	PageSize   int   `json:"page_size"`
	Total      int64 `json:"total"`
	TotalPages int   `json:"total_pages"`
	HasNext    bool  `json:"has_next"`
	HasPrev    bool  `json:"has_prev"`
}

// NewPagination creates pagination information
func NewPagination(page, pageSize int, total int64) Pagination {
	totalPages := int((total + int64(pageSize) - 1) / int64(pageSize))
	return Pagination{
		Page:       page,
		PageSize:   pageSize,
		Total:      total,
		TotalPages: totalPages,
		HasNext:    page < totalPages,
		HasPrev:    page > 1,
	}
}

// FilterParams represents filter parameters
type FilterParams struct {
	Status       string            `json:"status" form:"status"`
	FromDate     *time.Time        `json:"from_date" form:"from_date"`
	ToDate       *time.Time        `json:"to_date" form:"to_date"`
	Search       string            `json:"search" form:"search"`
	Tags         []string          `json:"tags" form:"tags"`
	CreatedBy    string            `json:"created_by" form:"created_by"`
	CustomFields map[string]string `json:"custom_fields" form:"custom_fields"`
}

// BuildWhereClause builds WHERE clause for SQL queries
func (f FilterParams) BuildWhereClause() (string, []interface{}) {
	var conditions []string
	var args []interface{}
	argIndex := 1

	if f.Status != "" {
		conditions = append(conditions, fmt.Sprintf("status = $%d", argIndex))
		args = append(args, f.Status)
		argIndex++
	}

	if f.FromDate != nil {
		conditions = append(conditions, fmt.Sprintf("created_at >= $%d", argIndex))
		args = append(args, f.FromDate)
		argIndex++
	}

	if f.ToDate != nil {
		conditions = append(conditions, fmt.Sprintf("created_at <= $%d", argIndex))
		args = append(args, f.ToDate)
		argIndex++
	}

	if f.Search != "" {
		conditions = append(conditions, fmt.Sprintf("search_text ILIKE $%d", argIndex))
		args = append(args, "%"+f.Search+"%")
		argIndex++
	}

	if f.CreatedBy != "" {
		conditions = append(conditions, fmt.Sprintf("created_by = $%d", argIndex))
		args = append(args, f.CreatedBy)
		argIndex++
	}

	// Add tag conditions
	for _, tag := range f.Tags {
		conditions = append(conditions, fmt.Sprintf("$%d = ANY(tags)", argIndex))
		args = append(args, tag)
		argIndex++
	}

	whereClause := ""
	if len(conditions) > 0 {
		whereClause = "WHERE " + strings.Join(conditions, " AND ")
	}

	return whereClause, args
}

// Import Result represents import operation result
type ImportResult struct {
	Total    int      `json:"total"`
	Imported int      `json:"imported"`
	Failed   int      `json:"failed"`
	Skipped  int      `json:"skipped"`
	Errors   []string `json:"errors,omitempty"`
	Duration string   `json:"duration"`
}

// ValidationError represents a validation error
type ValidationError struct {
	Field   string      `json:"field"`
	Message string      `json:"message"`
	Value   interface{} `json:"value,omitempty"`
}

// Error implements error interface
func (e ValidationError) Error() string {
	return fmt.Sprintf("%s: %s", e.Field, e.Message)
}

// ValidationErrors represents multiple validation errors
type ValidationErrors []ValidationError

// Error implements error interface
func (ve ValidationErrors) Error() string {
	if len(ve) == 0 {
		return "no validation errors"
	}
	if len(ve) == 1 {
		return ve[0].Error()
	}

	messages := make([]string, len(ve))
	for i, err := range ve {
		messages[i] = err.Error()
	}
	return strings.Join(messages, "; ")
}

// ToMap converts validation errors to map
func (ve ValidationErrors) ToMap() map[string]string {
	result := make(map[string]string)
	for _, err := range ve {
		result[err.Field] = err.Message
	}
	return result
}

// BusinessError represents a business logic error
type BusinessError struct {
	Code    string                 `json:"code"`
	Message string                 `json:"message"`
	Details map[string]interface{} `json:"details,omitempty"`
}

// Error implements error interface
func (e BusinessError) Error() string {
	return e.Message
}

// NewBusinessError creates a new business error
func NewBusinessError(code, message string) *BusinessError {
	return &BusinessError{
		Code:    code,
		Message: message,
	}
}

// WithDetails adds details to business error
func (e *BusinessError) WithDetails(key string, value interface{}) *BusinessError {
	if e.Details == nil {
		e.Details = make(map[string]interface{})
	}
	e.Details[key] = value
	return e
}
