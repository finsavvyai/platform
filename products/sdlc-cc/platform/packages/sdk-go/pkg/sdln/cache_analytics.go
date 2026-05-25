package sdln

import (
	"context"
	"fmt"
	"math"
	"sort"
	"strings"
	"sync"
	"time"
)

// CacheAnalytics provides comprehensive cache monitoring and analytics
type CacheAnalytics struct {
	service        *CacheService
	metrics        *CacheMetrics
	alerts         *CacheAlertManager
	dashboards     *CacheDashboardManager
	collector      *CacheMetricsCollector
	historicalData map[string][]*LayerMetrics
	trends         map[string]*Trend
	mutex          sync.RWMutex
}

// NewCacheAnalytics creates a new cache analytics service
func NewCacheAnalytics() *CacheAnalytics {
	analytics := &CacheAnalytics{
		metrics:    NewCacheMetrics(),
		alerts:     NewAlertManager(),
		dashboards: NewCacheDashboardManager(),
		collector:  NewCacheMetricsCollector(),
	}

	return analytics
}

// SetCacheService sets the cache service for analytics
func (a *CacheAnalytics) SetCacheService(service *CacheService) {
	a.service = service
}

// CacheMetrics collects and stores cache performance metrics
type CacheMetrics struct {
	layerMetrics map[string]*LayerMetrics
	globalStats  *GlobalCacheStats
	hits         map[string]int64
	misses       map[string]int64
	evictions    map[string]int64
	errors       map[string]int64
	sizes        map[string]int64
	itemCounts   map[string]int64
	latencies    map[string][]time.Duration
	lastUpdate   time.Time
	mutex        sync.RWMutex
}

// LayerMetrics represents metrics for a specific cache layer
type LayerMetrics struct {
	Name              string                  `json:"name"`
	Source            string                  `json:"source"`
	TotalRequests     int64                   `json:"total_requests"`
	CacheHits         int64                   `json:"cache_hits"`
	CacheMisses       int64                   `json:"cache_misses"`
	Hits              int64                   `json:"hits"`
	Misses            int64                   `json:"misses"`
	HitRate           float64                 `json:"hit_rate"`
	MissRate          float64                 `json:"miss_rate"`
	Evictions         int64                   `json:"evictions"`
	Errors            int64                   `json:"errors"`
	TotalSize         int64                   `json:"total_size"`
	Size              int64                   `json:"size"`
	ItemCount         int64                   `json:"item_count"`
	AvgLatency        time.Duration           `json:"avg_latency"`
	P95Latency        time.Duration           `json:"p95_latency"`
	P99Latency        time.Duration           `json:"p99_latency"`
	ErrorRate         float64                 `json:"error_rate"`
	ThroughputPerSec  float64                 `json:"throughput_per_sec"`
	Throughput        float64                 `json:"throughput"`
	MemoryUtilization float64                 `json:"memory_utilization"`
	Timestamp         time.Time               `json:"timestamp"`
	LastUpdate        time.Time               `json:"last_update"`
	History           []MetricSnapshot        `json:"history"`
	DataTypeMetrics   map[string]*TypeMetrics `json:"data_type_metrics"`
}

// TypeMetrics represents metrics for a specific data type
type TypeMetrics struct {
	DataType   string    `json:"data_type"`
	Hits       int64     `json:"hits"`
	Misses     int64     `json:"misses"`
	HitRate    float64   `json:"hit_rate"`
	AvgSize    int64     `json:"avg_size"`
	Popularity float64   `json:"popularity"`
	LastAccess time.Time `json:"last_access"`
}

// GlobalCacheStats represents overall cache statistics
type GlobalCacheStats struct {
	TotalRequests   int64         `json:"total_requests"`
	OverallHitRate  float64       `json:"overall_hit_rate"`
	TotalSize       int64         `json:"total_size"`
	TotalItems      int64         `json:"total_items"`
	AvgResponseTime time.Duration `json:"avg_response_time"`
	ErrorRate       float64       `json:"error_rate"`
	CostSavings     float64       `json:"cost_savings"`     // Money saved by cache hits
	PerformanceGain float64       `json:"performance_gain"` // Performance improvement percentage
	Timestamp       time.Time     `json:"timestamp"`
}

