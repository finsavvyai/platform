package sdln

import (
	"context"
	"fmt"
	"sync"
	"time"
)

// RealtimeDashboardService handles real-time dashboards and visualizations
type RealtimeDashboardService struct {
	service       *AdvancedMonitoringService
	dashboards    map[string]*RealtimeDashboard
	templates     map[string]*DashboardTemplate
	queries       *DashboardQueryCache
	websocketPool *WebSocketPool
	config        DashboardConfig
	mu            sync.RWMutex
}

// RealtimeDashboard represents a real-time dashboard
type RealtimeDashboard struct {
	ID              string              `json:"id"`
	TenantID        string              `json:"tenant_id"`
	Name            string              `json:"name"`
	Description     string              `json:"description"`
	Layout          DashboardLayout     `json:"layout"`
	Panels          []RealtimePanel     `json:"panels"`
	Variables       []DashboardVariable `json:"variables"`
	Filters         DashboardFilters    `json:"filters"`
	RefreshInterval time.Duration       `json:"refresh_interval"`
	TimeRange       TimeRange           `json:"time_range"`
	Sharing         SharingSettings     `json:"sharing"`
	Permissions     PermissionSettings  `json:"permissions"`
	Theme           DashboardTheme      `json:"theme"`
	LastUpdated     Timestamp           `json:"last_updated"`
	Subscribers     []string            `json:"subscribers"`
}

// DashboardLayout defines dashboard layout
type DashboardLayout struct {
	Type        string             `json:"type"` // grid, custom, tabs
	Columns     int                `json:"columns"`
	Rows        int                `json:"rows"`
	Gap         int                `json:"gap"`
	AutoArrange bool               `json:"auto_arrange"`
	Responsive  bool               `json:"responsive"`
	Sections    []DashboardSection `json:"sections,omitempty"`
}

// DashboardSection defines a dashboard section
type DashboardSection struct {
	ID        string   `json:"id"`
	Title     string   `json:"title"`
	Position  Position `json:"position"`
	Collapsed bool     `json:"collapsed"`
	PanelIDs  []string `json:"panel_ids"`
}

// Position defines position and size
type Position struct {
	X      int `json:"x"`
	Y      int `json:"y"`
	Width  int `json:"width"`
	Height int `json:"height"`
}

// RealtimePanel represents a real-time dashboard panel
type RealtimePanel struct {
	ID               string                 `json:"id"`
	Title            string                 `json:"title"`
	Type             string                 `json:"type"` // graph, stat, table, heatmap, gauge, progress
	Queries          []DashboardQuery       `json:"queries"`
	Visualization    VisualizationConfig    `json:"visualization"`
	Transformations  []DataTransformation   `json:"transformations"`
	Position         Position               `json:"position"`
	Data             PanelData              `json:"data"`
	Streaming        bool                   `json:"streaming"`
	StreamingConfig  StreamingConfig        `json:"streaming_config,omitempty"`
	Alerts           []PanelAlert           `json:"alerts"`
	Drilldown        DrilldownConfig        `json:"drilldown,omitempty"`
	Actions          []PanelAction          `json:"actions"`
	CustomProperties map[string]interface{} `json:"custom_properties"`
}

// DashboardQuery represents a dashboard query
type DashboardQuery struct {
	ID           string            `json:"id"`
	DataSource   string            `json:"data_source"` // prometheus, influxdb, elasticsearch, custom
	Query        string            `json:"query"`
	QueryType    string            `json:"query_type"` // metrics, logs, traces, events
	Format       string            `json:"format"`     // time_series, table, scalar
	Variables    map[string]string `json:"variables"`
	Options      QueryOptions      `json:"options"`
	LegendFormat string            `json:"legend_format,omitempty"`
	Unit         string            `json:"unit,omitempty"`
}

// QueryOptions defines query options
type QueryOptions struct {
	Step        time.Duration `json:"step,omitempty"`
	Rate        bool          `json:"rate,omitempty"`
	Instant     bool          `json:"instant,omitempty"`
	Timeout     time.Duration `json:"timeout,omitempty"`
	MinInterval time.Duration `json:"min_interval,omitempty"`
}

// VisualizationConfig defines visualization settings
type VisualizationConfig struct {
	ChartType   string                 `json:"chart_type"` // line, bar, area, pie, scatter
	Axis        AxisConfig             `json:"axis"`
	Legend      LegendConfig           `json:"legend"`
	Colors      []string               `json:"colors"`
	Thresholds  []Threshold            `json:"thresholds"`
	Annotations []Annotation           `json:"annotations"`
	Styles      map[string]interface{} `json:"styles"`
	Interactive bool                   `json:"interactive"`
	Zoom        bool                   `json:"zoom"`
	Crosshair   bool                   `json:"crosshair"`
}

