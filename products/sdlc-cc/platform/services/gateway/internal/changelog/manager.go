//go:build ignore

package changelog

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/getkin/kin-openapi/openapi3"
	"github.com/sirupsen/logrus"
	"gopkg.in/yaml.v3"
)

// ChangelogManager manages API changelogs
type ChangelogManager struct {
	config  ChangelogConfig
	logger  *logrus.Logger
	storage ChangelogStorage
}

// ChangelogConfig holds configuration for changelog management
type ChangelogConfig struct {
	// Directory to store changelog files
	ChangelogDir string

	// Output formats
	OutputFormats []string // json, yaml, markdown, html

	// Template directory
	TemplatesDir string

	// Auto-detect changes from OpenAPI spec
	AutoDetectChanges bool

	// Custom change categories
	Categories []ChangeCategory

	// Include in changelog
	IncludeBreakingChanges bool
	IncludeNewFeatures     bool
	IncludeImprovements    bool
	IncludeBugFixes        bool
	IncludeSecurityUpdates bool
	IncludeDeprecations    bool

	// Version information
	CurrentVersion string
	NextVersion    string
}

// ChangeCategory represents a category of changes
type ChangeCategory struct {
	Name        string `json:"name"`
	Title       string `json:"title"`
	Description string `json:"description"`
	Color       string `json:"color"`
	Icon        string `json:"icon"`
}

// ChangelogEntry represents a single changelog entry
type ChangelogEntry struct {
	ID          string                 `json:"id"`
	Version     string                 `json:"version"`
	Date        time.Time              `json:"date"`
	Title       string                 `json:"title"`
	Description string                 `json:"description"`
	Category    string                 `json:"category"`
	Type        ChangeType             `json:"type"`
	Impact      ImpactLevel            `json:"impact"`
	Changes     []Change               `json:"changes"`
	Author      string                 `json:"author"`
	Metadata    map[string]interface{} `json:"metadata"`
}

// Change represents a specific change
type Change struct {
	Type        string                 `json:"type"`
	Description string                 `json:"description"`
	Component   string                 `json:"component,omitempty"`
	Endpoint    string                 `json:"endpoint,omitempty"`
	Method      string                 `json:"method,omitempty"`
	Impact      string                 `json:"impact,omitempty"`
	Example     map[string]interface{} `json:"example,omitempty"`
	References  []string               `json:"references,omitempty"`
}

// ChangeType represents the type of change
type ChangeType string

const (
	ChangeTypeAdded          ChangeType = "added"
	ChangeTypeChanged        ChangeType = "changed"
	ChangeTypeDeprecated     ChangeType = "deprecated"
	ChangeTypeRemoved        ChangeType = "removed"
	ChangeTypeFixed          ChangeType = "fixed"
	ChangeTypeSecurity       ChangeType = "security"
	ChangeTypeBreakingChange ChangeType = "breaking_change"
)

// ImpactLevel represents the impact level of a change
type ImpactLevel string

const (
	ImpactLevelLow      ImpactLevel = "low"
	ImpactLevelMedium   ImpactLevel = "medium"
	ImpactLevelHigh     ImpactLevel = "high"
	ImpactLevelCritical ImpactLevel = "critical"
)

// ChangelogStorage interface for storing changelogs
type ChangelogStorage interface {
	Save(entry *ChangelogEntry) error
	Load(version string) (*ChangelogEntry, error)
	List() ([]*ChangelogEntry, error)
	Search(query string) ([]*ChangelogEntry, error)
}

// NewChangelogManager creates a new changelog manager
func NewChangelogManager(config ChangelogConfig, logger *logrus.Logger) (*ChangelogManager, error) {
	if logger == nil {
		logger = logrus.New()
	}

	// Create changelog directory if it doesn't exist
	if err := os.MkdirAll(config.ChangelogDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create changelog directory: %w", err)
	}

	// Set default categories
	if len(config.Categories) == 0 {
		config.Categories = []ChangeCategory{
			{Name: "breaking", Title: "Breaking Changes", Description: "Changes that may break existing integrations", Color: "#dc3545", Icon: "💥"},
			{Name: "added", Title: "New Features", Description: "New functionality and features", Color: "#28a745", Icon: "✨"},
			{Name: "changed", Title: "Improvements", Description: "Enhancements and optimizations", Color: "#17a2b8", Icon: "🚀"},
			{Name: "fixed", Title: "Bug Fixes", Description: "Fixed issues and bugs", Color: "#fd7e14", Icon: "🐛"},
			{Name: "security", Title: "Security", Description: "Security updates and patches", Color: "#6f42c1", Icon: "🔒"},
			{Name: "deprecated", Title: "Deprecations", Description: "Features that will be removed in future versions", Color: "#6c757d", Icon: "⚠️"},
		}
	}

	manager := &ChangelogManager{
		config: config,
		logger: logger,
		storage: &FileChangelogStorage{
			Dir: config.ChangelogDir,
		},
	}

	return manager, nil
}

