package changelog

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/getkin/kin-openapi/openapi3"
	"github.com/sirupsen/logrus"
)

// ChangeType represents the type of API change
type ChangeType string

const (
	ChangeTypeAdded     ChangeType = "added"
	ChangeTypeChanged   ChangeType = "changed"
	ChangeTypeDeprecated ChangeType = "deprecated"
	ChangeTypeRemoved   ChangeType = "removed"
	ChangeTypeFixed     ChangeType = "fixed"
	ChangeTypeSecurity  ChangeType = "security"
)

// ChangeImpact represents the impact level of a change
type ChangeImpact string

const (
	ImpactBreaking    ChangeImpact = "breaking"
	ImpactMajor       ChangeImpact = "major"
	ImpactMinor       ChangeImpact = "minor"
	ImpactPatch       ChangeImpact = "patch"
	ImpactInternal    ChangeImpact = "internal"
)

// ChangeEntry represents a single changelog entry
type ChangeEntry struct {
	ID          string       `json:"id"`
	Type        ChangeType   `json:"type"`
	Impact      ChangeImpact `json:"impact"`
	Title       string       `json:"title"`
	Description string       `json:"description"`
	Component   string       `json:"component"`
	Endpoints   []string     `json:"endpoints,omitempty"`
	Author      string       `json:"author"`
	PR          string       `json:"pr,omitempty"`
	Issues      []string     `json:"issues,omitempty"`
	Metadata    Metadata     `json:"metadata,omitempty"`
	CreatedAt   time.Time    `json:"created_at"`
	ReleasedAt  *time.Time   `json:"released_at,omitempty"`
	ReleaseTag  string       `json:"release_tag,omitempty"`
}

// Metadata holds additional change metadata
type Metadata map[string]interface{}

// ChangelogVersion represents a version in the changelog
type ChangelogVersion struct {
	Version     string        `json:"version"`
	Title       string        `json:"title,omitempty"`
	Description string        `json:"description,omitempty"`
	ReleaseDate time.Time     `json:"release_date"`
	Changes     []ChangeEntry `json:"changes"`
	Summary     VersionSummary `json:"summary"`
}

// VersionSummary provides a summary of changes in a version
type VersionSummary struct {
	TotalChanges int                       `json:"total_changes"`
	ByType       map[ChangeType]int        `json:"by_type"`
	ByImpact     map[ChangeImpact]int      `json:"by_impact"`
	ByComponent  map[string]int            `json:"by_component"`
	Endpoints    map[string][]ChangeType   `json:"endpoints"`
}

// Changelog represents the complete API changelog
type Changelog struct {
	Versions []ChangelogVersion `json:"versions"`
	Metadata ChangelogMetadata   `json:"metadata"`
}

// ChangelogMetadata holds changelog metadata
type ChangelogMetadata struct {
	APIVersion    string    `json:"api_version"`
	GeneratedAt   time.Time `json:"generated_at"`
	TotalVersions int       `json:"total_versions"`
	TotalChanges  int       `json:"total_changes"`
	Repository    string    `json:"repository,omitempty"`
	Documentation string    `json:"documentation,omitempty"`
}

// ChangelogConfig holds configuration for changelog generation
type ChangelogConfig struct {
	// File paths
	InputSpecPath    string
	OutputPath       string
	TemplatePath     string

	// Repository information
	RepositoryURL string
	BaseBranch    string

	// Authors and contributors
	Authors map[string]string // name -> email

	// Component grouping
	Components map[string][]string // component -> endpoint patterns

	// Change classification rules
	Rules ChangeClassificationRules

	// Output formats
	Formats []string // json, markdown, html

	// Template customization
	Templates map[string]string // format -> template content
}

// ChangeClassificationRules defines how to classify changes
type ChangeClassificationRules struct {
	// Breaking change indicators
	BreakingKeywords []string

	// Major change indicators
	MajorKeywords []string

	// Security change indicators
	SecurityKeywords []string

	// Deprecated keywords
	DeprecatedKeywords []string

	// Component mapping patterns
	ComponentPatterns map[string]string // pattern -> component
}

