package dashboards

import (
	"context"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/prometheus/client_golang/api"
	v1 "github.com/prometheus/client_golang/api/prometheus/v1"
)

// DashboardManager manages Grafana dashboards
type DashboardManager struct {
	config     DashboardConfig
	httpClient *http.Client
	logger     *log.Logger
	mu         sync.RWMutex
	dashboards map[string]*Dashboard
}

// DashboardConfig contains configuration for dashboard management
type DashboardConfig struct {
	GrafanaURL        string        `json:"grafana_url"`
	GrafanaAPIKey     string        `json:"grafana_api_key"`
	GrafanaFolder     string        `json:"grafana_folder"`
	PrometheusURL     string        `json:"prometheus_url"`
	BasicAuthPassword string        `json:"basic_auth_password"`
	DashboardsDir     string        `json:"dashboards_dir"`
	AutoSync          bool          `json:"auto_sync"`
	SyncInterval      time.Duration `json:"sync_interval"`
	DefaultDatasource string        `json:"default_datasource"`
	Tags              []string      `json:"tags"`
}

// DashboardCreationRequest contains configuration for creating a dashboard
type DashboardCreationRequest struct {
	Title         string    `json:"title"`
	Tags          []string  `json:"tags"`
	Timezone      string    `json:"timezone"`
	Refresh       string    `json:"refresh"`
	Time          TimeRange `json:"time"`
	SchemaVersion int       `json:"schemaVersion"`
	Version       int       `json:"version"`
	Editable      bool      `json:"editable"`
}

// TimeRange represents a time range
type TimeRange struct {
	From string `json:"from"`
	To   string `json:"to"`
}

// Dashboard represents a Grafana dashboard
type Dashboard struct {
	ID            string                `json:"id"`
	UID           string                `json:"uid"`
	Title         string                `json:"title"`
	Tags          []string              `json:"tags"`
	Timezone      string                `json:"timezone"`
	Refresh       string                `json:"refresh"`
	Time          TimeRange             `json:"time"`
	Templating    DashboardTemplating   `json:"templating"`
	Panels        []Panel               `json:"panels"`
	SchemaVersion int                   `json:"schemaVersion"`
	Version       int                   `json:"version"`
	Variables     []DashboardVariable   `json:"variables"`
	Annotations   []DashboardAnnotation `json:"annotations"`
	Editable      bool                  `json:"editable"`
	GnetID        int64                 `json:"gnetId"`
	Links         []DashboardLink       `json:"links"`
	Tooltip       DashboardTooltip      `json:"tooltip"`
	Timepicker    DashboardTimepicker   `json:"timepicker"`
}

// DashboardTemplating represents dashboard templating configuration
type DashboardTemplating struct {
	List []DashboardVariable `json:"list"`
}

// DashboardVariable represents a dashboard variable
type DashboardVariable struct {
	Name       string           `json:"name"`
	Type       string           `json:"type"`
	Datasource string           `json:"datasource"`
	Query      string           `json:"query"`
	Refresh    int              `json:"refresh"`
	IncludeAll bool             `json:"includeAll"`
	AllValue   string           `json:"allValue"`
	Multi      bool             `json:"multi"`
	Current    interface{}      `json:"current"`
	Options    []VariableOption `json:"options"`
	Hide       int              `json:"hide"`
}

// VariableOption represents a variable option
type VariableOption struct {
	Selected bool   `json:"selected"`
	Text     string `json:"text"`
	Value    string `json:"value"`
}

// DashboardAnnotation represents dashboard annotations
type DashboardAnnotation struct {
	List string `json:"list"`
}

// DashboardLink represents dashboard links
type DashboardLink struct {
	AsDropdown  bool     `json:"asDropdown"`
	Icon        string   `json:"icon"`
	IncludeVars bool     `json:"includeVars"`
	KeepTime    bool     `json:"keepTime"`
	Tags        []string `json:"tags"`
	TargetVars  []string `json:"targetVars"`
	Title       string   `json:"title"`
	Tooltip     string   `json:"tooltip"`
	Type        string   `json:"type"`
	URL         string   `json:"url"`
}

