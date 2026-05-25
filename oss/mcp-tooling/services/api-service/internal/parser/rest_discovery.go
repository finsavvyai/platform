package parser

import (
	"context"
	"encoding/json"
	"fmt"
	"net/url"
	"strings"
	"time"

	"github.com/mcpoverflow/api-service/internal/parser/utils"
)

// RESTDiscoveryParser implements the UniversalParser interface for REST Discovery (HAL, JSON-LD, Siren, etc.)
type RESTDiscoveryParser struct {
	version string
}

// NewRESTDiscoveryParser creates a new REST Discovery parser
func NewRESTDiscoveryParser() *RESTDiscoveryParser {
	return &RESTDiscoveryParser{
		version: "1.0.0",
	}
}

// HALDocument represents a HAL+JSON document
type HALDocument struct {
	Links    map[string]interface{} `json:"_links,omitempty"`
	Embedded map[string]interface{} `json:"_embedded,omitempty"`
	// Additional fields are dynamic
}

// SirenDocument represents a Siren document
type SirenDocument struct {
	Class      []string               `json:"class,omitempty"`
	Properties map[string]interface{} `json:"properties,omitempty"`
	Entities   []interface{}          `json:"entities,omitempty"`
	Links      []SirenLink            `json:"links,omitempty"`
	Actions    []SirenAction          `json:"actions,omitempty"`
	Title      string                 `json:"title,omitempty"`
}

// SirenLink represents a Siren link
type SirenLink struct {
	Rel   []string `json:"rel"`
	Href  string   `json:"href"`
	Title string   `json:"title,omitempty"`
	Type  string   `json:"type,omitempty"`
}

// SirenAction represents a Siren action
type SirenAction struct {
	Name   string                 `json:"name"`
	Title  string                 `json:"title,omitempty"`
	Method string                 `json:"method,omitempty"`
	Href   string                 `json:"href"`
	Type   string                 `json:"type,omitempty"`
	Fields []SirenField           `json:"fields,omitempty"`
}

// SirenField represents a Siren action field
type SirenField struct {
	Name  string      `json:"name"`
	Type  string      `json:"type,omitempty"`
	Value interface{} `json:"value,omitempty"`
	Title string      `json:"title,omitempty"`
}

// Parse implements the UniversalParser interface
func (p *RESTDiscoveryParser) Parse(ctx context.Context, input []byte, opts ParseOptions) (*IntermediateRepresentation, error) {
	var doc map[string]interface{}
	if err := json.Unmarshal(input, &doc); err != nil {
		return nil, fmt.Errorf("failed to unmarshal REST Discovery document: %w", err)
	}

	// Detect format type
	format := p.detectRESTFormat(doc)
	
	var ir *IntermediateRepresentation
	var err error

	switch format {
	case "hal":
		ir, err = p.parseHAL(doc)
	case "siren":
		ir, err = p.parseSiren(doc)
	case "jsonld":
		ir, err = p.parseJSONLD(doc)
	default:
		return nil, fmt.Errorf("unsupported REST discovery format")
	}

	if err != nil {
		return nil, err
	}

	ir.Source = SourceInfo{
		Format:        "rest-discovery",
		Version:       format,
		ParserVersion: p.version,
		ParsedAt:      time.Now(),
		Raw:           doc,
	}

	return ir, nil
}

// detectRESTFormat detects the REST hypermedia format
func (p *RESTDiscoveryParser) detectRESTFormat(doc map[string]interface{}) string {
	// Check for HAL
	if _, hasLinks := doc["_links"]; hasLinks {
		return "hal"
	}
	if _, hasEmbedded := doc["_embedded"]; hasEmbedded {
		return "hal"
	}

	// Check for Siren
	if links, ok := doc["links"].([]interface{}); ok {
		if len(links) > 0 {
			if linkMap, ok := links[0].(map[string]interface{}); ok {
				if _, hasRel := linkMap["rel"]; hasRel {
					return "siren"
				}
			}
		}
	}
	if _, hasActions := doc["actions"]; hasActions {
		return "siren"
	}

	// Check for JSON-LD
	if context, ok := doc["@context"]; ok {
		if context != nil {
			return "jsonld"
		}
	}

	return "unknown"
}

