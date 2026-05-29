package tools

import (
	"context"
	"encoding/json"
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"strings"

	"github.com/getkin/kin-openapi/openapi3"
	"github.com/google/uuid"
	"github.com/sirupsen/logrus"
)

// PostmanConfig holds configuration for Postman collection generation
type PostmanConfig struct {
	// Collection information
	Name        string
	Description string
	Schema      string // Postman schema version

	// Server configuration
	DefaultServer string
	Servers       []string

	// Authentication
	AuthType string // "apikey", "bearer", "basic", "oauth2"
	APIKey   string // For apikey auth
	Bearer   string // Default bearer token (for testing)

	// Environment variables
	Environment map[string]string

	// Request configuration
	Timeout int // Request timeout in seconds

	// Output configuration
	OutputPath string
	FileName   string

	// Test scripts
	GenerateTests bool
	TestTemplate  string

	// Documentation
	IncludeDocumentation bool
	IncludeExamples      bool
}

// PostmanCollection represents a Postman collection
type PostmanCollection struct {
	Info     CollectionInfo    `json:"info"`
	Item     []interface{}     `json:"item"` // Can be ItemGroup or Item
	Auth     *PostmanAuth      `json:"auth,omitempty"`
	Event    []PostmanEvent    `json:"event,omitempty"`
	Variable []PostmanVariable `json:"variable,omitempty"`
}

// CollectionInfo holds information about the collection
type CollectionInfo struct {
	ID          string `json:"_postman_id"`
	Name        string `json:"name"`
	Description string `json:"description,omitempty"`
	Schema      string `json:"schema"`
}

// PostmanAuth represents authentication configuration
type PostmanAuth struct {
	Type   string              `json:"type"`
	APIKey []PostmanAuthAPIKey `json:"apikey,omitempty"`
	Bearer []PostmanAuthBearer `json:"bearer,omitempty"`
	Basic  []PostmanAuthBasic  `json:"basic,omitempty"`
	OAuth2 []PostmanAuthOAuth2 `json:"oauth2,omitempty"`
}

// PostmanAuthAPIKey represents API key authentication
type PostmanAuthAPIKey struct {
	Key   string `json:"key"`
	Value string `json:"value"`
	In    string `json:"in"`
}

// PostmanAuthBearer represents bearer token authentication
type PostmanAuthBearer struct {
	Key   string `json:"key"`
	Value string `json:"value"`
}

// PostmanAuthBasic represents basic authentication
type PostmanAuthBasic struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

// PostmanAuthOAuth2 represents OAuth2 authentication
type PostmanAuthOAuth2 struct {
	GrantType      string `json:"grant_type"`
	AuthURL        string `json:"authUrl"`
	AccessTokenURL string `json:"accessTokenUrl"`
	ClientID       string `json:"clientId"`
}

// PostmanEvent represents collection/item events
type PostmanEvent struct {
	Listen string        `json:"listen"`
	Script PostmanScript `json:"script"`
}

// PostmanScript represents event scripts
type PostmanScript struct {
	Type string   `json:"type"` // "text/javascript"
	Exec []string `json:"exec"`
}

// PostmanVariable represents collection variables
type PostmanVariable struct {
	Key   string `json:"key"`
	Value string `json:"value"`
	Type  string `json:"type,omitempty"`
}

// ItemGroup represents a folder/group in Postman
type ItemGroup struct {
	Name        string         `json:"name"`
	Description string         `json:"description,omitempty"`
	Item        []interface{}  `json:"item"`
	Event       []PostmanEvent `json:"event,omitempty"`
}

// Item represents a request in Postman
type Item struct {
	Name        string         `json:"name"`
	Description interface{}    `json:"description,omitempty"`
	Request     PostmanRequest `json:"request"`
	Response    []interface{}  `json:"response,omitempty"`
	Event       []PostmanEvent `json:"event,omitempty"`
}

// PostmanRequest represents an HTTP request
type PostmanRequest struct {
	URL         PostmanURL          `json:"url"`
	Method      string              `json:"method"`
	Header      []PostmanHeader     `json:"header,omitempty"`
	Body        *PostmanBody        `json:"body,omitempty"`
	Description string              `json:"description,omitempty"`
	Auth        *PostmanAuth        `json:"auth,omitempty"`
	Proxy       *PostmanProxy       `json:"proxy,omitempty"`
	Certificate *PostmanCertificate `json:"certificate,omitempty"`
}