// DashboardTooltip represents tooltip configuration
type DashboardTooltip struct {
	Shared bool   `json:"shared"`
	Sort   int    `json:"sort"`
	Type   string `json:"type"`
}

// DashboardTimepicker represents timepicker configuration
type DashboardTimepicker struct {
	RefreshIntervals []string `json:"refresh_intervals"`
	TimeOptions      []string `json:"time_options"`
}

// Panel represents a dashboard panel
type Panel struct {
	ID              int                    `json:"id"`
	Title           string                 `json:"title"`
	Type            string                 `json:"type"`
	GridPos         GridPosition           `json:"gridPos"`
	Targets         []Target               `json:"targets"`
	FieldConfig     FieldConfig            `json:"fieldConfig"`
	Options         map[string]interface{} `json:"options"`
	Transparent     bool                   `json:"transparent"`
	PluginVersion   string                 `json:"pluginVersion"`
	Datasource      string                 `json:"datasource"`
	Description     string                 `json:"description"`
	Repeat          string                 `json:"repeat"`
	RepeatIteration int                    `json:"repeatIteration"`
	MaxDataPoints   int                    `json:"maxDataPoints"`
	Interval        string                 `json:"interval"`
	Transformations []Transformation       `json:"transformations"`
	Span            int                    `json:"span"`
}

// GridPosition represents panel grid position
type GridPosition struct {
	H int `json:"h"`
	W int `json:"w"`
	X int `json:"x"`
	Y int `json:"y"`
}

// Target represents a panel target
type Target struct {
	Expr         string                 `json:"expr"`
	RefID        string                 `json:"refId"`
	LegendFormat string                 `json:"legendFormat"`
	Hide         bool                   `json:"hide"`
	Instant      bool                   `json:"instant"`
	Format       string                 `json:"format"`
	Interval     string                 `json:"interval"`
	Step         int                    `json:"step"`
	Options      map[string]interface{} `json:"options"`
	Datasource   string                 `json:"datasource"`
}

// FieldConfig represents field configuration
type FieldConfig struct {
	Defaults  FieldDefaults   `json:"defaults"`
	Overrides []FieldOverride `json:"overrides"`
}

// FieldDefaults represents default field configuration
type FieldDefaults struct {
	Unit       string            `json:"unit"`
	Min        *float64          `json:"min"`
	Max        *float64          `json:"max"`
	Color      ColorConfig       `json:"color"`
	Thresholds ThresholdConfig   `json:"thresholds"`
	Mappings   []MappingConfig   `json:"mappings"`
	Custom     CustomFieldConfig `json:"custom"`
}

// FieldOverride represents field override configuration
type FieldOverride struct {
	Matcher    FieldMatcher           `json:"matcher"`
	Properties map[string]interface{} `json:"properties"`
}

// FieldMatcher represents field matcher
type FieldMatcher struct {
	ID      string                 `json:"id"`
	Options map[string]interface{} `json:"options"`
}

// ColorConfig represents color configuration
type ColorConfig struct {
	Mode string `json:"mode"`
}

// ThresholdConfig represents threshold configuration
type ThresholdConfig struct {
	Steps []ThresholdStep `json:"steps"`
}

// ThresholdStep represents a threshold step
type ThresholdStep struct {
	Color string   `json:"color"`
	Value *float64 `json:"value"`
}

// MappingConfig represents mapping configuration
type MappingConfig struct {
	Options []MappingOption `json:"options"`
	Type    string          `json:"type"`
}

// MappingOption represents a mapping option
type MappingOption struct {
	Text  string `json:"text"`
	Value string `json:"value"`
	Color string `json:"color"`
}

// CustomFieldConfig represents custom field configuration
type CustomFieldConfig struct {
	Align       string `json:"align"`
	DisplayMode string `json:"displayMode"`
	Orientation string `json:"orientation"`
}

