package parser

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/mcpoverflow/api-service/internal/parser/utils"
)

// AsyncAPIParser implements the UniversalParser interface for AsyncAPI specifications
type AsyncAPIParser struct {
	version string
}

// NewAsyncAPIParser creates a new AsyncAPI parser
func NewAsyncAPIParser() *AsyncAPIParser {
	return &AsyncAPIParser{
		version: "1.0.0",
	}
}

// AsyncAPIDocument represents an AsyncAPI v2/v3 document
type AsyncAPIDocument struct {
	AsyncAPI           string                        `json:"asyncapi"`
	ID                 string                        `json:"id,omitempty"`
	Info               AsyncAPIInfo                  `json:"info"`
	DefaultContentType string                        `json:"defaultContentType,omitempty"`
	Servers            map[string]AsyncAPIServer     `json:"servers,omitempty"`
	Channels           map[string]AsyncAPIChannel    `json:"channels,omitempty"`
	Operations         map[string]AsyncAPIOperation  `json:"operations,omitempty"`
	Components         *AsyncAPIComponents           `json:"components,omitempty"`
}

// AsyncAPIInfo contains API metadata
type AsyncAPIInfo struct {
	Title          string              `json:"title"`
	Version        string              `json:"version"`
	Description    string              `json:"description,omitempty"`
	TermsOfService string              `json:"termsOfService,omitempty"`
	Contact        *ContactInfo        `json:"contact,omitempty"`
	License        *LicenseInfo        `json:"license,omitempty"`
}

// AsyncAPIServer represents a server configuration
type AsyncAPIServer struct {
	URL             string                 `json:"url"`
	Protocol        string                 `json:"protocol"`
	ProtocolVersion string                 `json:"protocolVersion,omitempty"`
	Description     string                 `json:"description,omitempty"`
	Variables       map[string]ServerVariable `json:"variables,omitempty"`
	Security        []map[string][]string  `json:"security,omitempty"`
	Tags            []Tag                  `json:"tags,omitempty"`
	Bindings        map[string]interface{} `json:"bindings,omitempty"`
}

// AsyncAPIChannel represents a communication channel
type AsyncAPIChannel struct {
	Address     string                       `json:"address,omitempty"`
	Messages    map[string]AsyncAPIMessage   `json:"messages,omitempty"`
	Title       string                       `json:"title,omitempty"`
	Summary     string                       `json:"summary,omitempty"`
	Description string                       `json:"description,omitempty"`
	Servers     []string                     `json:"servers,omitempty"`
	Parameters  map[string]interface{}       `json:"parameters,omitempty"`
	Tags        []Tag                        `json:"tags,omitempty"`
	Bindings    map[string]interface{}       `json:"bindings,omitempty"`
}

// AsyncAPIOperation represents an operation (send or receive)
type AsyncAPIOperation struct {
	Action      string                 `json:"action"` // "send" or "receive"
	Channel     string                 `json:"channel,omitempty"`
	Title       string                 `json:"title,omitempty"`
	Summary     string                 `json:"summary,omitempty"`
	Description string                 `json:"description,omitempty"`
	Security    []map[string][]string  `json:"security,omitempty"`
	Tags        []Tag                  `json:"tags,omitempty"`
	Bindings    map[string]interface{} `json:"bindings,omitempty"`
	Messages    []string               `json:"messages,omitempty"`
	Reply       *AsyncAPIReply         `json:"reply,omitempty"`
}

// AsyncAPIReply represents a request-reply pattern
type AsyncAPIReply struct {
	Address  string                 `json:"address,omitempty"`
	Channel  string                 `json:"channel,omitempty"`
	Messages []string               `json:"messages,omitempty"`
}

// AsyncAPIMessage represents a message definition
type AsyncAPIMessage struct {
	Name          string                 `json:"name,omitempty"`
	Title         string                 `json:"title,omitempty"`
	Summary       string                 `json:"summary,omitempty"`
	Description   string                 `json:"description,omitempty"`
	ContentType   string                 `json:"contentType,omitempty"`
	Headers       map[string]interface{} `json:"headers,omitempty"`
	Payload       interface{}            `json:"payload,omitempty"`
	CorrelationID interface{}            `json:"correlationId,omitempty"`
	Tags          []Tag                  `json:"tags,omitempty"`
	Bindings      map[string]interface{} `json:"bindings,omitempty"`
	Examples      []interface{}          `json:"examples,omitempty"`
}

