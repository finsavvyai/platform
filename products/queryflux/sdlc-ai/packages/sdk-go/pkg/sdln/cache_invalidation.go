package sdln

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"time"
)

// CacheInvalidationService manages intelligent cache invalidation strategies
type CacheInvalidationService struct {
	cache      *CacheService
	strategies map[string]InvalidationStrategy
	watchers   []CacheWatcher
	rules      *InvalidationRules
	monitor    *InvalidationMonitor
}

// NewCacheInvalidationService creates a new cache invalidation service
func NewCacheInvalidationService(cache *CacheService) *CacheInvalidationService {
	service := &CacheInvalidationService{
		cache:      cache,
		strategies: make(map[string]InvalidationStrategy),
		watchers:   make([]CacheWatcher, 0),
		rules:      NewInvalidationRules(),
		monitor:    NewInvalidationMonitor(),
	}

	service.initializeStrategies()
	return service
}

// InvalidationStrategy defines how cache invalidation works
type InvalidationStrategy interface {
	Invalidate(ctx context.Context, event *InvalidationEvent) error
	GetName() string
	GetPriority() int
}

// InvalidationEvent represents a cache invalidation trigger
type InvalidationEvent struct {
	ID        string                 `json:"id"`
	Type      string                 `json:"type"` // data_change, time_based, manual, policy
	Source    string                 `json:"source"`
	DataType  string                 `json:"data_type"`
	EntityID  string                 `json:"entity_id"`
	EntityIDs []string               `json:"entity_ids,omitempty"`
	Pattern   string                 `json:"pattern,omitempty"`
	Tags      []string               `json:"tags,omitempty"`
	Reason    string                 `json:"reason"`
	Timestamp time.Time              `json:"timestamp"`
	Initiator string                 `json:"initiator"`
	Metadata  map[string]interface{} `json:"metadata,omitempty"`
	Priority  int                    `json:"priority"`
	Recursive bool                   `json:"recursive"`
}

// DataChangeInvalidator invalidates cache based on data changes
type DataChangeInvalidator struct {
	cache     *CacheService
	relations map[string][]string // data type -> related data types
}

func NewDataChangeInvalidator(cache *CacheService) *DataChangeInvalidator {
	invalidator := &DataChangeInvalidator{
		cache:     cache,
		relations: make(map[string][]string),
	}

	invalidator.initializeRelations()
	return invalidator
}

func (d *DataChangeInvalidator) initializeRelations() {
	d.relations = map[string][]string{
		"user":         {"user_profile", "user_permissions", "user_preferences"},
		"document":     {"document_metadata", "document_content", "document_permissions", "document_search_index"},
		"organization": {"org_users", "org_policies", "org_settings", "org_billing"},
		"policy":       {"policy_permissions", "policy_users", "policy_effects"},
		"role":         {"role_permissions", "role_users", "role_policies"},
		"project":      {"project_docs", "project_users", "project_settings", "project_metrics"},
		"search_index": {"search_results", "search_suggestions", "search_facets"},
		"settings":     {"system_config", "feature_flags", "rate_limits"},
		"audit":        {"audit_stats", "compliance_status", "risk_assessment"},
	}
}

func (d *DataChangeInvalidator) Invalidate(ctx context.Context, event *InvalidationEvent) error {
	if event.Type != "data_change" {
		return nil
	}

	// Direct invalidation
	if err := d.invalidateDirect(ctx, event); err != nil {
		return fmt.Errorf("failed direct invalidation: %w", err)
	}

	// Related invalidation
	if event.Recursive {
		if err := d.invalidateRelated(ctx, event); err != nil {
			return fmt.Errorf("failed related invalidation: %w", err)
		}
	}

	// Tag-based invalidation
	if len(event.Tags) > 0 {
		if err := d.invalidateByTags(ctx, event); err != nil {
			return fmt.Errorf("failed tag invalidation: %w", err)
		}
	}

	return nil
}

