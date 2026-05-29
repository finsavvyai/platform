//go:build ignore

package sdk

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"text/template"
	"time"

	"github.com/getkin/kin-openapi/openapi3"
	"github.com/google/uuid"
	"github.com/sirupsen/logrus"
)

// Language represents a programming language for SDK generation
type Language string

const (
	LanguagePython     Language = "python"
	LanguageTypeScript Language = "typescript"
	LanguageGo         Language = "go"
	LanguageJava       Language = "java"
	LanguageCSharp     Language = "csharp"
	LanguageRuby       Language = "ruby"
	LanguagePHP        Language = "php"
)

// SDKConfig holds configuration for SDK generation
type SDKConfig struct {
	// OpenAPI specification
	Spec *openapi3.T

	// Target languages
	Languages []Language

	// Output directory
	OutputDir string

	// Package name
	PackageName string

	// Package version
	PackageVersion string

	// Author information
	Author string
	Email  string

	// License
	License string

	// Repository URL
	RepositoryURL string

	// Documentation URL
	DocumentationURL string

	// Custom templates
	CustomTemplates map[Language]*template.Template

	// Enable async support
	EnableAsync bool

	// Enable streaming support
	EnableStreaming bool

	// Custom code generators
	CustomGenerators map[Language]CodeGenerator
}

// CodeGenerator interface for custom code generation
type CodeGenerator interface {
	Generate(ctx context.Context, config SDKConfig, lang Language) (*GeneratedSDK, error)
	Validate() error
}

// GeneratedSDK represents a generated SDK
type GeneratedSDK struct {
	Language     Language
	PackageName  string
	Version      string
	Files        map[string]string
	Dependencies []string
	Examples     []string
	Readme       string
	License      string
}

// SDKGenerator handles SDK generation for multiple languages
type SDKGenerator struct {
	config SDKConfig
	logger *logrus.Logger
}

// NewSDKGenerator creates a new SDK generator
func NewSDKGenerator(config SDKConfig, logger *logrus.Logger) (*SDKGenerator, error) {
	if logger == nil {
		logger = logrus.New()
	}

	// Validate OpenAPI spec
	if config.Spec == nil {
		return nil, fmt.Errorf("OpenAPI specification is required")
	}

	if err := config.Spec.Validate(context.Background()); err != nil {
		return nil, fmt.Errorf("invalid OpenAPI specification: %w", err)
	}

	// Set defaults
	if config.PackageName == "" {
		config.PackageName = "sdlc-ai-sdk"
	}

	if config.PackageVersion == "" {
		config.PackageVersion = "1.0.0"
	}

	if config.License == "" {
		config.License = "MIT"
	}

	if config.OutputDir == "" {
		config.OutputDir = "./generated-sdks"
	}

	return &SDKGenerator{
		config: config,
		logger: logger,
	}, nil
}

// GenerateAll generates SDKs for all configured languages
func (sg *SDKGenerator) GenerateAll(ctx context.Context) (map[Language]*GeneratedSDK, error) {
	sg.logger.Info("Starting SDK generation for multiple languages")

	results := make(map[Language]*GeneratedSDK)

	for _, lang := range sg.config.Languages {
		sdk, err := sg.GenerateForLanguage(ctx, lang)
		if err != nil {
			sg.logger.WithError(err).WithField("language", lang).Error("Failed to generate SDK")
			return nil, fmt.Errorf("failed to generate SDK for %s: %w", lang, err)
		}

		results[lang] = sdk
		sg.logger.WithField("language", lang).Info("SDK generated successfully")
	}

	sg.logger.WithField("count", len(results)).Info("All SDKs generated successfully")
	return results, nil
}

