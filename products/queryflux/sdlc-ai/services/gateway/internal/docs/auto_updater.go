package docs

import (
	"context"
	"encoding/json"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/getkin/kin-openapi/openapi3"
	"go.uber.org/zap"
)

// AutoUpdaterConfig holds configuration for automatic documentation updates
type AutoUpdaterConfig struct {
	// Source directories to watch
	SourceDirs []string

	// Patterns to watch for file changes
	WatchPatterns []string

	// Output directory for generated documentation
	OutputDir string

	// OpenAPI spec file path
	SpecFilePath string

	// Documentation templates directory
	TemplatesDir string

	// Update interval
	UpdateInterval time.Duration

	// Enable hot reload
	EnableHotReload bool

	// Enable git integration
	EnableGitIntegration bool

	// Git repository path
	GitRepoPath string

	// Webhook configuration
	WebhookURL    string
	WebhookSecret string

	// Notification settings
	EnableNotifications  bool
	NotificationChannels []string

	// Validation settings
	ValidateSpec bool
	LintSpec     bool

	// Custom generators
	CustomGenerators map[string]Generator

	// Cache settings
	EnableCache bool
	CacheDir    string

	// Logger
	Logger *zap.Logger
}

// Generator interface for custom documentation generators
type Generator interface {
	Generate(ctx context.Context, spec *openapi3.T, config AutoUpdaterConfig) error
	Validate() error
}

// DocumentationState represents the state of documentation
type DocumentationState struct {
	LastUpdate    time.Time              `json:"last_update"`
	Version       string                 `json:"version"`
	CommitHash    string                 `json:"commit_hash"`
	Files         map[string]FileHash    `json:"files"`
	GeneratedDocs []GeneratedDoc         `json:"generated_docs"`
	Metadata      map[string]interface{} `json:"metadata"`
}

// FileHash represents a file and its hash
type FileHash struct {
	Path string `json:"path"`
	Hash string `json:"hash"`
	Size int64  `json:"size"`
}

// GeneratedDoc represents a generated documentation file
type GeneratedDoc struct {
	Path        string                 `json:"path"`
	Type        string                 `json:"type"`
	GeneratedAt time.Time              `json:"generated_at"`
	Size        int64                  `json:"size"`
	Metadata    map[string]interface{} `json:"metadata"`
}

// AutoUpdater handles automatic documentation updates
type AutoUpdater struct {
	config          AutoUpdaterConfig
	logger          *zap.Logger
	state           DocumentationState
	stateFile       string
	stopChan        chan struct{}
	wg              sync.WaitGroup
	fileWatcher     *FileWatcher
	gitWatcher      *GitWatcher
	updateQueue     chan UpdateRequest
	processingQueue chan UpdateRequest
	mu              sync.RWMutex
	cache           *DocumentationCache
}

// UpdateRequest represents a documentation update request
type UpdateRequest struct {
	Type      UpdateType             `json:"type"`
	Files     []string               `json:"files"`
	Force     bool                   `json:"force"`
	Metadata  map[string]interface{} `json:"metadata"`
	Timestamp time.Time              `json:"timestamp"`
	Source    string                 `json:"source"`
}

// UpdateType represents the type of update
type UpdateType string

const (
	UpdateTypeFileChange UpdateType = "file_change"
	UpdateTypeGitCommit  UpdateType = "git_commit"
	UpdateTypeManual     UpdateType = "manual"
	UpdateTypeScheduled  UpdateType = "scheduled"
	UpdateTypeWebhook    UpdateType = "webhook"
	UpdateTypeAPIDeploy  UpdateType = "api_deploy"
)

// NewAutoUpdater creates a new auto documentation updater
func NewAutoUpdater(config AutoUpdaterConfig) (*AutoUpdater, error) {
	if err := config.Validate(); err != nil {
		return nil, fmt.Errorf("invalid configuration: %w", err)
	}

	// Create output directory if it doesn't exist
	if err := os.MkdirAll(config.OutputDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create output directory: %w", err)
	}

	// Initialize state file
	stateFile := filepath.Join(config.OutputDir, ".docs_state.json")
	state, err := loadState(stateFile)
	if err != nil {
		if os.IsNotExist(err) {
			state = DocumentationState{
				Files:    make(map[string]FileHash),
				Metadata: make(map[string]interface{}),
			}
		} else {
			return nil, fmt.Errorf("failed to load state: %w", err)
		}
	}

	// Initialize cache if enabled
	var cache *DocumentationCache
	if config.EnableCache {
		cacheDir := config.CacheDir
		if cacheDir == "" {
			cacheDir = filepath.Join(config.OutputDir, ".cache")
		}
		cache = NewDocumentationCache(cacheDir, config.Logger)
	}

	updater := &AutoUpdater{
		config:          config,
		logger:          config.Logger,
		state:           state,
		stateFile:       stateFile,
		stopChan:        make(chan struct{}),
		updateQueue:     make(chan UpdateRequest, 100),
		processingQueue: make(chan UpdateRequest, 100),
		cache:           cache,
	}

	return updater, nil
}

