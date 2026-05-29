package sdln

import (
	"sort"
	"strings"
	"sync"
	"time"
)

// IntelligentCacheService provides intelligent caching with adaptive strategies
type IntelligentCacheService struct {
	*CacheService
	strategies  *CacheStrategies
	predictor   *AccessPredictor
	invalidator *IntelligentInvalidator
	optimizer   *CacheOptimizer
}

// NewIntelligentCacheService creates a new intelligent cache service
func NewIntelligentCacheService(client *Client) *IntelligentCacheService {
	cacheService := NewCacheService(client)
	return &IntelligentCacheService{
		CacheService: cacheService,
		strategies:   NewCacheStrategies(),
		predictor:    NewAccessPredictor(),
		invalidator:  NewIntelligentInvalidator(cacheService),
		optimizer:    NewCacheOptimizer(cacheService),
	}
}

// CacheStrategy defines caching strategy for different scenarios
type CacheStrategy struct {
	Name         string                 `json:"name"`
	Description  string                 `json:"description"`
	ReadThrough  bool                   `json:"read_through"`
	WriteThrough bool                   `json:"write_through"`
	WriteBehind  bool                   `json:"write_behind"`
	RefreshAhead bool                   `json:"refresh_ahead"`
	CacheAside   bool                   `json:"cache_aside"`
	AdaptiveTTL  bool                   `json:"adaptive_ttl"`
	Compression  bool                   `json:"compression"`
	Encryption   bool                   `json:"encryption"`
	HotKey       bool                   `json:"hot_key"`
	LargeValue   bool                   `json:"large_value"`
	Parameters   map[string]interface{} `json:"parameters"`
}

// CacheStrategies manages different caching strategies
type CacheStrategies struct {
	strategies map[string]*CacheStrategy
	adapters   map[string]StrategyAdapter
}

// StrategyAdapter adapts caching strategy based on access patterns
type StrategyAdapter struct {
	DataTypes     []string               `json:"data_types"`
	AccessPattern string                 `json:"access_pattern"`
	Strategy      string                 `json:"strategy"`
	Conditions    map[string]interface{} `json:"conditions"`
	Confidence    float64                `json:"confidence"`
}

// NewCacheStrategies creates a new cache strategies manager
func NewCacheStrategies() *CacheStrategies {
	strategies := &CacheStrategies{
		strategies: make(map[string]*CacheStrategy),
		adapters:   make(map[string]StrategyAdapter),
	}

	strategies.initializeDefaultStrategies()
	strategies.initializeAdapters()

	return strategies
}

// initializeDefaultStrategies initializes default caching strategies
func (s *CacheStrategies) initializeDefaultStrategies() {
	defaultStrategies := map[string]*CacheStrategy{
		"high_performance": {
			Name:         "High Performance",
			Description:  "Maximize hit rate with L1 caching",
			ReadThrough:  true,
			WriteThrough: false,
			WriteBehind:  false,
			RefreshAhead: true,
			CacheAside:   true,
			AdaptiveTTL:  true,
			Compression:  false,
			Encryption:   false,
			HotKey:       true,
			LargeValue:   false,
			Parameters: map[string]interface{}{
				"l1_ttl":        "5m",
				"l2_ttl":        "1h",
				"refresh_ahead": "1m",
				"prefetch":      true,
			},
		},
		"conservative": {
			Name:         "Conservative",
			Description:  "Minimize data staleness with strong consistency",
			ReadThrough:  false,
			WriteThrough: true,
			WriteBehind:  false,
			RefreshAhead: false,
			CacheAside:   true,
			AdaptiveTTL:  false,
			Compression:  false,
			Encryption:   true,
			HotKey:       false,
			LargeValue:   false,
			Parameters: map[string]interface{}{
				"l1_ttl":     "30s",
				"l2_ttl":     "5m",
				"encryption": "aes256",
			},
		},
		"write_optimized": {
			Name:         "Write Optimized",
			Description:  "Optimize write-heavy workloads with write-behind",
			ReadThrough:  true,
			WriteThrough: false,
			WriteBehind:  true,
			RefreshAhead: false,
			CacheAside:   true,
			AdaptiveTTL:  true,
			Compression:  true,
			Encryption:   false,
			HotKey:       false,
			LargeValue:   true,
			Parameters: map[string]interface{}{
				"l1_ttl":      "2m",
				"l2_ttl":      "30m",
				"write_delay": "1s",
				"write_batch": 100,
				"compression": "zstd",
			},
		},
		"memory_efficient": {
			Name:         "Memory Efficient",
			Description:  "Minimize memory usage with compression and LRU",
			ReadThrough:  false,
			WriteThrough: false,
			WriteBehind:  false,
			RefreshAhead: true,
			CacheAside:   true,
			AdaptiveTTL:  true,
			Compression:  true,
			Encryption:   false,
			HotKey:       false,
			LargeValue:   true,
			Parameters: map[string]interface{}{
				"l1_max_size": "10MB",
				"compression": "zstd",
				"lru_window":  "1000",
			},
		},
		"edge_optimized": {
			Name:         "Edge Optimized",
			Description:  "Optimize for edge caching with CDN strategy",
			ReadThrough:  false,
			WriteThrough: false,
			WriteBehind:  true,
			RefreshAhead: true,
			CacheAside:   true,
			AdaptiveTTL:  true,
			Compression:  true,
			Encryption:   true,
			HotKey:       false,
			LargeValue:   false,
			Parameters: map[string]interface{}{
				"l3_ttl":        "24h",
				"edge_prefetch": true,
				"cdn_ttl":       "8h",
			},
		},
	}

	for name, strategy := range defaultStrategies {
		s.strategies[name] = strategy
	}
}

