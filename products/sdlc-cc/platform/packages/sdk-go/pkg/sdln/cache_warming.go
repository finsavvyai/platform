package sdln

import (
	"context"
	"fmt"
	"math/rand"
	"sort"
	"sync"
	"time"
)

// CacheWarmingService manages cache warming and preloading strategies
type CacheWarmingService struct {
	cache       *CacheService
	strategies  map[string]WarmingStrategy
	analytics   *CacheAnalytics
	warmupQueue chan *WarmupTask
	results     map[string]*WarmupResult
	workers     int
	running     bool
	mutex       sync.RWMutex
}

// NewCacheWarmingService creates a new cache warming service
func NewCacheWarmingService(cache *CacheService) *CacheWarmingService {
	service := &CacheWarmingService{
		cache:       cache,
		strategies:  make(map[string]WarmingStrategy),
		analytics:   NewCacheAnalytics(),
		warmupQueue: make(chan *WarmupTask, 1000),
		results:     make(map[string]*WarmupResult),
		workers:     5, // Number of concurrent warmup workers
	}

	service.initializeStrategies()
	return service
}

// WarmingStrategy defines how cache warming works
type WarmingStrategy interface {
	Warmup(ctx context.Context, task *WarmupTask) (*WarmupResult, error)
	GetName() string
	GetPriority() int
	CanWarmup(dataType string) bool
}

// WarmupTask represents a cache warmup task
type WarmupTask struct {
	ID          string                 `json:"id"`
	Strategy    string                 `json:"strategy"`
	DataType    string                 `json:"data_type"`
	Pattern     string                 `json:"pattern"`
	Query       string                 `json:"query"`
	Parameters  map[string]interface{} `json:"parameters"`
	Priority    int                    `json:"priority"`
	TTL         time.Duration          `json:"ttl"`
	MaxItems    int                    `json:"max_items"`
	CreatedAt   time.Time              `json:"created_at"`
	ScheduledAt time.Time              `json:"scheduled_at"`
	RetryCount  int                    `json:"retry_count"`
	MaxRetries  int                    `json:"max_retries"`
	Source      string                 `json:"source"`
}

