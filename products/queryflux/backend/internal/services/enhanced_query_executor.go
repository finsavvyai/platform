package services

import (
	"context"
	"fmt"
	"sync"
	"time"
)

// QueryOptions configures query execution
type QueryOptions struct {
	Parameters     map[string]interface{} `json:"parameters"`      // Named parameters for parameterized queries
	Timeout        time.Duration          `json:"timeout"`         // Query timeout
	MaxRows        int                    `json:"max_rows"`        // Maximum rows to return
	StreamBatch    int                    `json:"stream_batch"`    // Batch size for streaming
	EnableExplain  bool                   `json:"enable_explain"`  // Include execution plan
	ReadOnly       bool                   `json:"read_only"`       // Restrict to read-only operations
}

// DefaultQueryOptions returns default options
func DefaultQueryOptions() QueryOptions {
	return QueryOptions{
		Parameters:    make(map[string]interface{}),
		Timeout:       30 * time.Second,
		MaxRows:       10000,
		StreamBatch:   1000,
		EnableExplain: false,
		ReadOnly:      false,
	}
}

// QueryResult holds query execution results
type QueryResult struct {
	Data         []map[string]interface{} `json:"data"`
	RowCount     int                      `json:"row_count"`
	ColumnCount  int                      `json:"column_count"`
	Columns      []ColumnInfo             `json:"columns"`
	Duration     time.Duration            `json:"duration"`
	QueryPlan    *QueryPlan               `json:"query_plan,omitempty"`
	Truncated    bool                     `json:"truncated"`
	HasMore      bool                     `json:"has_more"`
}

// ColumnInfo describes a result column
type ColumnInfo struct {
	Name     string `json:"name"`
	Type     string `json:"type"`
	Nullable bool   `json:"nullable"`
}

// QueryPlan represents an execution plan
type QueryPlan struct {
	Plan       string             `json:"plan"`
	Cost       float64            `json:"cost"`
	Rows       int64              `json:"rows"`
	Details    map[string]interface{} `json:"details,omitempty"`
}

// StreamCallback is called for each batch of results
type StreamCallback func(batch []map[string]interface{}, batchNum int, complete bool) error

// QueryExecution represents a running query
type QueryExecution struct {
	ID           string             `json:"id"`
	UserID       string             `json:"user_id"`
	ConnectionID string             `json:"connection_id"`
	SQL          string             `json:"sql"`
	Parameters   map[string]interface{} `json:"parameters"`
	StartedAt    time.Time          `json:"started_at"`
	Status       string             `json:"status"`
	Progress     float64            `json:"progress"`
	cancel       context.CancelFunc
	mu           sync.RWMutex
}

// EnhancedQueryExecutor provides advanced query execution capabilities
type EnhancedQueryExecutor struct {
	runningQueries map[string]*QueryExecution
	mu             sync.RWMutex
}

// NewEnhancedQueryExecutor creates a new executor
func NewEnhancedQueryExecutor() *EnhancedQueryExecutor {
	return &EnhancedQueryExecutor{
		runningQueries: make(map[string]*QueryExecution),
	}
}

// ExecuteWithParams executes a parameterized query
func (e *EnhancedQueryExecutor) ExecuteWithParams(
	ctx context.Context,
	queryID, userID, connectionID, sql string,
	opts QueryOptions,
) (*QueryResult, error) {
	// Apply timeout
	if opts.Timeout > 0 {
		var cancel context.CancelFunc
		ctx, cancel = context.WithTimeout(ctx, opts.Timeout)
		defer cancel()
	}

	// Create execution record
	execCtx, execCancel := context.WithCancel(ctx)
	execution := &QueryExecution{
		ID:           queryID,
		UserID:       userID,
		ConnectionID: connectionID,
		SQL:          sql,
		Parameters:   opts.Parameters,
		StartedAt:    time.Now(),
		Status:       "running",
		cancel:       execCancel,
	}

	e.mu.Lock()
	e.runningQueries[queryID] = execution
	e.mu.Unlock()

	defer func() {
		e.mu.Lock()
		delete(e.runningQueries, queryID)
		e.mu.Unlock()
	}()

	// Build parameterized query
	preparedSQL, orderedParams := e.buildParameterizedQuery(sql, opts.Parameters)

	// Execute query with cancellation support
	result, err := e.executeWithContext(execCtx, connectionID, preparedSQL, orderedParams, opts)
	if err != nil {
		if ctx.Err() == context.Canceled {
			return nil, fmt.Errorf("query cancelled by user")
		}
		if ctx.Err() == context.DeadlineExceeded {
			return nil, fmt.Errorf("query timed out after %v", opts.Timeout)
		}
		return nil, err
	}

	return result, nil
}