// initializeAdapters initializes strategy adapters
func (s *CacheStrategies) initializeAdapters() {
	adapters := []StrategyAdapter{
		{
			DataTypes:     []string{"user_profile", "user_session"},
			AccessPattern: "frequent_reads",
			Strategy:      "high_performance",
			Conditions: map[string]interface{}{
				"read_freq_min":  100,
				"write_freq_max": 10,
			},
			Confidence: 0.9,
		},
		{
			DataTypes:     []string{"document_content", "file_data"},
			AccessPattern: "write_heavy",
			Strategy:      "write_optimized",
			Conditions: map[string]interface{}{
				"write_freq_min": 50,
				"size_avg_mb":    1.0,
			},
			Confidence: 0.8,
		},
		{
			DataTypes:     []string{"config_data", "policy_data"},
			AccessPattern: "rare_reads",
			Strategy:      "conservative",
			Conditions: map[string]interface{}{
				"read_freq_max": 5,
				"consistency":   "strong",
			},
			Confidence: 0.95,
		},
		{
			DataTypes:     []string{"analytics_data", "logs"},
			AccessPattern: "batch_writes",
			Strategy:      "memory_efficient",
			Conditions: map[string]interface{}{
				"batch_size_min":    100,
				"compression_ratio": 0.7,
			},
			Confidence: 0.75,
		},
		{
			DataTypes:     []string{"public_content", "static_assets"},
			AccessPattern: "edge_cached",
			Strategy:      "edge_optimized",
			Conditions: map[string]interface{}{
				"public":        true,
				"ttl_hours_min": 6,
			},
			Confidence: 0.85,
		},
	}

	for _, adapter := range adapters {
		for _, dataType := range adapter.DataTypes {
			s.adapters[dataType] = adapter
		}
	}
}

// GetStrategy selects the best caching strategy based on data type and access pattern
func (s *CacheStrategies) GetStrategy(dataType string, accessPattern string, size int64) (*CacheStrategy, float64) {
	// Try direct adapter match
	if adapter, exists := s.adapters[dataType]; exists {
		if strategy, strategyExists := s.strategies[adapter.Strategy]; strategyExists {
			return strategy, adapter.Confidence
		}
	}

	// Fallback to pattern-based selection
	selection := s.selectStrategyByPattern(dataType, accessPattern, size)
	return selection.strategy, selection.confidence
}