func (d *DataChangeInvalidator) invalidateDirect(ctx context.Context, event *InvalidationEvent) error {
	// Invalidate specific entity
	if event.EntityID != "" {
		pattern := fmt.Sprintf("%s:%s", event.DataType, event.EntityID)
		return d.cache.Clear(ctx, pattern)
	}

	// Invalidate multiple entities
	if len(event.EntityIDs) > 0 {
		for _, entityID := range event.EntityIDs {
			pattern := fmt.Sprintf("%s:%s", event.DataType, entityID)
			if err := d.cache.Clear(ctx, pattern); err != nil {
				return err
			}
		}
		return nil
	}

	// Invalidate all of this data type
	if event.Pattern != "" {
		return d.cache.Clear(ctx, event.Pattern)
	}

	// Default: invalidate all of this data type
	pattern := fmt.Sprintf("%s:*", event.DataType)
	return d.cache.Clear(ctx, pattern)
}

func (d *DataChangeInvalidator) invalidateRelated(ctx context.Context, event *InvalidationEvent) error {
	relatedTypes, exists := d.relations[event.DataType]
	if !exists {
		return nil
	}

	for _, relatedType := range relatedTypes {
		if event.EntityID != "" {
			pattern := fmt.Sprintf("%s:%s", relatedType, event.EntityID)
			if err := d.cache.Clear(ctx, pattern); err != nil {
				return err
			}
		} else {
			pattern := fmt.Sprintf("%s:*", relatedType)
			if err := d.cache.Clear(ctx, pattern); err != nil {
				return err
			}
		}
	}

	return nil
}

func (d *DataChangeInvalidator) invalidateByTags(ctx context.Context, event *InvalidationEvent) error {
	for _, tag := range event.Tags {
		pattern := fmt.Sprintf("tag:%s:*", tag)
		if err := d.cache.Clear(ctx, pattern); err != nil {
			return err
		}
	}
	return nil
}

func (d *DataChangeInvalidator) GetName() string {
	return "data_change"
}

func (d *DataChangeInvalidator) GetPriority() int {
	return 1 // Highest priority
}

// TimeBasedInvalidator invalidates cache based on time schedules
type TimeBasedInvalidator struct {
	cache     *CacheService
	schedules map[string]*InvalidationSchedule
	running   bool
	mutex     sync.RWMutex
}

// InvalidationSchedule defines when to invalidate cache
type InvalidationSchedule struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Pattern     string    `json:"pattern"`
	DataType    string    `json:"data_type"`
	Schedule    string    `json:"schedule"` // cron expression
	Timezone    string    `json:"timezone"`
	Enabled     bool      `json:"enabled"`
	LastRun     time.Time `json:"last_run"`
	NextRun     time.Time `json:"next_run"`
	Description string    `json:"description"`
	Priority    int       `json:"priority"`
}

func NewTimeBasedInvalidator(cache *CacheService) *TimeBasedInvalidator {
	invalidator := &TimeBasedInvalidator{
		cache:     cache,
		schedules: make(map[string]*InvalidationSchedule),
	}

	invalidator.initializeSchedules()
	return invalidator
}

func (t *TimeBasedInvalidator) initializeSchedules() {
	schedules := []*InvalidationSchedule{
		{
			ID:          "user_sessions",
			Name:        "User Session Cleanup",
			Pattern:     "auth_token:*",
			DataType:    "auth",
			Schedule:    "0 */6 * * *", // Every 6 hours
			Timezone:    "UTC",
			Enabled:     true,
			Description: "Clean up expired user sessions",
			Priority:    1,
		},
		{
			ID:          "search_index",
			Name:        "Search Index Refresh",
			Pattern:     "search_results:*",
			DataType:    "search",
			Schedule:    "0 */2 * * *", // Every 2 hours
			Timezone:    "UTC",
			Enabled:     true,
			Description: "Refresh search index cache",
			Priority:    2,
		},
		{
			ID:          "analytics_cache",
			Name:        "Analytics Cache",
			Pattern:     "analytics:*",
			DataType:    "analytics",
			Schedule:    "0 0 * * *", // Daily at midnight
			Timezone:    "UTC",
			Enabled:     true,
			Description: "Clear daily analytics cache",
			Priority:    3,
		},
		{
			ID:          "rate_limits",
			Name:        "Rate Limit Reset",
			Pattern:     "rate_limit:*",
			DataType:    "rate_limit",
			Schedule:    "0 * * * *", // Every hour
			Timezone:    "UTC",
			Enabled:     true,
			Description: "Reset hourly rate limits",
			Priority:    0, // Highest priority
		},
	}

	for _, schedule := range schedules {
		t.schedules[schedule.ID] = schedule
	}
}

