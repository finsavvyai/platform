package entities

import (
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
)

// Query represents a database query execution
type Query struct {
	ID           string                   `json:"id" db:"id"`
	UserID       string                   `json:"user_id" db:"user_id"`
	ConnectionID string                   `json:"connection_id" db:"connection_id"`
	Name         string                   `json:"name" db:"name"`
	SQL          string                   `json:"sql" db:"sql"`
	Results      []map[string]interface{} `json:"results" db:"results"`
	RowCount     int                      `json:"row_count" db:"row_count"`
	Duration     int64                    `json:"duration_ms" db:"duration_ms"`
	Status       string                   `json:"status" db:"status"`
	Error        string                   `json:"error" db:"error"`
	ExecutedAt   time.Time                `json:"executed_at" db:"executed_at"`
	CreatedAt    time.Time                `json:"created_at" db:"created_at"`
}

// Query statuses
const (
	QueryStatusPending   = "pending"
	QueryStatusRunning   = "running"
	QueryStatusCompleted = "completed"
	QueryStatusFailed    = "failed"
	QueryStatusCancelled = "cancelled"
)

// Query types based on SQL operation
const (
	QueryTypeSelect = "select"
	QueryTypeInsert = "insert"
	QueryTypeUpdate = "update"
	QueryTypeDelete = "delete"
	QueryTypeDDL    = "ddl"    // CREATE, ALTER, DROP
	QueryTypeOther  = "other"
)

// NewQuery creates a new query with validation
func NewQuery(userID, connectionID, sql string) (*Query, error) {
	if err := validateQueryParams(userID, connectionID, sql); err != nil {
		return nil, err
	}

	now := time.Now()
	return &Query{
		ID:           uuid.New().String(),
		UserID:       userID,
		ConnectionID: connectionID,
		SQL:          strings.TrimSpace(sql),
		Status:       QueryStatusPending,
		ExecutedAt:   now,
		CreatedAt:    now,
	}, nil
}

// NewNamedQuery creates a new named query
func NewNamedQuery(userID, connectionID, name, sql string) (*Query, error) {
	query, err := NewQuery(userID, connectionID, sql)
	if err != nil {
		return nil, err
	}

	if err := validateQueryName(name); err != nil {
		return nil, fmt.Errorf("invalid query name: %w", err)
	}

	query.Name = name
	return query, nil
}

// Validate validates the query entity
func (q *Query) Validate() error {
	if q.ID == "" {
		return fmt.Errorf("query ID is required")
	}

	if err := validateQueryParams(q.UserID, q.ConnectionID, q.SQL); err != nil {
		return err
	}

	if q.Name != "" {
		if err := validateQueryName(q.Name); err != nil {
			return fmt.Errorf("invalid query name: %w", err)
		}
	}

	if !isValidQueryStatus(q.Status) {
		return fmt.Errorf("invalid query status: %s", q.Status)
	}

	return nil
}

// SetName sets the query name
func (q *Query) SetName(name string) error {
	if err := validateQueryName(name); err != nil {
		return fmt.Errorf("invalid query name: %w", err)
	}

	q.Name = name
	return nil
}

// Start marks the query as running
func (q *Query) Start() {
	q.Status = QueryStatusRunning
	q.ExecutedAt = time.Now()
}

// Complete marks the query as completed with results
func (q *Query) Complete(results []map[string]interface{}, duration time.Duration) {
	q.Status = QueryStatusCompleted
	q.Results = results
	q.RowCount = len(results)
	q.Duration = duration.Milliseconds()
	q.Error = ""
}

// Fail marks the query as failed with error
func (q *Query) Fail(err error, duration time.Duration) {
	q.Status = QueryStatusFailed
	q.Error = err.Error()
	q.Duration = duration.Milliseconds()
	q.Results = nil
	q.RowCount = 0
}

// Cancel marks the query as cancelled
func (q *Query) Cancel(duration time.Duration) {
	q.Status = QueryStatusCancelled
	q.Duration = duration.Milliseconds()
	q.Results = nil
	q.RowCount = 0
}

// GetQueryType determines the type of SQL query
func (q *Query) GetQueryType() string {
	sql := strings.ToUpper(strings.TrimSpace(q.SQL))
	
	if strings.HasPrefix(sql, "SELECT") || strings.HasPrefix(sql, "WITH") {
		return QueryTypeSelect
	}
	
	if strings.HasPrefix(sql, "INSERT") {
		return QueryTypeInsert
	}
	
	if strings.HasPrefix(sql, "UPDATE") {
		return QueryTypeUpdate
	}
	
	if strings.HasPrefix(sql, "DELETE") {
		return QueryTypeDelete
	}
	
	ddlKeywords := []string{"CREATE", "ALTER", "DROP", "TRUNCATE"}
	for _, keyword := range ddlKeywords {
		if strings.HasPrefix(sql, keyword) {
			return QueryTypeDDL
		}
	}
	
	return QueryTypeOther
}

// IsReadOnly checks if the query is read-only
func (q *Query) IsReadOnly() bool {
	queryType := q.GetQueryType()
	return queryType == QueryTypeSelect
}

// IsCompleted checks if query execution is finished
func (q *Query) IsCompleted() bool {
	return q.Status == QueryStatusCompleted || q.Status == QueryStatusFailed || q.Status == QueryStatusCancelled
}

// IsSuccessful checks if query completed successfully
func (q *Query) IsSuccessful() bool {
	return q.Status == QueryStatusCompleted
}

// GetDurationString returns formatted duration string
func (q *Query) GetDurationString() string {
	if q.Duration == 0 {
		return "0ms"
	}
	
	if q.Duration < 1000 {
		return fmt.Sprintf("%dms", q.Duration)
	}
	
	seconds := float64(q.Duration) / 1000.0
	if seconds < 60 {
		return fmt.Sprintf("%.2fs", seconds)
	}
	
	minutes := int(seconds / 60)
	remainingSeconds := seconds - float64(minutes*60)
	return fmt.Sprintf("%dm %.2fs", minutes, remainingSeconds)
}

// GetSQLPreview returns a truncated version of the SQL for display
func (q *Query) GetSQLPreview(maxLength int) string {
	if maxLength <= 0 {
		maxLength = 100
	}
	
	sql := strings.TrimSpace(q.SQL)
	if len(sql) <= maxLength {
		return sql
	}
	
	return sql[:maxLength-3] + "..."
}

// Validation helpers
func validateQueryParams(userID, connectionID, sql string) error {
	if userID == "" {
		return fmt.Errorf("user ID is required")
	}

	if connectionID == "" {
		return fmt.Errorf("connection ID is required")
	}

	if sql == "" {
		return fmt.Errorf("SQL query is required")
	}

	sql = strings.TrimSpace(sql)
	if len(sql) == 0 {
		return fmt.Errorf("SQL query cannot be empty")
	}

	if len(sql) > 1000000 { // 1MB limit
		return fmt.Errorf("SQL query is too large (max 1MB)")
	}

	return nil
}

func validateQueryName(name string) error {
	if name == "" {
		return fmt.Errorf("query name cannot be empty")
	}

	if len(name) > 255 {
		return fmt.Errorf("query name must be less than 255 characters")
	}

	return nil
}

func isValidQueryStatus(status string) bool {
	validStatuses := []string{
		QueryStatusPending,
		QueryStatusRunning,
		QueryStatusCompleted,
		QueryStatusFailed,
		QueryStatusCancelled,
	}

	for _, validStatus := range validStatuses {
		if status == validStatus {
			return true
		}
	}

	return false
}