// DetectChangesFromSpec detects changes between OpenAPI specs
func (cm *ChangelogManager) DetectChangesFromSpec(oldSpec, newSpec *openapi3.T) (*ChangelogEntry, error) {
	if !cm.config.AutoDetectChanges {
		return nil, nil
	}

	changes := []Change{}

	// Compare paths/endpoints
	oldPaths := getPaths(oldSpec)
	newPaths := getPaths(newSpec)

	// Find new endpoints
	for path, methods := range newPaths {
		if oldMethods, exists := oldPaths[path]; !exists {
			// Entire path is new
			for method := range methods {
				changes = append(changes, Change{
					Type:        string(ChangeTypeAdded),
					Description: fmt.Sprintf("Added new endpoint %s %s", method, path),
					Endpoint:    path,
					Method:      method,
					Impact:      string(ImpactLevelMedium),
				})
			}
		} else {
			// Compare methods
			for method, operation := range methods {
				if oldMethod, exists := oldMethods[method]; !exists {
					changes = append(changes, Change{
						Type:        string(ChangeTypeAdded),
						Description: fmt.Sprintf("Added new endpoint %s %s", method, path),
						Endpoint:    path,
						Method:      method,
						Impact:      string(ImpactLevelMedium),
					})
				} else {
					// Compare operations for breaking changes
					if isBreakingChange(oldMethod, operation) {
						changes = append(changes, Change{
							Type:        string(ChangeTypeBreakingChange),
							Description: fmt.Sprintf("Breaking change in endpoint %s %s", method, path),
							Endpoint:    path,
							Method:      method,
							Impact:      string(ImpactLevelHigh),
						})
					}
				}
			}

			// Check for removed methods
			for method := range oldMethods {
				if _, exists := newMethods[method]; !exists {
					changes = append(changes, Change{
						Type:        string(ChangeTypeRemoved),
						Description: fmt.Sprintf("Removed endpoint %s %s", method, path),
						Endpoint:    path,
						Method:      method,
						Impact:      string(ImpactLevelCritical),
					})
				}
			}
		}
	}

	// Find removed paths
	for path := range oldPaths {
		if _, exists := newPaths[path]; !exists {
			changes = append(changes, Change{
				Type:        string(ChangeTypeRemoved),
				Description: fmt.Sprintf("Removed path %s and all its endpoints", path),
				Endpoint:    path,
				Impact:      string(ImpactLevelCritical),
			})
		}
	}

	// Compare schemas
	schemaChanges := compareSchemas(oldSpec.Components, newSpec.Components)
	changes = append(changes, schemaChanges...)

	// Create changelog entry if changes detected
	if len(changes) > 0 {
		entry := &ChangelogEntry{
			ID:          generateID(),
			Version:     cm.config.NextVersion,
			Date:        time.Now(),
			Title:       fmt.Sprintf("Release %s", cm.config.NextVersion),
			Description: fmt.Sprintf("Changes in version %s", cm.config.NextVersion),
			Category:    categorizeChanges(changes),
			Changes:     changes,
			Metadata: map[string]interface{}{
				"auto_detected": true,
				"change_count":  len(changes),
			},
		}
		return entry, nil
	}

	return nil, nil
}

// AddChange adds a manual change entry
func (cm *ChangelogManager) AddChange(entry *ChangelogEntry) error {
	if entry.ID == "" {
		entry.ID = generateID()
	}
	if entry.Date.IsZero() {
		entry.Date = time.Now()
	}

	return cm.storage.Save(entry)
}