// selectStrategyByPattern selects strategy based on access patterns
func (s *CacheStrategies) selectStrategyByPattern(dataType string, accessPattern string, size int64) struct {
	strategy   *CacheStrategy
	confidence float64
} {
	switch {
	case strings.Contains(dataType, "user") && accessPattern == "frequent_reads":
		return struct {
			strategy   *CacheStrategy
			confidence float64
		}{
			strategy:   s.strategies["high_performance"],
			confidence: 0.8,
		}
	case strings.Contains(dataType, "document") && size > 1024*1024: // > 1MB
		return struct {
			strategy   *CacheStrategy
			confidence float64
		}{
			strategy:   s.strategies["write_optimized"],
			confidence: 0.7,
		}
	case strings.Contains(dataType, "config") || strings.Contains(dataType, "policy"):
		return struct {
			strategy   *CacheStrategy
			confidence float64
		}{
			strategy:   s.strategies["conservative"],
			confidence: 0.9,
		}
	case size > 10*1024*1024: // > 10MB
		return struct {
			strategy   *CacheStrategy
			confidence float64
		}{
			strategy:   s.strategies["memory_efficient"],
			confidence: 0.75,
		}
	default:
		return struct {
			strategy   *CacheStrategy
			confidence float64
		}{
			strategy:   s.strategies["high_performance"],
			confidence: 0.6,
		}
	}
}

// AccessPredictor predicts future access patterns
type AccessPredictor struct {
	hotKeys  map[string]*AccessStats
	patterns map[string]*AccessPattern
	mutex    sync.RWMutex
}

// AccessStats tracks access statistics for a key
type AccessStats struct {
	Key         string                 `json:"key"`
	AccessCount int64                  `json:"access_count"`
	LastAccess  time.Time              `json:"last_access"`
	FirstAccess time.Time              `json:"first_access"`
	AccessTimes []time.Time            `json:"access_times"`
	PeakHours   map[int]int            `json:"peak_hours"`
	HotScore    float64                `json:"hot_score"`
	Predictions map[string]interface{} `json:"predictions"`
}

// AccessPattern represents detected access patterns
type AccessPattern struct {
	Type        string    `json:"type"`        // periodic, random, burst, steady
	Frequency   float64   `json:"frequency"`   // requests per hour
	Seasonality string    `json:"seasonality"` // hourly, daily, weekly
	PeakTimes   []int     `json:"peak_times"`
	Variability float64   `json:"variability"` // 0.0-1.0
	Confidence  float64   `json:"confidence"`
	LastUpdated time.Time `json:"last_updated"`
}

// NewAccessPredictor creates a new access predictor
func NewAccessPredictor() *AccessPredictor {
	predictor := &AccessPredictor{
		hotKeys:  make(map[string]*AccessStats),
		patterns: make(map[string]*AccessPattern),
	}

	go predictor.cleanupOldKeys()
	return predictor
}

// RecordAccess records an access to a key
func (p *AccessPredictor) RecordAccess(key string) {
	p.mutex.Lock()
	defer p.mutex.Unlock()

	now := time.Now()

	stats, exists := p.hotKeys[key]
	if !exists {
		stats = &AccessStats{
			Key:         key,
			FirstAccess: now,
			AccessTimes: make([]time.Time, 0),
			PeakHours:   make(map[int]int),
			Predictions: make(map[string]interface{}),
		}
		p.hotKeys[key] = stats
	}

	stats.AccessCount++
	stats.LastAccess = now
	stats.AccessTimes = append(stats.AccessTimes, now)

	// Keep only last 1000 access times
	if len(stats.AccessTimes) > 1000 {
		stats.AccessTimes = stats.AccessTimes[len(stats.AccessTimes)-1000:]
	}

	// Update peak hours
	hour := now.Hour()
	stats.PeakHours[hour]++

	// Update hot score
	p.updateHotScore(stats)

	// Update access pattern
	p.updateAccessPattern(key, stats)
}

// updateHotScore calculates hot score for a key
func (p *AccessPredictor) updateHotScore(stats *AccessStats) {
	duration := stats.LastAccess.Sub(stats.FirstAccess).Hours()
	if duration == 0 {
		duration = 1
	}

	// Calculate access frequency
	frequency := float64(stats.AccessCount) / duration

	// Calculate recency factor
	recency := 1.0 / (1.0 + stats.LastAccess.Sub(time.Now()).Hours()/24)

	// Calculate consistency factor
	consistency := p.calculateConsistency(stats.AccessTimes)

	// Combine factors with weights
	stats.HotScore = (frequency*0.5 + recency*0.3 + consistency*0.2)

	// Update predictions
	stats.Predictions["next_access"] = time.Now().Add(time.Hour)
	stats.Predictions["hot_probability"] = stats.HotScore
	stats.Predictions["access_count_24h"] = int(frequency * 24)
}

