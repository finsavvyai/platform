package bundler

import (
	"archive/tar"
	"bytes"
	"compress/gzip"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/sirupsen/logrus"

	"github.com/sdlc-ai/platform/services/opa/internal/storage"
)

// BundleManager handles policy bundle creation and deployment
type BundleManager struct {
	storage    storage.BundleStorage
	opaURL     string
	logger     *logrus.Logger
	httpClient *http.Client

	// Hot-reload state
	currentBundle   *Bundle
	bundleLock      sync.RWMutex
	reloadChan      chan struct{}
	watchers        []BundleWatcher
	watchersLock    sync.RWMutex
	pollingInterval time.Duration
	lastBundleHash  string
}

// Bundle represents a policy bundle
type Bundle struct {
	ID          uuid.UUID              `json:"id"`
	Name        string                 `json:"name"`
	Description string                 `json:"description"`
	Policies    []BundlePolicy         `json:"policies"`
	Data        map[string]interface{} `json:"data"`
	CreatedAt   time.Time              `json:"created_at"`
	UpdatedAt   time.Time              `json:"updated_at"`
	Version     int                    `json:"version"`
	Checksum    string                 `json:"checksum"`
	Active      bool                   `json:"active"`
	TenantID    string                 `json:"tenant_id"`
	CreatedBy   string                 `json:"created_by"`
}

// BundlePolicy represents a policy in a bundle
type BundlePolicy struct {
	ID         string    `json:"id"`
	Path       string    `json:"path"`
	Content    string    `json:"content"`
	Type       string    `json:"type"`
	Priority   int       `json:"priority"`
	Required   bool      `json:"required"`
	Checksum   string    `json:"checksum"`
	ModifiedAt time.Time `json:"modified_at"`
}

// BundleWatcher interface for monitoring bundle changes
type BundleWatcher interface {
	OnBundleChanged(bundle *Bundle) error
	OnBundleDeployed(bundle *Bundle) error
	OnBundleError(bundleID string, err error) error
}

// BundleChange represents a change in policies
type BundleChange struct {
	Type       string    `json:"type"` // created, updated, deleted
	PolicyID   string    `json:"policy_id"`
	PolicyPath string    `json:"policy_path"`
	OldContent *string   `json:"old_content,omitempty"`
	NewContent *string   `json:"new_content,omitempty"`
	Timestamp  time.Time `json:"timestamp"`
	UserID     string    `json:"user_id"`
}

// NewBundleManager creates a new bundle manager
func NewBundleManager(storage storage.BundleStorage, opaURL string, logger *logrus.Logger) *BundleManager {
	return &BundleManager{
		storage:         storage,
		opaURL:          opaURL,
		logger:          logger,
		httpClient:      &http.Client{Timeout: 30 * time.Second},
		reloadChan:      make(chan struct{}, 1),
		pollingInterval: 5 * time.Second,
	}
}

// CreateBundle creates a new policy bundle
func (bm *BundleManager) CreateBundle(ctx context.Context, req *CreateBundleRequest) (*Bundle, error) {
	bm.logger.WithFields(logrus.Fields{
		"name":      req.Name,
		"tenant_id": req.TenantID,
	}).Info("Creating policy bundle")

	// Load policies from storage
	policies, err := bm.loadPolicies(ctx, req.PolicyIDs)
	if err != nil {
		return nil, fmt.Errorf("failed to load policies: %w", err)
	}

	// Generate bundle data
	bundleData, err := bm.generateBundleData(policies)
	if err != nil {
		return nil, fmt.Errorf("failed to generate bundle data: %w", err)
	}

	// Calculate checksum
	checksum := bm.calculateChecksum(bundleData)

	// Create bundle
	bundle := &Bundle{
		ID:          uuid.New(),
		Name:        req.Name,
		Description: req.Description,
		Policies:    policies,
		Data:        bundleData,
		CreatedAt:   time.Now().UTC(),
		UpdatedAt:   time.Now().UTC(),
		Version:     1,
		Checksum:    checksum,
		Active:      false,
		TenantID:    req.TenantID,
		CreatedBy:   req.CreatedBy,
	}

	// Save bundle to storage
	if err := bm.storage.SaveBundle(ctx, bundle); err != nil {
		return nil, fmt.Errorf("failed to save bundle: %w", err)
	}

	bm.logger.WithFields(logrus.Fields{
		"bundle_id": bundle.ID,
		"name":      bundle.Name,
		"version":   bundle.Version,
	}).Info("Policy bundle created successfully")

	return bundle, nil
}