// GenerateForLanguage generates an SDK for a specific language
func (sg *SDKGenerator) GenerateForLanguage(ctx context.Context, lang Language) (*GeneratedSDK, error) {
	sg.logger.WithField("language", lang).Info("Generating SDK")

	// Check for custom generator
	if generator, exists := sg.config.CustomGenerators[lang]; exists {
		if err := generator.Validate(); err != nil {
			return nil, fmt.Errorf("invalid custom generator for %s: %w", lang, err)
		}
		return generator.Generate(ctx, sg.config, lang)
	}

	// Use built-in generator
	switch lang {
	case LanguagePython:
		return sg.generatePythonSDK(ctx)
	case LanguageTypeScript:
		return sg.generateTypeScriptSDK(ctx)
	case LanguageGo:
		return sg.generateGoSDK(ctx)
	case LanguageJava:
		return sg.generateJavaSDK(ctx)
	case LanguageCSharp:
		return sg.generateCSharpSDK(ctx)
	case LanguageRuby:
		return sg.generateRubySDK(ctx)
	case LanguagePHP:
		return sg.generatePHPSDK(ctx)
	default:
		return nil, fmt.Errorf("unsupported language: %s", lang)
	}
}

// generatePythonSDK generates a Python SDK
func (sg *SDKGenerator) generatePythonSDK(ctx context.Context) (*GeneratedSDK, error) {
	sdk := &GeneratedSDK{
		Language:    LanguagePython,
		PackageName: sg.config.PackageName,
		Version:     sg.config.PackageVersion,
		Files:       make(map[string]string),
		Dependencies: []string{
			"requests>=2.31.0",
			"pydantic>=2.0.0",
			"typing-extensions>=4.0.0",
		},
	}

	// Generate setup.py
	setupPy, err := sg.generatePythonSetup(sdk)
	if err != nil {
		return nil, fmt.Errorf("failed to generate setup.py: %w", err)
	}
	sdk.Files["setup.py"] = setupPy

	// Generate pyproject.toml
	pyprojectToml, err := sg.generatePythonPyproject(sdk)
	if err != nil {
		return nil, fmt.Errorf("failed to generate pyproject.toml: %w", err)
	}
	sdk.Files["pyproject.toml"] = pyprojectToml

	// Generate main client
	client, err := sg.generatePythonClient(sdk)
	if err != nil {
		return nil, fmt.Errorf("failed to generate client: %w", err)
	}
	sdk.Files[filepath.Join(sdk.PackageName, "client.py")] = client

	// Generate models
	models, err := sg.generatePythonModels(sdk)
	if err != nil {
		return nil, fmt.Errorf("failed to generate models: %w", err)
	}
	sdk.Files[filepath.Join(sdk.PackageName, "models.py")] = models

	// Generate API endpoints
	apiEndpoints, err := sg.generatePythonAPIEndpoints(sdk)
	if err != nil {
		return nil, fmt.Errorf("failed to generate API endpoints: %w", err)
	}
	sdk.Files[filepath.Join(sdk.PackageName, "api", "__init__.py")] = apiEndpoints

	// Generate exceptions
	exceptions, err := sg.generatePythonExceptions(sdk)
	if err != nil {
		return nil, fmt.Errorf("failed to generate exceptions: %w", err)
	}
	sdk.Files[filepath.Join(sdk.PackageName, "exceptions.py")] = exceptions

	// Generate __init__.py
	initPy, err := sg.generatePythonInit(sdk)
	if err != nil {
		return nil, fmt.Errorf("failed to generate __init__.py: %w", err)
	}
	sdk.Files[filepath.Join(sdk.PackageName, "__init__.py")] = initPy

	// Generate README
	sdk.Readme = sg.generatePythonReadme(sdk)

	// Generate examples
	sdk.Examples = sg.generatePythonExamples(sdk)

	// Generate license
	sdk.License = sg.generateLicense()

	return sdk, nil
}

