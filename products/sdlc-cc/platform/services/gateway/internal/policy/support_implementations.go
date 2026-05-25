package policy

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"sync"
)

// Simple logger implementation
type defaultLogger struct{}

func (l *defaultLogger) Debug(msg string, fields map[string]interface{}) {
	log.Printf("[DEBUG] %s %v", msg, fields)
}

func (l *defaultLogger) Info(msg string, fields map[string]interface{}) {
	log.Printf("[INFO] %s %v", msg, fields)
}

func (l *defaultLogger) Warn(msg string, fields map[string]interface{}) {
	log.Printf("[WARN] %s %v", msg, fields)
}

func (l *defaultLogger) Error(msg string, fields map[string]interface{}) {
	log.Printf("[ERROR] %s %v", msg, fields)
}

// MemoryBundleStorage implements BundleStorage for in-memory storage
type MemoryBundleStorage struct {
	bundles map[string]map[string]*PolicyBundle // name -> version -> bundle
	mu      sync.RWMutex
	logger  Logger
}

// NewMemoryBundleStorage creates a new memory bundle storage
func NewMemoryBundleStorage(logger Logger) *MemoryBundleStorage {
	if logger == nil {
		logger = &defaultLogger{}
	}

	return &MemoryBundleStorage{
		bundles: make(map[string]map[string]*PolicyBundle),
		logger:  logger,
	}
}

func (s *MemoryBundleStorage) SaveBundle(ctx context.Context, bundle *PolicyBundle) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.bundles[bundle.Name] == nil {
		s.bundles[bundle.Name] = make(map[string]*PolicyBundle)
	}

	s.bundles[bundle.Name][bundle.Version] = bundle

	s.logger.Debug("Bundle saved to memory", map[string]interface{}{
		"name":    bundle.Name,
		"version": bundle.Version,
	})

	return nil
}

func (s *MemoryBundleStorage) LoadBundle(ctx context.Context, name, version string) (*PolicyBundle, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if versions, ok := s.bundles[name]; ok {
		if bundle, ok := versions[version]; ok {
			s.logger.Debug("Bundle loaded from memory", map[string]interface{}{
				"name":    name,
				"version": version,
			})
			return bundle, nil
		}
	}

	return nil, fmt.Errorf("bundle %s@%s not found", name, version)
}

func (s *MemoryBundleStorage) DeleteBundle(ctx context.Context, name, version string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if versions, ok := s.bundles[name]; ok {
		delete(versions, version)
		if len(versions) == 0 {
			delete(s.bundles, name)
		}

		s.logger.Debug("Bundle deleted from memory", map[string]interface{}{
			"name":    name,
			"version": version,
		})

		return nil
	}

	return fmt.Errorf("bundle %s@%s not found", name, version)
}

func (s *MemoryBundleStorage) ListBundles(ctx context.Context) ([]*PolicyBundle, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var bundles []*PolicyBundle
	for name, versions := range s.bundles {
		for version, bundle := range versions {
			bundles = append(bundles, bundle)
			s.logger.Debug("Bundle listed", map[string]interface{}{
				"name":    name,
				"version": version,
			})
		}
	}

	return bundles, nil
}

// HMACSigner implements BundleSigner using HMAC
type HMACSigner struct {
	key    string
	logger Logger
}

// NewHMACSigner creates a new HMAC signer
func NewHMACSigner(key string, logger Logger) *HMACSigner {
	if logger == nil {
		logger = &defaultLogger{}
	}

	return &HMACSigner{
		key:    key,
		logger: logger,
	}
}

func (s *HMACSigner) SignBundle(bundle *PolicyBundle) ([]string, error) {
	if s.key == "" {
		return []string{}, nil
	}

	// Create bundle data for signing
	bundleData := map[string]interface{}{
		"name":       bundle.Name,
		"version":    bundle.Version,
		"policies":   bundle.Policies,
		"data":       bundle.Data,
		"metadata":   bundle.Metadata,
		"created_at": bundle.CreatedAt.Unix(),
	}

	data, err := json.Marshal(bundleData)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal bundle for signing: %w", err)
	}

	// Create HMAC signature
	h := hmac.New(sha256.New, []byte(s.key))
	h.Write(data)
	signature := hex.EncodeToString(h.Sum(nil))

	s.logger.Debug("Bundle signed", map[string]interface{}{
		"name":      bundle.Name,
		"version":   bundle.Version,
		"signature": signature[:16] + "...",
	})

	return []string{signature}, nil
}