// AxisConfig defines axis configuration
type AxisConfig struct {
	X     AxisOptions  `json:"x"`
	Y     AxisOptions  `json:"y"`
	Y2    *AxisOptions `json:"y2,omitempty"`
	Unit  string       `json:"unit"`
	Scale string       `json:"scale"` // linear, log
	Min   *float64     `json:"min,omitempty"`
	Max   *float64     `json:"max,omitempty"`
}

// AxisOptions defines axis options
type AxisOptions struct {
	Label  string `json:"label"`
	Show   bool   `json:"show"`
	Format string `json:"format"`
	Ticks  int    `json:"ticks"`
	Grid   bool   `json:"grid"`
}

// LegendConfig defines legend configuration
type LegendConfig struct {
	Show     bool     `json:"show"`
	Position string   `json:"position"` // top, bottom, left, right
	Orient   string   `json:"orient"`   // horizontal, vertical
	Values   []string `json:"values"`   // min, max, avg, current, delta
}

// Threshold defines visual threshold
type Threshold struct {
	Value float64 `json:"value"`
	Color string  `json:"color"`
	Label string  `json:"label"`
	Line  bool    `json:"line"`
	Fill  bool    `json:"fill"`
}

// Annotation defines annotation
type Annotation struct {
	Timestamp Timestamp `json:"timestamp"`
	Value     *float64  `json:"value,omitempty"`
	Text      string    `json:"text"`
	Tags      []string  `json:"tags"`
	Color     string    `json:"color"`
}

// DataTransformation defines data transformation
type DataTransformation struct {
	Type       string                 `json:"type"` // filter, join, calculate, aggregate
	Expression string                 `json:"expression"`
	Options    map[string]interface{} `json:"options"`
}

// PanelData represents panel data
type PanelData struct {
	Series     []MetricSeries         `json:"series"`
	Table      *TableData             `json:"table,omitempty"`
	Value      *float64               `json:"value,omitempty"`
	LastUpdate Timestamp              `json:"last_update"`
	Status     string                 `json:"status"` // loading, success, error
	Error      string                 `json:"error,omitempty"`
	Metadata   map[string]interface{} `json:"metadata"`
}

// TableData represents tabular data
type TableData struct {
	Columns []TableColumn `json:"columns"`
	Rows    []TableRow    `json:"rows"`
	Total   int64         `json:"total"`
}

// TableColumn defines table column
type TableColumn struct {
	Name string `json:"name"`
	Type string `json:"type"`
	Unit string `json:"unit,omitempty"`
}

// TableRow represents table row
type TableRow struct {
	Values []interface{} `json:"values"`
}

// StreamingConfig defines streaming configuration
type StreamingConfig struct {
	Enabled     bool          `json:"enabled"`
	Interval    time.Duration `json:"interval"`
	BufferSize  int           `json:"buffer_size"`
	Smoothing   bool          `json:"smoothing"`
	SmoothAlpha float64       `json:"smooth_alpha"`
}

// PanelAlert defines panel-level alert
type PanelAlert struct {
	Condition string   `json:"condition"`
	Threshold float64  `json:"threshold"`
	Severity  string   `json:"severity"`
	Message   string   `json:"message"`
	Enabled   bool     `json:"enabled"`
	Actions   []string `json:"actions"`
}

// DrilldownConfig defines drilldown configuration
type DrilldownConfig struct {
	Enabled    bool                   `json:"enabled"`
	Type       string                 `json:"type"` // dashboard, url, modal
	Target     string                 `json:"target"`
	Parameters map[string]interface{} `json:"parameters"`
	NewTab     bool                   `json:"new_tab"`
}

// PanelAction defines panel action
type PanelAction struct {
	Type     string                 `json:"type"` // refresh, export, share, fullscreen
	Name     string                 `json:"name"`
	Icon     string                 `json:"icon"`
	Shortcut string                 `json:"shortcut"`
	Config   map[string]interface{} `json:"config"`
}

// DashboardFilters defines dashboard filters
type DashboardFilters struct {
	Time   TimeFilter   `json:"time"`
	Labels LabelFilter  `json:"labels"`
	Custom CustomFilter `json:"custom"`
}

// TimeFilter defines time filter
type TimeFilter struct {
	Range   TimeRange `json:"range"`
	Quick   []string  `json:"quick"` // 1h, 6h, 12h, 24h, 7d, 30d
	Refresh bool      `json:"refresh"`
}

// LabelFilter defines label filter
type LabelFilter struct {
	Labels  map[string][]string `json:"labels"`
	Include []string            `json:"include"`
	Exclude []string            `json:"exclude"`
}

// CustomFilter defines custom filter
type CustomFilter struct {
	Name    string      `json:"name"`
	Type    string      `json:"type"` // input, select, multiselect
	Options []string    `json:"options"`
	Value   interface{} `json:"value"`
}

// SharingSettings defines sharing settings
type SharingSettings struct {
	Public    bool       `json:"public"`
	ShareLink string     `json:"share_link"`
	Export    bool       `json:"export"`
	Embed     bool       `json:"embed"`
	Password  string     `json:"password,omitempty"`
	Expires   *Timestamp `json:"expires,omitempty"`
}

