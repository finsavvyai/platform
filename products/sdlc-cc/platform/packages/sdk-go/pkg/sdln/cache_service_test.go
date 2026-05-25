//go:build never
// +build never

package sdln

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCacheService_Get(t *testing.T) {
	cache := NewCacheService(nil)
	ctx := context.Background()

	// Test cache miss
	result, err := cache.l1Cache.Get(ctx, "nonexistent_key")
	require.NoError(t, err)
	assert.False(t, result.Found)
	assert.Equal(t, "L1_MISS", result.Source)
	assert.False(t, result.FromCache)

	// Test cache hit
	err = cache.l1Cache.Set(ctx, "test_key", "test_value", time.Minute)
	require.NoError(t, err)

	result, err = cache.l1Cache.Get(ctx, "test_key")
	require.NoError(t, err)
	assert.True(t, result.Found)
	assert.Equal(t, "L1", result.Source)
	assert.True(t, result.FromCache)
	assert.Equal(t, "test_value", result.Value)
}

func TestCacheService_Set(t *testing.T) {
	cache := NewCacheService(nil)
	ctx := context.Background()

	// Test setting value
	err := cache.l1Cache.Set(ctx, "test_key", "test_value", time.Minute)
	require.NoError(t, err)

	// Verify value was set
	result, err := cache.l1Cache.Get(ctx, "test_key")
	require.NoError(t, err)
	assert.True(t, result.Found)
	assert.Equal(t, "test_value", result.Value)
}

func TestCacheService_Delete(t *testing.T) {
	cache := NewCacheService(nil)
	ctx := context.Background()

	// Set value
	err := cache.l1Cache.Set(ctx, "test_key", "test_value", time.Minute)
	require.NoError(t, err)

	// Verify value exists
	result, err := cache.l1Cache.Get(ctx, "test_key")
	require.NoError(t, err)
	assert.True(t, result.Found)

	// Delete value
	err = cache.l1Cache.Delete(ctx, "test_key")
	require.NoError(t, err)

	// Verify value was deleted
	result, err = cache.l1Cache.Get(ctx, "test_key")
	require.NoError(t, err)
	assert.False(t, result.Found)
}

func TestCacheService_Clear(t *testing.T) {
	cache := NewCacheService(nil)
	ctx := context.Background()

	// Set multiple values
	err := cache.l1Cache.Set(ctx, "user:123", "user_data", time.Minute)
	require.NoError(t, err)
	err = cache.l1Cache.Set(ctx, "user:456", "user_data", time.Minute)
	require.NoError(t, err)
	err = cache.l1Cache.Set(ctx, "document:789", "doc_data", time.Minute)
	require.NoError(t, err)

	// Clear user data
	err = cache.l1Cache.Clear(ctx, "user:*")
	require.NoError(t, err)

	// Verify user data was cleared
	result, err := cache.l1Cache.Get(ctx, "user:123")
	require.NoError(t, err)
	assert.False(t, result.Found)

	result, err = cache.l1Cache.Get(ctx, "user:456")
	require.NoError(t, err)
	assert.False(t, result.Found)

	// Verify document data still exists
	result, err = cache.l1Cache.Get(ctx, "document:789")
	require.NoError(t, err)
	assert.True(t, result.Found)
}

func TestInMemoryCache_LRU(t *testing.T) {
	cache := NewInMemoryCache(2, time.Minute) // Max 2 items
	ctx := context.Background()

	// Add first item
	err := cache.Set(ctx, "key1", "value1", time.Minute)
	require.NoError(t, err)

	// Add second item
	err = cache.Set(ctx, "key2", "value2", time.Minute)
	require.NoError(t, err)

	// Add third item (should evict key1)
	err = cache.Set(ctx, "key3", "value3", time.Minute)
	require.NoError(t, err)

	// Verify key1 was evicted
	result, err := cache.Get(ctx, "key1")
	require.NoError(t, err)
	assert.False(t, result.Found)

	// Verify key2 and key3 still exist
	result, err = cache.Get(ctx, "key2")
	require.NoError(t, err)
	assert.True(t, result.Found)

	result, err = cache.Get(ctx, "key3")
	require.NoError(t, err)
	assert.True(t, result.Found)
}