// ChangelogGenerator generates and manages API changelogs
type ChangelogGenerator struct {
	config ChangelogConfig
	logger *logrus.Logger
}

// NewChangelogGenerator creates a new changelog generator
func NewChangelogGenerator(config ChangelogConfig, logger *logrus.Logger) (*ChangelogGenerator, error) {
	if logger == nil {
		logger = logrus.New()
	}

	// Set default values
	if len(config.Formats) == 0 {
		config.Formats = []string{"json", "markdown"}
	}

	if config.BaseBranch == "" {
		config.BaseBranch = "main"
	}

	// Set default classification rules
	if len(config.Rules.BreakingKeywords) == 0 {
		config.Rules.BreakingKeywords = []string{
			"breaking", "removed", "deleted", "replaced",
			"incompatible", "signature change", "behavior change",
		}
	}

	if len(config.Rules.MajorKeywords) == 0 {
		config.Rules.MajorKeywords = []string{
			"major", "significant", "substantial", "important",
		}
	}

	if len(config.Rules.SecurityKeywords) == 0 {
		config.Rules.SecurityKeywords = []string{
			"security", "vulnerability", "cve", "auth", "authorization",
			"encryption", "authentication", "permission", "access control",
		}
	}

	if len(config.Rules.DeprecatedKeywords) == 0 {
		config.Rules.DeprecatedKeywords = []string{
			"deprecated", "obsolete", "legacy", "phased out",
		}
	}

	return &ChangelogGenerator{
		config: config,
		logger: logger,
	}, nil
}

// GenerateFromSpec generates a changelog from OpenAPI specification changes
func (cg *ChangelogGenerator) GenerateFromSpec(ctx context.Context, oldSpec, newSpec *openapi3.T) (*Changelog, error) {
	cg.logger.Info("Generating changelog from OpenAPI specification changes")

	changes := make([]ChangeEntry, 0)

	// Compare specifications
	specChanges := cg.compareSpecifications(oldSpec, newSpec)
	changes = append(changes, specChanges...)

	// Classify changes
	for i := range changes {
		cg.classifyChange(&changes[i])
	}

	// Create version
	version := ChangelogVersion{
		Version:     newSpec.Info.Version,
		Description: newSpec.Info.Description,
		ReleaseDate: time.Now(),
		Changes:     changes,
	}

	// Generate summary
	version.Summary = cg.generateVersionSummary(version.Changes)

	// Load existing changelog
	changelog, err := cg.loadExistingChangelog()
	if err != nil {
		cg.logger.WithError(err).Warn("Failed to load existing changelog, creating new one")
		changelog = &Changelog{
			Versions: []ChangelogVersion{version},
			Metadata: ChangelogMetadata{
				APIVersion:  newSpec.Info.Version,
				GeneratedAt: time.Now(),
			},
		}
	} else {
		// Add new version to beginning
		changelog.Versions = append([]ChangelogVersion{version}, changelog.Versions...)
		changelog.Metadata.APIVersion = newSpec.Info.Version
		changelog.Metadata.GeneratedAt = time.Now()
	}

	// Update metadata
	changelog.Metadata.TotalVersions = len(changelog.Versions)
	changelog.Metadata.TotalChanges = cg.countTotalChanges(changelog.Versions)
	changelog.Metadata.Repository = cg.config.RepositoryURL

	cg.logger.WithFields(logrus.Fields{
		"total_versions": changelog.Metadata.TotalVersions,
		"total_changes":  changelog.Metadata.TotalChanges,
	}).Info("Changelog generated successfully")

	return changelog, nil
}