// generateTypeScriptSDK generates a TypeScript SDK
func (sg *SDKGenerator) generateTypeScriptSDK(ctx context.Context) (*GeneratedSDK, error) {
	sdk := &GeneratedSDK{
		Language:    LanguageTypeScript,
		PackageName: sg.config.PackageName,
		Version:     sg.config.PackageVersion,
		Files:       make(map[string]string),
		Dependencies: []string{
			"axios>=1.6.0",
			"typescript>=5.0.0",
		},
		DevDependencies: []string{
			"@types/node>=20.0.0",
			"jest>=29.0.0",
			"@types/jest>=29.0.0",
			"ts-jest>=29.0.0",
			"rollup>=4.0.0",
			"@rollup/plugin-typescript>=11.0.0",
		},
	}

	// Generate package.json
	packageJson, err := sg.generateTypeScriptPackage(sdk)
	if err != nil {
		return nil, fmt.Errorf("failed to generate package.json: %w", err)
	}
	sdk.Files["package.json"] = packageJson

	// Generate tsconfig.json
	tsconfigJson, err := sg.generateTypeScriptTSConfig(sdk)
	if err != nil {
		return nil, fmt.Errorf("failed to generate tsconfig.json: %w", err)
	}
	sdk.Files["tsconfig.json"] = tsconfigJson

	// Generate main client
	client, err := sg.generateTypeScriptClient(sdk)
	if err != nil {
		return nil, fmt.Errorf("failed to generate client: %w", err)
	}
	sdk.Files["src/client.ts"] = client

	// Generate types
	types, err := sg.generateTypeScriptTypes(sdk)
	if err != nil {
		return nil, fmt.Errorf("failed to generate types: %w", err)
	}
	sdk.Files["src/types.ts"] = types

	// Generate API endpoints
	apiEndpoints, err := sg.generateTypeScriptAPIEndpoints(sdk)
	if err != nil {
		return nil, fmt.Errorf("failed to generate API endpoints: %w", err)
	}
	sdk.Files["src/api/index.ts"] = apiEndpoints

	// Generate exceptions
	exceptions, err := sg.generateTypeScriptExceptions(sdk)
	if err != nil {
		return nil, fmt.Errorf("failed to generate exceptions: %w", err)
	}
	sdk.Files["src/exceptions.ts"] = exceptions

	// Generate README
	sdk.Readme = sg.generateTypeScriptReadme(sdk)

	// Generate examples
	sdk.Examples = sg.generateTypeScriptExamples(sdk)

	// Generate license
	sdk.License = sg.generateLicense()

	return sdk, nil
}

// generateGoSDK generates a Go SDK
func (sg *SDKGenerator) generateGoSDK(ctx context.Context) (*GeneratedSDK, error) {
	sdk := &GeneratedSDK{
		Language:     LanguageGo,
		PackageName:  "github.com/sdlc-ai/" + sg.config.PackageName,
		Version:      sg.config.PackageVersion,
		Files:        make(map[string]string),
		Dependencies: []string{},
	}

	// Generate go.mod
	goMod, err := sg.generateGoMod(sdk)
	if err != nil {
		return nil, fmt.Errorf("failed to generate go.mod: %w", err)
	}
	sdk.Files["go.mod"] = goMod

	// Generate main client
	client, err := sg.generateGoClient(sdk)
	if err != nil {
		return nil, fmt.Errorf("failed to generate client: %w", err)
	}
	sdk.Files["client.go"] = client

	// Generate models
	models, err := sg.generateGoModels(sdk)
	if err != nil {
		return nil, fmt.Errorf("failed to generate models: %w", err)
	}
	sdk.Files["models.go"] = models

	// Generate API endpoints
	apiEndpoints, err := sg.generateGoAPIEndpoints(sdk)
	if err != nil {
		return nil, fmt.Errorf("failed to generate API endpoints: %w", err)
	}
	sdk.Files["api.go"] = apiEndpoints

	// Generate README
	sdk.Readme = sg.generateGoReadme(sdk)

	// Generate examples
	sdk.Examples = sg.generateGoExamples(sdk)

	// Generate license
	sdk.License = sg.generateLicense()

	return sdk, nil
}