func (s *HMACSigner) VerifyBundle(bundle *PolicyBundle) error {
	if s.key == "" {
		return nil // No signing configured
	}

	if len(bundle.Signatures) == 0 {
		return fmt.Errorf("bundle has no signatures")
	}

	// Create bundle data for verification
	bundleData := map[string]interface{}{
		"name":       bundle.Name,
		"version":    bundle.Version,
		"policies":   bundle.Policies,
		"data":       bundle.Data,
		"metadata":   bundle.Metadata,
		"created_at": bundle.CreatedAt.Unix(),
	}

	data, err := json.Marshal(bundleData)
	if err != nil {
		return fmt.Errorf("failed to marshal bundle for verification: %w", err)
	}

	// Verify each signature
	for _, signature := range bundle.Signatures {
		h := hmac.New(sha256.New, []byte(s.key))
		h.Write(data)
		expectedSignature := hex.EncodeToString(h.Sum(nil))

		if hmac.Equal([]byte(signature), []byte(expectedSignature)) {
			s.logger.Debug("Bundle signature verified", map[string]interface{}{
				"name":    bundle.Name,
				"version": bundle.Version,
			})
			return nil
		}
	}

	return fmt.Errorf("none of the bundle signatures are valid")
}

// MemoryVersionStorage implements VersionStorage for in-memory storage
type MemoryVersionStorage struct {
	versions map[string]map[string]*PolicyVersion // policy -> version -> version
	mu       sync.RWMutex
	logger   Logger
}

// NewMemoryVersionStorage creates a new memory version storage
func NewMemoryVersionStorage(logger Logger) *MemoryVersionStorage {
	if logger == nil {
		logger = &defaultLogger{}
	}

	return &MemoryVersionStorage{
		versions: make(map[string]map[string]*PolicyVersion),
		logger:   logger,
	}
}

func (s *MemoryVersionStorage) SaveVersion(ctx context.Context, version *PolicyVersion) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.versions[version.PolicyName] == nil {
		s.versions[version.PolicyName] = make(map[string]*PolicyVersion)
	}

	s.versions[version.PolicyName][version.Version] = version

	s.logger.Debug("Version saved to memory", map[string]interface{}{
		"policy":  version.PolicyName,
		"version": version.Version,
	})

	return nil
}

func (s *MemoryVersionStorage) GetVersion(ctx context.Context, policyName, version string) (*PolicyVersion, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if versions, ok := s.versions[policyName]; ok {
		if policyVersion, ok := versions[version]; ok {
			s.logger.Debug("Version loaded from memory", map[string]interface{}{
				"policy":  policyName,
				"version": version,
			})
			return policyVersion, nil
		}
	}

	return nil, fmt.Errorf("version %s@%s not found", policyName, version)
}

func (s *MemoryVersionStorage) GetLatestVersion(ctx context.Context, policyName string) (*PolicyVersion, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if versions, ok := s.versions[policyName]; ok {
		// Find the active version
		for _, version := range versions {
			if version.IsActive {
				s.logger.Debug("Active version loaded from memory", map[string]interface{}{
					"policy":  policyName,
					"version": version.Version,
				})
				return version, nil
			}
		}

		// If no active version, return the latest
		var latest *PolicyVersion
		for _, version := range versions {
			if latest == nil || version.CreatedAt.After(latest.CreatedAt) {
				latest = version
			}
		}

		if latest != nil {
			s.logger.Debug("Latest version loaded from memory", map[string]interface{}{
				"policy":  policyName,
				"version": latest.Version,
			})
			return latest, nil
		}
	}

	return nil, fmt.Errorf("no versions found for policy %s", policyName)
}

func (s *MemoryVersionStorage) ListVersions(ctx context.Context, policyName string) ([]*PolicyVersion, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if versions, ok := s.versions[policyName]; ok {
		var versionList []*PolicyVersion
		for _, version := range versions {
			versionList = append(versionList, version)
		}

		s.logger.Debug("Versions listed from memory", map[string]interface{}{
			"policy": policyName,
			"count":  len(versionList),
		})

		return versionList, nil
	}

	return []*PolicyVersion{}, nil
}

func (s *MemoryVersionStorage) DeleteVersion(ctx context.Context, policyName, version string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if versions, ok := s.versions[policyName]; ok {
		delete(versions, version)
		if len(versions) == 0 {
			delete(s.versions, policyName)
		}

		s.logger.Debug("Version deleted from memory", map[string]interface{}{
			"policy":  policyName,
			"version": version,
		})

		return nil
	}

	return fmt.Errorf("version %s@%s not found", policyName, version)
}

func (s *MemoryVersionStorage) GetVersionChain(ctx context.Context, policyName string) ([]*PolicyVersion, error) {
	return s.ListVersions(ctx, policyName)
}