// PermissionSettings defines permission settings
type PermissionSettings struct {
	View  []string `json:"view"`
	Edit  []string `json:"edit"`
	Admin []string `json:"admin"`
}

// DashboardTheme defines dashboard theme
type DashboardTheme struct {
	Name       string                 `json:"name"`
	Colors     ThemeColors            `json:"colors"`
	Typography ThemeTypography        `json:"typography"`
	Spacing    ThemeSpacing           `json:"spacing"`
	Borders    ThemeBorders           `json:"borders"`
	Custom     map[string]interface{} `json:"custom"`
}

// ThemeColors defines theme colors
type ThemeColors struct {
	Primary     string   `json:"primary"`
	Secondary   string   `json:"secondary"`
	Background  string   `json:"background"`
	Surface     string   `json:"surface"`
	Text        string   `json:"text"`
	Accent      string   `json:"accent"`
	GraphColors []string `json:"graph_colors"`
}

// ThemeTypography defines theme typography
type ThemeTypography struct {
	FontFamily string `json:"font_family"`
	FontSize   string `json:"font_size"`
	FontWeight string `json:"font_weight"`
}

// ThemeSpacing defines theme spacing
type ThemeSpacing struct {
	Small  int `json:"small"`
	Medium int `json:"medium"`
	Large  int `json:"large"`
}

// ThemeBorders defines theme borders
type ThemeBorders struct {
	Radius int    `json:"radius"`
	Width  int    `json:"width"`
	Color  string `json:"color"`
}

// DashboardTemplate defines a dashboard template
type DashboardTemplate struct {
	ID          string             `json:"id"`
	Name        string             `json:"name"`
	Description string             `json:"description"`
	Category    string             `json:"category"`
	Tags        []string           `json:"tags"`
	Dashboard   RealtimeDashboard  `json:"dashboard"`
	Variables   []TemplateVariable `json:"variables"`
	Screenshots []string           `json:"screenshots"`
	Rating      float64            `json:"rating"`
	Downloads   int                `json:"downloads"`
	Author      string             `json:"author"`
	CreatedAt   Timestamp          `json:"created_at"`
	UpdatedAt   Timestamp          `json:"updated_at"`
}

// TemplateVariable defines template variable
type TemplateVariable struct {
	Name         string      `json:"name"`
	Type         string      `json:"type"` // string, number, boolean, list
	Label        string      `json:"label"`
	Description  string      `json:"description"`
	DefaultValue interface{} `json:"default_value"`
	Required     bool        `json:"required"`
	Options      []string    `json:"options,omitempty"`
	Validation   Validation  `json:"validation,omitempty"`
}

// Validation defines variable validation
type Validation struct {
	Pattern string `json:"pattern,omitempty"`
	Min     *int   `json:"min,omitempty"`
	Max     *int   `json:"max,omitempty"`
}

// DashboardQueryCache caches dashboard queries
type DashboardQueryCache struct {
	cache  map[string]*CachedQuery
	mu     sync.RWMutex
	config CacheConfig
}

// CachedQuery represents a cached query result
type CachedQuery struct {
	Key      string      `json:"key"`
	Data     interface{} `json:"data"`
	Expires  time.Time   `json:"expires"`
	HitCount int64       `json:"hit_count"`
	LastHit  time.Time   `json:"last_hit"`
}

// CacheConfig defines cache configuration
type CacheConfig struct {
	TTL     time.Duration `json:"ttl"`
	MaxSize int           `json:"max_size"`
	Cleanup time.Duration `json:"cleanup_interval"`
}

// WebSocketPool manages WebSocket connections
type WebSocketPool struct {
	connections map[string]*WebSocketConnection
	mu          sync.RWMutex
}

// WebSocketConnection represents a WebSocket connection
type WebSocketConnection struct {
	ID       string
	UserID   string
	TenantID string
	Channel  chan []byte
	LastPing time.Time
}

// DashboardConfig defines dashboard service configuration
type DashboardConfig struct {
	MaxPanels       int           `json:"max_panels"`
	MaxQueries      int           `json:"max_queries"`
	RefreshInterval time.Duration `json:"refresh_interval"`
	QueryTimeout    time.Duration `json:"query_timeout"`
	CacheTTL        time.Duration `json:"cache_ttl"`
	StreamBuffer    int           `json:"stream_buffer"`
	ExportFormats   []string      `json:"export_formats"`
}