// Start starts the auto updater
func (au *AutoUpdater) Start(ctx context.Context) error {
	au.logger.Info("Starting documentation auto updater")

	// Initialize file watcher
	if au.config.EnableHotReload {
		if err := au.initFileWatcher(); err != nil {
			return fmt.Errorf("failed to initialize file watcher: %w", err)
		}
	}

	// Initialize git watcher
	if au.config.EnableGitIntegration {
		if err := au.initGitWatcher(); err != nil {
			au.logger.Warn("Failed to initialize git watcher", zap.Error(err))
		}
	}

	// Start workers
	au.wg.Add(3)
	go au.updateWorker(ctx)
	go au.processingWorker(ctx)

	// Start scheduled updates
	go au.scheduledUpdates(ctx)

	au.logger.Info("Documentation auto updater started")
	return nil
}

// Stop stops the auto updater
func (au *AutoUpdater) Stop() {
	au.logger.Info("Stopping documentation auto updater")
	close(au.stopChan)

	if au.fileWatcher != nil {
		au.fileWatcher.Stop()
	}

	if au.gitWatcher != nil {
		au.gitWatcher.Stop()
	}

	au.wg.Wait()
	au.logger.Info("Documentation auto updater stopped")
}

// TriggerUpdate triggers a documentation update
func (au *AutoUpdater) TriggerUpdate(req UpdateRequest) error {
	select {
	case au.updateQueue <- req:
		return nil
	default:
		return fmt.Errorf("update queue is full")
	}
}

// updateWorker processes update requests
func (au *AutoUpdater) updateWorker(ctx context.Context) {
	defer au.wg.Done()

	for {
		select {
		case <-ctx.Done():
			return
		case <-au.stopChan:
			return
		case req := <-au.updateQueue:
			au.logger.Info("Processing update request",
				zap.String("type", string(req.Type)),
				zap.Strings("files", req.Files),
				zap.String("source", req.Source))

			// Check if update is needed
			if !req.Force && !au.needsUpdate(req.Files) {
				au.logger.Debug("No update needed")
				continue
			}

			// Add to processing queue
			select {
			case au.processingQueue <- req:
			default:
				au.logger.Error("Processing queue is full, dropping update")
			}
		}
	}
}

// processingWorker processes documentation generation
func (au *AutoUpdater) processingWorker(ctx context.Context) {
	defer au.wg.Done()

	for {
		select {
		case <-ctx.Done():
			return
		case <-au.stopChan:
			return
		case req := <-au.processingQueue:
			if err := au.processUpdate(ctx, req); err != nil {
				au.logger.Error("Failed to process update",
					zap.Error(err),
					zap.String("type", string(req.Type)))
			}
		}
	}
}