// MetricSnapshot represents a point-in-time metric snapshot
type MetricSnapshot struct {
	Timestamp    time.Time     `json:"timestamp"`
	HitRate      float64       `json:"hit_rate"`
	RequestCount int64         `json:"request_count"`
	Size         int64         `json:"size"`
	Latency      time.Duration `json:"latency"`
}

func NewCacheMetrics() *CacheMetrics {
	return &CacheMetrics{
		layerMetrics: make(map[string]*LayerMetrics),
		globalStats:  &GlobalCacheStats{},
		hits:         make(map[string]int64),
		misses:       make(map[string]int64),
		evictions:    make(map[string]int64),
		errors:       make(map[string]int64),
		sizes:        make(map[string]int64),
		itemCounts:   make(map[string]int64),
		latencies:    make(map[string][]time.Duration),
	}
}

// RecordAccess records a cache access event
func (m *CacheMetrics) RecordAccess(layer, dataType string, hit bool, latency time.Duration, size int64) {
	m.mutex.Lock()
	defer m.mutex.Unlock()

	// Initialize layer metrics if not exists
	if _, exists := m.layerMetrics[layer]; !exists {
		m.layerMetrics[layer] = &LayerMetrics{
			Name:            layer,
			DataTypeMetrics: make(map[string]*TypeMetrics),
			History:         make([]MetricSnapshot, 0),
		}
	}

	layerMetrics := m.layerMetrics[layer]

	// Update layer metrics
	layerMetrics.TotalRequests++
	if hit {
		layerMetrics.CacheHits++
	} else {
		layerMetrics.CacheMisses++
	}

	// Update hit rate
	layerMetrics.HitRate = float64(layerMetrics.CacheHits) / float64(layerMetrics.TotalRequests)

	// Update latency
	layerMetrics.AvgLatency = time.Duration(
		(int64(layerMetrics.AvgLatency)*layerMetrics.TotalRequests + int64(latency)) /
			(layerMetrics.TotalRequests + 1),
	)

	// Update size
	layerMetrics.TotalSize += size

	// Update data type metrics
	if dataType != "" {
		if _, exists := layerMetrics.DataTypeMetrics[dataType]; !exists {
			layerMetrics.DataTypeMetrics[dataType] = &TypeMetrics{
				DataType:   dataType,
				LastAccess: time.Now(),
			}
		}

		typeMetrics := layerMetrics.DataTypeMetrics[dataType]
		if hit {
			typeMetrics.Hits++
		} else {
			typeMetrics.Misses++
		}
		typeMetrics.HitRate = float64(typeMetrics.Hits) / float64(typeMetrics.Hits+typeMetrics.Misses)
		typeMetrics.LastAccess = time.Now()

		// Update average size
		if typeMetrics.AvgSize == 0 {
			typeMetrics.AvgSize = size
		} else {
			typeMetrics.AvgSize = (typeMetrics.AvgSize + size) / 2
		}
	}

	// Update global stats
	m.globalStats.TotalRequests++
	if hit {
		m.globalStats.OverallHitRate = float64(m.globalStats.TotalRequests-1) * m.globalStats.OverallHitRate / float64(m.globalStats.TotalRequests)
	} else {
		m.globalStats.OverallHitRate = float64(m.globalStats.TotalRequests-1) * m.globalStats.OverallHitRate / float64(m.globalStats.TotalRequests)
	}

	m.globalStats.Timestamp = time.Now()
}

// RecordEviction records a cache eviction event
func (m *CacheMetrics) RecordEviction(layer, dataType string, size int64) {
	m.mutex.Lock()
	defer m.mutex.Unlock()

	if layerMetrics, exists := m.layerMetrics[layer]; exists {
		layerMetrics.Evictions++
		layerMetrics.TotalSize -= size
		layerMetrics.ItemCount--
	}
}