// NewRealtimeDashboardService creates a new real-time dashboard service
func NewRealtimeDashboardService(service *AdvancedMonitoringService) *RealtimeDashboardService {
	svc := &RealtimeDashboardService{
		service:    service,
		dashboards: make(map[string]*RealtimeDashboard),
		templates:  make(map[string]*DashboardTemplate),
		queries: &DashboardQueryCache{
			cache: make(map[string]*CachedQuery),
			config: CacheConfig{
				TTL:     time.Minute * 5,
				MaxSize: 1000,
				Cleanup: time.Minute * 10,
			},
		},
		websocketPool: &WebSocketPool{
			connections: make(map[string]*WebSocketConnection),
		},
		config: DashboardConfig{
			MaxPanels:       50,
			MaxQueries:      200,
			RefreshInterval: time.Second * 30,
			QueryTimeout:    time.Second * 10,
			CacheTTL:        time.Minute * 5,
			StreamBuffer:    100,
			ExportFormats:   []string{"png", "svg", "pdf", "csv", "json"},
		},
	}

	// Start background tasks
	go svc.startCacheCleanup()
	go svc.startDashboardRefresh()

	return svc
}

// CreateRealtimeDashboard creates a new real-time dashboard
func (rds *RealtimeDashboardService) CreateRealtimeDashboard(ctx context.Context, tenantID string, dashboard *RealtimeDashboard) (*RealtimeDashboard, error) {
	rds.mu.Lock()
	defer rds.mu.Unlock()

	// Validate dashboard
	if err := rds.validateDashboard(dashboard); err != nil {
		return nil, fmt.Errorf("invalid dashboard: %w", err)
	}

	// Set metadata
	dashboard.ID = generateUUID()
	dashboard.TenantID = tenantID
	dashboard.LastUpdated = TimestampNow()

	// Apply default theme if not set
	if dashboard.Theme.Name == "" {
		dashboard.Theme = rds.getDefaultTheme()
	}

	// Store dashboard
	rds.dashboards[dashboard.ID] = dashboard

	// Start streaming for panels with streaming enabled
	for i := range dashboard.Panels {
		if dashboard.Panels[i].Streaming {
			go rds.startPanelStreaming(dashboard.ID, &dashboard.Panels[i])
		}
	}

	return dashboard, nil
}

// GetRealtimeDashboard retrieves a real-time dashboard
func (rds *RealtimeDashboardService) GetRealtimeDashboard(ctx context.Context, tenantID, dashboardID string) (*RealtimeDashboard, error) {
	rds.mu.RLock()
	defer rds.mu.RUnlock()

	dashboard, exists := rds.dashboards[dashboardID]
	if !exists || dashboard.TenantID != tenantID {
		return nil, fmt.Errorf("dashboard not found")
	}

	// Update panel data
	rds.updatePanelData(ctx, dashboard)

	return dashboard, nil
}

// ListRealtimeDashboards lists real-time dashboards
func (rds *RealtimeDashboardService) ListRealtimeDashboards(ctx context.Context, tenantID string, opts *DashboardListOptions) (*PaginatedResponse[RealtimeDashboard], error) {
	rds.mu.RLock()
	defer rds.mu.RUnlock()

	var dashboards []RealtimeDashboard
	for _, dashboard := range rds.dashboards {
		if dashboard.TenantID == tenantID {
			// Apply filters
			if opts != nil {
				if opts.Search != "" && !rds.matchesSearch(dashboard, opts.Search) {
					continue
				}
				if len(opts.Tags) > 0 && !rds.matchesTags(dashboard, opts.Tags) {
					continue
				}
			}
			dashboards = append(dashboards, *dashboard)
		}
	}

	// Apply pagination
	total := int64(len(dashboards))
	start := 0
	end := len(dashboards)

	if opts != nil {
		if opts.PageSize > 0 {
			start = (opts.Page - 1) * opts.PageSize
			end = start + opts.PageSize
			if end > len(dashboards) {
				end = len(dashboards)
			}
		}
	}

	if start >= len(dashboards) {
		return &PaginatedResponse[RealtimeDashboard]{
			Data:    []RealtimeDashboard{},
			Total:   total,
			Page:    opts.Page,
			HasMore: false,
		}, nil
	}

	paged := dashboards[start:end]

	return &PaginatedResponse[RealtimeDashboard]{
		Data:    paged,
		Total:   total,
		Page:    opts.Page,
		HasMore: end < len(dashboards),
	}, nil
}

// UpdateRealtimeDashboard updates a real-time dashboard
func (rds *RealtimeDashboardService) UpdateRealtimeDashboard(ctx context.Context, tenantID, dashboardID string, dashboard *RealtimeDashboard) (*RealtimeDashboard, error) {
	rds.mu.Lock()
	defer rds.mu.Unlock()

	existing, exists := rds.dashboards[dashboardID]
	if !exists || existing.TenantID != tenantID {
		return nil, fmt.Errorf("dashboard not found")
	}

	// Validate updated dashboard
	if err := rds.validateDashboard(dashboard); err != nil {
		return nil, fmt.Errorf("invalid dashboard: %w", err)
	}

	// Update metadata
	dashboard.ID = dashboardID
	dashboard.TenantID = tenantID
	dashboard.LastUpdated = TimestampNow()

	// Update streaming configurations
	rds.updateStreamingConfigurations(existing, dashboard)

	// Store updated dashboard
	rds.dashboards[dashboardID] = dashboard

	return dashboard, nil
}

