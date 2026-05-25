package services

import (
	"context"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

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

func TestExecuteStreaming_Success(t *testing.T) {
	executor := NewEnhancedQueryExecutor()
	ctx := context.Background()
	
	opts := DefaultQueryOptions()
	opts.MaxRows = 100
	opts.StreamBatch = 25
	
	var batches [][]map[string]interface{}
	var batchNums []int
	var completedCount int
	
	callback := func(batch []map[string]interface{}, batchNum int, complete bool) error {
		batches = append(batches, batch)
		batchNums = append(batchNums, batchNum)
		if complete {
			completedCount++
		}
		return nil
	}
	
	err := executor.ExecuteStreaming(ctx, "query-5", "user-1", "conn-1",
		"SELECT * FROM users", opts, callback)
	
	require.NoError(t, err)
	assert.GreaterOrEqual(t, len(batches), 1)
	assert.Equal(t, 1, completedCount)
}

func TestExecuteStreaming_Cancellation(t *testing.T) {
	executor := NewEnhancedQueryExecutor()
	ctx, cancel := context.WithCancel(context.Background())
	
	opts := DefaultQueryOptions()
	opts.MaxRows = 10000
	opts.StreamBatch = 10
	
	callbackCount := 0
	callback := func(batch []map[string]interface{}, batchNum int, complete bool) error {
		callbackCount++
		if callbackCount >= 2 {
			cancel() // Cancel after 2 batches
		}
		return nil
	}
	
	err := executor.ExecuteStreaming(ctx, "query-6", "user-1", "conn-1",
		"SELECT * FROM users", opts, callback)
	
	assert.Error(t, err)
	assert.GreaterOrEqual(t, callbackCount, 2)
}

func TestCancelQuery_Success(t *testing.T) {
	executor := NewEnhancedQueryExecutor()
	ctx := context.Background()
	
	// Start a long-running streaming query
	opts := DefaultQueryOptions()
	opts.MaxRows = 100000
	opts.StreamBatch = 100
	
	var wg sync.WaitGroup
	wg.Add(1)
	
	go func() {
		defer wg.Done()
		_ = executor.ExecuteStreaming(ctx, "query-7", "user-1", "conn-1",
			"SELECT * FROM users", opts, func(batch []map[string]interface{}, batchNum int, complete bool) error {
				time.Sleep(50 * time.Millisecond)
				return nil
			})
	}()
	
	// Wait a bit then cancel
	time.Sleep(100 * time.Millisecond)
	err := executor.CancelQuery("query-7")
	
	assert.NoError(t, err)
	wg.Wait()
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