// GetLayerMetrics returns metrics for a specific layer
func (m *CacheMetrics) GetLayerMetrics(layer string) (*LayerMetrics, error) {
	m.mutex.RLock()
	defer m.mutex.RUnlock()

	if metrics, exists := m.layerMetrics[layer]; exists {
		// Calculate percentiles (simplified)
		metrics.P95Latency = metrics.AvgLatency + time.Duration(float64(metrics.AvgLatency)*0.5)
		metrics.P99Latency = metrics.AvgLatency + time.Duration(float64(metrics.AvgLatency)*0.8)
		metrics.ThroughputPerSec = float64(metrics.TotalRequests) / time.Since(metrics.Timestamp).Seconds()
		metrics.MemoryUtilization = float64(metrics.TotalSize) / (1024 * 1024 * 1024) // GB

		return metrics, nil
	}

	return nil, fmt.Errorf("layer metrics not found: %s", layer)
}

// GetGlobalStats returns global cache statistics
func (m *CacheMetrics) GetGlobalStats() *GlobalCacheStats {
	m.mutex.RLock()
	defer m.mutex.RUnlock()

	stats := *m.globalStats

	// Calculate totals
	for _, layer := range m.layerMetrics {
		stats.TotalSize += layer.TotalSize
		stats.TotalItems += layer.ItemCount
	}

	// Calculate performance metrics
	stats.AvgResponseTime = m.calculateAverageResponseTime()
	stats.CostSavings = m.calculateCostSavings()
	stats.PerformanceGain = m.calculatePerformanceGain()

	return &stats
}

// calculateAverageResponseTime calculates average response time across all layers
func (m *CacheMetrics) calculateAverageResponseTime() time.Duration {
	if len(m.layerMetrics) == 0 {
		return 0
	}

	var totalLatency time.Duration
	var count int

	for _, layer := range m.layerMetrics {
		totalLatency += layer.AvgLatency
		count++
	}

	return totalLatency / time.Duration(count)
}

// calculateCostSavings calculates monetary savings from cache hits
func (m *CacheMetrics) calculateCostSavings() float64 {
	// Simplified calculation: $0.001 per cache hit
	var totalHits int64
	for _, layer := range m.layerMetrics {
		totalHits += layer.CacheHits
	}

	return float64(totalHits) * 0.001
}

// calculatePerformanceGain calculates performance improvement percentage
func (m *CacheMetrics) calculatePerformanceGain() float64 {
	if m.globalStats.TotalRequests == 0 {
		return 0
	}

	hitRate := m.globalStats.OverallHitRate
	// Assume cache hits are 10x faster than cache misses
	return hitRate * 900 // 90% improvement for 100% hit rate
}

// AlertManager manages cache performance alerts
type CacheAlertManager struct {
	rules  []CacheAlertRule
	active map[string]*CacheAlert
	mutex  sync.RWMutex
}

// CacheAlertRule defines when to trigger an alert
type CacheAlertRule struct {
	ID          string             `json:"id"`
	Name        string             `json:"name"`
	Metric      string             `json:"metric"`    // hit_rate, latency, size, error_rate
	Operator    string             `json:"operator"`  // >, <, >=, <=, ==
	Condition   string             `json:"condition"` // condition expression
	Threshold   float64            `json:"threshold"`
	Duration    time.Duration      `json:"duration"`
	Severity    string             `json:"severity"` // low, medium, high, critical
	Enabled     bool               `json:"enabled"`
	Description string             `json:"description"`
	Actions     []CacheAlertAction `json:"actions"`
}

// Alert represents an active alert
type CacheAlert struct {
	ID          string                 `json:"id"`
	RuleID      string                 `json:"rule_id"`
	RuleName    string                 `json:"rule_name"`
	Name        string                 `json:"name"`
	Severity    string                 `json:"severity"`
	Message     string                 `json:"message"`
	Source      string                 `json:"source"`
	Value       float64                `json:"value"`
	Threshold   float64                `json:"threshold"`
	Timestamp   time.Time              `json:"timestamp"`
	TriggeredAt time.Time              `json:"triggered_at"`
	ResolvedAt  *time.Time             `json:"resolved_at,omitempty"`
	Resolved    bool                   `json:"resolved"`
	Active      bool                   `json:"active"`
	Metadata    map[string]interface{} `json:"metadata"`
}

// CacheAlertAction defines what to do when an alert triggers
type CacheAlertAction struct {
	Type       string                 `json:"type"` // email, slack, webhook, log
	Target     string                 `json:"target"`
	Template   string                 `json:"template"`
	Enabled    bool                   `json:"enabled"`
	Parameters map[string]interface{} `json:"parameters,omitempty"`
}