// parseHAL parses HAL+JSON format
func (p *RESTDiscoveryParser) parseHAL(doc map[string]interface{}) (*IntermediateRepresentation, error) {
	ir := &IntermediateRepresentation{
		Metadata: APIMetadata{
			Name:        "HAL API",
			Title:       "HAL API",
			Description: "Discovered from HAL+JSON hypermedia",
			Version:     "1.0.0",
		},
		Endpoints: []UnifiedEndpoint{},
		Types:     []TypeDefinition{},
		Auth:      []AuthScheme{},
		Servers:   []ServerConfig{},
		Globals: GlobalConfig{
			Headers: make(map[string]string),
		},
		Extensions: map[string]interface{}{
			"hypermedia_format": "hal",
		},
	}

	// Extract links
	if links, ok := doc["_links"].(map[string]interface{}); ok {
		for rel, linkData := range links {
			endpoint := p.extractHALLink(rel, linkData)
			if endpoint != nil {
				ir.Endpoints = append(ir.Endpoints, *endpoint)
			}
		}
	}

	// Extract embedded resources
	if embedded, ok := doc["_embedded"].(map[string]interface{}); ok {
		for rel, embeddedData := range embedded {
			// Process embedded resources
			if embeddedArray, ok := embeddedData.([]interface{}); ok {
				for _, item := range embeddedArray {
					if itemMap, ok := item.(map[string]interface{}); ok {
						if itemLinks, ok := itemMap["_links"].(map[string]interface{}); ok {
							for itemRel, itemLinkData := range itemLinks {
								endpoint := p.extractHALLink(fmt.Sprintf("%s.%s", rel, itemRel), itemLinkData)
								if endpoint != nil {
									ir.Endpoints = append(ir.Endpoints, *endpoint)
								}
							}
						}
					}
				}
			}
		}
	}

	// Extract base URL from self link
	if links, ok := doc["_links"].(map[string]interface{}); ok {
		if self, ok := links["self"].(map[string]interface{}); ok {
			if href, ok := self["href"].(string); ok {
				if parsedURL, err := url.Parse(href); err == nil {
					baseURL := fmt.Sprintf("%s://%s", parsedURL.Scheme, parsedURL.Host)
					ir.Servers = append(ir.Servers, ServerConfig{
						URL:         baseURL,
						Description: "Discovered from HAL self link",
					})
				}
			}
		}
	}

	return ir, nil
}

// extractHALLink extracts endpoint from HAL link
func (p *RESTDiscoveryParser) extractHALLink(rel string, linkData interface{}) *UnifiedEndpoint {
	var href, title, method string

	switch link := linkData.(type) {
	case map[string]interface{}:
		if h, ok := link["href"].(string); ok {
			href = h
		}
		if t, ok := link["title"].(string); ok {
			title = t
		}
		if m, ok := link["method"].(string); ok {
			method = strings.ToUpper(m)
		}
	case string:
		href = link
	default:
		return nil
	}

	if href == "" {
		return nil
	}

	// Default method based on relation
	if method == "" {
		method = p.inferMethodFromRel(rel)
	}

	if title == "" {
		title = strings.Title(strings.ReplaceAll(rel, "-", " "))
	}

	return &UnifiedEndpoint{
		ID:          rel,
		Name:        title,
		Description: fmt.Sprintf("HAL link relation: %s", rel),
		Method:      method,
		Path:        href,
		Tags:        []string{"hal"},
		Extensions: map[string]interface{}{
			"rel": rel,
		},
	}
}

// parseSiren parses Siren format
func (p *RESTDiscoveryParser) parseSiren(doc map[string]interface{}) (*IntermediateRepresentation, error) {
	var siren SirenDocument
	docBytes, _ := json.Marshal(doc)
	if err := json.Unmarshal(docBytes, &siren); err != nil {
		return nil, fmt.Errorf("failed to parse Siren document: %w", err)
	}

	ir := &IntermediateRepresentation{
		Metadata: APIMetadata{
			Name:        siren.Title,
			Title:       siren.Title,
			Description: "Discovered from Siren hypermedia",
			Version:     "1.0.0",
		},
		Endpoints: []UnifiedEndpoint{},
		Types:     []TypeDefinition{},
		Auth:      []AuthScheme{},
		Servers:   []ServerConfig{},
		Globals: GlobalConfig{
			Headers: make(map[string]string),
		},
		Extensions: map[string]interface{}{
			"hypermedia_format": "siren",
			"class":             siren.Class,
		},
	}

	// Extract actions
	for _, action := range siren.Actions {
		endpoint := UnifiedEndpoint{
			ID:          action.Name,
			Name:        action.Title,
			Description: fmt.Sprintf("Siren action: %s", action.Name),
			Method:      strings.ToUpper(action.Method),
			Path:        action.Href,
			Tags:        []string{"siren"},
			Extensions: map[string]interface{}{
				"action_name": action.Name,
			},
		}

		// Convert fields to parameters
		for _, field := range action.Fields {
			param := Parameter{
				Name:        field.Name,
				In:          "query", // Default, could be body for POST
				Description: field.Title,
				Schema: &TypeReference{
					Type: field.Type,
				},
			}
			endpoint.Parameters = append(endpoint.Parameters, param)
		}

		ir.Endpoints = append(ir.Endpoints, endpoint)
	}

	// Extract links
	for _, link := range siren.Links {
		if len(link.Rel) == 0 {
			continue
		}

		rel := link.Rel[0]
		endpoint := UnifiedEndpoint{
			ID:          rel,
			Name:        link.Title,
			Description: fmt.Sprintf("Siren link relation: %s", rel),
			Method:      p.inferMethodFromRel(rel),
			Path:        link.Href,
			Tags:        []string{"siren"},
			Extensions: map[string]interface{}{
				"rel": link.Rel,
			},
		}

		ir.Endpoints = append(ir.Endpoints, endpoint)
	}

	return ir, nil
}