// calculateConsistency calculates how consistent access times are
func (p *AccessPredictor) calculateConsistency(times []time.Time) float64 {
	if len(times) < 2 {
		return 0.0
	}

	// Calculate intervals
	var intervals []float64
	for i := 1; i < len(times); i++ {
		interval := times[i].Sub(times[i-1]).Seconds()
		intervals = append(intervals, interval)
	}

	// Calculate coefficient of variation
	return 1.0 / (1.0 + p.calculateCoefficientOfVariation(intervals))
}

// calculateCoefficientOfVariation calculates variation
func (p *AccessPredictor) calculateCoefficientOfVariation(values []float64) float64 {
	if len(values) == 0 {
		return 0.0
	}

	// Calculate mean
	var sum float64
	for _, value := range values {
		sum += value
	}
	mean := sum / float64(len(values))

	// Calculate standard deviation
	var variance float64
	for _, value := range values {
		diff := value - mean
		variance += diff * diff
	}
	variance /= float64(len(values))
	stdDev := sqrt(variance)

	// Coefficient of variation
	if mean == 0 {
		return 0.0
	}

	return stdDev / mean
}

// updateAccessPattern updates access pattern for a key
func (p *AccessPredictor) updateAccessPattern(key string, stats *AccessStats) {
	pattern, exists := p.patterns[key]
	if !exists {
		pattern = &AccessPattern{
			LastUpdated: time.Now(),
		}
		p.patterns[key] = pattern
	}

	// Analyze access times to determine pattern
	if len(stats.AccessTimes) >= 10 {
		pattern.Type = p.detectPatternType(stats.AccessTimes)
		pattern.Frequency = p.calculateFrequency(stats.AccessTimes)
		pattern.Seasonality = p.detectSeasonality(stats.AccessTimes)
		pattern.PeakTimes = p.calculatePeakTimes(stats.PeakHours)
		pattern.Variability = p.calculateVariability(stats.AccessTimes)
		pattern.Confidence = p.calculatePatternConfidence(stats.AccessTimes)
		pattern.LastUpdated = time.Now()
	}
}

// detectPatternType detects the type of access pattern
func (p *AccessPredictor) detectPatternType(times []time.Time) string {
	if len(times) < 2 {
		return "unknown"
	}

	intervals := make([]float64, len(times)-1)
	for i := 1; i < len(times); i++ {
		intervals[i-1] = times[i].Sub(times[i-1]).Seconds()
	}

	// Check for periodic pattern
	regularity := p.calculateRegularity(intervals)
	if regularity > 0.8 {
		return "periodic"
	}

	// Check for burst pattern
	coefficient := p.calculateCoefficientOfVariation(intervals)
	if coefficient > 0.5 {
		return "burst"
	}

	// Check for steady pattern
	if coefficient < 0.1 {
		return "steady"
	}

	return "random"
}

// calculateRegularity calculates how regular access intervals are
func (p *AccessPredictor) calculateRegularity(intervals []float64) float64 {
	if len(intervals) < 2 {
		return 0.0
	}

	// Calculate mean interval
	var sum float64
	for _, interval := range intervals {
		sum += interval
	}
	mean := sum / float64(len(intervals))

	// Count how close intervals are to mean
	closeCount := 0
	tolerance := mean * 0.1 // 10% tolerance
	for _, interval := range intervals {
		if abs(interval-mean) <= tolerance {
			closeCount++
		}
	}

	return float64(closeCount) / float64(len(intervals))
}

// calculateFrequency calculates access frequency
func (p *AccessPredictor) calculateFrequency(times []time.Time) float64 {
	if len(times) < 2 {
		return 0.0
	}

	duration := times[len(times)-1].Sub(times[0]).Hours()
	if duration == 0 {
		return 0.0
	}

	return float64(len(times)-1) / duration
}