func NewAlertManager() *CacheAlertManager {
	manager := &CacheAlertManager{
		rules:  make([]CacheAlertRule, 0),
		active: make(map[string]*CacheAlert),
	}

	manager.initializeDefaultRules()
	return manager
}

func (a *CacheAlertManager) initializeDefaultRules() {
	defaultRules := []CacheAlertRule{
		{
			ID:          "low_hit_rate",
			Name:        "Low Cache Hit Rate",
			Metric:      "hit_rate",
			Operator:    "<",
			Threshold:   0.8, // 80%
			Duration:    time.Minute * 5,
			Severity:    "medium",
			Enabled:     true,
			Description: "Cache hit rate is below 80%",
			Actions: []CacheAlertAction{
				{Type: "log", Template: "ALERT: Low cache hit rate: {{.value}}%", Enabled: true},
			},
		},
		{
			ID:          "high_latency",
			Name:        "High Cache Latency",
			Metric:      "latency",
			Operator:    ">",
			Threshold:   100, // 100ms
			Duration:    time.Minute * 2,
			Severity:    "high",
			Enabled:     true,
			Description: "Cache latency is above 100ms",
			Actions: []CacheAlertAction{
				{Type: "log", Template: "ALERT: High cache latency: {{.value}}ms", Enabled: true},
			},
		},
		{
			ID:          "memory_usage",
			Name:        "High Memory Usage",
			Metric:      "memory_utilization",
			Operator:    ">",
			Threshold:   0.9, // 90%
			Duration:    time.Minute * 1,
			Severity:    "critical",
			Enabled:     true,
			Description: "Cache memory usage is above 90%",
			Actions: []CacheAlertAction{
				{Type: "log", Template: "CRITICAL: High memory usage: {{.value}}%", Enabled: true},
			},
		},
		{
			ID:          "error_rate",
			Name:        "High Error Rate",
			Metric:      "error_rate",
			Operator:    ">",
			Threshold:   0.05, // 5%
			Duration:    time.Minute * 3,
			Severity:    "high",
			Enabled:     true,
			Description: "Cache error rate is above 5%",
			Actions: []CacheAlertAction{
				{Type: "log", Template: "ALERT: High error rate: {{.value}}%", Enabled: true},
			},
		},
	}

	a.rules = defaultRules
}

// EvaluateMetrics evaluates metrics against alert rules
func (a *CacheAlertManager) EvaluateMetrics(metrics *CacheMetrics) {
	a.mutex.Lock()
	defer a.mutex.Unlock()

	globalStats := metrics.GetGlobalStats()
	layerMetrics := make(map[string]*LayerMetrics)

	for layerName := range metrics.layerMetrics {
		if layer, _ := metrics.GetLayerMetrics(layerName); layer != nil {
			layerMetrics[layerName] = layer
		}
	}

	for _, rule := range a.rules {
		if !rule.Enabled {
			continue
		}

		var value float64
		var found bool

		// Get metric value based on rule
		switch rule.Metric {
		case "hit_rate":
			value = globalStats.OverallHitRate
			found = true
		case "latency":
			value = float64(globalStats.AvgResponseTime.Nanoseconds()) / 1e6 // Convert to milliseconds
			found = true
		case "memory_utilization":
			// Get max memory utilization across layers
			for _, layer := range layerMetrics {
				if layer.MemoryUtilization > value {
					value = layer.MemoryUtilization
					found = true
				}
			}
		case "error_rate":
			// Get max error rate across layers
			for _, layer := range layerMetrics {
				if layer.ErrorRate > value {
					value = layer.ErrorRate
					found = true
				}
			}
		}

		if !found {
			continue
		}

		// Check if rule condition is met
		triggered := false
		switch rule.Operator {
		case ">":
			triggered = value > rule.Threshold
		case "<":
			triggered = value < rule.Threshold
		case ">=":
			triggered = value >= rule.Threshold
		case "<=":
			triggered = value <= rule.Threshold
		case "==":
			triggered = math.Abs(value-rule.Threshold) < 0.001
		}

		alertKey := fmt.Sprintf("%s_%s", rule.ID, "global")

		if triggered {
			// Check if alert already exists
			if _, exists := a.active[alertKey]; !exists {
				// Create new alert
				alert := &CacheAlert{
					ID:          generateID(),
					RuleID:      rule.ID,
					RuleName:    rule.Name,
					Severity:    rule.Severity,
					Message:     fmt.Sprintf("%s: %s is %s (threshold: %s)", rule.Name, rule.Metric, formatMetricValue(rule.Metric, value), formatMetricValue(rule.Metric, rule.Threshold)),
					Value:       value,
					Threshold:   rule.Threshold,
					TriggeredAt: time.Now(),
					Active:      true,
					Metadata: map[string]interface{}{
						"rule":      rule,
						"timestamp": time.Now(),
					},
				}

				a.active[alertKey] = alert

				// Execute alert actions
				a.executeActions(alert)
			}
		} else {
			// Resolve alert if it exists
			if alert, exists := a.active[alertKey]; exists && alert.Active {
				now := time.Now()
				alert.ResolvedAt = &now
				alert.Active = false
			}
		}
	}
}