// DeployBundle deploys a bundle to OPA with hot-reload
func (bm *BundleManager) DeployBundle(ctx context.Context, bundleID string) error {
	bm.logger.WithField("bundle_id", bundleID).Info("Deploying policy bundle")

	// Load bundle
	bundle, err := bm.storage.GetBundle(ctx, bundleID)
	if err != nil {
		return fmt.Errorf("failed to load bundle: %w", err)
	}

	// Create bundle archive
	archiveData, err := bm.createBundleArchive(bundle)
	if err != nil {
		return fmt.Errorf("failed to create bundle archive: %w", err)
	}

	// Deploy to bundle server
	if err := bm.deployToBundleServer(ctx, bundle, archiveData); err != nil {
		return fmt.Errorf("failed to deploy to bundle server: %w", err)
	}

	// Trigger OPA reload
	if err := bm.triggerOPAReload(ctx); err != nil {
		bm.logger.WithError(err).Warn("Failed to trigger OPA reload")
		// Don't fail deployment if reload fails
	}

	// Update bundle status
	bundle.Active = true
	bundle.UpdatedAt = time.Now().UTC()

	if err := bm.storage.UpdateBundle(ctx, bundle); err != nil {
		bm.logger.WithError(err).Warn("Failed to update bundle status")
	}

	// Update current bundle
	bm.bundleLock.Lock()
	bm.currentBundle = bundle
	bm.lastBundleHash = bundle.Checksum
	bm.bundleLock.Unlock()

	// Notify watchers
	bm.notifyWatchers(func(w BundleWatcher) error {
		return w.OnBundleDeployed(bundle)
	})

	// Signal reload
	select {
	case bm.reloadChan <- struct{}{}:
	default:
		// Channel already has a pending signal
	}

	bm.logger.WithFields(logrus.Fields{
		"bundle_id": bundle.ID,
		"name":      bundle.Name,
		"version":   bundle.Version,
	}).Info("Policy bundle deployed successfully")

	return nil
}

// StartBundleMonitoring starts monitoring for bundle changes
func (bm *BundleManager) StartBundleMonitoring() {
	bm.logger.Info("Starting bundle monitoring")

	ticker := time.NewTicker(bm.pollingInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			bm.checkForBundleChanges()
		case <-bm.reloadChan:
			bm.handleBundleReload()
		}
	}
}

// AddWatcher adds a bundle watcher
func (bm *BundleManager) AddWatcher(watcher BundleWatcher) {
	bm.watchersLock.Lock()
	defer bm.watchersLock.Unlock()
	bm.watchers = append(bm.watchers, watcher)
}

// RemoveWatcher removes a bundle watcher
func (bm *BundleManager) RemoveWatcher(watcher BundleWatcher) {
	bm.watchersLock.Lock()
	defer bm.watchersLock.Unlock()

	for i, w := range bm.watchers {
		if w == watcher {
			bm.watchers = append(bm.watchers[:i], bm.watchers[i+1:]...)
			break
		}
	}
}

// TriggerReload triggers an immediate bundle reload
func (bm *BundleManager) TriggerReload() {
	select {
	case bm.reloadChan <- struct{}{}:
	default:
		// Channel already has a pending signal
	}
}

// ListBundles lists all bundles
func (bm *BundleManager) ListBundles(ctx context.Context) ([]*Bundle, error) {
	return bm.storage.ListBundles(ctx)
}

// GetBundle retrieves a specific bundle
func (bm *BundleManager) GetBundle(ctx context.Context, bundleID string) (*Bundle, error) {
	return bm.storage.GetBundle(ctx, bundleID)
}

// DeleteBundle deletes a bundle
func (bm *BundleManager) DeleteBundle(ctx context.Context, bundleID string) error {
	// Check if bundle is currently active
	bm.bundleLock.RLock()
	currentActive := bm.currentBundle != nil && bm.currentBundle.ID.String() == bundleID
	bm.bundleLock.RUnlock()

	if currentActive {
		return fmt.Errorf("cannot delete currently active bundle")
	}

	return bm.storage.DeleteBundle(ctx, bundleID)
}

// GetActiveBundle returns the currently active bundle
func (bm *BundleManager) GetActiveBundle() *Bundle {
	bm.bundleLock.RLock()
	defer bm.bundleLock.RUnlock()
	return bm.currentBundle
}

// Private methods

