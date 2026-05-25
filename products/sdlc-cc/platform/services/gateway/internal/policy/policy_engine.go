package policy

import (
	"context"
	"fmt"
	"sync"
	"time"
)

// PolicyEngine provides the main policy evaluation interface
type PolicyEngine struct {
	opaClient     OPAClient
	bundleManager *BundleManager
	cache         *DecisionCache
	metrics       *PolicyMetricsCollector
	logger        Logger
	config        EngineConfig

	// Hot reload management
	reloadChan    chan PolicyBundle
	reloadWorkers int

	// Policy conflict detection
	conflictDetector *ConflictDetector

	mu sync.RWMutex
}

// EngineConfig represents policy engine configuration
type EngineConfig struct {
	OPAConfig         OPAConfig     `json:"opa_config"`
	BundleConfig      BundleConfig  `json:"bundle_config"`
	CacheEnabled      bool          `json:"cache_enabled"`
	CacheSize         int           `json:"cache_size"`
	CacheTTL          time.Duration `json:"cache_ttl"`
	HotReloadEnabled  bool          `json:"hot_reload_enabled"`
	ReloadWorkers     int           `json:"reload_workers"`
	ConflictDetection bool          `json:"conflict_detection"`
	MetricsEnabled    bool          `json:"metrics_enabled"`
}

// DefaultEngineConfig returns default engine configuration
func DefaultEngineConfig() EngineConfig {
	return EngineConfig{
		OPAConfig:         DefaultOPAConfig(),
		BundleConfig:      BundleConfig{},
		CacheEnabled:      true,
		CacheSize:         10000,
		CacheTTL:          5 * time.Minute,
		HotReloadEnabled:  true,
		ReloadWorkers:     3,
		ConflictDetection: true,
		MetricsEnabled:    true,
	}
}

// NewPolicyEngine creates a new policy engine
func NewPolicyEngine(config EngineConfig, logger Logger) (*PolicyEngine, error) {
	// Several call sites pass nil; the engine spawns hot-reload workers
	// that immediately call logger.Info, so a nil here panics on boot.
	// Substitute a no-op logger when none is provided.
	if logger == nil {
		logger = noopLogger{}
	}
	engine := &PolicyEngine{
		config:        config,
		logger:        logger,
		reloadChan:    make(chan PolicyBundle, 100),
		reloadWorkers: config.ReloadWorkers,
	}

	// Initialize OPA client
	engine.opaClient = NewOPAClient(config.OPAConfig, logger)

	// Initialize cache
	if config.CacheEnabled {
		engine.cache = NewDecisionCache(config.CacheSize, config.CacheTTL)
	}

	// Initialize metrics
	if config.MetricsEnabled {
		engine.metrics = NewPolicyMetricsCollector()
	}

	// Initialize bundle manager
	storage := NewMemoryBundleStorage(logger)
	signer := NewHMACSigner(config.BundleConfig.SigningKey, logger)
	engine.bundleManager = NewBundleManager(config.BundleConfig, logger, storage, signer)

	// Initialize conflict detector
	if config.ConflictDetection {
		engine.conflictDetector = NewConflictDetector(logger)
	}

	// Start hot reload workers
	if config.HotReloadEnabled {
		engine.startHotReloadWorkers()
	}

	engine.logger.Info("Policy engine initialized", map[string]interface{}{
		"cache_enabled":      config.CacheEnabled,
		"hot_reload_enabled": config.HotReloadEnabled,
		"conflict_detection": config.ConflictDetection,
		"metrics_enabled":    config.MetricsEnabled,
	})

	return engine, nil
}

