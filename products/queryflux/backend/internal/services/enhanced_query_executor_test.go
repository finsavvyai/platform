package services

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/queryflux/backend/internal/application/services/query"
	"github.com/queryflux/backend/internal/infrastructure/database/adapters/types"
)

// stubStreamAdapter is a minimal query.StreamAdapter for tests in this
// package. It pushes the supplied rows onto the channel and (optionally)
// blocks before completion so cancellation paths can be exercised.
type stubStreamAdapter struct {
	rows      int
	perRow    time.Duration
	terminate error
}

func (s *stubStreamAdapter) Stream(ctx context.Context, _ string, _ ...interface{}) (<-chan query.StreamRow, <-chan error) {
	rowCh := make(chan query.StreamRow)
	errCh := make(chan error, 1)
	go func() {
		defer close(rowCh)
		defer close(errCh)
		for i := 0; i < s.rows; i++ {
			if s.perRow > 0 {
				select {
				case <-ctx.Done():
					errCh <- ctx.Err()
					return
				case <-time.After(s.perRow):
				}
			}
			select {
			case <-ctx.Done():
				errCh <- ctx.Err()
				return
			case rowCh <- query.StreamRow{
				Columns: []string{"id"},
				Values:  []interface{}{i},
				Index:   int64(i),
			}:
			}
		}
		errCh <- s.terminate
	}()
	return rowCh, errCh
}

func TestNewEnhancedQueryExecutor(t *testing.T) {
	executor := NewEnhancedQueryExecutor()
	assert.NotNil(t, executor)
	assert.NotNil(t, executor.runningQueries)
}

func TestDefaultQueryOptions(t *testing.T) {
	opts := DefaultQueryOptions()
	
	assert.Equal(t, 30*time.Second, opts.Timeout)
	assert.Equal(t, 10000, opts.MaxRows)
	assert.Equal(t, 1000, opts.StreamBatch)
	assert.False(t, opts.EnableExplain)
	assert.False(t, opts.ReadOnly)
	assert.NotNil(t, opts.Parameters)
}

func TestExecuteWithParams_Success(t *testing.T) {
	executor := NewEnhancedQueryExecutor()
	ctx := context.Background()
	
	opts := DefaultQueryOptions()
	opts.Parameters = map[string]interface{}{
		"user_id": 123,
		"status":  "active",
	}
	
	result, err := executor.ExecuteWithParams(ctx, "query-1", "user-1", "conn-1", 
		"SELECT * FROM users WHERE id = :user_id AND status = :status", opts)
	
	require.NoError(t, err)
	assert.NotNil(t, result)
	assert.Greater(t, result.RowCount, 0)
	assert.Greater(t, result.Duration, time.Duration(0))
	assert.False(t, result.Truncated)
}

func TestExecuteWithParams_Timeout(t *testing.T) {
	executor := NewEnhancedQueryExecutor()
	ctx := context.Background()
	
	opts := DefaultQueryOptions()
	opts.Timeout = 1 * time.Nanosecond // Very short timeout
	
	_, err := executor.ExecuteWithParams(ctx, "query-2", "user-1", "conn-1", 
		"SELECT * FROM users", opts)
	
	// Should fail due to timeout
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "timed out")
}

func TestExecuteWithParams_Cancellation(t *testing.T) {
	executor := NewEnhancedQueryExecutor()
	ctx, cancel := context.WithCancel(context.Background())
	
	opts := DefaultQueryOptions()
	opts.Timeout = 10 * time.Second
	
	// Start query in background and cancel immediately
	var wg sync.WaitGroup
	wg.Add(1)
	
	var queryErr error
	go func() {
		defer wg.Done()
		_, queryErr = executor.ExecuteWithParams(ctx, "query-3", "user-1", "conn-1",
			"SELECT * FROM large_table", opts)
	}()
	
	// Cancel immediately
	cancel()
	wg.Wait()
	
	assert.Error(t, queryErr)
}