func TestInMemoryCache_Expiration(t *testing.T) {
	cache := NewInMemoryCache(100, time.Millisecond) // Short TTL for testing
	ctx := context.Background()

	// Add item with short TTL
	err := cache.Set(ctx, "test_key", "test_value", time.Millisecond*10)
	require.NoError(t, err)

	// Verify item exists immediately
	result, err := cache.Get(ctx, "test_key")
	require.NoError(t, err)
	assert.True(t, result.Found)

	// Wait for expiration
	time.Sleep(time.Millisecond * 20)

	// Verify item expired
	result, err = cache.Get(ctx, "test_key")
	require.NoError(t, err)
	assert.False(t, result.Found)
}

func TestCachePolicies_GetPolicy(t *testing.T) {
	policies := NewCachePolicies()

	// Test existing policy
	policy := policies.GetPolicy("user")
	assert.Equal(t, "user_profile", policy.Name)
	assert.Equal(t, time.Hour, policy.TTL)
	assert.Equal(t, 1, policy.Priority)

	// Test non-existing policy (should return default)
	policy = policies.GetPolicy("unknown_type")
	assert.Equal(t, "default", policy.Name)
	assert.Equal(t, time.Minute*5, policy.TTL)
	assert.Equal(t, 10, policy.Priority)
}

func TestCacheInvalidationService_ProcessInvalidation(t *testing.T) {
	cache := NewCacheService(nil)
	invalidator := NewCacheInvalidationService(cache)
	ctx := context.Background()

	// Add some test data
	cache.l1Cache.Set(ctx, "user:123", "user_data", time.Hour)
	cache.l1Cache.Set(ctx, "user:456", "user_data", time.Hour)
	cache.l1Cache.Set(ctx, "document:789", "doc_data", time.Hour)

	// Test data change invalidation
	event := &InvalidationEvent{
		ID:       "evt_1",
		Type:     "data_change",
		DataType: "user",
		EntityID: "123",
		Reason:   "User profile updated",
	}

	err := invalidator.ProcessInvalidation(ctx, event)
	require.NoError(t, err)

	// Verify specific user cache was invalidated
	result, err := cache.l1Cache.Get(ctx, "user:123")
	require.NoError(t, err)
	assert.False(t, result.Found)

	// Verify other user cache still exists
	result, err = cache.l1Cache.Get(ctx, "user:456")
	require.NoError(t, err)
	assert.True(t, result.Found)

	// Verify document cache still exists
	result, err = cache.l1Cache.Get(ctx, "document:789")
	require.NoError(t, err)
	assert.True(t, result.Found)
}

func TestCacheInvalidationService_RecursiveInvalidation(t *testing.T) {
	cache := NewCacheService(nil)
	invalidator := NewCacheInvalidationService(cache)
	ctx := context.Background()

	// Add related data
	cache.l1Cache.Set(ctx, "user:123", "user_data", time.Hour)
	cache.l1Cache.Set(ctx, "user_profile:123", "profile_data", time.Hour)
	cache.l1Cache.Set(ctx, "user_permissions:123", "permissions_data", time.Hour)

	// Test recursive invalidation
	event := &InvalidationEvent{
		ID:        "evt_1",
		Type:      "data_change",
		DataType:  "user",
		EntityID:  "123",
		Recursive: true,
		Reason:    "User data changed - recursive invalidation",
	}

	err := invalidator.ProcessInvalidation(ctx, event)
	require.NoError(t, err)

	// Verify all user-related cache was invalidated
	result, err := cache.l1Cache.Get(ctx, "user:123")
	require.NoError(t, err)
	assert.False(t, result.Found)

	result, err = cache.l1Cache.Get(ctx, "user_profile:123")
	require.NoError(t, err)
	assert.False(t, result.Found)

	result, err = cache.l1Cache.Get(ctx, "user_permissions:123")
	require.NoError(t, err)
	assert.False(t, result.Found)
}

func TestCacheWarmingService_ScheduleWarmup(t *testing.T) {
	cache := NewCacheService(nil)
	warmer := NewCacheWarmingService(cache)

	// Test scheduling warmup task
	task := &WarmupTask{
		ID:       "task_1",
		Strategy: "database",
		DataType: "user",
		Query:    "SELECT * FROM users WHERE active = true",
		MaxItems: 10,
		TTL:      time.Hour,
		Priority: 1,
	}

	err := warmer.ScheduleWarmup(task)
	require.NoError(t, err)

	// Test invalid strategy
	invalidTask := &WarmupTask{
		ID:       "task_2",
		Strategy: "invalid_strategy",
		DataType: "user",
	}

	err = warmer.ScheduleWarmup(invalidTask)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "unknown warming strategy")
}