// parseJSONLD parses JSON-LD format
func (p *RESTDiscoveryParser) parseJSONLD(doc map[string]interface{}) (*IntermediateRepresentation, error) {
	ir := &IntermediateRepresentation{
		Metadata: APIMetadata{
			Name:        "JSON-LD API",
			Title:       "JSON-LD API",
			Description: "Discovered from JSON-LD",
			Version:     "1.0.0",
		},
		Endpoints: []UnifiedEndpoint{},
		Types:     []TypeDefinition{},
		Auth:      []AuthScheme{},
		Servers:   []ServerConfig{},
		Globals: GlobalConfig{
			Headers: make(map[string]string),
		},
		Extensions: map[string]interface{}{
			"hypermedia_format": "jsonld",
			"@context":          doc["@context"],
		},
	}

	// Extract @id as a link
	if id, ok := doc["@id"].(string); ok {
		endpoint := UnifiedEndpoint{
			ID:          "self",
			Name:        "Self",
			Description: "JSON-LD resource identifier",
			Method:      "GET",
			Path:        id,
			Tags:        []string{"jsonld"},
		}
		ir.Endpoints = append(ir.Endpoints, endpoint)
	}

	// Look for links in various JSON-LD patterns
	for key, value := range doc {
		if key == "@context" || key == "@id" || key == "@type" {
			continue
		}

		// Check if value is a URL
		if strValue, ok := value.(string); ok {
			if p.isURL(strValue) {
				endpoint := UnifiedEndpoint{
					ID:          key,
					Name:        strings.Title(strings.ReplaceAll(key, "_", " ")),
					Description: fmt.Sprintf("JSON-LD property: %s", key),
					Method:      "GET",
					Path:        strValue,
					Tags:        []string{"jsonld"},
				}
				ir.Endpoints = append(ir.Endpoints, endpoint)
			}
		}
	}

	return ir, nil
}

// Helper functions

func (p *RESTDiscoveryParser) inferMethodFromRel(rel string) string {
	rel = strings.ToLower(rel)

	switch {
	case strings.Contains(rel, "create"), strings.Contains(rel, "add"), strings.Contains(rel, "post"):
		return "POST"
	case strings.Contains(rel, "update"), strings.Contains(rel, "edit"), strings.Contains(rel, "modify"):
		return "PUT"
	case strings.Contains(rel, "patch"):
		return "PATCH"
	case strings.Contains(rel, "delete"), strings.Contains(rel, "remove"):
		return "DELETE"
	default:
		return "GET"
	}
}

func (p *RESTDiscoveryParser) isURL(str string) bool {
	parsedURL, err := url.Parse(str)
	return err == nil && (parsedURL.Scheme == "http" || parsedURL.Scheme == "https")
}

// DetectFormat implements the UniversalParser interface
func (p *RESTDiscoveryParser) DetectFormat(input []byte) (string, error) {
	var doc map[string]interface{}
	if err := json.Unmarshal(input, &doc); err != nil {
		return "", fmt.Errorf("not a valid JSON document")
	}

	format := p.detectRESTFormat(doc)
	if format == "unknown" {
		return "", fmt.Errorf("not a REST discovery document")
	}

	return "rest-discovery", nil
}

// Validate implements the UniversalParser interface
func (p *RESTDiscoveryParser) Validate(ir *IntermediateRepresentation) (*ValidationResults, error) {
	validator := utils.NewIRValidator()

	// Validate metadata
	validator.ValidateMetadata(ir.Metadata.Name, ir.Metadata.Version, ir.Metadata.Title)

	// Validate endpoints
	for i, endpoint := range ir.Endpoints {
		validator.ValidateEndpoint(endpoint.ID, endpoint.Name, endpoint.Method, endpoint.Path, i)
	}

	results := &ValidationResults{
		Valid:    validator.IsValid(),
		IsValid:  validator.IsValid(),
		Errors:   convertUtilsErrors(validator.GetErrors()),
		Warnings: convertUtilsErrors(validator.GetWarnings()),
		Info:     []ValidationError{},
		Infos:    []ValidationError{},
	}

	return results, nil
}

// GetFormat implements the UniversalParser interface
func (p *RESTDiscoveryParser) GetFormat() string {
	return "rest-discovery"
}

// GetVersion implements the UniversalParser interface
func (p *RESTDiscoveryParser) GetVersion() string {
	return p.version
}

// GetSupportedVersions implements the UniversalParser interface
func (p *RESTDiscoveryParser) GetSupportedVersions() []string {
	return []string{"hal", "siren", "jsonld", "collection+json"}
}