// DeleteRealtimeDashboard deletes a real-time dashboard
func (rds *RealtimeDashboardService) DeleteRealtimeDashboard(ctx context.Context, tenantID, dashboardID string) error {
	rds.mu.Lock()
	defer rds.mu.Unlock()

	dashboard, exists := rds.dashboards[dashboardID]
	if !exists || dashboard.TenantID != tenantID {
		return fmt.Errorf("dashboard not found")
	}

	// Stop all streaming for this dashboard
	for _, panel := range dashboard.Panels {
		if panel.Streaming {
			rds.stopPanelStreaming(dashboardID, panel.ID)
		}
	}

	// Remove subscribers
	rds.removeSubscribers(dashboardID)

	// Delete dashboard
	delete(rds.dashboards, dashboardID)

	return nil
}

// validateDashboard validates a dashboard
func (rds *RealtimeDashboardService) validateDashboard(dashboard *RealtimeDashboard) error {
	if dashboard.Name == "" {
		return fmt.Errorf("dashboard name is required")
	}

	if len(dashboard.Panels) > rds.config.MaxPanels {
		return fmt.Errorf("too many panels (max %d)", rds.config.MaxPanels)
	}

	for i, panel := range dashboard.Panels {
		if panel.Title == "" {
			return fmt.Errorf("panel %d title is required", i)
		}
		if len(panel.Queries) > rds.config.MaxQueries {
			return fmt.Errorf("panel %d has too many queries (max %d)", i, rds.config.MaxQueries)
		}
		for j, query := range panel.Queries {
			if query.Query == "" {
				return fmt.Errorf("panel %d query %d is empty", i, j)
			}
		}
	}

	return nil
}

// updatePanelData updates panel data with latest query results
func (rds *RealtimeDashboardService) updatePanelData(ctx context.Context, dashboard *RealtimeDashboard) {
	for i := range dashboard.Panels {
		panel := &dashboard.Panels[i]

		// Check cache first
		cacheKey := rds.getCacheKey(dashboard.ID, panel.ID)
		if cached := rds.queries.get(cacheKey); cached != nil {
			panel.Data = cached.Data.(PanelData)
			continue
		}

		// Execute queries
		panel.Data = PanelData{
			Series:     []MetricSeries{},
			LastUpdate: TimestampNow(),
			Status:     "loading",
		}

		for _, query := range panel.Queries {
			series, err := rds.executeQuery(ctx, query)
			if err != nil {
				panel.Data.Status = "error"
				panel.Data.Error = err.Error()
				break
			}
			panel.Data.Series = append(panel.Data.Series, series...)
		}

		if panel.Data.Status != "error" {
			panel.Data.Status = "success"

			// Apply transformations
			for _, transform := range panel.Transformations {
				panel.Data = rds.applyTransformation(panel.Data, transform)
			}

			// Cache result
			rds.queries.set(cacheKey, panel.Data, rds.config.CacheTTL)
		}
	}
}

// executeQuery executes a dashboard query
func (rds *RealtimeDashboardService) executeQuery(ctx context.Context, query DashboardQuery) ([]MetricSeries, error) {
	ctx, cancel := context.WithTimeout(ctx, rds.config.QueryTimeout)
	defer cancel()

	switch query.DataSource {
	case "prometheus":
		return rds.queryPrometheus(ctx, query)
	case "influxdb":
		return rds.queryInfluxDB(ctx, query)
	case "elasticsearch":
		return rds.queryElasticsearch(ctx, query)
	case "traces":
		return rds.queryTraces(ctx, query)
	case "logs":
		return rds.queryLogs(ctx, query)
	default:
		return rds.queryCustom(ctx, query)
	}
}

// queryPrometheus queries Prometheus for metrics
func (rds *RealtimeDashboardService) queryPrometheus(ctx context.Context, query DashboardQuery) ([]MetricSeries, error) {
	// This would integrate with Prometheus client
	// For now, return mock data
	return []MetricSeries{
		{
			Name: "http_requests_total",
			Points: []MetricPoint{
				{Timestamp: TimestampNow().Add(-time.Minute * 5), Value: 100},
				{Timestamp: TimestampNow().Add(-time.Minute * 4), Value: 120},
				{Timestamp: TimestampNow().Add(-time.Minute * 3), Value: 110},
				{Timestamp: TimestampNow().Add(-time.Minute * 2), Value: 130},
				{Timestamp: TimestampNow().Add(-time.Minute * 1), Value: 125},
				{Timestamp: TimestampNow(), Value: 140},
			},
		},
	}, nil
}

// queryInfluxDB queries InfluxDB for metrics
func (rds *RealtimeDashboardService) queryInfluxDB(ctx context.Context, query DashboardQuery) ([]MetricSeries, error) {
	// Implementation for InfluxDB queries
	return []MetricSeries{}, nil
}