// PostmanURL represents a URL in Postman
type PostmanURL struct {
	Raw      string               `json:"raw"`
	Protocol string               `json:"protocol,omitempty"`
	Host     []string             `json:"host,omitempty"`
	Path     []string             `json:"path,omitempty"`
	Query    []PostmanQueryParam  `json:"query,omitempty"`
	Variable []PostmanURLVariable `json:"variable,omitempty"`
}

// PostmanQueryParam represents a query parameter
type PostmanQueryParam struct {
	Key         string `json:"key"`
	Value       string `json:"value"`
	Description string `json:"description,omitempty"`
	Disabled    bool   `json:"disabled,omitempty"`
}

// PostmanURLVariable represents a URL variable
type PostmanURLVariable struct {
	Key         string `json:"key"`
	Value       string `json:"value"`
	Description string `json:"description,omitempty"`
	Disabled    bool   `json:"disabled,omitempty"`
}

// PostmanHeader represents a request header
type PostmanHeader struct {
	Key         string `json:"key"`
	Value       string `json:"value"`
	Description string `json:"description,omitempty"`
	Disabled    bool   `json:"disabled,omitempty"`
}

// PostmanBody represents a request body
type PostmanBody struct {
	Mode     string             `json:"mode"` // "raw", "urlencoded", "formdata", "file"
	Raw      string             `json:"raw,omitempty"`
	URL      PostmanBodyURL     `json:"urlencoded,omitempty"`
	FormData PostmanFormData    `json:"formdata,omitempty"`
	File     PostmanBodyFile    `json:"file,omitempty"`
	Options  PostmanBodyOptions `json:"options,omitempty"`
}

// PostmanBodyURL represents URL-encoded body
type PostmanBodyURL []PostmanBodyURLParam

// PostmanBodyURLParam represents a URL-encoded parameter
type PostmanBodyURLParam struct {
	Key         string `json:"key"`
	Value       string `json:"value"`
	Description string `json:"description,omitempty"`
	Disabled    bool   `json:"disabled,omitempty"`
}

// PostmanFormData represents form data
type PostmanFormData []PostmanFormDataParam

// PostmanFormDataParam represents a form data parameter
type PostmanFormDataParam struct {
	Key         string `json:"key"`
	Value       string `json:"value"`
	Description string `json:"description,omitempty"`
	Type        string `json:"type"` // "text", "file"
	Disabled    bool   `json:"disabled,omitempty"`
}

// PostmanBodyFile represents file upload
type PostmanBodyFile struct {
	Src string `json:"src"`
}

// PostmanBodyOptions represents body options
type PostmanBodyOptions struct {
	Raw PostmanBodyRawOptions `json:"raw,omitempty"`
}

// PostmanBodyRawOptions represents raw body options
type PostmanBodyRawOptions struct {
	Language string `json:"language"`
}

// PostmanProxy represents proxy configuration
type PostmanProxy struct {
	Match  string `json:"match"`
	Host   string `json:"host"`
	Port   int    `json:"port"`
	Tunnel bool   `json:"tunnel"`
}

// PostmanCertificate represents certificate configuration
type PostmanCertificate struct {
	Name    string   `json:"name"`
	Matches []string `json:"matches"`
	Key     struct {
		Source string `json:"source"`
	} `json:"key,omitempty"`
	Cert struct {
		Source string `json:"source"`
	} `json:"cert,omitempty"`
	Passphrase string `json:"passphrase,omitempty"`
}

// PostmanGenerator generates Postman collections from OpenAPI specs
type PostmanGenerator struct {
	config PostmanConfig
	logger *logrus.Logger
}

// NewPostmanGenerator creates a new Postman collection generator
func NewPostmanGenerator(config PostmanConfig, logger *logrus.Logger) (*PostmanGenerator, error) {
	if logger == nil {
		logger = logrus.New()
	}

	// Set defaults
	if config.Schema == "" {
		config.Schema = "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
	}

	if config.Timeout == 0 {
		config.Timeout = 30
	}

	if config.FileName == "" {
		config.FileName = "sdlc-api-collection"
	}

	return &PostmanGenerator{
		config: config,
		logger: logger,
	}, nil
}