func (t *TimeBasedInvalidator) Invalidate(ctx context.Context, event *InvalidationEvent) error {
	if event.Type != "time_based" {
		return nil
	}

	// Find matching schedule
	var schedule *InvalidationSchedule
	for _, s := range t.schedules {
		if s.Pattern == event.Pattern && s.Enabled {
			schedule = s
			break
		}
	}

	if schedule == nil {
		return fmt.Errorf("no matching schedule found for pattern: %s", event.Pattern)
	}

	// Perform invalidation
	err := t.cache.Clear(ctx, schedule.Pattern)
	if err != nil {
		return fmt.Errorf("failed to invalidate schedule %s: %w", schedule.ID, err)
	}

	// Update last run time
	t.mutex.Lock()
	schedule.LastRun = time.Now()
	t.mutex.Unlock()

	return nil
}

func (t *TimeBasedInvalidator) Start(ctx context.Context) {
	t.mutex.Lock()
	if t.running {
		t.mutex.Unlock()
		return
	}
	t.running = true
	t.mutex.Unlock()

	go t.scheduleLoop(ctx)
}

func (t *TimeBasedInvalidator) scheduleLoop(ctx context.Context) {
	ticker := time.NewTicker(time.Minute)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			t.mutex.Lock()
			t.running = false
			t.mutex.Unlock()
			return
		case <-ticker.C:
			t.checkSchedules(ctx)
		}
	}
}

func (t *TimeBasedInvalidator) checkSchedules(ctx context.Context) {
	now := time.Now()

	t.mutex.RLock()
	schedules := make([]*InvalidationSchedule, 0, len(t.schedules))
	for _, schedule := range t.schedules {
		schedules = append(schedules, schedule)
	}
	t.mutex.RUnlock()

	for _, schedule := range schedules {
		if !schedule.Enabled || schedule.NextRun.After(now) {
			continue
		}

		// Create invalidation event
		event := &InvalidationEvent{
			ID:        generateID(),
			Type:      "time_based",
			Source:    "scheduler",
			DataType:  schedule.DataType,
			Pattern:   schedule.Pattern,
			Reason:    fmt.Sprintf("Scheduled invalidation: %s", schedule.Name),
			Timestamp: now,
			Initiator: "system",
			Priority:  schedule.Priority,
			Metadata: map[string]interface{}{
				"schedule_id":   schedule.ID,
				"schedule_name": schedule.Name,
			},
		}

		// Execute invalidation
		if err := t.Invalidate(ctx, event); err != nil {
			// Log error but continue with other schedules
			fmt.Printf("Failed to execute scheduled invalidation %s: %v\n", schedule.ID, err)
		}
	}
}

func (t *TimeBasedInvalidator) GetName() string {
	return "time_based"
}

func (t *TimeBasedInvalidator) GetPriority() int {
	return 2
}

// PolicyBasedInvalidator invalidates cache based on policies
type PolicyBasedInvalidator struct {
	cache    *CacheService
	policies map[string]*InvalidationPolicy
}

// InvalidationPolicy defines cache invalidation rules
type InvalidationPolicy struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	DataType    string   `json:"data_type"`
	Conditions  []string `json:"conditions"` // conditions to trigger invalidation
	Actions     []string `json:"actions"`    // actions to take
	Enabled     bool     `json:"enabled"`
	Priority    int      `json:"priority"`
	Description string   `json:"description"`
}