// executeActions executes alert actions
func (a *CacheAlertManager) executeActions(alert *CacheAlert) {
	rule := alert.Metadata["rule"].(CacheAlertRule)

	for _, action := range rule.Actions {
		if !action.Enabled {
			continue
		}

		switch action.Type {
		case "log":
			fmt.Printf("CACHE ALERT [%s]: %s\n", strings.ToUpper(alert.Severity), alert.Message)
		case "email":
			// In real implementation, send email
			fmt.Printf("EMAIL ALERT: %s\n", alert.Message)
		case "slack":
			// In real implementation, send Slack notification
			fmt.Printf("SLACK ALERT: %s\n", alert.Message)
		case "webhook":
			// In real implementation, send webhook
			fmt.Printf("WEBHOOK ALERT: %s\n", alert.Message)
		}
	}
}

// GetActiveAlerts returns currently active alerts
func (a *CacheAlertManager) GetActiveAlerts() []*CacheAlert {
	a.mutex.RLock()
	defer a.mutex.RUnlock()

	var active []*CacheAlert
	for _, alert := range a.active {
		if alert.Active {
			active = append(active, alert)
		}
	}

	// Sort by severity and timestamp
	sort.Slice(active, func(i, j int) bool {
		severityOrder := map[string]int{"critical": 4, "high": 3, "medium": 2, "low": 1}
		if severityOrder[active[i].Severity] != severityOrder[active[j].Severity] {
			return severityOrder[active[i].Severity] > severityOrder[active[j].Severity]
		}
		return active[i].TriggeredAt.After(active[j].TriggeredAt)
	})

	return active
}

// CacheDashboardManager manages cache performance dashboards
type CacheDashboardManager struct {
	dashboards map[string]*CacheDashboard
	mutex      sync.RWMutex
}

// CacheDashboard represents a cache performance dashboard
type CacheDashboard struct {
	ID          string            `json:"id"`
	Name        string            `json:"name"`
	Description string            `json:"description"`
	Widgets     []CacheDashboardWidget `json:"widgets"`
	Layout      CacheDashboardLayout   `json:"layout"`
	RefreshRate time.Duration     `json:"refresh_rate"`
	CreatedAt   time.Time         `json:"created_at"`
	UpdatedAt   time.Time         `json:"updated_at"`
}

// CacheDashboardWidget represents a dashboard widget
type CacheDashboardWidget struct {
	ID       string                 `json:"id"`
	Type     string                 `json:"type"` // chart, metric, table, alert
	Title    string                 `json:"title"`
	Position WidgetPosition         `json:"position"`
	Config   map[string]interface{} `json:"config"`
	Data     interface{}            `json:"data"`
}

// WidgetPosition represents widget position on dashboard
type WidgetPosition struct {
	X      int `json:"x"`
	Y      int `json:"y"`
	Width  int `json:"width"`
	Height int `json:"height"`
}

// CacheDashboardLayout represents dashboard layout configuration
type CacheDashboardLayout struct {
	Columns int `json:"columns"`
	Rows    int `json:"rows"`
	Gap     int `json:"gap"`
}