// Transformation represents data transformation
type Transformation struct {
	ID      string                 `json:"id"`
	Options map[string]interface{} `json:"options"`
}

// NewDashboardManager creates a new dashboard manager
func NewDashboardManager(config DashboardConfig) (*DashboardManager, error) {
	logger := log.New(log.Writer(), "[DASHBOARD-MANAGER] ", log.LstdFlags|log.Lmsgprefix)

	if config.GrafanaURL == "" {
		config.GrafanaURL = os.Getenv("GRAFANA_URL")
	}
	if config.GrafanaAPIKey == "" {
		config.GrafanaAPIKey = os.Getenv("GRAFANA_API_KEY")
	}
	if config.PrometheusURL == "" {
		config.PrometheusURL = os.Getenv("PROMETHEUS_URL")
	}
	if config.DashboardsDir == "" {
		config.DashboardsDir = "monitoring/dashboards"
	}
	if config.SyncInterval == 0 {
		config.SyncInterval = 5 * time.Minute
	}

	httpClient := &http.Client{
		Timeout: 30 * time.Second,
	}

	dm := &DashboardManager{
		config:     config,
		httpClient: httpClient,
		logger:     logger,
		dashboards: make(map[string]*Dashboard),
	}

	// Load existing dashboards
	if err := dm.loadDashboards(); err != nil {
		logger.Printf("Warning: Failed to load dashboards: %v", err)
	}

	// Start auto-sync if enabled
	if config.AutoSync {
		go dm.autoSync()
	}

	return dm, nil
}

// loadDashboards loads dashboards from the dashboards directory
func (dm *DashboardManager) loadDashboards() error {
	if _, err := os.Stat(dm.config.DashboardsDir); os.IsNotExist(err) {
		return fmt.Errorf("dashboards directory does not exist: %s", dm.config.DashboardsDir)
	}

	files, err := filepath.Glob(filepath.Join(dm.config.DashboardsDir, "*.json"))
	if err != nil {
		return fmt.Errorf("failed to glob dashboard files: %w", err)
	}

	for _, file := range files {
		if err := dm.loadDashboardFile(file); err != nil {
			dm.logger.Printf("Warning: Failed to load dashboard %s: %v", file, err)
		}
	}

	dm.logger.Printf("Loaded %d dashboards from %s", len(dm.dashboards), dm.config.DashboardsDir)
	return nil
}

// loadDashboardFile loads a single dashboard file
func (dm *DashboardManager) loadDashboardFile(filename string) error {
	data, err := ioutil.ReadFile(filename)
	if err != nil {
		return fmt.Errorf("failed to read dashboard file: %w", err)
	}

	var dashboard struct {
		Dashboard Dashboard `json:"dashboard"`
	}

	if err := json.Unmarshal(data, &dashboard); err != nil {
		return fmt.Errorf("failed to unmarshal dashboard: %w", err)
	}

	// Add default tags
	for _, tag := range dm.config.Tags {
		if !contains(dashboard.Dashboard.Tags, tag) {
			dashboard.Dashboard.Tags = append(dashboard.Dashboard.Tags, tag)
		}
	}

	// Set default datasource
	dashboard.Dashboard = dm.setDefaultDatasource(dashboard.Dashboard)

	dm.mu.Lock()
	dm.dashboards[dashboard.Dashboard.Title] = &dashboard.Dashboard
	dm.mu.Unlock()

	return nil
}

// setDefaultDatasource sets default datasource for all targets
func (dm *DashboardManager) setDefaultDatasource(dashboard Dashboard) Dashboard {
	if len(dashboard.Panels) == 0 {
		return dashboard
	}

	for i := range dashboard.Panels {
		if len(dashboard.Panels[i].Targets) == 0 {
			continue
		}

		for j := range dashboard.Panels[i].Targets {
			if dashboard.Panels[i].Targets[j].Datasource == "" {
				dashboard.Panels[i].Targets[j].Datasource = dm.config.DefaultDatasource
			}
		}
	}

	return dashboard
}