// GenerateCollection generates a Postman collection from an OpenAPI specification
func (pg *PostmanGenerator) GenerateCollection(ctx context.Context, spec *openapi3.T) (*PostmanCollection, error) {
	pg.logger.Info("Generating Postman collection from OpenAPI specification")

	// Validate spec
	if err := spec.Validate(ctx); err != nil {
		return nil, fmt.Errorf("invalid OpenAPI specification: %w", err)
	}

	// Create collection info
	collection := &PostmanCollection{
		Info: CollectionInfo{
			ID:          uuid.New().String(),
			Name:        pg.config.Name,
			Description: pg.config.Description,
			Schema:      pg.config.Schema,
		},
		Item: make([]interface{}, 0),
	}

	// Add authentication
	if pg.config.AuthType != "" {
		collection.Auth = pg.createAuth()
	}

	// Add collection variables
	collection.Variable = pg.createVariables()

	// Add collection events (tests, pre-request scripts)
	collection.Event = pg.createCollectionEvents()

	// Convert OpenAPI paths to Postman items
	items, err := pg.convertPathsToItems(spec)
	if err != nil {
		return nil, fmt.Errorf("failed to convert paths to items: %w", err)
	}

	collection.Item = items

	// Group items by tag/category if available
	if spec.Tags != nil && len(spec.Tags) > 0 {
		collection.Item = pg.groupItemsByTags(collection.Item, spec.Tags)
	} else {
		// Group by path segments
		collection.Item = pg.groupItemsByPath(collection.Item)
	}

	pg.logger.WithFields(logrus.Fields{
		"name":  collection.Info.Name,
		"items": len(pg.flattenItems(collection.Item)),
	}).Info("Postman collection generated successfully")

	return collection, nil
}

// createAuth creates authentication configuration
func (pg *PostmanGenerator) createAuth() *PostmanAuth {
	auth := &PostmanAuth{
		Type: pg.config.AuthType,
	}

	switch pg.config.AuthType {
	case "apikey":
		auth.APIKey = []PostmanAuthAPIKey{
			{
				Key:   "X-API-Key",
				Value: pg.config.APIKey,
				In:    "header",
			},
		}
	case "bearer":
		auth.Bearer = []PostmanAuthBearer{
			{
				Key:   "Authorization",
				Value: pg.config.Bearer,
			},
		}
	case "basic":
		auth.Basic = []PostmanAuthBasic{
			{
				Username: "{{username}}",
				Password: "{{password}}",
			},
		}
	}

	return auth
}

// createVariables creates collection variables
func (pg *PostmanGenerator) createVariables() []PostmanVariable {
	variables := []PostmanVariable{
		{
			Key:   "baseUrl",
			Value: pg.config.DefaultServer,
			Type:  "string",
		},
		{
			Key:   "apiVersion",
			Value: "v1",
			Type:  "string",
		},
		{
			Key:   "tenantId",
			Value: "your-tenant-id",
			Type:  "string",
		},
		{
			Key:   "accessToken",
			Value: "",
			Type:  "string",
		},
	}

	// Add custom environment variables
	for key, value := range pg.config.Environment {
		variables = append(variables, PostmanVariable{
			Key:   key,
			Value: value,
			Type:  "string",
		})
	}

	return variables
}