// processUpdate processes a documentation update
func (au *AutoUpdater) processUpdate(ctx context.Context, req UpdateRequest) error {
	startTime := time.Now()
	au.logger.Info("Processing documentation update")

	// Load OpenAPI specification
	spec, err := au.loadOpenAPISpec()
	if err != nil {
		return fmt.Errorf("failed to load OpenAPI spec: %w", err)
	}

	// Validate specification if enabled
	if au.config.ValidateSpec {
		if err := spec.Validate(ctx); err != nil {
			return fmt.Errorf("OpenAPI spec validation failed: %w", err)
		}
	}

	// Lint specification if enabled
	if au.config.LintSpec {
		if err := au.lintSpec(spec); err != nil {
			au.logger.Warn("OpenAPI spec linting failed", zap.Error(err))
		}
	}

	// Generate documentation
	var generatedDocs []GeneratedDoc

	// Generate HTML documentation
	if err := au.generateHTMLDocumentation(spec); err != nil {
		return fmt.Errorf("failed to generate HTML documentation: %w", err)
	}
	generatedDocs = append(generatedDocs, GeneratedDoc{
		Path:        filepath.Join(au.config.OutputDir, "index.html"),
		Type:        "html",
		GeneratedAt: time.Now(),
	})

	// Generate OpenAPI JSON
	if err := au.generateOpenAPIJSON(spec); err != nil {
		return fmt.Errorf("failed to generate OpenAPI JSON: %w", err)
	}
	generatedDocs = append(generatedDocs, GeneratedDoc{
		Path:        filepath.Join(au.config.OutputDir, "openapi.json"),
		Type:        "openapi_json",
		GeneratedAt: time.Now(),
	})

	// Run custom generators
	for name, generator := range au.config.CustomGenerators {
		if err := generator.Generate(ctx, spec, au.config); err != nil {
			au.logger.Error("Custom generator failed",
				zap.String("generator", name),
				zap.Error(err))
		} else {
			generatedDocs = append(generatedDocs, GeneratedDoc{
				Path:        "",
				Type:        name,
				GeneratedAt: time.Now(),
			})
		}
	}

	// Update state
	au.mu.Lock()
	au.state.LastUpdate = time.Now()
	au.state.GeneratedDocs = generatedDocs
	au.state.Metadata = req.Metadata
	au.state.Files = au.getFileHashes(req.Files)
	au.mu.Unlock()

	// Save state
	if err := au.saveState(); err != nil {
		au.logger.Error("Failed to save state", zap.Error(err))
	}

	// Send notifications if enabled
	if au.config.EnableNotifications {
		au.sendNotifications(req, generatedDocs)
	}

	// Update cache if enabled
	if au.cache != nil {
		au.cache.Set("latest_spec", spec)
		au.cache.Set("generated_docs", generatedDocs)
	}

	au.logger.Info("Documentation update completed",
		zap.Duration("duration", time.Since(startTime)),
		zap.Int("docs_generated", len(generatedDocs)))

	return nil
}

// needsUpdate checks if documentation needs to be updated
func (au *AutoUpdater) needsUpdate(files []string) bool {
	au.mu.RLock()
	defer au.mu.RUnlock()

	for _, file := range files {
		if currentHash, exists := au.state.Files[file]; !exists {
			return true
		} else {
			if newHash, err := calculateFileHash(file); err == nil {
				if newHash != currentHash.Hash {
					return true
				}
			}
		}
	}

	return false
}

// loadOpenAPISpec loads the OpenAPI specification
func (au *AutoUpdater) loadOpenAPISpec() (*openapi3.T, error) {
	// Try cache first
	if au.cache != nil {
		if cached, err := au.cache.Get("latest_spec"); err == nil {
			if spec, ok := cached.(*openapi3.T); ok {
				return spec, nil
			}
		}
	}

	// Load from file
	spec, err := openapi3.NewLoader().LoadFromFile(au.config.SpecFilePath)
	if err != nil {
		return nil, err
	}

	return spec, nil
}

// generateHTMLDocumentation generates HTML documentation
func (au *AutoUpdater) generateHTMLDocumentation(spec *openapi3.T) error {
	// Use the existing HTML generator
	htmlPath := filepath.Join(au.config.OutputDir, "index.html")

	// Read template if it exists
	templatePath := filepath.Join(au.config.TemplatesDir, "index.html.template")
	if _, err := os.Stat(templatePath); err == nil {
		// Custom template exists
		return au.generateFromTemplate(spec, templatePath, htmlPath)
	}

	// Use default template
	return au.generateDefaultHTML(spec, htmlPath)
}

// generateOpenAPIJSON generates OpenAPI JSON file
func (au *AutoUpdater) generateOpenAPIJSON(spec *openapi3.T) error {
	jsonPath := filepath.Join(au.config.OutputDir, "openapi.json")

	data, err := json.MarshalIndent(spec, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(jsonPath, data, 0644)
}

// lintSpec lints the OpenAPI specification
func (au *AutoUpdater) lintSpec(spec *openapi3.T) error {
	// Basic linting rules
	if spec.Info == nil {
		return fmt.Errorf("missing info section")
	}
	if spec.Info.Title == "" {
		return fmt.Errorf("missing API title")
	}
	if spec.Info.Version == "" {
		return fmt.Errorf("missing API version")
	}

	// Check for required fields in paths
	for path, pathItem := range spec.Paths.Map() {
		if pathItem == nil {
			continue
		}

		operations := []*openapi3.Operation{
			pathItem.Connect, pathItem.Delete, pathItem.Get,
			pathItem.Head, pathItem.Options, pathItem.Patch,
			pathItem.Post, pathItem.Put, pathItem.Trace,
		}

		for _, op := range operations {
			if op != nil && op.OperationID == "" {
				au.logger.Warn("Missing operation ID",
					zap.String("path", path))
			}
		}
	}

	return nil
}

// sendNotifications sends notifications about documentation updates
func (au *AutoUpdater) sendNotifications(req UpdateRequest, docs []GeneratedDoc) {
	// Implementation would send notifications to configured channels
	au.logger.Info("Sending documentation update notifications",
		zap.String("update_type", string(req.Type)),
		zap.Int("docs_count", len(docs)))
}

// scheduledUpdates runs scheduled documentation updates
func (au *AutoUpdater) scheduledUpdates(ctx context.Context) {
	ticker := time.NewTicker(au.config.UpdateInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-au.stopChan:
			return
		case <-ticker.C:
			req := UpdateRequest{
				Type:      UpdateTypeScheduled,
				Files:     au.getAllSourceFiles(),
				Timestamp: time.Now(),
				Source:    "scheduler",
			}
			au.TriggerUpdate(req)
		}
	}
}