// ExecuteStreaming executes a query with streaming results
func (e *EnhancedQueryExecutor) ExecuteStreaming(
	ctx context.Context,
	queryID, userID, connectionID, sql string,
	opts QueryOptions,
	callback StreamCallback,
) error {
	// Apply timeout
	if opts.Timeout > 0 {
		var cancel context.CancelFunc
		ctx, cancel = context.WithTimeout(ctx, opts.Timeout)
		defer cancel()
	}

	// Create execution with cancel
	_, execCancel := context.WithCancel(ctx)
	execution := &QueryExecution{
		ID:           queryID,
		UserID:       userID,
		ConnectionID: connectionID,
		SQL:          sql,
		Parameters:   opts.Parameters,
		StartedAt:    time.Now(),
		Status:       "streaming",
		cancel:       execCancel,
	}

	e.mu.Lock()
	e.runningQueries[queryID] = execution
	e.mu.Unlock()

	defer func() {
		e.mu.Lock()
		delete(e.runningQueries, queryID)
		e.mu.Unlock()
	}()

	// Consume batch-size config so unused-var lint does not regress while
	// the body is stubbed. Real batching lives in SafeQueryRunner.Stream.
	_ = opts.StreamBatch

	// TODO(phase-2): replace with SafeQueryRunner.Stream wiring via the
	// query.SafeQueryRunner application service and a concrete adapter
	// resolved from the connection factory. Until then the mock streaming
	// path is intentionally disabled so no fake rows can escape to HTTP.
	_ = callback
	return ErrNotImplemented
}

// ErrNotImplemented marks Phase-1 stubs that must not run in production.
var ErrNotImplemented = fmt.Errorf("enhanced_query_executor: not implemented - use SafeQueryRunner")

// CancelQuery cancels a running query
func (e *EnhancedQueryExecutor) CancelQuery(queryID string) error {
	e.mu.RLock()
	execution, exists := e.runningQueries[queryID]
	e.mu.RUnlock()

	if !exists {
		return fmt.Errorf("query %s not found or already completed", queryID)
	}

	execution.mu.Lock()
	execution.Status = "cancelling"
	execution.mu.Unlock()

	// Cancel the context
	if execution.cancel != nil {
		execution.cancel()
	}

	return nil
}

// GetRunningQueries returns all running queries for a user
func (e *EnhancedQueryExecutor) GetRunningQueries(userID string) []*QueryExecution {
	e.mu.RLock()
	defer e.mu.RUnlock()

	var result []*QueryExecution
	for _, exec := range e.runningQueries {
		if exec.UserID == userID {
			result = append(result, exec)
		}
	}
	return result
}

// GetQueryProgress returns progress of a running query
func (e *EnhancedQueryExecutor) GetQueryProgress(queryID string) (float64, string, error) {
	e.mu.RLock()
	execution, exists := e.runningQueries[queryID]
	e.mu.RUnlock()

	if !exists {
		return 0, "", fmt.Errorf("query not found")
	}

	execution.mu.RLock()
	defer execution.mu.RUnlock()
	return execution.Progress, execution.Status, nil
}

// buildParameterizedQuery converts named parameters to positional
func (e *EnhancedQueryExecutor) buildParameterizedQuery(sql string, params map[string]interface{}) (string, []interface{}) {
	// Simple parameter substitution - in production use proper SQL parser
	orderedParams := make([]interface{}, 0, len(params))
	resultSQL := sql
	
	paramIdx := 1
	for name, value := range params {
		placeholder := fmt.Sprintf(":%s", name)
		positional := fmt.Sprintf("$%d", paramIdx)
		resultSQL = replaceFirst(resultSQL, placeholder, positional)
		orderedParams = append(orderedParams, value)
		paramIdx++
	}
	
	return resultSQL, orderedParams
}

// executeWithContext simulates actual query execution
func (e *EnhancedQueryExecutor) executeWithContext(
	ctx context.Context,
	connectionID, sql string,
	params []interface{},
	opts QueryOptions,
) (*QueryResult, error) {
	// Simulate execution time
	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	case <-time.After(50 * time.Millisecond):
	}

	// Build mock result
	result := &QueryResult{
		Data: []map[string]interface{}{
			{"id": 1, "name": "Sample", "created_at": time.Now().Format(time.RFC3339)},
			{"id": 2, "name": "Data", "created_at": time.Now().Format(time.RFC3339)},
		},
		RowCount:    2,
		ColumnCount: 3,
		Columns: []ColumnInfo{
			{Name: "id", Type: "integer", Nullable: false},
			{Name: "name", Type: "text", Nullable: true},
			{Name: "created_at", Type: "timestamp", Nullable: false},
		},
		Duration:  50 * time.Millisecond,
		Truncated: false,
		HasMore:   false,
	}

	// Include execution plan if requested
	if opts.EnableExplain {
		result.QueryPlan = &QueryPlan{
			Plan:  "Seq Scan on table",
			Cost:  10.5,
			Rows:  1000,
		}
	}

	return result, nil
}

// replaceFirst replaces the first occurrence of old with new
func replaceFirst(s, old, new string) string {
	idx := 0
	for i := 0; i < len(s)-len(old)+1; i++ {
		if s[i:i+len(old)] == old {
			return s[:i] + new + s[i+len(old):]
		}
		idx++
	}
	return s
}