// compareSpecifications compares two OpenAPI specifications and identifies changes
func (cg *ChangelogGenerator) compareSpecifications(oldSpec, newSpec *openapi3.T) []ChangeEntry {
	changes := make([]ChangeEntry, 0)

	if oldSpec == nil {
		// Initial version
		changes = append(changes, ChangeEntry{
			ID:          generateID(),
			Type:        ChangeTypeAdded,
			Impact:      ImpactMajor,
			Title:       "Initial API release",
			Description: fmt.Sprintf("Initial release of %s API", newSpec.Info.Title),
			Component:   "API",
			Endpoints:   cg.getAllEndpoints(newSpec),
			CreatedAt:   time.Now(),
		})
		return changes
	}

	// Compare info section
	if oldSpec.Info.Title != newSpec.Info.Title {
		changes = append(changes, ChangeEntry{
			ID:          generateID(),
			Type:        ChangeTypeChanged,
			Impact:      ImpactMinor,
			Title:       "API title updated",
			Description: fmt.Sprintf("API title changed from '%s' to '%s'", oldSpec.Info.Title, newSpec.Info.Title),
			Component:   "API",
			CreatedAt:   time.Now(),
		})
	}

	// Compare paths
	pathChanges := cg.comparePaths(oldSpec.Paths, newSpec.Paths)
	changes = append(changes, pathChanges...)

	// Compare components
	componentChanges := cg.compareComponents(oldSpec.Components, newSpec.Components)
	changes = append(changes, componentChanges...)

	// Compare security schemes
	securityChanges := cg.compareSecuritySchemes(oldSpec.Components.SecuritySchemes, newSpec.Components.SecuritySchemes)
	changes = append(changes, securityChanges...)

	return changes
}

// comparePaths compares OpenAPI paths and identifies changes
func (cg *ChangelogGenerator) comparePaths(oldPaths, newPaths *openapi3.Paths) []ChangeEntry {
	changes := make([]ChangeEntry, 0)

	// Track all endpoints for reporting
	oldEndpoints := make(map[string]bool)
	newEndpoints := make(map[string]bool)

	oldPathMap := oldPaths.Map()
	newPathMap := newPaths.Map()

	// Find added and modified paths
	for path, newPathItem := range newPathMap {
		newEndpoints[path] = true

		if oldPathItem, exists := oldPathMap[path]; exists {
			// Path exists in both, compare operations
			oldEndpoints[path] = true

			// Compare operations
			opChanges := cg.compareOperations(path, oldPathItem, newPathItem)
			changes = append(changes, opChanges...)
		} else {
			// New path added
			changes = append(changes, ChangeEntry{
				ID:          generateID(),
				Type:        ChangeTypeAdded,
				Impact:      ImpactMinor,
				Title:       fmt.Sprintf("Added endpoint: %s", path),
				Description: fmt.Sprintf("New endpoint %s has been added", path),
				Component:   cg.getComponentFromPath(path),
				Endpoints:   []string{path},
				CreatedAt:   time.Now(),
			})
		}
	}

	// Find removed paths
	for path := range oldPathMap {
		if !newEndpoints[path] {
			changes = append(changes, ChangeEntry{
				ID:          generateID(),
				Type:        ChangeTypeRemoved,
				Impact:      ImpactBreaking,
				Title:       fmt.Sprintf("Removed endpoint: %s", path),
				Description: fmt.Sprintf("Endpoint %s has been removed", path),
				Component:   cg.getComponentFromPath(path),
				Endpoints:   []string{path},
				CreatedAt:   time.Now(),
			})
		}
	}

	return changes
}