// createCollectionEvents creates collection-level events
func (pg *PostmanGenerator) createCollectionEvents() []PostmanEvent {
	events := make([]PostmanEvent, 0)

	// Add pre-request script for authentication
	if pg.config.AuthType == "bearer" {
		events = append(events, PostmanEvent{
			Listen: "prerequest",
			Script: PostmanScript{
				Type: "text/javascript",
				Exec: []string{
					"// Auto-refresh token if needed",
					"if (!pm.environment.get('accessToken') || isTokenExpired()) {",
					"    // Refresh token logic here",
					"}",
					"",
					"function isTokenExpired() {",
					"    const token = pm.environment.get('accessToken');",
					"    if (!token) return true;",
					"    try {",
					"        const payload = JSON.parse(atob(token.split('.')[1]));",
					"        return Date.now() >= payload.exp * 1000;",
					"    } catch (e) {",
					"        return true;",
					"    }",
					"}",
				},
			},
		})
	}

	// Add test script if enabled
	if pg.config.GenerateTests {
		events = append(events, PostmanEvent{
			Listen: "test",
			Script: PostmanScript{
				Type: "text/javascript",
				Exec: []string{
					"// Common test scripts",
					"pm.test('Status code is successful', function () {",
					"    pm.expect(pm.response.code).to.be.oneOf([200, 201, 202, 204]);",
					"});",
					"",
					"pm.test('Response time is acceptable', function () {",
					"    pm.expect(pm.response.responseTime).to.be.below(5000);",
					"});",
					"",
					"pm.test('Response has proper content type', function () {",
					"    pm.expect(pm.response.headers.get('Content-Type')).to.include('application/json');",
					"});",
				},
			},
		})
	}

	return events
}

// convertPathsToItems converts OpenAPI paths to Postman items
func (pg *PostmanGenerator) convertPathsToItems(spec *openapi3.T) ([]interface{}, error) {
	items := make([]interface{}, 0)

	for path, pathItem := range spec.Paths.Map() {
		operations := map[string]*openapi3.Operation{
			"GET":     pathItem.Get,
			"POST":    pathItem.Post,
			"PUT":     pathItem.Put,
			"PATCH":   pathItem.Patch,
			"DELETE":  pathItem.Delete,
			"HEAD":    pathItem.Head,
			"OPTIONS": pathItem.Options,
		}

		for method, operation := range operations {
			if operation != nil {
				item, err := pg.createItemFromOperation(method, path, operation)
				if err != nil {
					pg.logger.WithError(err).WithFields(logrus.Fields{
						"method": method,
						"path":   path,
					}).Warn("Failed to create item from operation")
					continue
				}
				items = append(items, item)
			}
		}
	}

	return items, nil
}

// createItemFromOperation creates a Postman item from an OpenAPI operation
func (pg *PostmanGenerator) createItemFromOperation(method, path string, operation *openapi3.Operation) (Item, error) {
	// Create URL
	postmanURL := pg.createURL(path)

	// Create headers
	headers := pg.createHeaders(operation)

	// Create request body if needed
	var body *PostmanBody
	if operation.RequestBody != nil {
		body = pg.createBody(operation.RequestBody)
	}

	// Create description
	description := pg.createDescription(operation)

	// Create request
	request := PostmanRequest{
		URL:         postmanURL,
		Method:      method,
		Header:      headers,
		Body:        body,
		Description: description,
	}

	// Add authentication to request if needed
	if pg.config.AuthType != "" {
		request.Auth = pg.createAuth()
	}

	// Create item
	item := Item{
		Name:        operation.Summary,
		Description: description,
		Request:     request,
		Event:       pg.createItemEvents(method, path, operation),
	}

	// Set default name if summary is empty
	if item.Name == "" {
		item.Name = fmt.Sprintf("%s %s", method, path)
	}

	return item, nil
}

// createURL creates a Postman URL from an OpenAPI path
func (pg *PostmanGenerator) createURL(path string) PostmanURL {
	// Parse the base URL
	baseURL, err := url.Parse(pg.config.DefaultServer)
	if err != nil {
		// Fallback to simple URL construction
		return PostmanURL{
			Raw:  "{{baseUrl}}/{{apiVersion}}" + path,
			Host: []string{"{{baseUrl}}"},
			Path: pg.splitPath("{{apiVersion}}" + path),
		}
	}

	// Construct full URL
	fullPath := baseURL.Path + path
	if !strings.HasPrefix(fullPath, "/") {
		fullPath = "/" + fullPath
	}

	return PostmanURL{
		Raw:      fmt.Sprintf("{{baseUrl}}%s", fullPath),
		Protocol: baseURL.Scheme,
		Host:     []string{baseURL.Host},
		Path:     pg.splitPath(fullPath),
		Query:    pg.extractQueryParams(path),
		Variable: pg.createURLVariables(path),
	}
}