func TestDatabaseWarmupStrategy_Warmup(t *testing.T) {
	cache := NewCacheService(nil)
	strategy := NewDatabaseWarmupStrategy(cache)
	ctx := context.Background()

	// Test database warmup
	task := &WarmupTask{
		ID:       "task_1",
		Strategy: "database",
		DataType: "user",
		Query:    "SELECT * FROM users WHERE active = true",
		MaxItems: 5,
		TTL:      time.Hour,
	}

	result, err := strategy.Warmup(ctx, task)
	require.NoError(t, err)
	assert.True(t, result.Success)
	assert.Greater(t, result.ItemsLoaded, 0)
	assert.Greater(t, result.BytesLoaded, int64(0))
	assert.NotEmpty(t, result.LoadedKeys)
	assert.LessOrEqual(t, result.ItemsLoaded, task.MaxItems)
}

func TestAnalyticsWarmupStrategy_Warmup(t *testing.T) {
	cache := NewCacheService(nil)
	strategy := NewAnalyticsWarmupStrategy(cache)
	ctx := context.Background()

	// Test analytics warmup
	task := &WarmupTask{
		ID:       "task_1",
		Strategy: "analytics",
		DataType: "analytics",
		MaxItems: 10,
		TTL:      time.Minute * 30,
	}

	result, err := strategy.Warmup(ctx, task)
	require.NoError(t, err)
	assert.True(t, result.Success)
	assert.Greater(t, result.ItemsLoaded, 0)
	assert.Greater(t, result.BytesLoaded, int64(0))
	assert.NotEmpty(t, result.LoadedKeys)
}

func TestRecommendationWarmupStrategy_Warmup(t *testing.T) {
	cache := NewCacheService(nil)
	strategy := NewRecommendationWarmupStrategy(cache)
	ctx := context.Background()

	// Test recommendation warmup
	task := &WarmupTask{
		ID:       "task_1",
		Strategy: "recommendation",
		DataType: "user",
		MaxItems: 20,
		TTL:      time.Hour,
	}

	result, err := strategy.Warmup(ctx, task)
	require.NoError(t, err)
	assert.True(t, result.Success)
	assert.Greater(t, result.ItemsLoaded, 0)
	assert.Greater(t, result.BytesLoaded, int64(0))
	assert.NotEmpty(t, result.LoadedKeys)
}

func TestCacheMetrics_RecordAccess(t *testing.T) {
	metrics := NewCacheMetrics()

	// Record some accesses
	metrics.RecordAccess("L1", "user", true, time.Millisecond*5, 1024)
	metrics.RecordAccess("L1", "user", false, time.Millisecond*10, 2048)
	metrics.RecordAccess("L2", "document", true, time.Millisecond*2, 512)

	// Get layer metrics
	layerMetrics, err := metrics.GetLayerMetrics("L1")
	require.NoError(t, err)
	assert.Equal(t, int64(2), layerMetrics.TotalRequests)
	assert.Equal(t, int64(1), layerMetrics.CacheHits)
	assert.Equal(t, int64(1), layerMetrics.CacheMisses)
	assert.Equal(t, 0.5, layerMetrics.HitRate)
	assert.Greater(t, layerMetrics.AvgLatency, time.Duration(0))

	// Check data type metrics
	userMetrics, exists := layerMetrics.DataTypeMetrics["user"]
	assert.True(t, exists)
	assert.Equal(t, int64(1), userMetrics.Hits)
	assert.Equal(t, int64(1), userMetrics.Misses)
	assert.Equal(t, 0.5, userMetrics.HitRate)

	// Get global stats
	globalStats := metrics.GetGlobalStats()
	assert.Equal(t, int64(3), globalStats.TotalRequests)
	assert.Greater(t, globalStats.OverallHitRate, 0.0)
	assert.Greater(t, globalStats.AvgResponseTime, time.Duration(0))
}