// compareOperations compares operations within a path
func (cg *ChangelogGenerator) compareOperations(path string, oldItem, newItem *openapi3.PathItem) []ChangeEntry {
	changes := make([]ChangeEntry, 0)

	operations := map[string]*openapi3.Operation{
		"GET":    oldItem.Get, "POST": oldItem.Post, "PUT": oldItem.Put,
		"PATCH":  oldItem.Patch, "DELETE": oldItem.Delete,
		"HEAD":   oldItem.Head, "OPTIONS": oldItem.Options,
		"TRACE":  oldItem.Trace, "CONNECT": oldItem.Connect,
	}

	newOperations := map[string]*openapi3.Operation{
		"GET":    newItem.Get, "POST": newItem.Post, "PUT": newItem.Put,
		"PATCH":  newItem.Patch, "DELETE": newItem.Delete,
		"HEAD":   newItem.Head, "OPTIONS": newItem.Options,
		"TRACE":  newItem.Trace, "CONNECT": newItem.Connect,
	}

	for method, oldOp := range operations {
		newOp := newOperations[method]

		if oldOp == nil && newOp != nil {
			// Operation added
			changes = append(changes, ChangeEntry{
				ID:          generateID(),
				Type:        ChangeTypeAdded,
				Impact:      ImpactMinor,
				Title:       fmt.Sprintf("Added %s %s", method, path),
				Description: fmt.Sprintf("New %s operation added to %s", method, path),
				Component:   cg.getComponentFromPath(path),
				Endpoints:   []string{fmt.Sprintf("%s %s", method, path)},
				CreatedAt:   time.Now(),
			})
		} else if oldOp != nil && newOp == nil {
			// Operation removed
			changes = append(changes, ChangeEntry{
				ID:          generateID(),
				Type:        ChangeTypeRemoved,
				Impact:      ImpactBreaking,
				Title:       fmt.Sprintf("Removed %s %s", method, path),
				Description: fmt.Sprintf("%s operation removed from %s", method, path),
				Component:   cg.getComponentFromPath(path),
				Endpoints:   []string{fmt.Sprintf("%s %s", method, path)},
				CreatedAt:   time.Now(),
			})
		} else if oldOp != nil && newOp != nil {
			// Operation exists in both, compare details
			if oldOp.Summary != newOp.Summary {
				changes = append(changes, ChangeEntry{
					ID:          generateID(),
					Type:        ChangeTypeChanged,
					Impact:      ImpactPatch,
					Title:       fmt.Sprintf("Updated %s %s description", method, path),
					Description: fmt.Sprintf("Operation description updated for %s %s", method, path),
					Component:   cg.getComponentFromPath(path),
					Endpoints:   []string{fmt.Sprintf("%s %s", method, path)},
					CreatedAt:   time.Now(),
				})
			}

			// Compare parameters
			paramChanges := cg.compareParameters(fmt.Sprintf("%s %s", method, path), oldOp.Parameters, newOp.Parameters)
			changes = append(changes, paramChanges...)

			// Compare responses
			responseChanges := cg.compareResponses(fmt.Sprintf("%s %s", method, path), *oldOp.Responses, *newOp.Responses)
			changes = append(changes, responseChanges...)
		}
	}

	return changes
}

// compareParameters compares operation parameters
func (cg *ChangelogGenerator) compareParameters(operation string, oldParams, newParams openapi3.Parameters) []ChangeEntry {
	changes := make([]ChangeEntry, 0)

	oldParamMap := make(map[string]*openapi3.ParameterRef)
	newParamMap := make(map[string]*openapi3.ParameterRef)

	for _, param := range oldParams {
		if param.Value != nil {
			oldParamMap[param.Value.Name] = param
		}
	}

	for _, param := range newParams {
		if param.Value != nil {
			newParamMap[param.Value.Name] = param
		}
	}

	// Find added parameters
	for name := range newParamMap {
		if _, exists := oldParamMap[name]; !exists {
			changes = append(changes, ChangeEntry{
				ID:          generateID(),
				Type:        ChangeTypeAdded,
				Impact:      ImpactMinor,
				Title:       fmt.Sprintf("Added parameter '%s' to %s", name, operation),
				Description: fmt.Sprintf("New parameter '%s' added to %s", name, operation),
				Component:   cg.getComponentFromOperation(operation),
				Endpoints:   []string{operation},
				CreatedAt:   time.Now(),
			})
		}
	}

	// Find removed parameters
	for name := range oldParamMap {
		if _, exists := newParamMap[name]; !exists {
			changes = append(changes, ChangeEntry{
				ID:          generateID(),
				Type:        ChangeTypeRemoved,
				Impact:      ImpactBreaking,
				Title:       fmt.Sprintf("Removed parameter '%s' from %s", name, operation),
				Description: fmt.Sprintf("Parameter '%s' removed from %s", name, operation),
				Component:   cg.getComponentFromOperation(operation),
				Endpoints:   []string{operation},
				CreatedAt:   time.Now(),
			})
		}
	}

	return changes
}