// GenerateChangelog generates changelog in specified formats
func (cm *ChangelogManager) GenerateChangelog() (map[string]string, error) {
	entries, err := cm.storage.List()
	if err != nil {
		return nil, fmt.Errorf("failed to load changelog entries: %w", err)
	}

	// Sort entries by date (newest first)
	sort.Slice(entries, func(i, j int) bool {
		return entries[i].Date.After(entries[j].Date)
	})

	outputs := make(map[string]string)

	for _, format := range cm.config.OutputFormats {
		switch format {
		case "markdown":
			outputs[format] = cm.generateMarkdown(entries)
		case "json":
			outputs[format] = cm.generateJSON(entries)
		case "yaml":
			outputs[format] = cm.generateYAML(entries)
		case "html":
			outputs[format] = cm.generateHTML(entries)
		default:
			cm.logger.WithField("format", format).Warn("Unsupported changelog format")
		}
	}

	return outputs, nil
}

// SaveChangelog saves the changelog to files
func (cm *ChangelogManager) SaveChangelog() error {
	outputs, err := cm.GenerateChangelog()
	if err != nil {
		return err
	}

	for format, content := range outputs {
		filename := filepath.Join(cm.config.ChangelogDir, "CHANGELOG."+format)
		if err := os.WriteFile(filename, []byte(content), 0644); err != nil {
			return fmt.Errorf("failed to write changelog %s: %w", format, err)
		}
		cm.logger.WithField("file", filename).Info("Changelog saved")
	}

	return nil
}

// generateMarkdown generates changelog in Markdown format
func (cm *ChangelogManager) generateMarkdown(entries []*ChangelogEntry) string {
	var builder strings.Builder

	builder.WriteString("# Changelog\n\n")
	builder.WriteString("All notable changes to this project will be documented in this file.\n\n")

	// Group entries by version
	versionGroups := make(map[string][]*ChangelogEntry)
	for _, entry := range entries {
		versionGroups[entry.Version] = append(versionGroups[entry.Version], entry)
	}

	// Sort versions
	versions := make([]string, 0, len(versionGroups))
	for version := range versionGroups {
		versions = append(versions, version)
	}
	sort.Sort(sort.Reverse(sort.StringSlice(versions)))

	for _, version := range versions {
		versionEntries := versionGroups[version]
		if len(versionEntries) == 0 {
			continue
		}

		// Use the first entry for version info
		entry := versionEntries[0]
		builder.WriteString(fmt.Sprintf("## [%s] - %s\n\n", version, entry.Date.Format("2006-01-02")))

		// Group changes by category
		categoryGroups := make(map[string][]Change)
		for _, entry := range versionEntries {
			categoryGroups[entry.Category] = append(categoryGroups[entry.Category], entry.Changes...)
		}

		// Generate sections for each category
		for _, category := range cm.config.Categories {
			if changes, exists := categoryGroups[category.Name]; exists && len(changes) > 0 {
				if shouldIncludeCategory(category.Name) {
					builder.WriteString(fmt.Sprintf("### %s %s\n\n", category.Icon, category.Title))

					for _, change := range changes {
						builder.WriteString(fmt.Sprintf("- %s\n", change.Description))
					}
					builder.WriteString("\n")
				}
			}
		}
	}

	return builder.String()
}

// generateJSON generates changelog in JSON format
func (cm *ChangelogManager) generateJSON(entries []*ChangelogEntry) string {
	data := map[string]interface{}{
		"version":   "1.0.0",
		"generated": time.Now().Format(time.RFC3339),
		"entries":   entries,
	}

	jsonData, _ := json.MarshalIndent(data, "", "  ")
	return string(jsonData)
}

// generateYAML generates changelog in YAML format
func (cm *ChangelogManager) generateYAML(entries []*ChangelogEntry) string {
	data := map[string]interface{}{
		"version":   "1.0.0",
		"generated": time.Now().Format(time.RFC3339),
		"entries":   entries,
	}

	yamlData, _ := yaml.Marshal(data)
	return string(yamlData)
}