func TestCacheMetrics_RecordEviction(t *testing.T) {
	metrics := NewCacheMetrics()

	// Record some data first
	metrics.RecordAccess("L1", "user", true, time.Millisecond*5, 1024)

	// Get initial metrics
	layerMetrics, err := metrics.GetLayerMetrics("L1")
	require.NoError(t, err)
	assert.Equal(t, int64(1), layerMetrics.ItemCount)
	assert.Equal(t, int64(1024), layerMetrics.TotalSize)

	// Record eviction
	metrics.RecordEviction("L1", "user", 1024)

	// Check metrics after eviction
	layerMetrics, err = metrics.GetLayerMetrics("L1")
	require.NoError(t, err)
	assert.Equal(t, int64(0), layerMetrics.ItemCount)
	assert.Equal(t, int64(0), layerMetrics.TotalSize)
	assert.Equal(t, int64(1), layerMetrics.Evictions)
}

func TestAlertManager_EvaluateMetrics(t *testing.T) {
	alertManager := NewAlertManager()
	metrics := NewCacheMetrics()

	// Record low hit rate to trigger alert
	for i := 0; i < 100; i++ {
		metrics.RecordAccess("L1", "user", false, time.Millisecond*10, 1024)
	}

	// Evaluate metrics (should trigger low hit rate alert)
	alertManager.EvaluateMetrics(metrics)

	// Check for active alerts
	activeAlerts := alertManager.GetActiveAlerts()
	assert.Greater(t, len(activeAlerts), 0)

	// Find low hit rate alert
	var lowHitRateAlert *Alert
	for _, alert := range activeAlerts {
		if alert.RuleID == "low_hit_rate" {
			lowHitRateAlert = alert
			break
		}
	}

	assert.NotNil(t, lowHitRateAlert)
	assert.Equal(t, "medium", lowHitRateAlert.Severity)
	assert.True(t, lowHitRateAlert.Active)
	assert.Contains(t, lowHitRateAlert.Message, "Low cache hit rate")
}

func TestAlertManager_HighLatencyAlert(t *testing.T) {
	alertManager := NewAlertManager()
	metrics := NewCacheMetrics()

	// Record high latency to trigger alert
	for i := 0; i < 10; i++ {
		metrics.RecordAccess("L1", "user", true, time.Millisecond*200, 1024)
	}

	// Evaluate metrics (should trigger high latency alert)
	alertManager.EvaluateMetrics(metrics)

	// Check for active alerts
	activeAlerts := alertManager.GetActiveAlerts()
	assert.Greater(t, len(activeAlerts), 0)

	// Find high latency alert
	var highLatencyAlert *Alert
	for _, alert := range activeAlerts {
		if alert.RuleID == "high_latency" {
			highLatencyAlert = alert
			break
		}
	}

	assert.NotNil(t, highLatencyAlert)
	assert.Equal(t, "high", highLatencyAlert.Severity)
	assert.True(t, highLatencyAlert.Active)
	assert.Contains(t, highLatencyAlert.Message, "High cache latency")
}

func TestDashboardManager_GetDashboard(t *testing.T) {
	dashboardManager := NewDashboardManager()

	// Get existing dashboard
	dashboard, err := dashboardManager.GetDashboard("cache_overview")
	require.NoError(t, err)
	assert.Equal(t, "cache_overview", dashboard.ID)
	assert.Equal(t, "Cache Overview", dashboard.Name)
	assert.NotEmpty(t, dashboard.Widgets)

	// Try to get non-existing dashboard
	_, err = dashboardManager.GetDashboard("nonexistent")
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "dashboard not found")
}

func TestDashboardManager_UpdateDashboardData(t *testing.T) {
	dashboardManager := NewDashboardManager()
	metrics := NewCacheMetrics()

	// Record some metrics
	for i := 0; i < 100; i++ {
		metrics.RecordAccess("L1", "user", i%2 == 0, time.Millisecond*5, 1024)
	}

	// Update dashboard data
	err := dashboardManager.UpdateDashboardData("cache_overview", metrics)
	require.NoError(t, err)

	// Get updated dashboard
	dashboard, err := dashboardManager.GetDashboard("cache_overview")
	require.NoError(t, err)

	// Check if widget data was updated
	var hitRateWidget *DashboardWidget
	for _, widget := range dashboard.Widgets {
		if widget.ID == "hit_rate_gauge" {
			hitRateWidget = &widget
			break
		}
	}

	assert.NotNil(t, hitRateWidget)
	assert.NotNil(t, hitRateWidget.Data)
}