// splitPath splits a URL path into components
func (pg *PostmanGenerator) splitPath(path string) []string {
	// Remove leading slash and split
	path = strings.TrimPrefix(path, "/")
	if path == "" {
		return []string{}
	}

	// Replace path variables with Postman variables
	parts := strings.Split(path, "/")
	for i, part := range parts {
		if strings.HasPrefix(part, "{") && strings.HasSuffix(part, "}") {
			parts[i] = "{{" + strings.Trim(part, "{}") + "}}"
		}
	}

	return parts
}

// extractQueryParams extracts query parameters from a path
func (pg *PostmanGenerator) extractQueryParams(path string) []PostmanQueryParam {
	// This is a simplified implementation
	// In a full implementation, you'd parse OpenAPI parameter definitions
	return []PostmanQueryParam{}
}

// createURLVariables creates URL variables for path parameters
func (pg *PostmanGenerator) createURLVariables(path string) []PostmanURLVariable {
	variables := make([]PostmanURLVariable, 0)

	// Extract path variables from braces
	parts := strings.Split(path, "/")
	for _, part := range parts {
		if strings.HasPrefix(part, "{") && strings.HasSuffix(part, "}") {
			varName := strings.Trim(part, "{}")
			variables = append(variables, PostmanURLVariable{
				Key:         varName,
				Value:       fmt.Sprintf("{{%s}}", varName),
				Description: fmt.Sprintf("Path parameter: %s", varName),
			})
		}
	}

	return variables
}

// createHeaders creates headers from OpenAPI operation
func (pg *PostmanGenerator) createHeaders(operation *openapi3.Operation) []PostmanHeader {
	headers := []PostmanHeader{
		{
			Key:         "Content-Type",
			Value:       "application/json",
			Description: "Request content type",
		},
		{
			Key:         "Accept",
			Value:       "application/json",
			Description: "Acceptable response types",
		},
		{
			Key:         "User-Agent",
			Value:       "SDLC-API-Postman-Collection/1.0.0",
			Description: "Client identification",
		},
	}

	// Add operation-specific headers
	if operation.Parameters != nil {
		for _, paramRef := range operation.Parameters {
			if paramRef.Value != nil && paramRef.Value.In == "header" {
				headers = append(headers, PostmanHeader{
					Key:         paramRef.Value.Name,
					Value:       fmt.Sprintf("{{%s}}", paramRef.Value.Name),
					Description: paramRef.Value.Description,
					Disabled:    !paramRef.Value.Required,
				})
			}
		}
	}

	return headers
}

// createBody creates a request body from OpenAPI request body
func (pg *PostmanGenerator) createBody(requestBody *openapi3.RequestBodyRef) *PostmanBody {
	if requestBody.Value == nil {
		return nil
	}

	body := &PostmanBody{
		Mode: "raw",
		Options: PostmanBodyOptions{
			Raw: PostmanBodyRawOptions{
				Language: "json",
			},
		},
	}

	// Check content types
	for contentType, mediaType := range requestBody.Value.Content {
		if contentType == "application/json" {
			if mediaType.Schema != nil && mediaType.Schema.Ref != "" {
				// Generate example from schema
				body.Raw = pg.generateExampleFromSchema(mediaType.Schema.Value)
			} else {
				body.Raw = "{\n  \"key\": \"value\"\n}"
			}
			break
		} else if contentType == "multipart/form-data" {
			body.Mode = "formdata"
			body.FormData = pg.generateFormData(mediaType)
		} else if contentType == "application/x-www-form-urlencoded" {
			body.Mode = "urlencoded"
			body.URL = pg.generateURLEncoded(mediaType)
		}
	}

	return body
}

// generateExampleFromSchema generates an example JSON from an OpenAPI schema
func (pg *PostmanGenerator) generateExampleFromSchema(schema *openapi3.Schema) string {
	// This is a simplified implementation
	// A full implementation would recursively generate examples from the schema
	return "{\n  \"example\": \"value\"\n}"
}

// generateFormData generates form data from media type
func (pg *PostmanGenerator) generateFormData(mediaType *openapi3.MediaType) PostmanFormData {
	// Simplified implementation
	return PostmanFormData{
		{
			Key:         "file",
			Type:        "file",
			Description: "File to upload",
		},
	}
}

