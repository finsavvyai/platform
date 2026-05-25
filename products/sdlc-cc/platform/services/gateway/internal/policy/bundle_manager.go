package policy

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

// BundleManager manages OPA policy bundles
type BundleManager struct {
	config       BundleConfig
	httpClient   *http.Client
	logger       Logger
	storage      BundleStorage
	signer       BundleSigner
	versionCache map[string]string
	mu           sync.RWMutex
}

// BundleConfig represents bundle manager configuration
type BundleConfig struct {
	BundleURL         string        `json:"bundle_url"`
	LocalBundleDir    string        `json:"local_bundle_dir"`
	RemoteURL         string        `json:"remote_url"`
	SigningKey        string        `json:"signing_key"`
	PollingInterval   time.Duration `json:"polling_interval"`
	HotReloadEnabled  bool          `json:"hot_reload_enabled"`
	BundleVersion     string        `json:"bundle_version"`
	MaxBundleSize     int64         `json:"max_bundle_size"`
	SignatureRequired bool          `json:"signature_required"`
}

// BundleStorage interface for storing bundles
type BundleStorage interface {
	SaveBundle(ctx context.Context, bundle *PolicyBundle) error
	LoadBundle(ctx context.Context, name, version string) (*PolicyBundle, error)
	DeleteBundle(ctx context.Context, name, version string) error
	ListBundles(ctx context.Context) ([]*PolicyBundle, error)
}

// BundleSigner interface for signing bundles
type BundleSigner interface {
	SignBundle(bundle *PolicyBundle) ([]string, error)
	VerifyBundle(bundle *PolicyBundle) error
}

// NewBundleManager creates a new bundle manager
func NewBundleManager(config BundleConfig, logger Logger, storage BundleStorage, signer BundleSigner) *BundleManager {
	return &BundleManager{
		config:       config,
		httpClient:   &http.Client{Timeout: 30 * time.Second},
		logger:       logger,
		storage:      storage,
		signer:       signer,
		versionCache: make(map[string]string),
	}
}