// compareResponses compares operation responses
func (cg *ChangelogGenerator) compareResponses(operation string, oldResponses, newResponses openapi3.Responses) []ChangeEntry {
	changes := make([]ChangeEntry, 0)

	// Compare response codes and schemas
	// This is a simplified implementation - a more thorough comparison would
	// analyze schema changes in detail

	return changes
}

// compareComponents compares OpenAPI components
func (cg *ChangelogGenerator) compareComponents(oldComponents, newComponents *openapi3.Components) []ChangeEntry {
	changes := make([]ChangeEntry, 0)

	// Compare schemas
	schemaChanges := cg.compareSchemas(oldComponents.Schemas, newComponents.Schemas)
	changes = append(changes, schemaChanges...)

	// Compare other components as needed

	return changes
}

// compareSchemas compares schema components
func (cg *ChangelogGenerator) compareSchemas(oldSchemas, newSchemas openapi3.Schemas) []ChangeEntry {
	changes := make([]ChangeEntry, 0)

	// Find added schemas
	for name := range newSchemas {
		if _, exists := oldSchemas[name]; !exists {
			changes = append(changes, ChangeEntry{
				ID:          generateID(),
				Type:        ChangeTypeAdded,
				Impact:      ImpactMinor,
				Title:       fmt.Sprintf("Added schema: %s", name),
				Description: fmt.Sprintf("New schema '%s' has been added", name),
				Component:   "Schemas",
				CreatedAt:   time.Now(),
			})
		}
	}

	// Find removed schemas
	for name := range oldSchemas {
		if _, exists := newSchemas[name]; !exists {
			changes = append(changes, ChangeEntry{
				ID:          generateID(),
				Type:        ChangeTypeRemoved,
				Impact:      ImpactBreaking,
				Title:       fmt.Sprintf("Removed schema: %s", name),
				Description: fmt.Sprintf("Schema '%s' has been removed", name),
				Component:   "Schemas",
				CreatedAt:   time.Now(),
			})
		}
	}

	return changes
}

// compareSecuritySchemes compares security scheme components
func (cg *ChangelogGenerator) compareSecuritySchemes(oldSchemes, newSchemes openapi3.SecuritySchemes) []ChangeEntry {
	changes := make([]ChangeEntry, 0)

	// Find added security schemes
	for name := range newSchemes {
		if _, exists := oldSchemes[name]; !exists {
			changes = append(changes, ChangeEntry{
				ID:          generateID(),
				Type:        ChangeTypeAdded,
				Impact:      ImpactMinor,
				Title:       fmt.Sprintf("Added security scheme: %s", name),
				Description: fmt.Sprintf("New security scheme '%s' has been added", name),
				Component:   "Security",
				CreatedAt:   time.Now(),
			})
		}
	}

	// Find removed security schemes
	for name := range oldSchemes {
		if _, exists := newSchemes[name]; !exists {
			changes = append(changes, ChangeEntry{
				ID:          generateID(),
				Type:        ChangeTypeRemoved,
				Impact:      ImpactBreaking,
				Title:       fmt.Sprintf("Removed security scheme: %s", name),
				Description: fmt.Sprintf("Security scheme '%s' has been removed", name),
				Component:   "Security",
				CreatedAt:   time.Now(),
			})
		}
	}

	return changes
}