// generateURLEncoded generates URL-encoded data from media type
func (pg *PostmanGenerator) generateURLEncoded(mediaType *openapi3.MediaType) PostmanBodyURL {
	// Simplified implementation
	return PostmanBodyURL{
		{
			Key:   "param1",
			Value: "value1",
		},
	}
}

// createDescription creates a description from OpenAPI operation
func (pg *PostmanGenerator) createDescription(operation *openapi3.Operation) string {
	description := operation.Description
	if description == "" {
		description = operation.Summary
	}

	return description
}

// createItemEvents creates events for a specific item
func (pg *PostmanGenerator) createItemEvents(method, path string, operation *openapi3.Operation) []PostmanEvent {
	events := make([]PostmanEvent, 0)

	if pg.config.GenerateTests {
		// Generate specific tests based on operation
		testScript := pg.generateTestScript(method, path, operation)
		if testScript != nil {
			events = append(events, *testScript)
		}
	}

	return events
}

// generateTestScript generates test scripts for an operation
func (pg *PostmanGenerator) generateTestScript(method, path string, operation *openapi3.Operation) *PostmanEvent {
	// Generate tests based on expected responses
	tests := []string{
		"// Generated tests for " + operation.OperationID,
		"pm.test('Status code is successful', function () {",
	}

	// Check expected status codes based on method
	switch method {
	case "POST":
		tests = append(tests, "    pm.expect(pm.response.code).to.be.oneOf([200, 201, 202]);")
	case "PUT", "PATCH":
		tests = append(tests, "    pm.expect(pm.response.code).to.be.oneOf([200, 204]);")
	case "DELETE":
		tests = append(tests, "    pm.expect(pm.response.code).to.be.oneOf([200, 202, 204]);")
	default:
		tests = append(tests, "    pm.expect(pm.response.code).to.be.oneOf([200, 202]);")
	}

	tests = append(tests,
		"});",
		"",
		"pm.test('Response has valid JSON structure', function () {",
		"    try {",
		"        const jsonData = pm.response.json();",
		"        pm.expect(jsonData).to.have.property('success');",
		"    } catch (e) {",
		"        pm.test.skip('Response is not JSON');",
		"    }",
		"});",
	)

	// Add specific tests based on operation ID
	if strings.Contains(strings.ToLower(path), "/auth/login") {
		tests = append(tests,
			"",
			"// Authentication-specific tests",
			"pm.test('Login returns access token', function () {",
			"    const jsonData = pm.response.json();",
			"    if (jsonData.success && jsonData.data) {",
			"        pm.expect(jsonData.data).to.have.property('access_token');",
			"        pm.environment.set('accessToken', jsonData.data.access_token);",
			"    }",
			"});",
		)
	}

	return &PostmanEvent{
		Listen: "test",
		Script: PostmanScript{
			Type: "text/javascript",
			Exec: tests,
		},
	}
}

// groupItemsByTags groups items by OpenAPI tags
func (pg *PostmanGenerator) groupItemsByTags(items []interface{}, tags openapi3.Tags) []interface{} {
	// This is a simplified implementation
	// A full implementation would properly group by tags
	if len(items) == 0 {
		return items
	}

	// Create a default group for now
	group := ItemGroup{
		Name:        "API Endpoints",
		Description: "All API endpoints",
		Item:        items,
	}

	return []interface{}{group}
}

// groupItemsByPath groups items by path segments
func (pg *PostmanGenerator) groupItemsByPath(items []interface{}) []interface{} {
	groups := make(map[string][]interface{})

	// Group items by first path segment
	for _, item := range items {
		if i, ok := item.(Item); ok {
			path := i.Request.URL.Path
			if len(path) > 0 {
				groupName := path[0]
				if groupName == "" {
					groupName = "Root"
				}
				groups[groupName] = append(groups[groupName], item)
			}
		}
	}

	// Convert to array
	result := make([]interface{}, 0)
	for name, groupItems := range groups {
		// Only create group if multiple items
		if len(groupItems) > 1 {
			result = append(result, ItemGroup{
				Name:        strings.Title(name),
				Description: fmt.Sprintf("%s endpoints", strings.Title(name)),
				Item:        groupItems,
			})
		} else {
			result = append(result, groupItems...)
		}
	}

	return result
}