// Helper functions

// loadState loads documentation state from file
func loadState(stateFile string) (DocumentationState, error) {
	var state DocumentationState

	data, err := os.ReadFile(stateFile)
	if err != nil {
		return state, err
	}

	err = json.Unmarshal(data, &state)
	return state, err
}

// saveState saves documentation state to file
func (au *AutoUpdater) saveState() error {
	au.mu.RLock()
	defer au.mu.RUnlock()

	data, err := json.MarshalIndent(au.state, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(au.stateFile, data, 0644)
}

// Validate validates the configuration
func (c *AutoUpdaterConfig) Validate() error {
	if len(c.SourceDirs) == 0 {
		return fmt.Errorf("at least one source directory is required")
	}

	if c.SpecFilePath == "" {
		return fmt.Errorf("spec file path is required")
	}

	if c.OutputDir == "" {
		return fmt.Errorf("output directory is required")
	}

	if c.UpdateInterval == 0 {
		c.UpdateInterval = 5 * time.Minute
	}

	return nil
}

// DocumentationCache implements a simple cache for documentation
type DocumentationCache struct {
	items  map[string]interface{}
	mu     sync.RWMutex
	dir    string
	logger *zap.Logger
}

// NewDocumentationCache creates a new documentation cache
func NewDocumentationCache(dir string, logger *zap.Logger) *DocumentationCache {
	return &DocumentationCache{
		items:  make(map[string]interface{}),
		dir:    dir,
		logger: logger,
	}
}

// Set sets a value in the cache
func (dc *DocumentationCache) Set(key string, value interface{}) {
	dc.mu.Lock()
	defer dc.mu.Unlock()
	dc.items[key] = value
}

// Get gets a value from the cache
func (dc *DocumentationCache) Get(key string) (interface{}, error) {
	dc.mu.RLock()
	defer dc.mu.RUnlock()

	if value, exists := dc.items[key]; exists {
		return value, nil
	}

	return nil, fmt.Errorf("key not found: %s", key)
}

// FileWatcher and GitWatcher would be implemented here
// For brevity, their implementations are omitted

type FileWatcher struct {
	// Implementation would watch file system changes
}

func (fw *FileWatcher) Stop() {
	// Stop watching
}

type GitWatcher struct {
	// Implementation would watch git changes
}

func (gw *GitWatcher) Stop() {
	// Stop watching
}

// initFileWatcher initializes the file watcher
func (au *AutoUpdater) initFileWatcher() error {
	// Implementation would initialize file system watcher
	return nil
}

// initGitWatcher initializes the git watcher
func (au *AutoUpdater) initGitWatcher() error {
	// Implementation would initialize git watcher
	return nil
}

// Helper functions for file operations
func calculateFileHash(path string) (string, error) {
	// Implementation would calculate file hash
	return "hash", nil
}

func (au *AutoUpdater) getFileHashes(files []string) map[string]FileHash {
	hashes := make(map[string]FileHash)
	for _, file := range files {
		if hash, err := calculateFileHash(file); err == nil {
			if info, err := os.Stat(file); err == nil {
				hashes[file] = FileHash{
					Path: file,
					Hash: hash,
					Size: info.Size(),
				}
			}
		}
	}
	return hashes
}

func (au *AutoUpdater) getAllSourceFiles() []string {
	var files []string
	for _, dir := range au.config.SourceDirs {
		filepath.WalkDir(dir, func(path string, d fs.DirEntry, err error) error {
			if err != nil {
				return err
			}
			if !d.IsDir() {
				files = append(files, path)
			}
			return nil
		})
	}
	return files
}

func (au *AutoUpdater) generateFromTemplate(spec *openapi3.T, templatePath, outputPath string) error {
	// Implementation would generate HTML from template
	return nil
}

func (au *AutoUpdater) generateDefaultHTML(spec *openapi3.T, outputPath string) error {
	// Implementation would generate default HTML
	return nil
}