// SyncDashboards syncs all dashboards to Grafana
func (dm *DashboardManager) SyncDashboards() error {
	dm.mu.RLock()
	dashboards := make(map[string]*Dashboard)
	for k, v := range dm.dashboards {
		dashboards[k] = v
	}
	dm.mu.RUnlock()

	for title, dashboard := range dashboards {
		if err := dm.syncDashboardToGrafana(dashboard); err != nil {
			dm.logger.Printf("Failed to sync dashboard %s: %v", title, err)
		}
	}

	return nil
}

// syncDashboardToGrafana syncs a single dashboard to Grafana
func (dm *DashboardManager) syncDashboardToGrafana(dashboard *Dashboard) error {
	// Check if dashboard already exists
	existingUID, err := dm.findDashboardByTitle(dashboard.Title)
	if err != nil {
		dm.logger.Printf("Warning: Failed to check if dashboard exists: %v", err)
	}

	// Prepare dashboard payload
	payload := map[string]interface{}{
		"dashboard": dashboard,
		"overwrite": true,
		"folderId":  dm.config.GrafanaFolder,
	}

	payloadData, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal dashboard payload: %w", err)
	}

	// Create or update dashboard
	var endpoint string
	if existingUID != "" {
		endpoint = fmt.Sprintf("%s/api/dashboards/uid/%s", dm.config.GrafanaURL, existingUID)
	} else {
		endpoint = fmt.Sprintf("%s/api/dashboards/db", dm.config.GrafanaURL)
	}

	req, err := http.NewRequest("POST", endpoint, strings.NewReader(string(payloadData)))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+dm.config.GrafanaAPIKey)

	resp, err := dm.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("unexpected status code: %d", resp.StatusCode)
	}

	dm.logger.Printf("Successfully synced dashboard: %s", dashboard.Title)
	return nil
}