func NewPolicyBasedInvalidator(cache *CacheService) *PolicyBasedInvalidator {
	invalidator := &PolicyBasedInvalidator{
		cache:    cache,
		policies: make(map[string]*InvalidationPolicy),
	}

	invalidator.initializePolicies()
	return invalidator
}

func (p *PolicyBasedInvalidator) initializePolicies() {
	policies := []*InvalidationPolicy{
		{
			ID:          "user_data_change",
			Name:        "User Data Change Policy",
			DataType:    "user",
			Conditions:  []string{"user.profile.updated", "user.permissions.changed", "user.role.modified"},
			Actions:     []string{"invalidate:user:*", "invalidate:user_permissions:*", "invalidate:user_profile:*"},
			Enabled:     true,
			Priority:    1,
			Description: "Invalidate all user-related cache when user data changes",
		},
		{
			ID:          "document_change",
			Name:        "Document Change Policy",
			DataType:    "document",
			Conditions:  []string{"document.created", "document.updated", "document.deleted", "document.shared"},
			Actions:     []string{"invalidate:document:*", "invalidate:search_index:*", "invalidate:document_permissions:*"},
			Enabled:     true,
			Priority:    1,
			Description: "Invalidate document and search cache when documents change",
		},
		{
			ID:          "security_change",
			Name:        "Security Policy Change",
			DataType:    "policy",
			Conditions:  []string{"policy.created", "policy.updated", "policy.deleted"},
			Actions:     []string{"invalidate:policy:*", "invalidate:user_permissions:*", "invalidate:role_permissions:*"},
			Enabled:     true,
			Priority:    0, // Highest priority
			Description: "Invalidate all permission caches when policies change",
		},
	}

	for _, policy := range policies {
		p.policies[policy.ID] = policy
	}
}

func (p *PolicyBasedInvalidator) Invalidate(ctx context.Context, event *InvalidationEvent) error {
	if event.Type != "policy" {
		return nil
	}

	// Find matching policies
	for _, policy := range p.policies {
		if !policy.Enabled || policy.DataType != event.DataType {
			continue
		}

		// Check if condition matches
		condition := event.Reason
		matches := false
		for _, policyCondition := range policy.Conditions {
			if strings.Contains(condition, policyCondition) {
				matches = true
				break
			}
		}

		if !matches {
			continue
		}

		// Execute actions
		for _, action := range policy.Actions {
			if strings.HasPrefix(action, "invalidate:") {
				pattern := strings.TrimPrefix(action, "invalidate:")
				if err := p.cache.Clear(ctx, pattern); err != nil {
					return fmt.Errorf("failed to execute policy action %s: %w", action, err)
				}
			}
		}
	}

	return nil
}

func (p *PolicyBasedInvalidator) GetName() string {
	return "policy_based"
}

func (p *PolicyBasedInvalidator) GetPriority() int {
	return 3
}

// ManualInvalidator handles manual cache invalidation requests
type ManualInvalidator struct {
	cache *CacheService
}

func NewManualInvalidator(cache *CacheService) *ManualInvalidator {
	return &ManualInvalidator{
		cache: cache,
	}
}

func (m *ManualInvalidator) Invalidate(ctx context.Context, event *InvalidationEvent) error {
	if event.Type != "manual" {
		return nil
	}

	if event.Pattern != "" {
		return m.cache.Clear(ctx, event.Pattern)
	}

	if event.EntityID != "" && event.DataType != "" {
		pattern := fmt.Sprintf("%s:%s", event.DataType, event.EntityID)
		return m.cache.Clear(ctx, pattern)
	}

	return fmt.Errorf("manual invalidation requires either pattern or entity_id and data_type")
}

func (m *ManualInvalidator) GetName() string {
	return "manual"
}

func (m *ManualInvalidator) GetPriority() int {
	return 10 // Lowest priority
}

// CacheWatcher monitors changes and triggers invalidation
type CacheWatcher interface {
	Watch(ctx context.Context) error
	Stop() error
	GetName() string
}

// DatabaseWatcher watches database changes
type DatabaseWatcher struct {
	cache       *CacheService
	invalidator *CacheInvalidationService
	listener    DatabaseListener
	running     bool
	mutex       sync.RWMutex
}