func TestQueryAnalyzer_ExtractCacheKeys(t *testing.T) {
	analyzer := NewQueryAnalyzer()

	// Test cache key extraction
	keys, err := analyzer.ExtractCacheKeys("SELECT * FROM users WHERE active = true")
	require.NoError(t, err)
	assert.NotEmpty(t, keys)
	assert.LessOrEqual(t, len(keys), 8) // Max keys from mock implementation
}

func TestAnalyticsProcessor_GenerateAnalyticsData(t *testing.T) {
	processor := NewAnalyticsProcessor()

	// Test generating different types of analytics data
	params := map[string]interface{}{
		"time_range":  "24h",
		"granularity": "hour",
	}

	// Test user stats
	userStats := processor.GenerateAnalyticsData("user_stats", params)
	assert.NotNil(t, userStats)
	statsMap, ok := userStats.(map[string]interface{})
	assert.True(t, ok)
	assert.Contains(t, statsMap, "total_users")
	assert.Contains(t, statsMap, "active_users")
	assert.Contains(t, statsMap, "generated_at")

	// Test document stats
	docStats := processor.GenerateAnalyticsData("document_stats", params)
	assert.NotNil(t, docStats)

	// Test search stats
	searchStats := processor.GenerateAnalyticsData("search_stats", params)
	assert.NotNil(t, searchStats)

	// Test performance metrics
	perfMetrics := processor.GenerateAnalyticsData("performance_metrics", params)
	assert.NotNil(t, perfMetrics)

	// Test usage analytics
	usageAnalytics := processor.GenerateAnalyticsData("usage_analytics", params)
	assert.NotNil(t, usageAnalytics)
}

func TestCacheWarmingService_GetWarmupStatus(t *testing.T) {
	cache := NewCacheService(nil)
	warmer := NewCacheWarmingService(cache)

	// Get initial status
	status := warmer.GetWarmupStatus()
	assert.NotNil(t, status)
	assert.Equal(t, false, status.Running) // Not started yet
	assert.Equal(t, 5, status.Workers)     // Default worker count
	assert.Equal(t, 0, status.TotalResults)
}

func TestCacheService_Integration(t *testing.T) {
	cache := NewCacheService(nil)
	ctx := context.Background()

	// Test multi-layer cache workflow
	// 1. Try to get from cache (miss)
	result, err := cache.l1Cache.Get(ctx, "integration_test")
	require.NoError(t, err)
	assert.False(t, result.Found)

	// 2. Set in L1 cache
	err = cache.l1Cache.Set(ctx, "integration_test", "integration_value", time.Minute)
	require.NoError(t, err)

	// 3. Get from cache (hit)
	result, err = cache.l1Cache.Get(ctx, "integration_test")
	require.NoError(t, err)
	assert.True(t, result.Found)
	assert.Equal(t, "integration_value", result.Value)
	assert.Equal(t, "L1", result.Source)
	assert.True(t, result.FromCache)

	// 4. Test TTL
	shortTTL := time.Millisecond * 10
	err = cache.l1Cache.Set(ctx, "short_ttl_test", "short_value", shortTTL)
	require.NoError(t, err)

	result, err = cache.l1Cache.Get(ctx, "short_ttl_test")
	require.NoError(t, err)
	assert.True(t, result.Found)

	// Wait for expiration
	time.Sleep(shortTTL + time.Millisecond*5)

	result, err = cache.l1Cache.Get(ctx, "short_ttl_test")
	require.NoError(t, err)
	assert.False(t, result.Found)
}

func TestInvalidationRules_Evaluate(t *testing.T) {
	rules := NewInvalidationRules()

	// Add custom rule
	customRule := InvalidationRule{
		ID:   "custom_rule",
		Name: "Custom Rule",
		Condition: func(event *InvalidationEvent) bool {
			return event.DataType == "test" && event.Priority > 5
		},
		Action:   "clear:test:*",
		Enabled:  true,
		Priority: 1,
	}

	rules.AddRule(customRule)

	// Test rule evaluation
	event := &InvalidationEvent{
		DataType: "test",
		Priority: 10,
	}

	actions := rules.Evaluate(event)
	assert.Contains(t, actions, "clear:test:*")

	// Test rule that doesn't match
	event = &InvalidationEvent{
		DataType: "other",
		Priority: 10,
	}

	actions = rules.Evaluate(event)
	assert.Empty(t, actions)
}