// findDashboardByTitle finds a dashboard UID by title
func (dm *DashboardManager) findDashboardByTitle(title string) (string, error) {
	endpoint := fmt.Sprintf("%s/api/search?type=dash&query=%s", dm.config.GrafanaURL, title)

	req, err := http.NewRequest("GET", endpoint, nil)
	if err != nil {
		return "", fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+dm.config.GrafanaAPIKey)

	resp, err := dm.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return "", fmt.Errorf("unexpected status code: %d", resp.StatusCode)
	}

	var results []struct {
		UID string `json:"uid"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&results); err != nil {
		return "", fmt.Errorf("failed to decode response: %w", err)
	}

	if len(results) > 0 {
		return results[0].UID, nil
	}

	return "", nil
}

// autoSync automatically syncs dashboards at intervals
func (dm *DashboardManager) autoSync() {
	ticker := time.NewTicker(dm.config.SyncInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			if err := dm.SyncDashboards(); err != nil {
				dm.logger.Printf("Auto-sync failed: %v", err)
			}
		}
	}
}

// CreateDashboard creates a new dashboard from configuration
func (dm *DashboardManager) CreateDashboard(config DashboardCreationRequest) (*Dashboard, error) {
	dashboard := &Dashboard{
		ID:            fmt.Sprintf("%d", time.Now().UnixNano()),
		Title:         config.Title,
		Tags:          append(dm.config.Tags, config.Tags...),
		Timezone:      config.Timezone,
		Refresh:       config.Refresh,
		Time:          config.Time,
		SchemaVersion: config.SchemaVersion,
		Version:       config.Version,
		Editable:      config.Editable,
	}

	// Save dashboard
	dm.mu.Lock()
	dm.dashboards[dashboard.Title] = dashboard
	dm.mu.Unlock()

	// Sync to Grafana
	if err := dm.syncDashboardToGrafana(dashboard); err != nil {
		return nil, fmt.Errorf("failed to sync dashboard to Grafana: %w", err)
	}

	dm.logger.Printf("Created and synced dashboard: %s", dashboard.Title)
	return dashboard, nil
}

// DeleteDashboard deletes a dashboard
func (dm *DashboardManager) DeleteDashboard(title string) error {
	dm.mu.Lock()
	defer dm.mu.Unlock()

	dashboard, exists := dm.dashboards[title]
	if !exists {
		return fmt.Errorf("dashboard not found: %s", title)
	}

	// Delete from Grafana
	endpoint := fmt.Sprintf("%s/api/dashboards/uid/%s", dm.config.GrafanaURL, dashboard.UID)

	req, err := http.NewRequest("DELETE", endpoint, nil)
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+dm.config.GrafanaAPIKey)

	resp, err := dm.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("unexpected status code: %d", resp.StatusCode)
	}

	// Remove from local cache
	delete(dm.dashboards, title)

	dm.logger.Printf("Deleted dashboard: %s", title)
	return nil
}

// GetDashboard returns a dashboard by title
func (dm *DashboardManager) GetDashboard(title string) (*Dashboard, error) {
	dm.mu.RLock()
	defer dm.mu.RUnlock()

	dashboard, exists := dm.dashboards[title]
	if !exists {
		return nil, fmt.Errorf("dashboard not found: %s", title)
	}

	return dashboard, nil
}

// ListDashboards returns all dashboard titles
func (dm *DashboardManager) ListDashboards() []string {
	dm.mu.RLock()
	defer dm.mu.RUnlock()

	titles := make([]string, 0, len(dm.dashboards))
	for title := range dm.dashboards {
		titles = append(titles, title)
	}

	return titles
}

// ValidateDashboard validates a dashboard configuration
func (dm *DashboardManager) ValidateDashboard(dashboard *Dashboard) error {
	if dashboard.Title == "" {
		return fmt.Errorf("dashboard title is required")
	}

	if len(dashboard.Panels) == 0 {
		return fmt.Errorf("dashboard must have at least one panel")
	}

	// Validate each panel
	for i, panel := range dashboard.Panels {
		if panel.Title == "" {
			return fmt.Errorf("panel %d title is required", i+1)
		}

		if panel.Type == "" {
			return fmt.Errorf("panel %d type is required", i+1)
		}

		// Validate targets
		if panel.Type != "row" && panel.Type != "text" && len(panel.Targets) == 0 {
			return fmt.Errorf("panel %s must have at least one target", panel.Title)
		}

		// Validate each target
		for j, target := range panel.Targets {
			if target.Expr == "" {
				return fmt.Errorf("panel %s target %d must have an expression", panel.Title, j+1)
			}

			// Validate Prometheus expression
			if err := dm.validatePrometheusQuery(target.Expr); err != nil {
				return fmt.Errorf("panel %s target %d has invalid Prometheus expression: %w", panel.Title, j+1, err)
			}
		}
	}

	return nil
}

// validatePrometheusQuery validates a Prometheus query
func (dm *DashboardManager) validatePrometheusQuery(query string) error {
	if dm.config.PrometheusURL == "" {
		return nil // Skip validation if Prometheus URL is not configured
	}

	client, err := api.NewClient(api.Config{
		Address: dm.config.PrometheusURL,
	})
	if err != nil {
		return fmt.Errorf("failed to create Prometheus client: %w", err)
	}

	v1api := v1.NewAPI(client)
	_, _, err = v1api.QueryRange(context.Background(), query, v1.Range{
		Start: time.Now().Add(-1 * time.Hour),
		End:   time.Now(),
		Step:  time.Minute,
	})

	return err
}

// ExportDashboard exports a dashboard to JSON
func (dm *DashboardManager) ExportDashboard(title string) ([]byte, error) {
	dashboard, err := dm.GetDashboard(title)
	if err != nil {
		return nil, err
	}

	wrapper := struct {
		Dashboard *Dashboard `json:"dashboard"`
	}{
		Dashboard: dashboard,
	}

	return json.MarshalIndent(wrapper, "", "  ")
}

// contains checks if a string is in a slice
func contains(slice []string, item string) bool {
	for _, s := range slice {
		if s == item {
			return true
		}
	}
	return false
}