// AsyncAPIComponents holds reusable objects
type AsyncAPIComponents struct {
	Schemas         map[string]interface{}        `json:"schemas,omitempty"`
	Servers         map[string]AsyncAPIServer     `json:"servers,omitempty"`
	Channels        map[string]AsyncAPIChannel    `json:"channels,omitempty"`
	Operations      map[string]AsyncAPIOperation  `json:"operations,omitempty"`
	Messages        map[string]AsyncAPIMessage    `json:"messages,omitempty"`
	SecuritySchemes map[string]interface{}        `json:"securitySchemes,omitempty"`
	Parameters      map[string]interface{}        `json:"parameters,omitempty"`
}

// Parse implements the UniversalParser interface
func (p *AsyncAPIParser) Parse(ctx context.Context, input []byte, opts ParseOptions) (*IntermediateRepresentation, error) {
	var doc AsyncAPIDocument
	if err := json.Unmarshal(input, &doc); err != nil {
		return nil, fmt.Errorf("failed to unmarshal AsyncAPI document: %w", err)
	}

	// Validate required fields
	if doc.AsyncAPI == "" {
		return nil, fmt.Errorf("missing required field: asyncapi")
	}
	if doc.Info.Title == "" {
		return nil, fmt.Errorf("missing required field: info.title")
	}
	if doc.Info.Version == "" {
		return nil, fmt.Errorf("missing required field: info.version")
	}

	// Convert to intermediate representation
	ir := &IntermediateRepresentation{
		Metadata: APIMetadata{
			Name:           doc.Info.Title,
			Title:          doc.Info.Title,
			Description:    doc.Info.Description,
			Version:        doc.Info.Version,
			TermsOfService: doc.Info.TermsOfService,
			Contact:        doc.Info.Contact,
			License:        doc.Info.License,
		},
		Endpoints: p.convertOperations(doc),
		Types:     p.extractTypes(doc),
		Auth:      p.extractAuthSchemes(doc),
		Servers:   p.convertServers(doc.Servers),
		Globals: GlobalConfig{
			Headers: make(map[string]string),
		},
		Extensions: map[string]interface{}{
			"asyncapi_version":   doc.AsyncAPI,
			"default_content_type": doc.DefaultContentType,
			"channels":           doc.Channels,
		},
		Source: SourceInfo{
			Format:        "asyncapi",
			Version:       doc.AsyncAPI,
			ParserVersion: p.version,
			ParsedAt:      time.Now(),
			Raw:           doc,
		},
	}

	return ir, nil
}

// convertOperations converts AsyncAPI operations to unified endpoints
func (p *AsyncAPIParser) convertOperations(doc AsyncAPIDocument) []UnifiedEndpoint {
	var endpoints []UnifiedEndpoint

	// Convert operations
	for opID, operation := range doc.Operations {
		endpoint := UnifiedEndpoint{
			ID:          opID,
			Name:        operation.Title,
			Description: operation.Description,
			Method:      strings.ToUpper(operation.Action), // "SEND" or "RECEIVE"
			Tags:        p.extractTagNames(operation.Tags),
			Extensions: map[string]interface{}{
				"asyncapi_action": operation.Action,
				"channel":         operation.Channel,
			},
		}

		// Get channel information
		if operation.Channel != "" {
			if channel, ok := doc.Channels[operation.Channel]; ok {
				endpoint.Path = channel.Address
				endpoint.Description = p.combineDescriptions(endpoint.Description, channel.Description)

				// Add streaming info for async operations
				endpoint.Streaming = &StreamingInfo{
					Type: p.determineStreamingType(operation.Action),
					Settings: map[string]interface{}{
						"protocol": p.getProtocolFromChannel(doc, operation.Channel),
						"bindings": operation.Bindings,
					},
				}

				// Extract message schemas
				if len(channel.Messages) > 0 {
					p.addMessageSchemas(&endpoint, channel.Messages, operation.Action)
				}
			}
		}

		// Add reply info for request-reply patterns
		if operation.Reply != nil {
			endpoint.Extensions["reply"] = operation.Reply
		}

		endpoints = append(endpoints, endpoint)
	}

	// Also convert channels without explicit operations (v2 style)
	for channelID, channel := range doc.Channels {
		// Skip if already processed in operations
		if p.isChannelInOperations(channelID, doc.Operations) {
			continue
		}

		// Create endpoints for publish/subscribe
		for msgID, message := range channel.Messages {
			endpoint := UnifiedEndpoint{
				ID:          fmt.Sprintf("%s_%s", channelID, msgID),
				Name:        message.Title,
				Description: message.Description,
				Method:      "PUBLISH", // Default for channel-based
				Path:        channel.Address,
				Tags:        p.extractTagNames(channel.Tags),
				Extensions: map[string]interface{}{
					"channel":    channelID,
					"message_id": msgID,
				},
			}

			// Add streaming info
			endpoint.Streaming = &StreamingInfo{
				Type: "bidirectional",
				Settings: map[string]interface{}{
					"protocol": "async",
				},
			}

			endpoints = append(endpoints, endpoint)
		}
	}

	return endpoints
}