// generateHTML generates changelog in HTML format
func (cm *ChangelogManager) generateHTML(entries []*ChangelogEntry) string {
	var builder strings.Builder

	builder.WriteString("<!DOCTYPE html>\n")
	builder.WriteString("<html lang=\"en\">\n")
	builder.WriteString("<head>\n")
	builder.WriteString("    <meta charset=\"UTF-8\">\n")
	builder.WriteString("    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n")
	builder.WriteString("    <title>Changelog</title>\n")
	builder.WriteString("    <style>\n")
	builder.WriteString(htmlCSS)
	builder.WriteString("    </style>\n")
	builder.WriteString("</head>\n")
	builder.WriteString("<body>\n")
	builder.WriteString("    <div class=\"container\">\n")
	builder.WriteString("        <h1>Changelog</h1>\n")
	builder.WriteString("        <p>All notable changes to this project will be documented in this file.</p>\n")

	// Group entries by version
	versionGroups := make(map[string][]*ChangelogEntry)
	for _, entry := range entries {
		versionGroups[entry.Version] = append(versionGroups[entry.Version], entry)
	}

	// Sort versions
	versions := make([]string, 0, len(versionGroups))
	for version := range versionGroups {
		versions = append(versions, version)
	}
	sort.Sort(sort.Reverse(sort.StringSlice(versions)))

	for _, version := range versions {
		versionEntries := versionGroups[version]
		if len(versionEntries) == 0 {
			continue
		}

		entry := versionEntries[0]
		builder.WriteString(fmt.Sprintf("        <section class=\"version\">\n"))
		builder.WriteString(fmt.Sprintf("            <h2>[%s] - %s</h2>\n", version, entry.Date.Format("2006-01-02")))

		// Group changes by category
		categoryGroups := make(map[string][]Change)
		for _, entry := range versionEntries {
			categoryGroups[entry.Category] = append(categoryGroups[entry.Category], entry.Changes...)
		}

		for _, category := range cm.config.Categories {
			if changes, exists := categoryGroups[category.Name]; exists && len(changes) > 0 {
				if shouldIncludeCategory(category.Name) {
					builder.WriteString(fmt.Sprintf("            <div class=\"category %s\">\n", category.Name))
					builder.WriteString(fmt.Sprintf("                <h3>%s %s</h3>\n", category.Icon, category.Title))
					builder.WriteString("                <ul>\n")

					for _, change := range changes {
						builder.WriteString(fmt.Sprintf("                    <li>%s</li>\n", change.Description))
					}

					builder.WriteString("                </ul>\n")
					builder.WriteString("            </div>\n")
				}
			}
		}

		builder.WriteString("        </section>\n")
	}

	builder.WriteString("    </div>\n")
	builder.WriteString("</body>\n")
	builder.WriteString("</html>\n")

	return builder.String()
}

// Helper functions

func getPaths(spec *openapi3.T) map[string]map[string]*openapi3.Operation {
	paths := make(map[string]map[string]*openapi3.Operation)

	if spec.Paths == nil {
		return paths
	}

	for path, pathItem := range spec.Paths.Map() {
		methods := make(map[string]*openapi3.Operation)

		if pathItem.Get != nil {
			methods["GET"] = pathItem.Get
		}
		if pathItem.Post != nil {
			methods["POST"] = pathItem.Post
		}
		if pathItem.Put != nil {
			methods["PUT"] = pathItem.Put
		}
		if pathItem.Delete != nil {
			methods["DELETE"] = pathItem.Delete
		}
		if pathItem.Patch != nil {
			methods["PATCH"] = pathItem.Patch
		}
		if pathItem.Head != nil {
			methods["HEAD"] = pathItem.Head
		}
		if pathItem.Options != nil {
			methods["OPTIONS"] = pathItem.Options
		}

		if len(methods) > 0 {
			paths[path] = methods
		}
	}

	return paths
}

func isBreakingChange(oldOp, newOp *openapi3.Operation) bool {
	// Compare parameters
	if len(oldOp.Parameters) != len(newOp.Parameters) {
		return true
	}

	// Compare request body
	oldBody := oldOp.RequestBody != nil
	newBody := newOp.RequestBody != nil
	if oldBody != newBody {
		return true
	}

	// Compare responses
	if len(oldOp.Responses) != len(newOp.Responses) {
		return true
	}

	return false
}

func compareSchemas(oldComps, newComps *openapi3.Components) []Change {
	changes := []Change{}

	if oldComps == nil || newComps == nil {
		return changes
	}

	// Compare schemas
	oldSchemas := oldComps.Schemas
	newSchemas := newComps.Schemas

	// Find new schemas
	for name := range newSchemas {
		if _, exists := oldSchemas[name]; !exists {
			changes = append(changes, Change{
				Type:        string(ChangeTypeAdded),
				Description: fmt.Sprintf("Added new schema: %s", name),
				Component:   "schema",
				Impact:      string(ImpactLevelLow),
			})
		}
	}

	// Find removed schemas
	for name := range oldSchemas {
		if _, exists := newSchemas[name]; !exists {
			changes = append(changes, Change{
				Type:        string(ChangeTypeRemoved),
				Description: fmt.Sprintf("Removed schema: %s", name),
				Component:   "schema",
				Impact:      string(ImpactLevelHigh),
			})
		}
	}

	return changes
}