// LoadBundleFromURL loads a bundle from a URL
func (bm *BundleManager) LoadBundleFromURL(ctx context.Context, bundleURL string) (*PolicyBundle, error) {
	bm.logger.Info("Loading bundle from URL", map[string]interface{}{
		"url": bundleURL,
	})

	// Download bundle
	resp, err := bm.httpClient.Get(bundleURL)
	if err != nil {
		return nil, fmt.Errorf("failed to download bundle: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("bundle download failed with status %d", resp.StatusCode)
	}

	// Check size limit
	if resp.ContentLength > bm.config.MaxBundleSize {
		return nil, fmt.Errorf("bundle too large: %d bytes (max: %d)", resp.ContentLength, bm.config.MaxBundleSize)
	}

	// Read bundle data
	data, err := io.ReadAll(io.LimitReader(resp.Body, bm.config.MaxBundleSize))
	if err != nil {
		return nil, fmt.Errorf("failed to read bundle data: %w", err)
	}

	// Parse bundle
	var bundle PolicyBundle
	if err := json.Unmarshal(data, &bundle); err != nil {
		return nil, fmt.Errorf("failed to parse bundle: %w", err)
	}

	// Verify bundle
	if err := bm.VerifyBundle(ctx, &bundle); err != nil {
		return nil, fmt.Errorf("bundle verification failed: %w", err)
	}

	// Cache version
	bm.mu.Lock()
	bm.versionCache[bundle.Name] = bundle.Version
	bm.mu.Unlock()

	return &bundle, nil
}

// LoadBundleFromFile loads a bundle from a local file. The path must resolve
// inside the configured LocalBundleDir to prevent directory traversal.
func (bm *BundleManager) LoadBundleFromFile(ctx context.Context, filePath string) (*PolicyBundle, error) {
	bm.logger.Info("Loading bundle from file", map[string]interface{}{
		"file": filePath,
	})

	cleaned := filepath.Clean(filePath)
	if bm.config.LocalBundleDir != "" {
		base, err := filepath.Abs(filepath.Clean(bm.config.LocalBundleDir))
		if err != nil {
			return nil, fmt.Errorf("invalid local bundle dir: %w", err)
		}
		abs, err := filepath.Abs(cleaned)
		if err != nil {
			return nil, fmt.Errorf("invalid bundle path: %w", err)
		}
		// Ensure the cleaned absolute path is within the configured base dir.
		if !strings.HasPrefix(abs+string(filepath.Separator), base+string(filepath.Separator)) && abs != base {
			return nil, fmt.Errorf("bundle path escapes allowed directory")
		}
		cleaned = abs
	}

	// #nosec G304 -- path validated against configured LocalBundleDir above
	data, err := os.ReadFile(cleaned)
	if err != nil {
		return nil, fmt.Errorf("failed to read bundle file: %w", err)
	}

	// Check size limit
	if int64(len(data)) > bm.config.MaxBundleSize {
		return nil, fmt.Errorf("bundle too large: %d bytes (max: %d)", len(data), bm.config.MaxBundleSize)
	}

	// Parse bundle
	var bundle PolicyBundle
	if err := json.Unmarshal(data, &bundle); err != nil {
		return nil, fmt.Errorf("failed to parse bundle: %w", err)
	}

	// Verify bundle
	if err := bm.VerifyBundle(ctx, &bundle); err != nil {
		return nil, fmt.Errorf("bundle verification failed: %w", err)
	}

	return &bundle, nil
}

// CreateBundle creates a new policy bundle
func (bm *BundleManager) CreateBundle(ctx context.Context, name string, policies map[string]string, data map[string]string) (*PolicyBundle, error) {
	bm.logger.Info("Creating policy bundle", map[string]interface{}{
		"name":       name,
		"policies":   len(policies),
		"data_files": len(data),
	})

	// Create bundle
	bundle := &PolicyBundle{
		Name:      name,
		Version:   bm.generateVersion(),
		Policies:  policies,
		Data:      data,
		Metadata:  make(map[string]string),
		CreatedAt: time.Now(),
	}

	// Add metadata
	bundle.Metadata["created_by"] = "bundle_manager"
	bundle.Metadata["created_at"] = bundle.CreatedAt.Format(time.RFC3339)
	bundle.Metadata["policy_count"] = fmt.Sprintf("%d", len(policies))

	// Sign bundle
	if bm.config.SignatureRequired || bm.signer != nil {
		signatures, err := bm.signer.SignBundle(bundle)
		if err != nil {
			return nil, fmt.Errorf("failed to sign bundle: %w", err)
		}
		bundle.Signatures = signatures
	}

	// Save bundle
	if err := bm.storage.SaveBundle(ctx, bundle); err != nil {
		return nil, fmt.Errorf("failed to save bundle: %w", err)
	}

	// Cache version
	bm.mu.Lock()
	bm.versionCache[name] = bundle.Version
	bm.mu.Unlock()

	return bundle, nil
}

// VerifyBundle verifies a bundle's signature and integrity
func (bm *BundleManager) VerifyBundle(ctx context.Context, bundle *PolicyBundle) error {
	// Check required fields
	if bundle.Name == "" {
		return fmt.Errorf("bundle name is required")
	}
	if bundle.Version == "" {
		return fmt.Errorf("bundle version is required")
	}
	if len(bundle.Policies) == 0 {
		return fmt.Errorf("bundle must contain at least one policy")
	}

	// Verify signatures if required
	if bm.config.SignatureRequired {
		if len(bundle.Signatures) == 0 {
			return fmt.Errorf("bundle signature is required")
		}
		if bm.signer != nil {
			if err := bm.signer.VerifyBundle(bundle); err != nil {
				return fmt.Errorf("bundle signature verification failed: %w", err)
			}
		}
	}

	// Verify policy syntax
	for name, policy := range bundle.Policies {
		if err := bm.verifyRegoSyntax(policy); err != nil {
			return fmt.Errorf("policy %s has invalid syntax: %w", name, err)
		}
	}

	return nil
}

// verifyRegoSyntax performs basic Rego syntax verification
func (bm *BundleManager) verifyRegoSyntax(policy string) error {
	// TODO: Implement proper Rego syntax checking
	// This could use OPA's parsing capabilities or a Rego linter

	// Basic checks for now
	if !strings.Contains(policy, "package") {
		return fmt.Errorf("policy must contain a package declaration")
	}

	return nil
}

// UpdateBundle updates an existing bundle
func (bm *BundleManager) UpdateBundle(ctx context.Context, name string, policies map[string]string, data map[string]string) (*PolicyBundle, error) {
	bm.logger.Info("Updating policy bundle", map[string]interface{}{
		"name":       name,
		"policies":   len(policies),
		"data_files": len(data),
	})

	// Get current version
	bm.mu.RLock()
	currentVersion := bm.versionCache[name]
	bm.mu.RUnlock()

	// Load current bundle
	var currentBundle *PolicyBundle
	if currentVersion != "" {
		var err error
		currentBundle, err = bm.storage.LoadBundle(ctx, name, currentVersion)
		if err != nil {
			bm.logger.Warn("Failed to load current bundle", map[string]interface{}{
				"name":    name,
				"version": currentVersion,
				"error":   err.Error(),
			})
		}
	}

	// Create new bundle
	bundle := &PolicyBundle{
		Name:      name,
		Version:   bm.generateVersion(),
		Policies:  policies,
		Data:      data,
		Metadata:  make(map[string]string),
		CreatedAt: time.Now(),
	}

	// Add metadata
	bundle.Metadata["created_by"] = "bundle_manager"
	bundle.Metadata["created_at"] = bundle.CreatedAt.Format(time.RFC3339)
	bundle.Metadata["policy_count"] = fmt.Sprintf("%d", len(policies))

	if currentBundle != nil {
		bundle.Metadata["previous_version"] = currentBundle.Version
		bundle.Metadata["updated_from"] = currentBundle.Metadata["created_at"]
	}

	// Sign bundle
	if bm.config.SignatureRequired || bm.signer != nil {
		signatures, err := bm.signer.SignBundle(bundle)
		if err != nil {
			return nil, fmt.Errorf("failed to sign bundle: %w", err)
		}
		bundle.Signatures = signatures
	}

	// Save bundle
	if err := bm.storage.SaveBundle(ctx, bundle); err != nil {
		return nil, fmt.Errorf("failed to save bundle: %w", err)
	}

	// Cache version
	bm.mu.Lock()
	bm.versionCache[name] = bundle.Version
	bm.mu.Unlock()

	return bundle, nil
}

// DeleteBundle deletes a bundle
func (bm *BundleManager) DeleteBundle(ctx context.Context, name, version string) error {
	bm.logger.Info("Deleting bundle", map[string]interface{}{
		"name":    name,
		"version": version,
	})

	if err := bm.storage.DeleteBundle(ctx, name, version); err != nil {
		return fmt.Errorf("failed to delete bundle: %w", err)
	}

	// Remove from cache
	bm.mu.Lock()
	if cachedVersion, exists := bm.versionCache[name]; exists && cachedVersion == version {
		delete(bm.versionCache, name)
	}
	bm.mu.Unlock()

	return nil
}

// ListBundles lists all available bundles
func (bm *BundleManager) ListBundles(ctx context.Context) ([]*PolicyBundle, error) {
	return bm.storage.ListBundles(ctx)
}

// GetBundleVersion returns the cached version for a bundle name
func (bm *BundleManager) GetBundleVersion(name string) (string, bool) {
	bm.mu.RLock()
	defer bm.mu.RUnlock()

	version, exists := bm.versionCache[name]
	return version, exists
}

// StartHotReload starts the hot reload process
func (bm *BundleManager) StartHotReload(ctx context.Context) error {
	if !bm.config.HotReloadEnabled {
		bm.logger.Info("Hot reload is disabled", nil)
		return nil
	}

	bm.logger.Info("Starting hot reload", map[string]interface{}{
		"interval": bm.config.PollingInterval,
		"url":      bm.config.RemoteURL,
	})

	ticker := time.NewTicker(bm.config.PollingInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-ticker.C:
			if err := bm.checkForUpdates(ctx); err != nil {
				bm.logger.Error("Hot reload check failed", map[string]interface{}{
					"error": err.Error(),
				})
			}
		}
	}
}