func (bm *BundleManager) loadPolicies(ctx context.Context, policyIDs []string) ([]BundlePolicy, error) {
	var policies []BundlePolicy

	for _, policyID := range policyIDs {
		policy, err := bm.storage.GetPolicy(ctx, policyID)
		if err != nil {
			return nil, fmt.Errorf("failed to load policy %s: %w", policyID, err)
		}

		bundlePolicy := BundlePolicy{
			ID:         policy.ID,
			Path:       policy.Path,
			Content:    policy.Content,
			Type:       policy.Type,
			Priority:   policy.Priority,
			Required:   policy.Required,
			ModifiedAt: policy.ModifiedAt,
		}

		// Calculate policy checksum
		bundlePolicy.Checksum = bm.calculatePolicyChecksum(bundlePolicy.Content)

		policies = append(policies, bundlePolicy)
	}

	return policies, nil
}

func (bm *BundleManager) generateBundleData(policies []BundlePolicy) (map[string]interface{}, error) {
	data := make(map[string]interface{})

	// Add manifest
	manifest := map[string]interface{}{
		"revision": time.Now().Unix(),
		"roots":    []string{"sdlc"}, // Root packages
		"metadata": map[string]interface{}{
			"created_at": time.Now().UTC().Format(time.RFC3339),
			"version":    "1.0",
		},
	}

	data["manifest.json"] = manifest

	// Add policies
	for _, policy := range policies {
		// Ensure path has .rego extension
		path := policy.Path
		if !strings.HasSuffix(path, ".rego") {
			path = path + ".rego"
		}

		data[path] = policy.Content
	}

	// Add data files if any
	dataFiles, err := bm.loadDataFiles()
	if err != nil {
		bm.logger.WithError(err).Warn("Failed to load data files")
	} else {
		for name, content := range dataFiles {
			data["data/"+name] = content
		}
	}

	return data, nil
}

func (bm *BundleManager) loadDataFiles() (map[string]string, error) {
	dataFiles := make(map[string]string)

	// Load data files from policies directory
	policiesDir := "policies"
	if _, err := os.Stat(policiesDir); err == nil {
		err := filepath.Walk(policiesDir, func(path string, info os.FileInfo, err error) error {
			if err != nil {
				return err
			}

			if info.IsDir() && filepath.Base(path) == "data" {
				return filepath.Walk(path, func(dataPath string, dataInfo os.FileInfo, err error) error {
					if err != nil {
						return err
					}

					if !dataInfo.IsDir() && strings.HasSuffix(dataPath, ".json") {
						content, err := os.ReadFile(dataPath)
						if err != nil {
							bm.logger.WithError(err).Warnf("Failed to read data file: %s", dataPath)
							return nil
						}

						relPath, _ := filepath.Rel(path, dataPath)
						dataFiles[relPath] = string(content)
					}

					return nil
				})
			}

			return nil
		})

		if err != nil {
			bm.logger.WithError(err).Warn("Failed to walk policies directory")
		}
	}

	return dataFiles, nil
}

func (bm *BundleManager) createBundleArchive(bundle *Bundle) ([]byte, error) {
	var buf bytes.Buffer
	gzWriter := gzip.NewWriter(&buf)
	tarWriter := tar.NewWriter(gzWriter)

	// Add files to tar archive
	for path, content := range bundle.Data {
		contentStr, ok := content.(string)
		if !ok {
			contentBytes, err := json.Marshal(content)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal content for %s: %w", path, err)
			}
			contentStr = string(contentBytes)
		}

		header := &tar.Header{
			Name:    path,
			Mode:    0644,
			Size:    int64(len(contentStr)),
			ModTime: time.Now(),
		}

		if err := tarWriter.WriteHeader(header); err != nil {
			return nil, fmt.Errorf("failed to write header for %s: %w", path, err)
		}

		if _, err := tarWriter.Write([]byte(contentStr)); err != nil {
			return nil, fmt.Errorf("failed to write content for %s: %w", path, err)
		}
	}

	// Close tar and gzip writers
	if err := tarWriter.Close(); err != nil {
		return nil, fmt.Errorf("failed to close tar writer: %w", err)
	}

	if err := gzWriter.Close(); err != nil {
		return nil, fmt.Errorf("failed to close gzip writer: %w", err)
	}

	return buf.Bytes(), nil
}

func (bm *BundleManager) deployToBundleServer(ctx context.Context, bundle *Bundle, archiveData []byte) error {
	// In a real implementation, this would upload to the bundle server
	// For now, we'll simulate by writing to a local file
	bundlePath := filepath.Join("bundles", fmt.Sprintf("%s.tar.gz", bundle.ID.String()))

	if err := os.MkdirAll(filepath.Dir(bundlePath), 0755); err != nil {
		return fmt.Errorf("failed to create bundle directory: %w", err)
	}

	if err := os.WriteFile(bundlePath, archiveData, 0644); err != nil {
		return fmt.Errorf("failed to write bundle file: %w", err)
	}

	bm.logger.WithFields(logrus.Fields{
		"bundle_id":   bundle.ID,
		"bundle_path": bundlePath,
		"size":        len(archiveData),
	}).Info("Bundle deployed to bundle server")

	return nil
}