// queryElasticsearch queries Elasticsearch for data
func (rds *RealtimeDashboardService) queryElasticsearch(ctx context.Context, query DashboardQuery) ([]MetricSeries, error) {
	// Implementation for Elasticsearch queries
	return []MetricSeries{}, nil
}

// queryTraces queries trace data
func (rds *RealtimeDashboardService) queryTraces(ctx context.Context, query DashboardQuery) ([]MetricSeries, error) {
	// Implementation for trace queries
	return []MetricSeries{}, nil
}

// queryLogs queries log data
func (rds *RealtimeDashboardService) queryLogs(ctx context.Context, query DashboardQuery) ([]MetricSeries, error) {
	// Implementation for log queries
	return []MetricSeries{}, nil
}

// queryCustom queries custom data sources
func (rds *RealtimeDashboardService) queryCustom(ctx context.Context, query DashboardQuery) ([]MetricSeries, error) {
	// Implementation for custom queries
	return []MetricSeries{}, nil
}

// applyTransformation applies data transformation
func (rds *RealtimeDashboardService) applyTransformation(data PanelData, transform DataTransformation) PanelData {
	switch transform.Type {
	case "filter":
		return rds.transformFilter(data, transform)
	case "calculate":
		return rds.transformCalculate(data, transform)
	case "aggregate":
		return rds.transformAggregate(data, transform)
	case "join":
		return rds.transformJoin(data, transform)
	default:
		return data
	}
}

// transformFilter filters data
func (rds *RealtimeDashboardService) transformFilter(data PanelData, transform DataTransformation) PanelData {
	// Implementation for filter transformation
	return data
}

// transformCalculate calculates new fields
func (rds *RealtimeDashboardService) transformCalculate(data PanelData, transform DataTransformation) PanelData {
	// Implementation for calculate transformation
	return data
}

// transformAggregate aggregates data
func (rds *RealtimeDashboardService) transformAggregate(data PanelData, transform DataTransformation) PanelData {
	// Implementation for aggregate transformation
	return data
}

// transformJoin joins data
func (rds *RealtimeDashboardService) transformJoin(data PanelData, transform DataTransformation) PanelData {
	// Implementation for join transformation
	return data
}

// startPanelStreaming starts streaming for a panel
func (rds *RealtimeDashboardService) startPanelStreaming(dashboardID string, panel *RealtimePanel) {
	ticker := time.NewTicker(panel.StreamingConfig.Interval)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			ctx, cancel := context.WithTimeout(context.Background(), rds.config.QueryTimeout)

			// Execute queries
			var newSeries []MetricSeries
			for _, query := range panel.Queries {
				series, err := rds.executeQuery(ctx, query)
				if err != nil {
					continue
				}
				newSeries = append(newSeries, series...)
			}

			// Update panel data
			rds.mu.Lock()
			if dashboard, exists := rds.dashboards[dashboardID]; exists {
				for i := range dashboard.Panels {
					if dashboard.Panels[i].ID == panel.ID {
						// Apply smoothing if enabled
						if panel.StreamingConfig.Smoothing {
							newSeries = rds.applySmoothing(dashboard.Panels[i].Data.Series, newSeries, panel.StreamingConfig.SmoothAlpha)
						}

						dashboard.Panels[i].Data = PanelData{
							Series:     newSeries,
							LastUpdate: TimestampNow(),
							Status:     "success",
						}

						// Broadcast to subscribers
						rds.broadcastUpdate(dashboardID, &dashboard.Panels[i])
						break
					}
				}
			}
			rds.mu.Unlock()

			cancel()
		}
	}
}

// applySmoothing applies exponential smoothing to data
func (rds *RealtimeDashboardService) applySmoothing(oldSeries, newSeries []MetricSeries, alpha float64) []MetricSeries {
	// Implementation for exponential smoothing
	// Simple implementation - just return new series for now
	return newSeries
}

// stopPanelStreaming stops streaming for a panel
func (rds *RealtimeDashboardService) stopPanelStreaming(dashboardID, panelID string) {
	// Implementation to stop streaming
	// This would need to track goroutines and stop them
}

// updateStreamingConfigurations updates streaming configurations
func (rds *RealtimeDashboardService) updateStreamingConfigurations(old, new *RealtimeDashboard) {
	// Compare old and new panels
	oldPanels := make(map[string]*RealtimePanel)
	for i := range old.Panels {
		oldPanels[old.Panels[i].ID] = &old.Panels[i]
	}

	for i := range new.Panels {
		panel := &new.Panels[i]
		if oldPanel, exists := oldPanels[panel.ID]; exists {
			// Check if streaming configuration changed
			if oldPanel.Streaming != panel.Streaming {
				if panel.Streaming {
					go rds.startPanelStreaming(new.ID, panel)
				} else {
					rds.stopPanelStreaming(new.ID, panel.ID)
				}
			}
		} else if panel.Streaming {
			// New panel with streaming
			go rds.startPanelStreaming(new.ID, panel)
		}
	}
}