// addMessageSchemas adds request/response schemas from messages
func (p *AsyncAPIParser) addMessageSchemas(endpoint *UnifiedEndpoint, messages map[string]AsyncAPIMessage, action string) {
	for msgID, message := range messages {
		contentType := message.ContentType
		if contentType == "" {
			contentType = "application/json"
		}

		// Create type reference from payload
		var schema *TypeReference
		if message.Payload != nil {
			schema = &TypeReference{
				Type: "object",
				Ref:  fmt.Sprintf("#/components/messages/%s/payload", msgID),
			}
		}

		if action == "send" || action == "publish" {
			// This is a request
			endpoint.RequestBody = &RequestBody{
				Description: message.Description,
				Required:    true,
				ContentType: contentType,
				Schema:      schema,
			}
		} else {
			// This is a response
			endpoint.Responses = append(endpoint.Responses, Response{
				StatusCode:  "200",
				Description: message.Description,
				ContentType: contentType,
				Schema:      schema,
			})
		}
	}
}

// determineStreamingType determines the streaming pattern
func (p *AsyncAPIParser) determineStreamingType(action string) string {
	switch strings.ToLower(action) {
	case "send", "publish":
		return "client-stream"
	case "receive", "subscribe":
		return "server-stream"
	default:
		return "bidirectional"
	}
}

// getProtocolFromChannel gets the protocol for a channel
func (p *AsyncAPIParser) getProtocolFromChannel(doc AsyncAPIDocument, channelRef string) string {
	if channel, ok := doc.Channels[channelRef]; ok {
		if len(channel.Servers) > 0 {
			if server, ok := doc.Servers[channel.Servers[0]]; ok {
				return server.Protocol
			}
		}
	}
	return "unknown"
}

// isChannelInOperations checks if a channel is already in operations
func (p *AsyncAPIParser) isChannelInOperations(channelID string, operations map[string]AsyncAPIOperation) bool {
	for _, op := range operations {
		if op.Channel == channelID {
			return true
		}
	}
	return false
}

// convertServers converts AsyncAPI servers to IR servers
func (p *AsyncAPIParser) convertServers(servers map[string]AsyncAPIServer) []ServerConfig {
	var result []ServerConfig
	for serverID, server := range servers {
		result = append(result, ServerConfig{
			URL:         server.URL,
			Description: server.Description,
			Variables:   server.Variables,
			Extensions: map[string]interface{}{
				"server_id":        serverID,
				"protocol":         server.Protocol,
				"protocol_version": server.ProtocolVersion,
				"bindings":         server.Bindings,
			},
		})
	}
	return result
}