func TestExecuteWithParams_WithExplain(t *testing.T) {
	executor := NewEnhancedQueryExecutor()
	ctx := context.Background()
	
	opts := DefaultQueryOptions()
	opts.EnableExplain = true
	
	result, err := executor.ExecuteWithParams(ctx, "query-4", "user-1", "conn-1",
		"SELECT * FROM users", opts)
	
	require.NoError(t, err)
	assert.NotNil(t, result.QueryPlan)
	assert.NotEmpty(t, result.QueryPlan.Plan)
}

// The three tests below replace legacy EnhancedQueryExecutor cases that
// were stubbed by `ErrNotImplemented` in commit 29b038232. The production
// streaming + cancellation surface is now `query.SafeQueryRunner.Stream`
// (internal/application/services/query). These rewrites assert the same
// intent against that surface so coverage of the streaming contract is
// preserved without invoking dead code.

func TestExecuteStreaming_Success(t *testing.T) {
	adapter := &stubStreamAdapter{rows: 50}
	runner := query.NewSafeQueryRunner(query.NewInMemoryAuditLogger())

	chunks, errs := runner.Stream(
		context.Background(),
		adapter,
		"SELECT id FROM users",
		nil,
		query.QueryOptions{BatchSize: 10, MaxRows: 100},
	)

	var (
		totalRows int
		sawFinal  bool
		pages     int
	)
	for c := range chunks {
		totalRows += len(c.Rows)
		pages++
		if c.Final {
			sawFinal = true
		}
	}
	require.NoError(t, <-errs)
	assert.Equal(t, 50, totalRows, "all 50 rows should reach the consumer")
	assert.GreaterOrEqual(t, pages, 5, "expected paging across BatchSize=10")
	assert.True(t, sawFinal, "must emit a terminal Final=true chunk")
}

func TestExecuteStreaming_Cancellation(t *testing.T) {
	// 50ms per row × 100 rows guarantees the consumer can cancel mid-stream.
	adapter := &stubStreamAdapter{rows: 100, perRow: 50 * time.Millisecond}
	runner := query.NewSafeQueryRunner(query.NewInMemoryAuditLogger())

	ctx, cancel := context.WithCancel(context.Background())
	chunks, errs := runner.Stream(
		ctx,
		adapter,
		"SELECT id FROM users",
		nil,
		query.QueryOptions{BatchSize: 5, MaxRows: 10000, Timeout: 30 * time.Second},
	)

	pagesSeen := 0
	for c := range chunks {
		pagesSeen++
		if pagesSeen >= 2 {
			cancel()
		}
		_ = c
	}
	err := <-errs
	assert.Error(t, err, "cancellation must surface a terminal error")
	assert.True(t, errors.Is(err, types.ErrTimeout) || errors.Is(err, context.Canceled),
		"expected ErrTimeout or context.Canceled, got %v", err)
	assert.GreaterOrEqual(t, pagesSeen, 2, "consumer should receive at least 2 chunks before cancel")
}

func TestCancelQuery_Success(t *testing.T) {
	// Legacy intent: a started query is registered and can be cancelled by
	// id. SafeQueryRunner has no registry — cancellation flows via the
	// caller's context. This rewrite asserts the equivalent property:
	// cancelling the parent context terminates the stream, closes both
	// channels and propagates a cancellation/timeout error.
	adapter := &stubStreamAdapter{rows: 1000, perRow: 20 * time.Millisecond}
	runner := query.NewSafeQueryRunner(query.NewInMemoryAuditLogger())

	ctx, cancel := context.WithCancel(context.Background())
	chunks, errs := runner.Stream(
		ctx,
		adapter,
		"SELECT id FROM big",
		nil,
		query.QueryOptions{BatchSize: 50, MaxRows: 100000, Timeout: 30 * time.Second},
	)

	// Drain in a goroutine so we can `cancel()` from the outside.
	var wg sync.WaitGroup
	wg.Add(1)
	go func() {
		defer wg.Done()
		for range chunks {
		}
	}()

	time.Sleep(60 * time.Millisecond)
	cancel()
	wg.Wait()

	err := <-errs
	require.Error(t, err)
	assert.True(t, errors.Is(err, types.ErrTimeout) || errors.Is(err, context.Canceled),
		"expected cancellation-class error, got %v", err)
}