// broadcastUpdate broadcasts updates to subscribers
func (rds *RealtimeDashboardService) broadcastUpdate(dashboardID string, panel *RealtimePanel) {
	// Implementation to broadcast updates via WebSocket
	// This would serialize panel data and send to connected clients
}

// subscribeToDashboard subscribes to dashboard updates
func (rds *RealtimeDashboardService) subscribeToDashboard(ctx context.Context, tenantID, dashboardID, userID string) error {
	rds.mu.Lock()
	defer rds.mu.Unlock()

	dashboard, exists := rds.dashboards[dashboardID]
	if !exists || dashboard.TenantID != tenantID {
		return fmt.Errorf("dashboard not found")
	}

	// Add subscriber
	for _, sub := range dashboard.Subscribers {
		if sub == userID {
			return nil // Already subscribed
		}
	}

	dashboard.Subscribers = append(dashboard.Subscribers, userID)

	return nil
}

// unsubscribeFromDashboard unsubscribes from dashboard updates
func (rds *RealtimeDashboardService) unsubscribeFromDashboard(ctx context.Context, tenantID, dashboardID, userID string) error {
	rds.mu.Lock()
	defer rds.mu.Unlock()

	dashboard, exists := rds.dashboards[dashboardID]
	if !exists || dashboard.TenantID != tenantID {
		return fmt.Errorf("dashboard not found")
	}

	// Remove subscriber
	for i, sub := range dashboard.Subscribers {
		if sub == userID {
			dashboard.Subscribers = append(dashboard.Subscribers[:i], dashboard.Subscribers[i+1:]...)
			break
		}
	}

	return nil
}

// removeSubscribers removes all subscribers from a dashboard
func (rds *RealtimeDashboardService) removeSubscribers(dashboardID string) {
	rds.mu.Lock()
	defer rds.mu.Unlock()

	if dashboard, exists := rds.dashboards[dashboardID]; exists {
		dashboard.Subscribers = []string{}
	}
}

// ExportDashboard exports a dashboard
func (rds *RealtimeDashboardService) ExportDashboard(ctx context.Context, tenantID, dashboardID string, format string) ([]byte, error) {
	rds.mu.RLock()
	defer rds.mu.RUnlock()

	dashboard, exists := rds.dashboards[dashboardID]
	if !exists || dashboard.TenantID != tenantID {
		return nil, fmt.Errorf("dashboard not found")
	}

	switch format {
	case "json":
		return rds.exportJSON(dashboard)
	case "png":
		return rds.exportPNG(dashboard)
	case "svg":
		return rds.exportSVG(dashboard)
	case "pdf":
		return rds.exportPDF(dashboard)
	case "csv":
		return rds.exportCSV(dashboard)
	default:
		return nil, fmt.Errorf("unsupported export format: %s", format)
	}
}

// exportJSON exports dashboard as JSON
func (rds *RealtimeDashboardService) exportJSON(dashboard *RealtimeDashboard) ([]byte, error) {
	// Implementation for JSON export
	return []byte("{}"), nil
}

// exportPNG exports dashboard as PNG image
func (rds *RealtimeDashboardService) exportPNG(dashboard *RealtimeDashboard) ([]byte, error) {
	// Implementation for PNG export
	return []byte{}, nil
}

// exportSVG exports dashboard as SVG
func (rds *RealtimeDashboardService) exportSVG(dashboard *RealtimeDashboard) ([]byte, error) {
	// Implementation for SVG export
	return []byte{}, nil
}

// exportPDF exports dashboard as PDF
func (rds *RealtimeDashboardService) exportPDF(dashboard *RealtimeDashboard) ([]byte, error) {
	// Implementation for PDF export
	return []byte{}, nil
}

// exportCSV exports dashboard data as CSV
func (rds *RealtimeDashboardService) exportCSV(dashboard *RealtimeDashboard) ([]byte, error) {
	// Implementation for CSV export
	return []byte{}, nil
}

// ImportDashboard imports a dashboard from JSON or template
func (rds *RealtimeDashboardService) ImportDashboard(ctx context.Context, tenantID string, data []byte, templateID string) (*RealtimeDashboard, error) {
	// Implementation for importing dashboards
	return nil, nil
}

// GetDashboardTemplates gets available dashboard templates
func (rds *RealtimeDashboardService) GetDashboardTemplates(ctx context.Context, category string) ([]DashboardTemplate, error) {
	rds.mu.RLock()
	defer rds.mu.RUnlock()

	var templates []DashboardTemplate
	for _, template := range rds.templates {
		if category == "" || template.Category == category {
			templates = append(templates, *template)
		}
	}

	return templates, nil
}