// extractTypes extracts type definitions from schemas
func (p *AsyncAPIParser) extractTypes(doc AsyncAPIDocument) []TypeDefinition {
	var types []TypeDefinition

	// Extract from components.schemas
	if doc.Components != nil && doc.Components.Schemas != nil {
		for name, schema := range doc.Components.Schemas {
			types = append(types, TypeDefinition{
				Name:        name,
				Type:        "object",
				Description: fmt.Sprintf("Schema from AsyncAPI components: %s", name),
				Extensions: map[string]interface{}{
					"schema": schema,
				},
			})
		}
	}

	// Extract from message payloads
	if doc.Components != nil && doc.Components.Messages != nil {
		for name, message := range doc.Components.Messages {
			if message.Payload != nil {
				types = append(types, TypeDefinition{
					Name:        fmt.Sprintf("%s_payload", name),
					Type:        "object",
					Description: message.Description,
					Extensions: map[string]interface{}{
						"payload": message.Payload,
					},
				})
			}
		}
	}

	return types
}

// extractAuthSchemes extracts authentication schemes
func (p *AsyncAPIParser) extractAuthSchemes(doc AsyncAPIDocument) []AuthScheme {
	var schemes []AuthScheme

	if doc.Components != nil && doc.Components.SecuritySchemes != nil {
		for name, schemeData := range doc.Components.SecuritySchemes {
			// Parse security scheme
			schemeMap, ok := schemeData.(map[string]interface{})
			if !ok {
				continue
			}

			schemeType, _ := schemeMap["type"].(string)
			description, _ := schemeMap["description"].(string)

			scheme := AuthScheme{
				Type:        schemeType,
				Name:        name,
				Description: description,
			}

			// Add protocol-specific fields
			if in, ok := schemeMap["in"].(string); ok {
				scheme.In = in
			}
			if schemeName, ok := schemeMap["scheme"].(string); ok {
				scheme.Scheme = schemeName
			}

			schemes = append(schemes, scheme)
		}
	}

	return schemes
}

// extractTagNames extracts tag names from Tag objects
func (p *AsyncAPIParser) extractTagNames(tags []Tag) []string {
	names := make([]string, len(tags))
	for i, tag := range tags {
		names[i] = tag.Name
	}
	return names
}

// combineDescriptions combines two descriptions
func (p *AsyncAPIParser) combineDescriptions(desc1, desc2 string) string {
	if desc1 == "" {
		return desc2
	}
	if desc2 == "" {
		return desc1
	}
	return desc1 + "\n\n" + desc2
}

// DetectFormat implements the UniversalParser interface
func (p *AsyncAPIParser) DetectFormat(input []byte) (string, error) {
	// Try to parse as JSON
	var doc map[string]interface{}
	if err := json.Unmarshal(input, &doc); err != nil {
		return "", fmt.Errorf("not a valid JSON document")
	}

	// Check for asyncapi field
	if asyncapi, ok := doc["asyncapi"].(string); ok {
		if strings.HasPrefix(asyncapi, "2.") || strings.HasPrefix(asyncapi, "3.") {
			return "asyncapi", nil
		}
	}

	return "", fmt.Errorf("not an AsyncAPI document")
}

// Validate implements the UniversalParser interface
func (p *AsyncAPIParser) Validate(ir *IntermediateRepresentation) (*ValidationResults, error) {
	validator := utils.NewIRValidator()

	// Validate metadata
	validator.ValidateMetadata(ir.Metadata.Name, ir.Metadata.Version, ir.Metadata.Title)

	// Validate endpoints
	for i, endpoint := range ir.Endpoints {
		validator.ValidateEndpoint(endpoint.ID, endpoint.Name, endpoint.Method, endpoint.Path, i)
	}

	// Validate auth schemes
	for i, auth := range ir.Auth {
		validator.ValidateAuthScheme(auth.Name, auth.Type, i)
	}

	// Validate servers
	for i, server := range ir.Servers {
		validator.ValidateServerConfig(server.URL, i)
	}

	// Validate type definitions
	for i, typeDef := range ir.Types {
		validator.ValidateTypeDefinition(typeDef.Name, typeDef.Type, i)
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
func (p *AsyncAPIParser) GetFormat() string {
	return "asyncapi"
}

// GetVersion implements the UniversalParser interface
func (p *AsyncAPIParser) GetVersion() string {
	return p.version
}

// GetSupportedVersions implements the UniversalParser interface
func (p *AsyncAPIParser) GetSupportedVersions() []string {
	return []string{"2.0.0", "2.1.0", "2.2.0", "2.3.0", "2.4.0", "2.5.0", "2.6.0", "3.0.0"}
}