func (bm *BundleManager) triggerOPAReload(ctx context.Context) error {
	// Trigger OPA configuration reload
	reloadURL := fmt.Sprintf("%s/v1/data", bm.opaURL)

	req, err := http.NewRequestWithContext(ctx, "POST", reloadURL, bytes.NewReader([]byte("{}")))
	if err != nil {
		return fmt.Errorf("failed to create reload request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")

	resp, err := bm.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send reload request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("OPA reload failed with status %d", resp.StatusCode)
	}

	bm.logger.Info("OPA reload triggered successfully")
	return nil
}

func (bm *BundleManager) checkForBundleChanges() {
	// Check if current bundle hash has changed
	bm.bundleLock.RLock()
	currentBundle := bm.currentBundle
	currentHash := bm.lastBundleHash
	bm.bundleLock.RUnlock()

	if currentBundle == nil {
		return
	}

	// Recalculate bundle checksum
	updatedBundle, err := bm.updateBundleChecksum(currentBundle)
	if err != nil {
		bm.logger.WithError(err).Error("Failed to update bundle checksum")
		return
	}

	if updatedBundle.Checksum != currentHash {
		bm.logger.WithFields(logrus.Fields{
			"bundle_id":    updatedBundle.ID,
			"old_checksum": currentHash,
			"new_checksum": updatedBundle.Checksum,
		}).Info("Bundle checksum changed, triggering reload")

		bm.bundleLock.Lock()
		bm.currentBundle = updatedBundle
		bm.lastBundleHash = updatedBundle.Checksum
		bm.bundleLock.Unlock()

		bm.TriggerReload()
	}
}

func (bm *BundleManager) handleBundleReload() {
	bm.logger.Info("Handling bundle reload")

	// Get current bundle
	bundle := bm.GetActiveBundle()
	if bundle == nil {
		bm.logger.Warn("No active bundle to reload")
		return
	}

	// Trigger OPA reload
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := bm.triggerOPAReload(ctx); err != nil {
		bm.logger.WithError(err).Error("Failed to reload OPA")

		// Notify watchers of error
		bm.notifyWatchers(func(w BundleWatcher) error {
			return w.OnBundleError(bundle.ID.String(), err)
		})
		return
	}

	bm.logger.Info("Bundle reload completed successfully")
}

func (bm *BundleManager) updateBundleChecksum(bundle *Bundle) (*Bundle, error) {
	// Recalculate bundle data checksum
	bundleData, err := bm.generateBundleData(bundle.Policies)
	if err != nil {
		return nil, err
	}

	newChecksum := bm.calculateChecksum(bundleData)

	// Create updated bundle copy
	updated := *bundle
	updated.Data = bundleData
	updated.Checksum = newChecksum
	updated.UpdatedAt = time.Now().UTC()

	return &updated, nil
}

func (bm *BundleManager) calculateChecksum(data map[string]interface{}) string {
	// Serialize data to JSON
	jsonData, err := json.Marshal(data)
	if err != nil {
		bm.logger.WithError(err).Error("Failed to marshal bundle data for checksum")
		return ""
	}

	// Calculate simple hash (in production, use SHA-256)
	hash := 5381
	for _, b := range jsonData {
		hash = ((hash << 5) + hash) + int(b)
	}

	return fmt.Sprintf("%x", hash)
}

func (bm *BundleManager) calculatePolicyChecksum(content string) string {
	// Calculate policy checksum
	hash := 5381
	for _, b := range []byte(content) {
		hash = ((hash << 5) + hash) + int(b)
	}

	return fmt.Sprintf("%x", hash)
}

func (bm *BundleManager) notifyWatchers(notify func(w BundleWatcher) error) {
	bm.watchersLock.RLock()
	watchers := make([]BundleWatcher, len(bm.watchers))
	copy(watchers, bm.watchers)
	bm.watchersLock.RUnlock()

	for _, watcher := range watchers {
		if err := notify(watcher); err != nil {
			bm.logger.WithError(err).Error("Bundle watcher notification failed")
		}
	}
}

// Request models

type CreateBundleRequest struct {
	Name        string   `json:"name"`
	Description string   `json:"description"`
	PolicyIDs   []string `json:"policy_ids"`
	TenantID    string   `json:"tenant_id"`
	CreatedBy   string   `json:"created_by"`
}