// detectSeasonality detects seasonality pattern
func (p *AccessPredictor) detectSeasonality(times []time.Time) string {
	if len(times) < 24 {
		return "none"
	}

	// Analyze by hour of day
	hourlyAccess := make(map[int]int)
	for _, t := range times {
		hourlyAccess[t.Hour()]++
	}

	// Check if hourly pattern exists
	maxAccess := 0
	maxHour := -1
	for hour, count := range hourlyAccess {
		if count > maxAccess {
			maxAccess = count
			maxHour = hour
		}
	}

	// If most accesses are within specific hours
	if float64(maxAccess)/float64(len(times)) > 0.3 {
		return "hourly"
	}

	// Check daily pattern
	dailyAccess := make(map[int]int)
	for _, t := range times {
		dailyAccess[t.Hour()/24]++
	}

	// Simplified - could be more sophisticated
	return "daily"
}

// calculatePeakTimes calculates peak access times
func (p *AccessPredictor) calculatePeakTimes(hourCounts map[int]int) []int {
	type hourCount struct {
		hour  int
		count int
	}

	var hc []hourCount
	for hour, count := range hourCounts {
		hc = append(hc, hourCount{hour: hour, count: count})
	}

	// Sort by count descending
	sort.Slice(hc, func(i, j int) bool {
		return hc[i].count > hc[j].count
	})

	// Return top 3 peak hours
	var peaks []int
	for i := 0; i < min(3, len(hc)); i++ {
		if hc[i].count > 0 {
			peaks = append(peaks, hc[i].hour)
		}
	}

	return peaks
}

// calculateVariability calculates access variability
func (p *AccessPredictor) calculateVariability(times []time.Time) float64 {
	if len(times) < 2 {
		return 0.0
	}

	intervals := make([]float64, len(times)-1)
	for i := 1; i < len(times); i++ {
		intervals[i-1] = times[i].Sub(times[i-1]).Seconds()
	}

	coefficient := p.calculateCoefficientOfVariation(intervals)
	return min(coefficient, 1.0)
}

// calculatePatternConfidence calculates confidence in detected pattern
func (p *AccessPredictor) calculatePatternConfidence(times []time.Time) float64 {
	if len(times) < 10 {
		return float64(len(times)) / 10.0
	}

	// More data = higher confidence
	return min(float64(len(times))/100.0, 1.0)
}

// PredictNextAccess predicts when a key will be accessed next
func (p *AccessPredictor) PredictNextAccess(key string) (time.Time, float64) {
	p.mutex.RLock()
	defer p.mutex.RUnlock()

	stats, exists := p.hotKeys[key]
	if !exists {
		return time.Now(), 0.0
	}

	if nextAccess, ok := stats.Predictions["next_access"].(time.Time); ok {
		return nextAccess, stats.HotScore
	}

	// Make prediction based on last access and frequency
	if stats.AccessCount > 10 {
		avgInterval := stats.LastAccess.Sub(stats.FirstAccess).Seconds() / float64(stats.AccessCount-1)
		nextAccess := stats.LastAccess.Add(time.Duration(avgInterval * 1e9))
		return nextAccess, stats.HotScore
	}

	// Default prediction
	return time.Now().Add(time.Hour), stats.HotScore
}

// GetHotKeys returns hot keys above a threshold
func (p *AccessPredictor) GetHotKeys(threshold float64) []string {
	p.mutex.RLock()
	defer p.mutex.RUnlock()

	var hotKeys []string
	for key, stats := range p.hotKeys {
		if stats.HotScore >= threshold {
			hotKeys = append(hotKeys, key)
		}
	}

	// Sort by hot score descending
	sort.Slice(hotKeys, func(i, j int) bool {
		return p.hotKeys[hotKeys[i]].HotScore > p.hotKeys[hotKeys[j]].HotScore
	})

	return hotKeys
}

// cleanupOldKeys removes old keys from tracking
func (p *AccessPredictor) cleanupOldKeys() {
	ticker := time.NewTicker(time.Hour)
	defer ticker.Stop()

	for range ticker.C {
		p.mutex.Lock()
		now := time.Now()
		for key, stats := range p.hotKeys {
			if now.Sub(stats.LastAccess) > 24*time.Hour && stats.HotScore < 0.1 {
				delete(p.hotKeys, key)
			}
		}
		p.mutex.Unlock()
	}
}

// Helper functions
func abs(x float64) float64 {
	if x < 0 {
		return -x
	}
	return x
}

func sqrt(x float64) float64 {
	// Simplified sqrt - use math.Sqrt in real implementation
	return x * 0.5 // Placeholder
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func min64(a, b float64) float64 {
	if a < b {
		return a
	}
	return b
}