// CreateDashboardTemplate creates a new dashboard template
func (rds *RealtimeDashboardService) CreateDashboardTemplate(ctx context.Context, template *DashboardTemplate) (*DashboardTemplate, error) {
	rds.mu.Lock()
	defer rds.mu.Unlock()

	template.ID = generateUUID()
	template.CreatedAt = TimestampNow()
	template.UpdatedAt = TimestampNow()

	rds.templates[template.ID] = template

	return template, nil
}

// getDefaultTheme returns the default dashboard theme
func (rds *RealtimeDashboardService) getDefaultTheme() DashboardTheme {
	return DashboardTheme{
		Name: "default",
		Colors: ThemeColors{
			Primary:     "#1f77b4",
			Secondary:   "#ff7f0e",
			Background:  "#ffffff",
			Surface:     "#f5f5f5",
			Text:        "#333333",
			Accent:      "#2ca02c",
			GraphColors: []string{"#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd", "#8c564b", "#e377c2", "#7f7f7f"},
		},
		Typography: ThemeTypography{
			FontFamily: "Inter, sans-serif",
			FontSize:   "14px",
			FontWeight: "400",
		},
		Spacing: ThemeSpacing{
			Small:  8,
			Medium: 16,
			Large:  24,
		},
		Borders: ThemeBorders{
			Radius: 4,
			Width:  1,
			Color:  "#e0e0e0",
		},
	}
}

// matchesSearch checks if dashboard matches search query
func (rds *RealtimeDashboardService) matchesSearch(dashboard *RealtimeDashboard, search string) bool {
	// Simple implementation - check name and description
	return contains(dashboard.Name, search) || contains(dashboard.Description, search)
}

// matchesTags checks if dashboard matches tags
func (rds *RealtimeDashboardService) matchesTags(dashboard *RealtimeDashboard, tags []string) bool {
	// Implementation for tag matching
	return true
}

// getCacheKey generates cache key for panel query
func (rds *RealtimeDashboardService) getCacheKey(dashboardID, panelID string) string {
	return fmt.Sprintf("%s:%s", dashboardID, panelID)
}

// startCacheCleanup starts periodic cache cleanup
func (rds *RealtimeDashboardService) startCacheCleanup() {
	ticker := time.NewTicker(rds.queries.config.Cleanup)
	defer ticker.Stop()

	for range ticker.C {
		rds.queries.cleanup()
	}
}

// startDashboardRefresh starts periodic dashboard refresh
func (rds *RealtimeDashboardService) startDashboardRefresh() {
	ticker := time.NewTicker(rds.config.RefreshInterval)
	defer ticker.Stop()

	for range ticker.C {
		ctx := context.Background()
		rds.mu.RLock()

		for _, dashboard := range rds.dashboards {
			rds.updatePanelData(ctx, dashboard)
		}

		rds.mu.RUnlock()
	}
}

// Cache methods
func (dq *DashboardQueryCache) get(key string) *CachedQuery {
	dq.mu.RLock()
	defer dq.mu.RUnlock()

	cached, exists := dq.cache[key]
	if !exists || time.Now().After(cached.Expires) {
		return nil
	}

	cached.HitCount++
	cached.LastHit = time.Now()
	return cached
}

func (dq *DashboardQueryCache) set(key string, data interface{}, ttl time.Duration) {
	dq.mu.Lock()
	defer dq.mu.Unlock()

	dq.cache[key] = &CachedQuery{
		Key:      key,
		Data:     data,
		Expires:  time.Now().Add(ttl),
		HitCount: 0,
		LastHit:  time.Now(),
	}
}

func (dq *DashboardQueryCache) cleanup() {
	dq.mu.Lock()
	defer dq.mu.Unlock()

	now := time.Now()
	for key, cached := range dq.cache {
		if now.After(cached.Expires) {
			delete(dq.cache, key)
		}
	}
}

// WebSocketPool methods
func (wsp *WebSocketPool) AddConnection(userID, tenantID string) *WebSocketConnection {
	wsp.mu.Lock()
	defer wsp.mu.Unlock()

	conn := &WebSocketConnection{
		ID:       generateUUID(),
		UserID:   userID,
		TenantID: tenantID,
		Channel:  make(chan []byte, 100),
		LastPing: time.Now(),
	}

	wsp.connections[conn.ID] = conn
	return conn
}

func (wsp *WebSocketPool) RemoveConnection(id string) {
	wsp.mu.Lock()
	defer wsp.mu.Unlock()

	if conn, exists := wsp.connections[id]; exists {
		close(conn.Channel)
		delete(wsp.connections, id)
	}
}

func (wsp *WebSocketPool) Broadcast(tenantID string, message []byte) {
	wsp.mu.RLock()
	defer wsp.mu.RUnlock()

	for _, conn := range wsp.connections {
		if conn.TenantID == tenantID {
			select {
			case conn.Channel <- message:
			default:
				// Channel full, skip
			}
		}
	}
}