// flattenItems flattens nested items to count total requests
func (pg *PostmanGenerator) flattenItems(items []interface{}) []Item {
	flattened := make([]Item, 0)

	for _, item := range items {
		switch v := item.(type) {
		case Item:
			flattened = append(flattened, v)
		case ItemGroup:
			flattened = append(flattened, pg.flattenItems(v.Item)...)
		}
	}

	return flattened
}

// SaveCollection saves the Postman collection to a file
func (pg *PostmanGenerator) SaveCollection(collection *PostmanCollection) error {
	// Create output directory if it doesn't exist
	if err := os.MkdirAll(pg.config.OutputPath, 0755); err != nil {
		return fmt.Errorf("failed to create output directory: %w", err)
	}

	// Marshal collection to JSON
	collectionJSON, err := json.MarshalIndent(collection, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal collection: %w", err)
	}

	// Write to file
	filePath := filepath.Join(pg.config.OutputPath, pg.config.FileName+".json")
	if err := os.WriteFile(filePath, collectionJSON, 0644); err != nil {
		return fmt.Errorf("failed to write collection file: %w", err)
	}

	pg.logger.WithField("path", filePath).Info("Postman collection saved successfully")

	// Generate environment file if needed
	if len(pg.config.Environment) > 0 {
		if err := pg.generateEnvironmentFile(); err != nil {
			pg.logger.WithError(err).Warn("Failed to generate environment file")
		}
	}

	return nil
}

// generateEnvironmentFile generates a Postman environment file
func (pg *PostmanGenerator) generateEnvironmentFile() error {
	environment := map[string]interface{}{
		"id":                      uuid.New().String(),
		"name":                    pg.config.Name + " Environment",
		"values":                  pg.createEnvironmentValues(),
		"_postman_variable_scope": "environment",
	}

	environmentJSON, err := json.MarshalIndent(environment, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal environment: %w", err)
	}

	envPath := filepath.Join(pg.config.OutputPath, pg.config.FileName+"-environment.json")
	if err := os.WriteFile(envPath, environmentJSON, 0644); err != nil {
		return fmt.Errorf("failed to write environment file: %w", err)
	}

	pg.logger.WithField("path", envPath).Info("Postman environment file generated")
	return nil
}

// createEnvironmentValues creates environment variable values
func (pg *PostmanGenerator) createEnvironmentValues() []map[string]interface{} {
	values := make([]map[string]interface{}, 0)

	// Add base variables
	baseVars := []string{"baseUrl", "apiVersion", "tenantId", "accessToken"}
	for _, key := range baseVars {
		if value, exists := pg.config.Environment[key]; exists {
			values = append(values, map[string]interface{}{
				"key":     key,
				"value":   value,
				"type":    "default",
				"enabled": true,
			})
		} else {
			values = append(values, map[string]interface{}{
				"key":     key,
				"value":   pg.getVariableDefaultValue(key),
				"type":    "default",
				"enabled": true,
			})
		}
	}

	// Add custom variables
	for key, value := range pg.config.Environment {
		// Skip if already added
		found := false
		for _, v := range values {
			if v["key"] == key {
				found = true
				break
			}
		}
		if !found {
			values = append(values, map[string]interface{}{
				"key":     key,
				"value":   value,
				"type":    "default",
				"enabled": true,
			})
		}
	}

	return values
}

// getVariableDefaultValue returns a default value for a variable
func (pg *PostmanGenerator) getVariableDefaultValue(key string) string {
	switch key {
	case "baseUrl":
		return pg.config.DefaultServer
	case "apiVersion":
		return "v1"
	case "tenantId":
		return "your-tenant-id"
	case "accessToken":
		return ""
	case "username":
		return "your-username"
	case "password":
		return "your-password"
	default:
		return ""
	}
}

// GenerateAndSave generates and saves a Postman collection
func (pg *PostmanGenerator) GenerateAndSave(ctx context.Context, spec *openapi3.T) error {
	collection, err := pg.GenerateCollection(ctx, spec)
	if err != nil {
		return fmt.Errorf("failed to generate collection: %w", err)
	}

	if err := pg.SaveCollection(collection); err != nil {
		return fmt.Errorf("failed to save collection: %w", err)
	}

	return nil
}