type DatabaseListener interface {
	Subscribe(ctx context.Context, events chan<- *InvalidationEvent) error
	Unsubscribe() error
}

func NewDatabaseWatcher(cache *CacheService, invalidator *CacheInvalidationService, listener DatabaseListener) *DatabaseWatcher {
	return &DatabaseWatcher{
		cache:       cache,
		invalidator: invalidator,
		listener:    listener,
	}
}

func (d *DatabaseWatcher) Watch(ctx context.Context) error {
	d.mutex.Lock()
	if d.running {
		d.mutex.Unlock()
		return nil
	}
	d.running = true
	d.mutex.Unlock()

	events := make(chan *InvalidationEvent, 100)

	// Subscribe to database events
	if err := d.listener.Subscribe(ctx, events); err != nil {
		return fmt.Errorf("failed to subscribe to database events: %w", err)
	}

	// Process events
	go func() {
		defer d.listener.Unsubscribe()
		for {
			select {
			case <-ctx.Done():
				d.mutex.Lock()
				d.running = false
				d.mutex.Unlock()
				return
			case event := <-events:
				if err := d.invalidator.ProcessInvalidation(ctx, event); err != nil {
					fmt.Printf("Failed to process invalidation event: %v\n", err)
				}
			}
		}
	}()

	return nil
}

func (d *DatabaseWatcher) Stop() error {
	d.mutex.Lock()
	defer d.mutex.Unlock()

	if d.running {
		d.running = false
		return d.listener.Unsubscribe()
	}

	return nil
}

func (d *DatabaseWatcher) GetName() string {
	return "database_watcher"
}

// InvalidationRules manages invalidation rule evaluation
type InvalidationRules struct {
	rules []InvalidationRule
	mutex sync.RWMutex
}

type InvalidationRule struct {
	ID        string                        `json:"id"`
	Name      string                        `json:"name"`
	Condition func(*InvalidationEvent) bool `json:"-"`
	Action    string                        `json:"action"`
	Enabled   bool                          `json:"enabled"`
	Priority  int                           `json:"priority"`
}

func NewInvalidationRules() *InvalidationRules {
	return &InvalidationRules{
		rules: make([]InvalidationRule, 0),
	}
}

func (r *InvalidationRules) AddRule(rule InvalidationRule) {
	r.mutex.Lock()
	defer r.mutex.Unlock()
	r.rules = append(r.rules, rule)
}

func (r *InvalidationRules) Evaluate(event *InvalidationEvent) []string {
	r.mutex.RLock()
	defer r.mutex.RUnlock()

	var actions []string
	for _, rule := range r.rules {
		if rule.Enabled && rule.Condition(event) {
			actions = append(actions, rule.Action)
		}
	}

	return actions
}

// InvalidationMonitor tracks invalidation performance
type InvalidationMonitor struct {
	stats map[string]*InvalidationStats
	mutex sync.RWMutex
}

type InvalidationStats struct {
	TotalInvalidations      int64         `json:"total_invalidations"`
	SuccessfulInvalidations int64         `json:"successful_invalidations"`
	FailedInvalidations     int64         `json:"failed_invalidations"`
	AvgInvalidationTime     time.Duration `json:"avg_invalidation_time"`
	LastInvalidation        time.Time     `json:"last_invalidation"`
	Errors                  []string      `json:"errors"`
}

func NewInvalidationMonitor() *InvalidationMonitor {
	return &InvalidationMonitor{
		stats: make(map[string]*InvalidationStats),
	}
}