func NewCacheDashboardManager() *CacheDashboardManager {
	manager := &CacheDashboardManager{
		dashboards: make(map[string]*CacheDashboard),
	}

	manager.initializeDefaultCacheDashboards()
	return manager
}

func (d *CacheDashboardManager) initializeDefaultCacheDashboards() {
	// Create overview dashboard
	overviewCacheDashboard := &CacheDashboard{
		ID:          "cache_overview",
		Name:        "Cache Overview",
		Description: "Overall cache performance metrics",
		Widgets: []CacheDashboardWidget{
			{
				ID:       "hit_rate_gauge",
				Type:     "gauge",
				Title:    "Overall Hit Rate",
				Position: WidgetPosition{X: 0, Y: 0, Width: 6, Height: 4},
				Config: map[string]interface{}{
					"metric": "hit_rate",
					"unit":   "%",
					"min":    0,
					"max":    100,
				},
			},
			{
				ID:       "total_requests",
				Type:     "metric",
				Title:    "Total Requests",
				Position: WidgetPosition{X: 6, Y: 0, Width: 6, Height: 4},
				Config: map[string]interface{}{
					"metric": "total_requests",
					"unit":   "count",
				},
			},
			{
				ID:       "layer_performance",
				Type:     "chart",
				Title:    "Layer Performance",
				Position: WidgetPosition{X: 0, Y: 4, Width: 12, Height: 6},
				Config: map[string]interface{}{
					"chart_type": "bar",
					"metrics":    []string{"hit_rate", "latency"},
				},
			},
		},
		Layout: CacheDashboardLayout{
			Columns: 12,
			Rows:    10,
			Gap:     2,
		},
		RefreshRate: time.Minute * 1,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	d.dashboards["cache_overview"] = overviewCacheDashboard
}

// GetCacheDashboard returns a dashboard by ID
func (d *CacheDashboardManager) GetCacheDashboard(id string) (*CacheDashboard, error) {
	d.mutex.RLock()
	defer d.mutex.RUnlock()

	if dashboard, exists := d.dashboards[id]; exists {
		return dashboard, nil
	}

	return nil, fmt.Errorf("dashboard not found: %s", id)
}

// UpdateCacheDashboardData updates dashboard data with current metrics
func (d *CacheDashboardManager) UpdateCacheDashboardData(dashboardID string, metrics *CacheMetrics) error {
	d.mutex.Lock()
	defer d.mutex.Unlock()

	dashboard, exists := d.dashboards[dashboardID]
	if !exists {
		return fmt.Errorf("dashboard not found: %s", dashboardID)
	}

	globalStats := metrics.GetGlobalStats()

	for i := range dashboard.Widgets {
		widget := &dashboard.Widgets[i]

		switch widget.Type {
		case "gauge", "metric":
			if metric, ok := widget.Config["metric"].(string); ok {
				switch metric {
				case "hit_rate":
					widget.Data = map[string]interface{}{
						"value": globalStats.OverallHitRate * 100,
						"unit":  "%",
					}
				case "total_requests":
					widget.Data = map[string]interface{}{
						"value": globalStats.TotalRequests,
						"unit":  "count",
					}
				case "avg_latency":
					widget.Data = map[string]interface{}{
						"value": float64(globalStats.AvgResponseTime.Nanoseconds()) / 1e6,
						"unit":  "ms",
					}
				}
			}
		case "chart":
			if widget.Config["chart_type"] == "bar" {
				// Generate chart data for layers
				layerData := make([]map[string]interface{}, 0)
				for layerName, layer := range metrics.layerMetrics {
					layerData = append(layerData, map[string]interface{}{
						"name":     layerName,
						"hit_rate": layer.HitRate * 100,
						"latency":  float64(layer.AvgLatency.Nanoseconds()) / 1e6,
					})
				}
				widget.Data = map[string]interface{}{
					"datasets": layerData,
				}
			}
		}
	}

	dashboard.UpdatedAt = time.Now()
	return nil
}

// CacheMetricsCollector collects metrics from various sources
type CacheMetricsCollector struct {
	sources map[string]MetricsSource
	mutex   sync.RWMutex
}

// MetricsSource interface for different metric sources
type MetricsSource interface {
	Collect(ctx context.Context) (*CacheMetrics, error)
	GetName() string
	GetType() string
}

func NewCacheMetricsCollector() *CacheMetricsCollector {
	return &CacheMetricsCollector{
		sources: make(map[string]MetricsSource),
	}
}

// AddSource adds a metrics source
func (c *CacheMetricsCollector) AddSource(source MetricsSource) {
	c.mutex.Lock()
	defer c.mutex.Unlock()
	c.sources[source.GetName()] = source
}

// CollectAll collects metrics from all sources
func (c *CacheMetricsCollector) CollectAll(ctx context.Context) (*CacheMetrics, error) {
	c.mutex.RLock()
	sources := make([]MetricsSource, 0, len(c.sources))
	for _, source := range c.sources {
		sources = append(sources, source)
	}
	c.mutex.RUnlock()

	combinedMetrics := NewCacheMetrics()

	for _, source := range sources {
		sourceMetrics, err := source.Collect(ctx)
		if err != nil {
			// Log error but continue with other sources
			continue
		}

		// Merge metrics
		combinedMetrics = c.mergeMetrics(combinedMetrics, sourceMetrics)
	}

	return combinedMetrics, nil
}

// mergeMetrics merges metrics from multiple sources
func (c *CacheMetricsCollector) mergeMetrics(base, additional *CacheMetrics) *CacheMetrics {
	// Simplified merging logic
	for layerName, layer := range additional.layerMetrics {
		if baseLayer, exists := base.layerMetrics[layerName]; exists {
			baseLayer.TotalRequests += layer.TotalRequests
			baseLayer.CacheHits += layer.CacheHits
			baseLayer.CacheMisses += layer.CacheMisses
			baseLayer.Evictions += layer.Evictions
		} else {
			base.layerMetrics[layerName] = layer
		}
	}

	return base
}

// Helper functions

func formatMetricValue(metric string, value float64) string {
	switch metric {
	case "hit_rate", "error_rate", "memory_utilization":
		return fmt.Sprintf("%.2f%%", value*100)
	case "latency":
		return fmt.Sprintf("%.2fms", value)
	default:
		return fmt.Sprintf("%.2f", value)
	}
}

// RecordWarmup records warmup operation metrics
func (a *CacheAnalytics) RecordWarmup(task *WarmupTask, result *WarmupResult) {
	// Record warmup metrics
	a.metrics.RecordAccess("warmup", task.DataType, result.Success, result.Duration, result.BytesLoaded)
}

// GetCacheDashboardData returns dashboard data for visualization
func (a *CacheAnalytics) GetCacheDashboardData(dashboardID string) (map[string]interface{}, error) {
	dashboard, err := a.dashboards.GetCacheDashboard(dashboardID)
	if err != nil {
		return nil, err
	}

	// Update dashboard with current metrics
	err = a.dashboards.UpdateCacheDashboardData(dashboardID, a.metrics)
	if err != nil {
		return nil, err
	}

	return map[string]interface{}{
		"dashboard": dashboard,
		"alerts":    a.alerts.GetActiveAlerts(),
		"timestamp": time.Now(),
	}, nil
}

// Start starts the analytics service
func (a *CacheAnalytics) Start(ctx context.Context) error {
	// Start metrics collection
	go a.metricsCollectionLoop(ctx)

	// Start alert evaluation
	go a.alertEvaluationLoop(ctx)

	return nil
}

// metricsCollectionLoop continuously collects metrics
func (a *CacheAnalytics) metricsCollectionLoop(ctx context.Context) {
	ticker := time.NewTicker(time.Second * 30) // Collect metrics every 30 seconds
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			metrics, err := a.collector.CollectAll(ctx)
			if err != nil {
				// Log error but continue
				continue
			}

			// Update internal metrics
			a.metrics = metrics
		}
	}
}

// alertEvaluationLoop continuously evaluates alert rules
func (a *CacheAnalytics) alertEvaluationLoop(ctx context.Context) {
	ticker := time.NewTicker(time.Minute) // Evaluate alerts every minute
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			a.alerts.EvaluateMetrics(a.metrics)
		}
	}
}