// classifyChange classifies the impact and type of a change
func (cg *ChangelogGenerator) classifyChange(change *ChangeEntry) {
	description := strings.ToLower(change.Description)
	title := strings.ToLower(change.Title)
	text := description + " " + title

	// Classify type
	if change.Type == "" {
		switch {
		case strings.Contains(text, "security") || strings.Contains(text, "vulnerability"):
			change.Type = ChangeTypeSecurity
		case strings.Contains(text, "deprecated"):
			change.Type = ChangeTypeDeprecated
		case strings.Contains(text, "fix") || strings.Contains(text, "bug"):
			change.Type = ChangeTypeFixed
		case strings.Contains(text, "removed") || strings.Contains(text, "deleted"):
			change.Type = ChangeTypeRemoved
		case strings.Contains(text, "changed") || strings.Contains(text, "updated"):
			change.Type = ChangeTypeChanged
		default:
			change.Type = ChangeTypeAdded
		}
	}

	// Classify impact
	if change.Impact == "" {
		switch {
		case cg.containsAny(text, cg.config.Rules.BreakingKeywords):
			change.Impact = ImpactBreaking
		case cg.containsAny(text, cg.config.Rules.MajorKeywords):
			change.Impact = ImpactMajor
		case change.Type == ChangeTypeAdded || change.Type == ChangeTypeFixed:
			change.Impact = ImpactMinor
		default:
			change.Impact = ImpactPatch
		}
	}
}

// containsAny checks if text contains any of the keywords
func (cg *ChangelogGenerator) containsAny(text string, keywords []string) bool {
	for _, keyword := range keywords {
		if strings.Contains(text, strings.ToLower(keyword)) {
			return true
		}
	}
	return false
}

// generateVersionSummary generates a summary of changes for a version
func (cg *ChangelogGenerator) generateVersionSummary(changes []ChangeEntry) VersionSummary {
	summary := VersionSummary{
		TotalChanges: len(changes),
		ByType:       make(map[ChangeType]int),
		ByImpact:     make(map[ChangeImpact]int),
		ByComponent:  make(map[string]int),
		Endpoints:    make(map[string][]ChangeType),
	}

	for _, change := range changes {
		// Count by type
		summary.ByType[change.Type]++

		// Count by impact
		summary.ByImpact[change.Impact]++

		// Count by component
		summary.ByComponent[change.Component]++

		// Track endpoints
		for _, endpoint := range change.Endpoints {
			if summary.Endpoints[endpoint] == nil {
				summary.Endpoints[endpoint] = make([]ChangeType, 0)
			}
			summary.Endpoints[endpoint] = append(summary.Endpoints[endpoint], change.Type)
		}
	}

	return summary
}

// loadExistingChangelog loads an existing changelog from disk
func (cg *ChangelogGenerator) loadExistingChangelog() (*Changelog, error) {
	changelogPath := filepath.Join(cg.config.OutputPath, "changelog.json")

	if _, err := os.Stat(changelogPath); os.IsNotExist(err) {
		return nil, fmt.Errorf("changelog file does not exist")
	}

	data, err := os.ReadFile(changelogPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read changelog file: %w", err)
	}

	var changelog Changelog
	if err := json.Unmarshal(data, &changelog); err != nil {
		return nil, fmt.Errorf("failed to unmarshal changelog: %w", err)
	}

	return &changelog, nil
}

// saveChangelog saves the changelog to disk
func (cg *ChangelogGenerator) saveChangelog(changelog *Changelog) error {
	// Create output directory if it doesn't exist
	if err := os.MkdirAll(cg.config.OutputPath, 0755); err != nil {
		return fmt.Errorf("failed to create output directory: %w", err)
	}

	// Save JSON version
	jsonPath := filepath.Join(cg.config.OutputPath, "changelog.json")
	jsonData, err := json.MarshalIndent(changelog, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal changelog JSON: %w", err)
	}

	if err := os.WriteFile(jsonPath, jsonData, 0644); err != nil {
		return fmt.Errorf("failed to write changelog JSON: %w", err)
	}

	// Generate other formats if requested
	for _, format := range cg.config.Formats {
		if format == "markdown" {
			if err := cg.generateMarkdownChangelog(changelog); err != nil {
				cg.logger.WithError(err).Error("Failed to generate markdown changelog")
			}
		} else if format == "html" {
			if err := cg.generateHTMLChangelog(changelog); err != nil {
				cg.logger.WithError(err).Error("Failed to generate HTML changelog")
			}
		}
	}

	return nil
}