func (m *InvalidationMonitor) RecordInvalidation(strategy string, duration time.Duration, success bool, err error) {
	m.mutex.Lock()
	defer m.mutex.Unlock()

	if _, exists := m.stats[strategy]; !exists {
		m.stats[strategy] = &InvalidationStats{
			Errors: make([]string, 0),
		}
	}

	stats := m.stats[strategy]
	stats.TotalInvalidations++
	stats.LastInvalidation = time.Now()

	if success {
		stats.SuccessfulInvalidations++
	} else {
		stats.FailedInvalidations++
		if err != nil {
			errorMsg := err.Error()
			if len(stats.Errors) < 100 { // Keep last 100 errors
				stats.Errors = append(stats.Errors, errorMsg)
			}
		}
	}

	// Update average time
	totalTime := stats.AvgInvalidationTime * time.Duration(stats.TotalInvalidations-1)
	stats.AvgInvalidationTime = (totalTime + duration) / time.Duration(stats.TotalInvalidations)
}

// initializeStrategies sets up all invalidation strategies
func (s *CacheInvalidationService) initializeStrategies() {
	s.strategies["data_change"] = NewDataChangeInvalidator(s.cache)
	s.strategies["time_based"] = NewTimeBasedInvalidator(s.cache)
	s.strategies["policy"] = NewPolicyBasedInvalidator(s.cache)
	s.strategies["manual"] = NewManualInvalidator(s.cache)
}

// ProcessInvalidation processes an invalidation event using appropriate strategies
func (s *CacheInvalidationService) ProcessInvalidation(ctx context.Context, event *InvalidationEvent) error {
	start := time.Now()

	// Evaluate custom rules
	actions := s.rules.Evaluate(event)
	for _, action := range actions {
		if strings.HasPrefix(action, "clear:") {
			pattern := strings.TrimPrefix(action, "clear:")
			if err := s.cache.Clear(ctx, pattern); err != nil {
				return fmt.Errorf("failed to execute rule action: %w", err)
			}
		}
	}

	// Find and execute strategy
	strategy, exists := s.strategies[event.Type]
	if !exists {
		return fmt.Errorf("unknown invalidation strategy: %s", event.Type)
	}

	err := strategy.Invalidate(ctx, event)

	// Record metrics
	s.monitor.RecordInvalidation(strategy.GetName(), time.Since(start), err == nil, err)

	return err
}

// InvalidateManual triggers manual cache invalidation
func (s *CacheInvalidationService) InvalidateManual(ctx context.Context, pattern, reason, initiator string) error {
	event := &InvalidationEvent{
		ID:        generateID(),
		Type:      "manual",
		Source:    "manual_request",
		Pattern:   pattern,
		Reason:    reason,
		Timestamp: time.Now(),
		Initiator: initiator,
		Priority:  10, // Low priority
	}

	return s.ProcessInvalidation(ctx, event)
}

// InvalidateByDataType invalidates all cache entries for a data type
func (s *CacheInvalidationService) InvalidateByDataType(ctx context.Context, dataType, entityID string, recursive bool) error {
	event := &InvalidationEvent{
		ID:        generateID(),
		Type:      "data_change",
		Source:    "data_change",
		DataType:  dataType,
		EntityID:  entityID,
		Recursive: recursive,
		Reason:    fmt.Sprintf("Data change for %s:%s", dataType, entityID),
		Timestamp: time.Now(),
		Initiator: "system",
		Priority:  1, // High priority
	}

	return s.ProcessInvalidation(ctx, event)
}

// Start starts the invalidation service
func (s *CacheInvalidationService) Start(ctx context.Context) error {
	// Start time-based invalidator
	if timeBased, exists := s.strategies["time_based"]; exists {
		if tb, ok := timeBased.(*TimeBasedInvalidator); ok {
			tb.Start(ctx)
		}
	}

	// Start watchers
	for _, watcher := range s.watchers {
		if err := watcher.Watch(ctx); err != nil {
			return fmt.Errorf("failed to start watcher %s: %w", watcher.GetName(), err)
		}
	}

	return nil
}

// Stop stops the invalidation service
func (s *CacheInvalidationService) Stop() error {
	var errors []error

	// Stop watchers
	for _, watcher := range s.watchers {
		if err := watcher.Stop(); err != nil {
			errors = append(errors, fmt.Errorf("failed to stop watcher %s: %w", watcher.GetName(), err))
		}
	}

	if len(errors) > 0 {
		return fmt.Errorf("multiple errors occurred: %v", errors)
	}

	return nil
}