// WarmupResult represents the result of a cache warmup operation
type WarmupResult struct {
	TaskID      string                 `json:"task_id"`
	Success     bool                   `json:"success"`
	ItemsLoaded int                    `json:"items_loaded"`
	BytesLoaded int64                  `json:"bytes_loaded"`
	Duration    time.Duration          `json:"duration"`
	Error       string                 `json:"error,omitempty"`
	LoadedKeys  []string               `json:"loaded_keys,omitempty"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
	CompletedAt time.Time              `json:"completed_at"`
}

// DatabaseWarmupStrategy warms cache from database queries
type DatabaseWarmupStrategy struct {
	cache    *CacheService
	analyzer *CacheQueryAnalyzer
}

func NewDatabaseWarmupStrategy(cache *CacheService) *DatabaseWarmupStrategy {
	return &DatabaseWarmupStrategy{
		cache:    cache,
		analyzer: NewCacheQueryAnalyzer(),
	}
}

func (d *DatabaseWarmupStrategy) Warmup(ctx context.Context, task *WarmupTask) (*WarmupResult, error) {
	start := time.Now()
	result := &WarmupResult{
		TaskID:     task.ID,
		LoadedKeys: make([]string, 0),
		Metadata:   make(map[string]interface{}),
	}

	// Analyze query to determine cache keys
	keys, err := d.analyzer.ExtractCacheKeys(task.Query)
	if err != nil {
		result.Error = fmt.Sprintf("Failed to analyze query: %v", err)
		result.CompletedAt = time.Now()
		result.Duration = time.Since(start)
		return result, nil
	}

	// Execute warmup query and cache results
	loadedCount := 0
	var loadedBytes int64

	for _, key := range keys {
		if task.MaxItems > 0 && loadedCount >= task.MaxItems {
			break
		}

		// Simulate database query and cache set
		value := d.simulateDataValue(key, task.DataType)
		if value != nil {
			cacheKey := fmt.Sprintf("%s:%s", task.DataType, key)
			err := d.cache.l1Cache.Set(ctx, cacheKey, value, task.TTL)
			if err == nil {
				result.LoadedKeys = append(result.LoadedKeys, cacheKey)
				loadedCount++
				loadedBytes += int64(len(fmt.Sprintf("%v", value)))
			}
		}
	}

	result.Success = true
	result.ItemsLoaded = loadedCount
	result.BytesLoaded = loadedBytes
	result.Duration = time.Since(start)
	result.CompletedAt = time.Now()
	result.Metadata["cache_keys"] = len(result.LoadedKeys)

	return result, nil
}

func (d *DatabaseWarmupStrategy) simulateDataValue(key, dataType string) interface{} {
	// Simulate different data types based on cache key
	switch dataType {
	case "user":
		return map[string]interface{}{
			"id":         key,
			"name":       fmt.Sprintf("User %s", key),
			"email":      fmt.Sprintf("user%s@example.com", key),
			"active":     true,
			"created_at": time.Now().AddDate(0, 0, -rand.Intn(365)),
		}
	case "document":
		return map[string]interface{}{
			"id":         key,
			"title":      fmt.Sprintf("Document %s", key),
			"author":     fmt.Sprintf("Author %s", key),
			"word_count": rand.Intn(10000) + 100,
			"created_at": time.Now().AddDate(0, 0, -rand.Intn(30)),
		}
	case "search":
		return map[string]interface{}{
			"query":     key,
			"results":   rand.Intn(100) + 1,
			"took_ms":   rand.Intn(50) + 1,
			"cached_at": time.Now(),
		}
	default:
		return map[string]interface{}{
			"id":   key,
			"data": fmt.Sprintf("Sample data for %s", key),
		}
	}
}

func (d *DatabaseWarmupStrategy) GetName() string {
	return "database"
}

func (d *DatabaseWarmupStrategy) GetPriority() int {
	return 1 // High priority
}

func (d *DatabaseWarmupStrategy) CanWarmup(dataType string) bool {
	warmupTypes := []string{"user", "document", "organization", "policy", "search"}
	for _, t := range warmupTypes {
		if t == dataType {
			return true
		}
	}
	return false
}

// AnalyticsWarmupStrategy warms cache from analytics data
type AnalyticsWarmupStrategy struct {
	cache     *CacheService
	processor *AnalyticsProcessor
}

func NewAnalyticsWarmupStrategy(cache *CacheService) *AnalyticsWarmupStrategy {
	return &AnalyticsWarmupStrategy{
		cache:     cache,
		processor: NewAnalyticsProcessor(),
	}
}

func (a *AnalyticsWarmupStrategy) Warmup(ctx context.Context, task *WarmupTask) (*WarmupResult, error) {
	start := time.Now()
	result := &WarmupResult{
		TaskID:     task.ID,
		LoadedKeys: make([]string, 0),
		Metadata:   make(map[string]interface{}),
	}

	// Generate analytics cache entries
	loadedCount := 0
	var loadedBytes int64

	analyticsTypes := []string{
		"user_stats",
		"document_stats",
		"search_stats",
		"performance_metrics",
		"usage_analytics",
	}

	for _, analyticsType := range analyticsTypes {
		if task.MaxItems > 0 && loadedCount >= task.MaxItems {
			break
		}

		// Generate analytics data
		analyticsData := a.processor.GenerateAnalyticsData(analyticsType, task.Parameters)
		cacheKey := fmt.Sprintf("analytics:%s:%s", analyticsType, time.Now().Format("2006-01-02"))

		err := a.cache.l1Cache.Set(ctx, cacheKey, analyticsData, task.TTL)
		if err == nil {
			result.LoadedKeys = append(result.LoadedKeys, cacheKey)
			loadedCount++
			loadedBytes += int64(len(fmt.Sprintf("%v", analyticsData)))
		}
	}

	result.Success = true
	result.ItemsLoaded = loadedCount
	result.BytesLoaded = loadedBytes
	result.Duration = time.Since(start)
	result.CompletedAt = time.Now()
	result.Metadata["analytics_types"] = len(analyticsTypes)

	return result, nil
}

func (a *AnalyticsWarmupStrategy) GetName() string {
	return "analytics"
}

func (a *AnalyticsWarmupStrategy) GetPriority() int {
	return 2 // Medium priority
}

func (a *AnalyticsWarmupStrategy) CanWarmup(dataType string) bool {
	return dataType == "analytics"
}

// RecommendationWarmupStrategy warms cache based on usage recommendations
type RecommendationWarmupStrategy struct {
	cache          *CacheService
	recommender    *UsageRecommender
	popularityData map[string]*PopularityData
}

type PopularityData struct {
	Key         string    `json:"key"`
	AccessCount int64     `json:"access_count"`
	LastAccess  time.Time `json:"last_access"`
	Trend       float64   `json:"trend"` // Growth rate
	Priority    int       `json:"priority"`
}

type UsageRecommender struct {
	popularityData map[string]*PopularityData
	mutex          sync.RWMutex
}

func NewUsageRecommender() *UsageRecommender {
	return &UsageRecommender{
		popularityData: make(map[string]*PopularityData),
	}
}

func NewRecommendationWarmupStrategy(cache *CacheService) *RecommendationWarmupStrategy {
	return &RecommendationWarmupStrategy{
		cache:          cache,
		recommender:    NewUsageRecommender(),
		popularityData: make(map[string]*PopularityData),
	}
}

func (r *RecommendationWarmupStrategy) Warmup(ctx context.Context, task *WarmupTask) (*WarmupResult, error) {
	start := time.Now()
	result := &WarmupResult{
		TaskID:     task.ID,
		LoadedKeys: make([]string, 0),
		Metadata:   make(map[string]interface{}),
	}

	// Get popular items based on usage analytics
	popularItems := r.getPopularItems(task.DataType, task.MaxItems)

	loadedCount := 0
	var loadedBytes int64

	for _, item := range popularItems {
		if task.MaxItems > 0 && loadedCount >= task.MaxItems {
			break
		}

		// Warm up popular item
		value := r.generatePopularItemData(item.Key, task.DataType)
		cacheKey := fmt.Sprintf("%s:%s", task.DataType, item.Key)

		err := r.cache.l1Cache.Set(ctx, cacheKey, value, task.TTL)
		if err == nil {
			result.LoadedKeys = append(result.LoadedKeys, cacheKey)
			loadedCount++
			loadedBytes += int64(len(fmt.Sprintf("%v", value)))
		}
	}

	result.Success = true
	result.ItemsLoaded = loadedCount
	result.BytesLoaded = loadedBytes
	result.Duration = time.Since(start)
	result.CompletedAt = time.Now()
	result.Metadata["popularity_score"] = len(popularItems)

	return result, nil
}

func (r *RecommendationWarmupStrategy) getPopularItems(dataType string, maxItems int) []*PopularityData {
	r.recommender.mutex.RLock()
	defer r.recommender.mutex.RUnlock()

	var items []*PopularityData
	for _, data := range r.recommender.popularityData {
		// Filter by data type
		if len(data.Key) > 0 {
			items = append(items, data)
		}
	}

	// Sort by priority (access count + trend)
	sort.Slice(items, func(i, j int) bool {
		scoreI := float64(items[i].AccessCount) * (1.0 + items[i].Trend)
		scoreJ := float64(items[j].AccessCount) * (1.0 + items[j].Trend)
		return scoreI > scoreJ
	})

	if maxItems > 0 && len(items) > maxItems {
		items = items[:maxItems]
	}

	return items
}

func (r *RecommendationWarmupStrategy) generatePopularItemData(key, dataType string) interface{} {
	// Generate realistic data for popular items
	switch dataType {
	case "user":
		return map[string]interface{}{
			"id":           key,
			"username":     fmt.Sprintf("user%s", key),
			"last_login":   time.Now().Add(-time.Duration(rand.Intn(24)) * time.Hour),
			"login_count":  rand.Intn(1000) + 10,
			"premium_user": rand.Float32() > 0.7,
		}
	case "document":
		return map[string]interface{}{
			"id":         key,
			"title":      fmt.Sprintf("Popular Document %s", key),
			"view_count": rand.Intn(10000) + 100,
			"rating":     rand.Float32()*2 + 3, // 3.0-5.0
			"tags":       []string{"popular", "featured"},
		}
	case "search":
		return map[string]interface{}{
			"query":        key,
			"result_count": rand.Intn(500) + 50,
			"click_rate":   rand.Float32() * 0.8, // 0-80%
			"avg_position": rand.Intn(5) + 1,
		}
	default:
		return map[string]interface{}{
			"id":    key,
			"score": rand.Float32() * 100,
		}
	}
}

func (r *RecommendationWarmupStrategy) GetName() string {
	return "recommendation"
}

func (r *RecommendationWarmupStrategy) GetPriority() int {
	return 3 // Lower priority
}

func (r *RecommendationWarmupStrategy) CanWarmup(dataType string) bool {
	// Can warm up any data type based on popularity
	return true
}

// CacheQueryAnalyzer analyzes database queries to extract cache keys
type CacheQueryAnalyzer struct {
	patterns map[string]string
}

func NewCacheQueryAnalyzer() *CacheQueryAnalyzer {
	return &CacheQueryAnalyzer{
		patterns: map[string]string{
			"SELECT \\* FROM users WHERE (.*)":          "user_profile",
			"SELECT \\* FROM documents WHERE (.*)":      "document_metadata",
			"SELECT \\* FROM organizations WHERE (.*)":  "organization_info",
			"SELECT \\* FROM search_results WHERE (.*)": "search_results",
		},
	}
}

func (q *CacheQueryAnalyzer) ExtractCacheKeys(query string) ([]string, error) {
	// Simple query analysis - in real implementation, this would use SQL parsing
	keys := []string{
		"user_1", "user_2", "user_3",
		"doc_1", "doc_2", "doc_3",
		"org_1", "org_2",
		"search_recent",
	}

	// Shuffle and return subset
	rand.Shuffle(len(keys), func(i, j int) { keys[i], keys[j] = keys[j], keys[i] })

	maxKeys := rand.Intn(5) + 3
	if len(keys) > maxKeys {
		keys = keys[:maxKeys]
	}

	return keys, nil
}

// AnalyticsProcessor generates analytics data for cache warming
type AnalyticsProcessor struct {
	generators map[string]func(map[string]interface{}) interface{}
}

func NewAnalyticsProcessor() *AnalyticsProcessor {
	return &AnalyticsProcessor{
		generators: map[string]func(map[string]interface{}) interface{}{
			"user_stats": func(params map[string]interface{}) interface{} {
				return map[string]interface{}{
					"total_users":     rand.Intn(10000) + 1000,
					"active_users":    rand.Intn(5000) + 500,
					"new_users_today": rand.Intn(100) + 10,
					"generated_at":    time.Now(),
				}
			},
			"document_stats": func(params map[string]interface{}) interface{} {
				return map[string]interface{}{
					"total_documents": rand.Intn(50000) + 5000,
					"documents_today": rand.Intn(200) + 20,
					"avg_size_kb":     rand.Intn(500) + 50,
					"generated_at":    time.Now(),
				}
			},
			"search_stats": func(params map[string]interface{}) interface{} {
				return map[string]interface{}{
					"total_searches": rand.Intn(100000) + 10000,
					"searches_today": rand.Intn(1000) + 100,
					"avg_results":    rand.Intn(20) + 5,
					"generated_at":   time.Now(),
				}
			},
			"performance_metrics": func(params map[string]interface{}) interface{} {
				return map[string]interface{}{
					"avg_response_time_ms": rand.Intn(100) + 10,
					"cache_hit_rate":       rand.Float32()*0.3 + 0.7, // 70-100%
					"error_rate":           rand.Float32() * 0.02,    // 0-2%
					"generated_at":         time.Now(),
				}
			},
			"usage_analytics": func(params map[string]interface{}) interface{} {
				return map[string]interface{}{
					"daily_active_users": rand.Intn(1000) + 100,
					"api_calls_today":    rand.Intn(50000) + 5000,
					"storage_used_gb":    rand.Float32()*100 + 10,
					"generated_at":       time.Now(),
				}
			},
		},
	}
}

func (a *AnalyticsProcessor) GenerateAnalyticsData(analyticsType string, params map[string]interface{}) interface{} {
	if generator, exists := a.generators[analyticsType]; exists {
		return generator(params)
	}
	return map[string]interface{}{
		"type":         analyticsType,
		"data":         "sample analytics data",
		"generated_at": time.Now(),
	}
}

// initializeStrategies sets up all warming strategies
func (s *CacheWarmingService) initializeStrategies() {
	s.strategies["database"] = NewDatabaseWarmupStrategy(s.cache)
	s.strategies["analytics"] = NewAnalyticsWarmupStrategy(s.cache)
	s.strategies["recommendation"] = NewRecommendationWarmupStrategy(s.cache)
}

// ScheduleWarmup schedules a cache warmup task
func (s *CacheWarmingService) ScheduleWarmup(task *WarmupTask) error {
	// Validate task
	if task.ID == "" {
		task.ID = generateID()
	}

	if task.CreatedAt.IsZero() {
		task.CreatedAt = time.Now()
	}

	if task.ScheduledAt.IsZero() {
		task.ScheduledAt = time.Now()
	}

	if task.TTL == 0 {
		task.TTL = time.Hour
	}

	if task.MaxRetries == 0 {
		task.MaxRetries = 3
	}

	// Check if strategy exists and can handle this data type
	strategy, exists := s.strategies[task.Strategy]
	if !exists {
		return fmt.Errorf("unknown warming strategy: %s", task.Strategy)
	}

	if !strategy.CanWarmup(task.DataType) {
		return fmt.Errorf("strategy %s cannot warm up data type %s", task.Strategy, task.DataType)
	}

	select {
	case s.warmupQueue <- task:
		return nil
	default:
		return fmt.Errorf("warmup queue is full")
	}
}

// Start starts the cache warming service
func (s *CacheWarmingService) Start(ctx context.Context) error {
	s.mutex.Lock()
	if s.running {
		s.mutex.Unlock()
		return nil
	}
	s.running = true
	s.mutex.Unlock()

	// Start worker pool
	for i := 0; i < s.workers; i++ {
		go s.worker(ctx, i)
	}

	// Start periodic warmup for popular data
	go s.periodicWarmup(ctx)

	return nil
}

// Stop stops the cache warming service
func (s *CacheWarmingService) Stop() error {
	s.mutex.Lock()
	if !s.running {
		s.mutex.Unlock()
		return nil
	}
	s.running = false
	s.mutex.Unlock()

	close(s.warmupQueue)
	return nil
}

// worker processes warmup tasks
func (s *CacheWarmingService) worker(ctx context.Context, workerID int) {
	for {
		select {
		case <-ctx.Done():
			return
		case task, ok := <-s.warmupQueue:
			if !ok {
				return // Queue closed
			}

			s.processTask(ctx, task, workerID)
		}
	}
}

// processTask processes a single warmup task
func (s *CacheWarmingService) processTask(ctx context.Context, task *WarmupTask, workerID int) {
	// Wait until scheduled time
	if time.Now().Before(task.ScheduledAt) {
		timer := time.NewTimer(time.Until(task.ScheduledAt))
		select {
		case <-ctx.Done():
			timer.Stop()
			return
		case <-timer.C:
		}
	}

	// Execute warmup
	strategy := s.strategies[task.Strategy]
	result, err := strategy.Warmup(ctx, task)

	// Handle retries
	if err != nil && task.RetryCount < task.MaxRetries {
		task.RetryCount++
		task.ScheduledAt = time.Now().Add(time.Duration(task.RetryCount) * time.Minute)

		// Requeue for retry
		select {
		case s.warmupQueue <- task:
		default:
			// Queue full, log error
		}
		return
	}

	// Store result
	s.mutex.Lock()
	s.results[task.ID] = result
	s.mutex.Unlock()

	// Record analytics
	s.analytics.RecordWarmup(task, result)
}

// periodicWarmup performs periodic cache warming for popular data
func (s *CacheWarmingService) periodicWarmup(ctx context.Context) {
	ticker := time.NewTicker(time.Minute * 30) // Every 30 minutes
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			s.performPeriodicWarmup(ctx)
		}
	}
}

func (s *CacheWarmingService) performPeriodicWarmup(ctx context.Context) {
	// Create warmup tasks for popular data types
	tasks := []*WarmupTask{
		{
			ID:          generateID(),
			Strategy:    "recommendation",
			DataType:    "user",
			MaxItems:    100,
			TTL:         time.Hour,
			Priority:    2,
			ScheduledAt: time.Now(),
			MaxRetries:  2,
			Source:      "periodic",
		},
		{
			ID:          generateID(),
			Strategy:    "recommendation",
			DataType:    "document",
			MaxItems:    50,
			TTL:         time.Minute * 30,
			Priority:    2,
			ScheduledAt: time.Now(),
			MaxRetries:  2,
			Source:      "periodic",
		},
		{
			ID:          generateID(),
			Strategy:    "analytics",
			DataType:    "analytics",
			MaxItems:    10,
			TTL:         time.Minute * 15,
			Priority:    3,
			ScheduledAt: time.Now(),
			MaxRetries:  1,
			Source:      "periodic",
		},
	}

	// Schedule tasks
	for _, task := range tasks {
		if err := s.ScheduleWarmup(task); err != nil {
			// Log error but continue with other tasks
		}
	}
}

// GetWarmupStatus returns the current warmup status
func (s *CacheWarmingService) GetWarmupStatus() *WarmupStatus {
	s.mutex.RLock()
	defer s.mutex.RUnlock()

	status := &WarmupStatus{
		Running:      s.running,
		QueueLength:  len(s.warmupQueue),
		Workers:      s.workers,
		TotalResults: len(s.results),
	}

	// Calculate success rate
	var successCount, totalCount int
	for _, result := range s.results {
		totalCount++
		if result.Success {
			successCount++
		}
	}

	if totalCount > 0 {
		status.SuccessRate = float64(successCount) / float64(totalCount)
	}

	return status
}

// WarmupStatus represents the current warmup service status
type WarmupStatus struct {
	Running      bool    `json:"running"`
	QueueLength  int     `json:"queue_length"`
	Workers      int     `json:"workers"`
	TotalResults int     `json:"total_results"`
	SuccessRate  float64 `json:"success_rate"`
}

// WarmupPopularData warms up cache with popular data
func (s *CacheWarmingService) WarmupPopularData(ctx context.Context, dataType string, maxItems int) error {
	task := &WarmupTask{
		ID:          generateID(),
		Strategy:    "recommendation",
		DataType:    dataType,
		MaxItems:    maxItems,
		TTL:         time.Hour,
		Priority:    1, // High priority
		ScheduledAt: time.Now(),
		MaxRetries:  2,
		Source:      "manual",
	}

	return s.ScheduleWarmup(task)
}

// WarmupAnalytics warms up analytics cache
func (s *CacheWarmingService) WarmupAnalytics(ctx context.Context, params map[string]interface{}) error {
	task := &WarmupTask{
		ID:          generateID(),
		Strategy:    "analytics",
		DataType:    "analytics",
		Parameters:  params,
		MaxItems:    20,
		TTL:         time.Minute * 30,
		Priority:    2,
		ScheduledAt: time.Now(),
		MaxRetries:  1,
		Source:      "manual",
	}

	return s.ScheduleWarmup(task)
}