// SaveToDisk saves the generated SDK to disk
func (sg *SDKGenerator) SaveToDisk(sdk *GeneratedSDK) error {
	baseDir := filepath.Join(sg.config.OutputDir, string(sdk.Language))

	// Create base directory
	if err := os.MkdirAll(baseDir, 0755); err != nil {
		return fmt.Errorf("failed to create output directory: %w", err)
	}

	// Write files
	for filename, content := range sdk.Files {
		filePath := filepath.Join(baseDir, filename)
		dir := filepath.Dir(filePath)

		// Create directory if it doesn't exist
		if err := os.MkdirAll(dir, 0755); err != nil {
			return fmt.Errorf("failed to create directory %s: %w", dir, err)
		}

		// Write file
		if err := os.WriteFile(filePath, []byte(content), 0644); err != nil {
			return fmt.Errorf("failed to write file %s: %w", filePath, err)
		}
	}

	// Write README
	if sdk.Readme != "" {
		readmePath := filepath.Join(baseDir, "README.md")
		if err := os.WriteFile(readmePath, []byte(sdk.Readme), 0644); err != nil {
			return fmt.Errorf("failed to write README: %w", err)
		}
	}

	// Write license
	if sdk.License != "" {
		licensePath := filepath.Join(baseDir, "LICENSE")
		if err := os.WriteFile(licensePath, []byte(sdk.License), 0644); err != nil {
			return fmt.Errorf("failed to write LICENSE: %w", err)
		}
	}

	// Write examples
	if len(sdk.Examples) > 0 {
		examplesDir := filepath.Join(baseDir, "examples")
		if err := os.MkdirAll(examplesDir, 0755); err != nil {
			return fmt.Errorf("failed to create examples directory: %w", err)
		}

		for i, example := range sdk.Examples {
			exampleFile := filepath.Join(examplesDir, fmt.Sprintf("example_%d%s", i+1, getFileExtension(sdk.Language)))
			if err := os.WriteFile(exampleFile, []byte(example), 0644); err != nil {
				return fmt.Errorf("failed to write example: %w", err)
			}
		}
	}

	sg.logger.WithFields(logrus.Fields{
		"language": sdk.Language,
		"path":     baseDir,
	}).Info("SDK saved to disk")

	return nil
}

// generateLicense generates the license file
func (sg *SDKGenerator) generateLicense() string {
	if sg.config.License == "MIT" {
		return `MIT License

Copyright (c) ` + time.Now().Year() + ` ` + sg.config.Author + `

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`
	}

	return fmt.Sprintf("License: %s\n\nPlease add your license text here.", sg.config.License)
}

// getFileExtension returns the appropriate file extension for a language
func getFileExtension(lang Language) string {
	switch lang {
	case LanguagePython:
		return ".py"
	case LanguageTypeScript:
		return ".ts"
	case LanguageGo:
		return ".go"
	case LanguageJava:
		return ".java"
	case LanguageCSharp:
		return ".cs"
	case LanguageRuby:
		return ".rb"
	case LanguagePHP:
		return ".php"
	default:
		return ".txt"
	}
}

// Template helper functions
func (sg *SDKGenerator) executeTemplate(templateContent string, data interface{}) (string, error) {
	tmpl, err := template.New("sdk").Parse(templateContent)
	if err != nil {
		return "", fmt.Errorf("failed to parse template: %w", err)
	}

	var buf bytes.Buffer
	if err := tmpl.Execute(&buf, data); err != nil {
		return "", fmt.Errorf("failed to execute template: %w", err)
	}

	return buf.String(), nil
}

// HTTPClient represents an HTTP client for the SDK
type HTTPClient interface {
	Do(req *http.Request) (*http.Response, error)
}

// SDKClient represents the base SDK client
type SDKClient struct {
	BaseURL    string
	HTTPClient HTTPClient
	APIKey     string
	AuthToken  string
	Headers    map[string]string
}

// NewSDKClient creates a new SDK client
func NewSDKClient(baseURL string) *SDKClient {
	return &SDKClient{
		BaseURL: baseURL,
		HTTPClient: &http.Client{
			Timeout: 30 * time.Second,
		},
		Headers: make(map[string]string),
	}
}

// SetAPIKey sets the API key for authentication
func (c *SDKClient) SetAPIKey(apiKey string) {
	c.APIKey = apiKey
	c.Headers["X-API-Key"] = apiKey
}

// SetAuthToken sets the auth token for authentication
func (c *SDKClient) SetAuthToken(token string) {
	c.AuthToken = token
	c.Headers["Authorization"] = "Bearer " + token
}

// SetHeader sets a custom header
func (c *SDKClient) SetHeader(key, value string) {
	c.Headers[key] = value
}

// Do executes an HTTP request with common headers and authentication
func (c *SDKClient) Do(req *http.Request) (*http.Response, error) {
	// Set common headers
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", fmt.Sprintf("%s-sdk/%s", sg.config.PackageName, sg.config.PackageVersion))

	// Set custom headers
	for key, value := range c.Headers {
		req.Header.Set(key, value)
	}

	// Set request ID
	req.Header.Set("X-Request-ID", uuid.New().String())

	return c.HTTPClient.Do(req)
}