// generateMarkdownChangelog generates a markdown version of the changelog
func (cg *ChangelogGenerator) generateMarkdownChangelog(changelog *Changelog) error {
	var builder strings.Builder

	// Header
	builder.WriteString(fmt.Sprintf("# %s API Changelog\n\n", changelog.Metadata.APIVersion))

	if changelog.Metadata.Repository != "" {
		builder.WriteString(fmt.Sprintf("**Repository:** %s\n\n", changelog.Metadata.Repository))
	}

	builder.WriteString(fmt.Sprintf("**Last Updated:** %s\n\n", changelog.Metadata.GeneratedAt.Format("2006-01-02")))

	// Generate TOC
	builder.WriteString("## Table of Contents\n\n")
	for _, version := range changelog.Versions {
		builder.WriteString(fmt.Sprintf("- [%s](#version-%s)\n", version.Version, strings.ReplaceAll(version.Version, ".", "")))
	}
	builder.WriteString("\n")

	// Generate version entries
	for _, version := range changelog.Versions {
		builder.WriteString(fmt.Sprintf("## Version %s\n\n", version.Version))
		builder.WriteString(fmt.Sprintf("**Released:** %s\n\n", version.ReleaseDate.Format("2006-01-02")))

		if version.Description != "" {
			builder.WriteString(fmt.Sprintf("%s\n\n", version.Description))
		}

		// Group changes by type
		changesByType := make(map[ChangeType][]ChangeEntry)
		for _, change := range version.Changes {
			changesByType[change.Type] = append(changesByType[change.Type], change)
		}

		// Generate sections for each change type
		typeOrder := []ChangeType{ChangeTypeAdded, ChangeTypeChanged, ChangeTypeDeprecated, ChangeTypeRemoved, ChangeTypeFixed, ChangeTypeSecurity}
		for _, changeType := range typeOrder {
			if changes, exists := changesByType[changeType]; exists && len(changes) > 0 {
				builder.WriteString(fmt.Sprintf("### %s\n\n", strings.Title(string(changeType))))

				for _, change := range changes {
					builder.WriteString(fmt.Sprintf("- **%s** (%s)\n", change.Title, change.Impact))
					if change.Description != "" {
						builder.WriteString(fmt.Sprintf("  %s\n", change.Description))
					}
					if len(change.Endpoints) > 0 {
						builder.WriteString(fmt.Sprintf("  **Endpoints:** %s\n", strings.Join(change.Endpoints, ", ")))
					}
					if change.Author != "" {
						builder.WriteString(fmt.Sprintf("  **Author:** %s\n", change.Author))
					}
					if change.PR != "" {
						builder.WriteString(fmt.Sprintf("  **PR:** #%s\n", change.PR))
					}
					if len(change.Issues) > 0 {
						builder.WriteString(fmt.Sprintf("  **Issues:** %s\n", strings.Join(change.Issues, ", ")))
					}
					builder.WriteString("\n")
				}
			}
		}
	}

	// Write markdown file
	markdownPath := filepath.Join(cg.config.OutputPath, "CHANGELOG.md")
	if err := os.WriteFile(markdownPath, []byte(builder.String()), 0644); err != nil {
		return fmt.Errorf("failed to write markdown changelog: %w", err)
	}

	return nil
}

// generateHTMLChangelog generates an HTML version of the changelog
func (cg *ChangelogGenerator) generateHTMLChangelog(changelog *Changelog) error {
	// This would generate a comprehensive HTML changelog
	// Implementation would include HTML templates, CSS styling, etc.

	htmlPath := filepath.Join(cg.config.OutputPath, "changelog.html")
	htmlContent := `<!DOCTYPE html>
<html>
<head>
    <title>API Changelog</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        .version { border-bottom: 1px solid #eee; margin-bottom: 30px; }
        .change { margin: 10px 0; padding: 10px; background: #f9f9f9; border-left: 4px solid #007bff; }
        .breaking { border-left-color: #dc3545; }
        .major { border-left-color: #fd7e14; }
        .minor { border-left-color: #28a745; }
        .security { border-left-color: #ffc107; }
    </style>
</head>
<body>
    <h1>API Changelog</h1>
    <p>HTML changelog generation would be implemented here with full styling and interactivity.</p>
</body>
</html>`

	return os.WriteFile(htmlPath, []byte(htmlContent), 0644)
}