// EvaluatePolicy evaluates a policy request
func (pe *PolicyEngine) EvaluatePolicy(ctx context.Context, input PolicyInput) (*PolicyDecision, error) {
	startTime := time.Now()

	pe.logger.Debug("Evaluating policy", map[string]interface{}{
		"tenant_id": input.TenantID,
		"user_id":   input.UserID,
		"action":    input.Action,
		"resource":  input.Resource,
	})

	// Record evaluation
	if pe.metrics != nil {
		pe.metrics.RecordEvaluation()
	}

	var decision *PolicyDecision
	var err error

	// Check cache first
	if pe.cache != nil {
		if cached, found := pe.cache.Get(input.CacheKey()); found {
			pe.logger.Debug("Policy decision from cache", map[string]interface{}{
				"tenant_id": input.TenantID,
				"decision":  cached.Allowed,
			})

			if pe.metrics != nil {
				pe.metrics.RecordCacheHit()
			}

			return cached, nil
		}
	}

	// Evaluate with OPA
	decision, err = pe.opaClient.EvaluatePolicy(ctx, input)
	if err != nil {
		if pe.metrics != nil {
			pe.metrics.RecordError()
		}
		return nil, fmt.Errorf("policy evaluation failed: %w", err)
	}

	// Cache result
	if pe.cache != nil {
		pe.cache.Set(input.CacheKey(), decision, pe.config.CacheTTL)
	}

	// Record latency
	if pe.metrics != nil {
		pe.metrics.RecordLatency(int(time.Since(startTime).Milliseconds()))
	}

	pe.logger.Debug("Policy evaluation completed", map[string]interface{}{
		"tenant_id":   input.TenantID,
		"user_id":     input.UserID,
		"action":      input.Action,
		"decision":    decision.Allowed,
		"duration_ms": time.Since(startTime).Milliseconds(),
	})

	return decision, nil
}

// LoadPolicyBundle loads a policy bundle
func (pe *PolicyEngine) LoadPolicyBundle(ctx context.Context, bundle *PolicyBundle) error {
	pe.logger.Info("Loading policy bundle", map[string]interface{}{
		"name":    bundle.Name,
		"version": bundle.Version,
	})

	// Check for conflicts
	if pe.conflictDetector != nil {
		conflicts, err := pe.conflictDetector.DetectConflicts(ctx, bundle)
		if err != nil {
			return fmt.Errorf("conflict detection failed: %w", err)
		}

		if len(conflicts) > 0 {
			pe.logger.Warn("Policy conflicts detected", map[string]interface{}{
				"bundle":    bundle.Name,
				"conflicts": len(conflicts),
			})

			// TODO: Handle conflicts based on configuration
			// Options: reject, warn, auto-resolve
		}
	}

	// Load bundle via OPA client
	if err := pe.opaClient.LoadPolicy(ctx, *bundle); err != nil {
		return fmt.Errorf("failed to load bundle in OPA: %w", err)
	}

	// Store bundle
	if err := pe.bundleManager.storage.SaveBundle(ctx, bundle); err != nil {
		return fmt.Errorf("failed to store bundle: %w", err)
	}

	pe.logger.Info("Policy bundle loaded successfully", map[string]interface{}{
		"name":    bundle.Name,
		"version": bundle.Version,
	})

	return nil
}

// TestPolicyBundle tests a policy bundle
func (pe *PolicyEngine) TestPolicyBundle(ctx context.Context, bundle *PolicyBundle, testCases []TestCase) ([]TestResult, error) {
	pe.logger.Info("Testing policy bundle", map[string]interface{}{
		"name":       bundle.Name,
		"version":    bundle.Version,
		"test_cases": len(testCases),
	})

	return pe.opaClient.TestPolicy(ctx, *bundle, testCases)
}

// GetMetrics returns policy engine metrics
func (pe *PolicyEngine) GetMetrics(ctx context.Context) EngineMetrics {
	metrics := EngineMetrics{
		OPAMetrics:    pe.opaClient.GetPolicyMetrics(ctx),
		BundleMetrics: pe.bundleManager.GetBundleMetrics(),
		LastUpdated:   time.Now(),
	}

	if pe.metrics != nil {
		metrics.CustomMetrics = pe.metrics.GetMetrics()
	}

	if pe.cache != nil {
		metrics.CacheStats = pe.cache.Stats()
	}

	return metrics
}