// ValidateOpenAPISpec validates the OpenAPI specification for SDK generation
func (sg *SDKGenerator) ValidateOpenAPISpec() error {
	if sg.config.Spec == nil {
		return fmt.Errorf("OpenAPI specification is required")
	}

	if sg.config.Spec.Info == nil {
		return fmt.Errorf("OpenAPI spec missing info section")
	}

	if sg.config.Spec.Info.Title == "" {
		return fmt.Errorf("OpenAPI spec missing title")
	}

	if sg.config.Spec.Info.Version == "" {
		return fmt.Errorf("OpenAPI spec missing version")
	}

	if len(sg.config.Spec.Paths) == 0 {
		return fmt.Errorf("OpenAPI spec has no paths defined")
	}

	// Validate each path
	for path, pathItem := range sg.config.Spec.Paths {
		if pathItem == nil {
			continue
		}

		operations := []*openapi3.Operation{
			pathItem.Connect, pathItem.Delete, pathItem.Get,
			pathItem.Head, pathItem.Options, pathItem.Patch,
			pathItem.Post, pathItem.Put, pathItem.Trace,
		}

		hasOperation := false
		for _, op := range operations {
			if op != nil {
				hasOperation = true
				if op.OperationID == "" {
					sg.logger.WithField("path", path).Warn("Operation missing operation ID")
				}
			}
		}

		if !hasOperation {
			sg.logger.WithField("path", path).Warn("Path has no operations defined")
		}
	}

	return nil
}

// GenerateSDKPackage generates a complete SDK package for all languages
func (sg *SDKGenerator) GenerateSDKPackage(ctx context.Context) error {
	// Validate spec first
	if err := sg.ValidateOpenAPISpec(); err != nil {
		return fmt.Errorf("OpenAPI spec validation failed: %w", err)
	}

	// Generate SDKs for all languages
	sdks, err := sg.GenerateAll(ctx)
	if err != nil {
		return fmt.Errorf("failed to generate SDKs: %w", err)
	}

	// Save all SDKs to disk
	for lang, sdk := range sdks {
		if err := sg.SaveToDisk(sdk); err != nil {
			return fmt.Errorf("failed to save %s SDK: %w", lang, err)
		}
	}

	// Generate package manifest
	manifest := sg.generatePackageManifest(sdks)
	manifestPath := filepath.Join(sg.config.OutputDir, "manifest.json")
	if err := os.WriteFile(manifestPath, []byte(manifest), 0644); err != nil {
		return fmt.Errorf("failed to write package manifest: %w", err)
	}

	sg.logger.WithField("output_dir", sg.config.OutputDir).Info("SDK package generated successfully")
	return nil
}

// generatePackageManifest generates a package manifest with metadata
func (sg *SDKGenerator) generatePackageManifest(sdks map[Language]*GeneratedSDK) string {
	manifest := map[string]interface{}{
		"generated_at": time.Now().UTC().Format(time.RFC3339),
		"generator": map[string]interface{}{
			"name":    "sdlc-ai-sdk-generator",
			"version": "1.0.0",
		},
		"package": map[string]interface{}{
			"name":          sg.config.PackageName,
			"version":       sg.config.PackageVersion,
			"author":        sg.config.Author,
			"email":         sg.config.Email,
			"license":       sg.config.License,
			"repository":    sg.config.RepositoryURL,
			"documentation": sg.config.DocumentationURL,
		},
		"languages": make(map[string]interface{}),
		"openapi": map[string]interface{}{
			"title":       sg.config.Spec.Info.Title,
			"version":     sg.config.Spec.Info.Version,
			"description": sg.config.Spec.Info.Description,
		},
	}

	for lang, sdk := range sdks {
		manifest["languages"].(map[string]interface{})[string(lang)] = map[string]interface{}{
			"package_name": sdk.PackageName,
			"version":      sdk.Version,
			"files_count":  len(sdk.Files),
			"dependencies": sdk.Dependencies,
			"has_examples": len(sdk.Examples) > 0,
		}
	}

	manifestBytes, _ := json.MarshalIndent(manifest, "", "  ")
	return string(manifestBytes)
}