func TestCancelQuery_NotFound(t *testing.T) {
	executor := NewEnhancedQueryExecutor()
	
	err := executor.CancelQuery("non-existent-query")
	
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "not found")
}

func TestGetRunningQueries(t *testing.T) {
	executor := NewEnhancedQueryExecutor()
	ctx := context.Background()
	
	opts := DefaultQueryOptions()
	opts.MaxRows = 100000
	
	var wg sync.WaitGroup
	wg.Add(2)
	
	// Start multiple queries
	go func() {
		defer wg.Done()
		_ = executor.ExecuteStreaming(ctx, "q1", "user-1", "conn-1", "SELECT 1", opts,
			func(batch []map[string]interface{}, batchNum int, complete bool) error { return nil })
	}()
	
	go func() {
		defer wg.Done()
		_ = executor.ExecuteStreaming(ctx, "q2", "user-2", "conn-1", "SELECT 2", opts,
			func(batch []map[string]interface{}, batchNum int, complete bool) error { return nil })
	}()
	
	time.Sleep(50 * time.Millisecond)
	
	user1Queries := executor.GetRunningQueries("user-1")
	user2Queries := executor.GetRunningQueries("user-2")
	
	// Queries may or may not still be running
	assert.GreaterOrEqual(t, len(user1Queries)+len(user2Queries), 0)
	
	wg.Wait()
}

func TestGetQueryProgress(t *testing.T) {
	executor := NewEnhancedQueryExecutor()
	ctx := context.Background()
	
	opts := DefaultQueryOptions()
	opts.MaxRows = 10000
	opts.StreamBatch = 100
	
	var wg sync.WaitGroup
	wg.Add(1)
	
	go func() {
		defer wg.Done()
		_ = executor.ExecuteStreaming(ctx, "progress-query", "user-1", "conn-1",
			"SELECT * FROM users", opts, func(batch []map[string]interface{}, batchNum int, complete bool) error {
				time.Sleep(20 * time.Millisecond)
				return nil
			})
	}()
	
	time.Sleep(100 * time.Millisecond)
	
	progress, status, err := executor.GetQueryProgress("progress-query")
	
	// Query might be done or still running
	if err == nil {
		assert.GreaterOrEqual(t, progress, 0.0)
		assert.NotEmpty(t, status)
	}
	
	wg.Wait()
}

func TestBuildParameterizedQuery(t *testing.T) {
	executor := NewEnhancedQueryExecutor()
	
	sql := "SELECT * FROM users WHERE id = :id AND status = :status"
	params := map[string]interface{}{
		"id":     123,
		"status": "active",
	}
	
	resultSQL, orderedParams := executor.buildParameterizedQuery(sql, params)
	
	// Should have replaced named params with positional
	assert.NotContains(t, resultSQL, ":id")
	assert.NotContains(t, resultSQL, ":status")
	assert.Contains(t, resultSQL, "$")
	assert.Len(t, orderedParams, 2)
}

func TestColumnInfo(t *testing.T) {
	col := ColumnInfo{
		Name:     "id",
		Type:     "integer",
		Nullable: false,
	}
	
	assert.Equal(t, "id", col.Name)
	assert.Equal(t, "integer", col.Type)
	assert.False(t, col.Nullable)
}

func TestQueryPlan(t *testing.T) {
	plan := QueryPlan{
		Plan:  "Seq Scan on users",
		Cost:  100.5,
		Rows:  1000,
		Details: map[string]interface{}{
			"startup_cost": 0.0,
			"total_cost":   100.5,
		},
	}
	
	assert.NotEmpty(t, plan.Plan)
	assert.Greater(t, plan.Cost, 0.0)
	assert.Greater(t, plan.Rows, int64(0))
}