// checkForUpdates checks for bundle updates
func (bm *BundleManager) checkForUpdates(ctx context.Context) error {
	// TODO: Implement update checking logic
	// This would:
	// 1. Check remote URL for new bundle versions
	// 2. Compare with cached versions
	// 3. Download and verify new bundles
	// 4. Trigger policy reload in OPA

	return nil
}

// generateVersion generates a new bundle version
func (bm *BundleManager) generateVersion() string {
	timestamp := time.Now().Unix()
	hash := sha256.Sum256([]byte(fmt.Sprintf("%d-%d", timestamp, time.Now().Nanosecond())))
	return hex.EncodeToString(hash[:])[:8]
}

// GetBundleMetrics returns bundle manager metrics
func (bm *BundleManager) GetBundleMetrics() BundleMetrics {
	bm.mu.RLock()
	defer bm.mu.RUnlock()

	return BundleMetrics{
		CachedBundles:   len(bm.versionCache),
		LastCheck:       time.Now(), // TODO: Track last check time
		TotalDownloads:  0,          // TODO: Track download count
		FailedDownloads: 0,          // TODO: Track failed downloads
	}
}

// BundleMetrics represents bundle manager metrics
type BundleMetrics struct {
	CachedBundles   int       `json:"cached_bundles"`
	LastCheck       time.Time `json:"last_check"`
	TotalDownloads  int       `json:"total_downloads"`
	FailedDownloads int       `json:"failed_downloads"`
}