// Helper functions

// generateID generates a unique ID for a change entry
func generateID() string {
	return fmt.Sprintf("change_%d", time.Now().UnixNano())
}

// getAllEndpoints extracts all endpoints from an OpenAPI spec
func (cg *ChangelogGenerator) getAllEndpoints(spec *openapi3.T) []string {
	endpoints := make([]string, 0)

	for path, pathItem := range spec.Paths.Map() {
		operations := map[string]*openapi3.Operation{
			"GET": pathItem.Get, "POST": pathItem.Post, "PUT": pathItem.Put,
			"PATCH": pathItem.Patch, "DELETE": pathItem.Delete,
		}

		for method, op := range operations {
			if op != nil {
				endpoints = append(endpoints, fmt.Sprintf("%s %s", method, path))
			}
		}
	}

	sort.Strings(endpoints)
	return endpoints
}

// getComponentFromPath determines the component from a path
func (cg *ChangelogGenerator) getComponentFromPath(path string) string {
	// Extract component from path patterns
	for component, patterns := range cg.config.Components {
		for _, pattern := range patterns {
			if strings.Contains(path, pattern) {
				return component
			}
		}
	}

	// Default component based on path structure
	if strings.Contains(path, "/auth") {
		return "Authentication"
	} else if strings.Contains(path, "/users") {
		return "User Management"
	} else if strings.Contains(path, "/tenants") {
		return "Tenant Management"
	} else if strings.Contains(path, "/documents") {
		return "Document Management"
	} else if strings.Contains(path, "/rag") {
		return "RAG"
	} else if strings.Contains(path, "/policies") {
		return "Policy Management"
	}

	return "API"
}

// getComponentFromOperation determines the component from an operation string
func (cg *ChangelogGenerator) getComponentFromOperation(operation string) string {
	parts := strings.Fields(operation)
	if len(parts) >= 2 {
		return cg.getComponentFromPath(parts[1])
	}
	return "API"
}

// countTotalChanges counts total changes across all versions
func (cg *ChangelogGenerator) countTotalChanges(versions []ChangelogVersion) int {
	total := 0
	for _, version := range versions {
		total += len(version.Changes)
	}
	return total
}

// Public API methods

// AddChange adds a manual change entry to the current version
func (cg *ChangelogGenerator) AddChange(change ChangeEntry) error {
	// Load existing changelog
	changelog, err := cg.loadExistingChangelog()
	if err != nil {
		return fmt.Errorf("failed to load changelog: %w", err)
	}

	// Add change to latest version
	if len(changelog.Versions) > 0 {
		change.ID = generateID()
		change.CreatedAt = time.Now()
		cg.classifyChange(&change)

		changelog.Versions[0].Changes = append(changelog.Versions[0].Changes, change)
		changelog.Versions[0].Summary = cg.generateVersionSummary(changelog.Versions[0].Changes)

		// Save updated changelog
		return cg.saveChangelog(changelog)
	}

	return fmt.Errorf("no versions found in changelog")
}

// GetLatestVersion returns the latest version from the changelog
func (cg *ChangelogGenerator) GetLatestVersion() (*ChangelogVersion, error) {
	changelog, err := cg.loadExistingChangelog()
	if err != nil {
		return nil, fmt.Errorf("failed to load changelog: %w", err)
	}

	if len(changelog.Versions) == 0 {
		return nil, fmt.Errorf("no versions found in changelog")
	}

	return &changelog.Versions[0], nil
}

// GetVersion returns a specific version from the changelog
func (cg *ChangelogGenerator) GetVersion(version string) (*ChangelogVersion, error) {
	changelog, err := cg.loadExistingChangelog()
	if err != nil {
		return nil, fmt.Errorf("failed to load changelog: %w", err)
	}

	for _, v := range changelog.Versions {
		if v.Version == version {
			return &v, nil
		}
	}

	return nil, fmt.Errorf("version %s not found in changelog", version)
}