func categorizeChanges(changes []Change) string {
	// Determine primary category based on changes
	for _, change := range changes {
		if change.Type == string(ChangeTypeBreakingChange) {
			return "breaking"
		}
		if change.Type == string(ChangeTypeSecurity) {
			return "security"
		}
	}

	// Default to "added" if any additions exist
	for _, change := range changes {
		if change.Type == string(ChangeTypeAdded) {
			return "added"
		}
	}

	return "changed"
}

func shouldIncludeCategory(category string) bool {
	// Default inclusion rules
	switch category {
	case "added", "changed", "fixed", "breaking", "security":
		return true
	default:
		return false
	}
}

func generateID() string {
	return fmt.Sprintf("chg_%d", time.Now().UnixNano())
}

// HTML CSS for changelog
const htmlCSS = `
body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    line-height: 1.6;
    color: #333;
    max-width: 800px;
    margin: 0 auto;
    padding: 2rem;
}

.container {
    background: white;
    padding: 2rem;
    border-radius: 8px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

h1 {
    color: #2c3e50;
    border-bottom: 2px solid #eee;
    padding-bottom: 0.5rem;
}

h2 {
    color: #34495e;
    margin-top: 2rem;
}

h3 {
    margin-top: 1.5rem;
}

.version {
    margin-bottom: 3rem;
}

.category {
    margin: 1rem 0;
    padding: 1rem;
    border-radius: 6px;
}

.category.breaking {
    background: #ffebee;
    border-left: 4px solid #dc3545;
}

.category.added {
    background: #e8f5e9;
    border-left: 4px solid #28a745;
}

.category.changed {
    background: #e3f2fd;
    border-left: 4px solid #17a2b8;
}

.category.fixed {
    background: #fff3e0;
    border-left: 4px solid #fd7e14;
}

.category.security {
    background: #f3e5f5;
    border-left: 4px solid #6f42c1;
}

.category.deprecated {
    background: #f8f9fa;
    border-left: 4px solid #6c757d;
}

ul {
    margin: 0;
    padding-left: 1.5rem;
}

li {
    margin: 0.5rem 0;
}

@media (max-width: 600px) {
    body {
        padding: 1rem;
    }

    .container {
        padding: 1rem;
    }
}
`

// FileChangelogStorage implements ChangelogStorage for file-based storage
type FileChangelogStorage struct {
	Dir string
}

func (fcs *FileChangelogStorage) Save(entry *ChangelogEntry) error {
	filename := filepath.Join(fcs.Dir, entry.Version+".json")

	data, err := json.MarshalIndent(entry, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(filename, data, 0644)
}

func (fcs *FileChangelogStorage) Load(version string) (*ChangelogEntry, error) {
	filename := filepath.Join(fcs.Dir, version+".json")

	data, err := os.ReadFile(filename)
	if err != nil {
		return nil, err
	}

	var entry ChangelogEntry
	if err := json.Unmarshal(data, &entry); err != nil {
		return nil, err
	}

	return &entry, nil
}

func (fcs *FileChangelogStorage) List() ([]*ChangelogEntry, error) {
	entries := []*ChangelogEntry{}

	files, err := os.ReadDir(fcs.Dir)
	if err != nil {
		return nil, err
	}

	for _, file := range files {
		if file.IsDir() || !strings.HasSuffix(file.Name(), ".json") {
			continue
		}

		version := strings.TrimSuffix(file.Name(), ".json")
		entry, err := fcs.Load(version)
		if err != nil {
			continue
		}

		entries = append(entries, entry)
	}

	return entries, nil
}

func (fcs *FileChangelogStorage) Search(query string) ([]*ChangelogEntry, error) {
	entries, err := fcs.List()
	if err != nil {
		return nil, err
	}

	var results []*ChangelogEntry
	query = strings.ToLower(query)

	for _, entry := range entries {
		// Search in title and description
		if strings.Contains(strings.ToLower(entry.Title), query) ||
			strings.Contains(strings.ToLower(entry.Description), query) {
			results = append(results, entry)
			continue
		}

		// Search in changes
		for _, change := range entry.Changes {
			if strings.Contains(strings.ToLower(change.Description), query) {
				results = append(results, entry)
				break
			}
		}
	}

	return results, nil
}