// Health checks the health of the policy engine
func (pe *PolicyEngine) Health(ctx context.Context) error {
	// Check OPA health
	if err := pe.opaClient.Health(ctx); err != nil {
		return fmt.Errorf("OPA health check failed: %w", err)
	}

	// TODO: Add more health checks
	// - Bundle storage health
	// - Cache health
	// - Hot reload workers health

	return nil
}

// InvalidateCache invalidates the policy decision cache
func (pe *PolicyEngine) InvalidateCache(pattern string) {
	if pe.cache != nil {
		pe.cache.InvalidatePattern(pattern)
		pe.logger.Info("Cache invalidated", map[string]interface{}{
			"pattern": pattern,
		})
	}
}

// GetPolicyBundle returns a specific policy bundle
func (pe *PolicyEngine) GetPolicyBundle(ctx context.Context, name, version string) (*PolicyBundle, error) {
	return pe.bundleManager.storage.LoadBundle(ctx, name, version)
}

// ListPolicyBundles returns all available policy bundles
func (pe *PolicyEngine) ListPolicyBundles(ctx context.Context) ([]*PolicyBundle, error) {
	return pe.bundleManager.ListBundles(ctx)
}

// DeletePolicyBundle deletes a policy bundle
func (pe *PolicyEngine) DeletePolicyBundle(ctx context.Context, name, version string) error {
	pe.logger.Info("Deleting policy bundle", map[string]interface{}{
		"name":    name,
		"version": version,
	})

	if err := pe.bundleManager.DeleteBundle(ctx, name, version); err != nil {
		return fmt.Errorf("failed to delete bundle: %w", err)
	}

	// Invalidate cache for this bundle
	pe.InvalidateCache(fmt.Sprintf("bundle:%s", name))

	return nil
}

// startHotReloadWorkers starts workers for handling hot reload
func (pe *PolicyEngine) startHotReloadWorkers() {
	for i := 0; i < pe.reloadWorkers; i++ {
		go pe.hotReloadWorker(i)
	}
}

// hotReloadWorker handles policy bundle hot reload
func (pe *PolicyEngine) hotReloadWorker(workerID int) {
	pe.logger.Info("Hot reload worker started", map[string]interface{}{
		"worker_id": workerID,
	})

	for bundle := range pe.reloadChan {
		ctx := context.Background()

		if err := pe.LoadPolicyBundle(ctx, &bundle); err != nil {
			pe.logger.Error("Hot reload failed", map[string]interface{}{
				"worker_id": workerID,
				"bundle":    bundle.Name,
				"version":   bundle.Version,
				"error":     err.Error(),
			})
			continue
		}

		pe.logger.Info("Hot reload completed", map[string]interface{}{
			"worker_id": workerID,
			"bundle":    bundle.Name,
			"version":   bundle.Version,
		})
	}
}

// Shutdown gracefully shuts down the policy engine
func (pe *PolicyEngine) Shutdown(ctx context.Context) error {
	pe.logger.Info("Shutting down policy engine", nil)

	// Close reload channel
	close(pe.reloadChan)

	// TODO: Add more shutdown logic
	// - Wait for workers to finish
	// - Close OPA client connections
	// - Persist metrics

	pe.logger.Info("Policy engine shutdown completed", nil)
	return nil
}

// EngineMetrics represents comprehensive engine metrics
type EngineMetrics struct {
	OPAMetrics    PolicyMetrics `json:"opa_metrics"`
	BundleMetrics BundleMetrics `json:"bundle_metrics"`
	CustomMetrics PolicyMetrics `json:"custom_metrics,omitempty"`
	CacheStats    CacheStats    `json:"cache_stats,omitempty"`
	LastUpdated   time.Time     `json:"last_updated"`
}
