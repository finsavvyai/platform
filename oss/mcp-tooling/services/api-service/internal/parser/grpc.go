package parser

import (
	"context"
	"encoding/json"
	"fmt"
	"regexp"
	"strings"
	"time"

	"github.com/mcpoverflow/api-service/internal/parser/utils"
)

// GRPCParser implements the UniversalParser interface for gRPC/Protocol Buffers
type GRPCParser struct {
	version string
}

// NewGRPCParser creates a new gRPC parser instance
func NewGRPCParser() *GRPCParser {
	return &GRPCParser{
		version: "1.0.0",
	}
}

// Parse parses a .proto file and returns an IntermediateRepresentation
func (p *GRPCParser) Parse(ctx context.Context, input []byte, opts ParseOptions) (*IntermediateRepresentation, error) {
	// Parse the proto file
	protoFile, err := p.parseProtoFile(string(input))
	if err != nil {
		return nil, fmt.Errorf("failed to parse proto file: %w", err)
	}

	// Convert to IR
	ir := &IntermediateRepresentation{
		Metadata: APIMetadata{
			Title:       protoFile.Package,
			Version:     "1.0.0",
			Description: protoFile.getDescription(),
		},
		Endpoints:  p.convertServices(protoFile),
		Types:      p.convertMessages(protoFile),
		Auth:       []AuthScheme{},
		Servers:    []ServerConfig{},
		Globals:    GlobalConfig{},
		Extensions: map[string]interface{}{
			"proto_syntax": protoFile.Syntax,
			"package":      protoFile.Package,
			"imports":      protoFile.Imports,
			"options":      protoFile.Options,
		},
		Source: SourceInfo{
			Format:        "grpc",
			Version:       protoFile.Syntax,
			ParserVersion: p.version,
			ParsedAt:      time.Now(),
		},
	}

	return ir, nil
}

// DetectFormat detects if the input is a gRPC/protobuf file
func (p *GRPCParser) DetectFormat(input []byte) (string, error) {
	content := string(input)
	
	// Check for proto syntax
	if strings.Contains(content, "syntax = \"proto3\"") || strings.Contains(content, "syntax = \"proto2\"") {
		return "grpc", nil
	}
	
	// Check for service definitions
	servicePattern := regexp.MustCompile(`(?m)^service\s+\w+\s*\{`)
	if servicePattern.MatchString(content) {
		return "grpc", nil
	}
	
	// Check for message definitions
	messagePattern := regexp.MustCompile(`(?m)^message\s+\w+\s*\{`)
	if messagePattern.MatchString(content) {
		return "grpc", nil
	}
	
	return "", fmt.Errorf("not a valid proto file")
}

// Validate validates the IntermediateRepresentation
func (p *GRPCParser) Validate(ir *IntermediateRepresentation) (*ValidationResults, error) {
	validator := utils.NewIRValidator()
	
	// Validate metadata
	if ir.Metadata.Title == "" {
		validator.AddWarning("MISSING_TITLE", "Package name is recommended", "metadata.title", nil)
	}
	
	// Validate endpoints (RPC methods)
	for i, endpoint := range ir.Endpoints {
		validator.ValidateEndpoint(endpoint.ID, endpoint.Name, "POST", endpoint.Path, i)
	}
	
	// Validate types (messages)
	for i, typeDef := range ir.Types {
		if typeDef.Name == "" {
			validator.AddError("MISSING_TYPE_NAME", "Type name is required", fmt.Sprintf("types[%d].name", i), nil)
		}
	}

	// Construct ValidationResults
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

// convertUtilsErrors converts utils.ValidationError to parser.ValidationError
func convertUtilsErrors(utilsErrors []utils.ValidationError) []ValidationError {
	errors := make([]ValidationError, len(utilsErrors))
	for i, e := range utilsErrors {
		errors[i] = ValidationError{
			Code:     e.Code,
			Message:  e.Message,
			Path:     e.Path,
			Severity: e.Severity,
			Details:  e.Details.(map[string]interface{}),
		}
	}
	return errors
}

// GetFormat returns the format identifier
func (p *GRPCParser) GetFormat() string {
	return "grpc"
}

// GetVersion returns the parser version
func (p *GRPCParser) GetVersion() string {
	return p.version
}

// GetSupportedVersions returns supported proto versions
func (p *GRPCParser) GetSupportedVersions() []string {
	return []string{"proto2", "proto3"}
}

// ProtoFile represents a parsed .proto file
type ProtoFile struct {
	Syntax   string
	Package  string
	Imports  []string
	Options  map[string]string
	Services []ProtoService
	Messages []ProtoMessage
	Enums    []ProtoEnum
	Comments []string
}

// ProtoService represents a gRPC service definition
type ProtoService struct {
	Name    string
	Methods []ProtoMethod
	Options map[string]string
}

// ProtoMethod represents an RPC method
type ProtoMethod struct {
	Name         string
	InputType    string
	OutputType   string
	ClientStream bool
	ServerStream bool
	Options      map[string]string
	Comments     []string
}

// ProtoMessage represents a protobuf message
type ProtoMessage struct {
	Name    string
	Fields  []ProtoField
	Nested  []ProtoMessage
	Options map[string]string
}

// ProtoField represents a message field
type ProtoField struct {
	Name     string
	Type     string
	Number   int
	Repeated bool
	Optional bool
	Map      bool
	Options  map[string]string
}

// ProtoEnum represents an enum definition
type ProtoEnum struct {
	Name    string
	Values  []ProtoEnumValue
	Options map[string]string
}

// ProtoEnumValue represents an enum value
type ProtoEnumValue struct {
	Name    string
	Number  int
	Options map[string]string
}

// parseProtoFile parses a proto file into a ProtoFile structure
func (p *GRPCParser) parseProtoFile(content string) (*ProtoFile, error) {
	protoFile := &ProtoFile{
		Options:  make(map[string]string),
		Imports:  []string{},
		Services: []ProtoService{},
		Messages: []ProtoMessage{},
		Enums:    []ProtoEnum{},
		Comments: []string{},
	}

	// Parse syntax
	syntaxPattern := regexp.MustCompile(`syntax\s*=\s*"(proto[23])"`)
	if matches := syntaxPattern.FindStringSubmatch(content); len(matches) > 1 {
		protoFile.Syntax = matches[1]
	} else {
		protoFile.Syntax = "proto2" // Default
	}

	// Parse package
	packagePattern := regexp.MustCompile(`package\s+([\w.]+)\s*;`)
	if matches := packagePattern.FindStringSubmatch(content); len(matches) > 1 {
		protoFile.Package = matches[1]
	}

	// Parse imports
	importPattern := regexp.MustCompile(`import\s+(?:public\s+|weak\s+)?"([^"]+)"\s*;`)
	for _, match := range importPattern.FindAllStringSubmatch(content, -1) {
		if len(match) > 1 {
			protoFile.Imports = append(protoFile.Imports, match[1])
		}
	}

	// Parse options
	optionPattern := regexp.MustCompile(`option\s+([\w.]+)\s*=\s*"?([^";]+)"?\s*;`)
	for _, match := range optionPattern.FindAllStringSubmatch(content, -1) {
		if len(match) > 2 {
			protoFile.Options[match[1]] = match[2]
		}
	}

	// Parse services
	protoFile.Services = p.parseServices(content)

	// Parse messages
	protoFile.Messages = p.parseMessages(content)

	// Parse enums
	protoFile.Enums = p.parseEnums(content)

	return protoFile, nil
}

// parseServices parses service definitions from proto content
func (p *GRPCParser) parseServices(content string) []ProtoService {
	var services []ProtoService
	
	// Match service blocks
	servicePattern := regexp.MustCompile(`(?s)service\s+(\w+)\s*\{([^}]*)\}`)
	for _, match := range servicePattern.FindAllStringSubmatch(content, -1) {
		if len(match) < 3 {
			continue
		}
		
		service := ProtoService{
			Name:    match[1],
			Methods: []ProtoMethod{},
			Options: make(map[string]string),
		}
		
		serviceBody := match[2]
		
		// Parse RPC methods
		rpcPattern := regexp.MustCompile(`(?m)rpc\s+(\w+)\s*\(\s*(stream\s+)?(\w+)\s*\)\s*returns\s*\(\s*(stream\s+)?(\w+)\s*\)`)
		for _, rpcMatch := range rpcPattern.FindAllStringSubmatch(serviceBody, -1) {
			method := ProtoMethod{
				Name:         rpcMatch[1],
				InputType:    rpcMatch[3],
				OutputType:   rpcMatch[5],
				ClientStream: rpcMatch[2] != "",
				ServerStream: rpcMatch[4] != "",
				Options:      make(map[string]string),
				Comments:     []string{},
			}
			service.Methods = append(service.Methods, method)
		}
		
		services = append(services, service)
	}
	
	return services
}

// parseMessages parses message definitions from proto content
func (p *GRPCParser) parseMessages(content string) []ProtoMessage {
	var messages []ProtoMessage
	
	// Match message blocks (non-nested only for simplicity)
	messagePattern := regexp.MustCompile(`(?s)message\s+(\w+)\s*\{([^}]*)\}`)
	for _, match := range messagePattern.FindAllStringSubmatch(content, -1) {
		if len(match) < 3 {
			continue
		}
		
		message := ProtoMessage{
			Name:    match[1],
			Fields:  []ProtoField{},
			Nested:  []ProtoMessage{},
			Options: make(map[string]string),
		}
		
		messageBody := match[2]
		
		// Parse fields
		fieldPattern := regexp.MustCompile(`(?m)(repeated\s+)?(optional\s+)?(map<(\w+),\s*(\w+)>|(\w+))\s+(\w+)\s*=\s*(\d+)`)
		for _, fieldMatch := range fieldPattern.FindAllStringSubmatch(messageBody, -1) {
			field := ProtoField{
				Repeated: fieldMatch[1] != "",
				Optional: fieldMatch[2] != "",
				Options:  make(map[string]string),
			}
			
			if fieldMatch[4] != "" && fieldMatch[5] != "" {
				// Map type
				field.Map = true
				field.Type = fmt.Sprintf("map<%s,%s>", fieldMatch[4], fieldMatch[5])
				field.Name = fieldMatch[7]
			} else {
				// Regular field
				field.Type = fieldMatch[6]
				field.Name = fieldMatch[7]
			}
			
			// Parse field number
			fmt.Sscanf(fieldMatch[8], "%d", &field.Number)
			
			message.Fields = append(message.Fields, field)
		}
		
		messages = append(messages, message)
	}
	
	return messages
}

// parseEnums parses enum definitions from proto content
func (p *GRPCParser) parseEnums(content string) []ProtoEnum {
	var enums []ProtoEnum
	
	enumPattern := regexp.MustCompile(`(?s)enum\s+(\w+)\s*\{([^}]*)\}`)
	for _, match := range enumPattern.FindAllStringSubmatch(content, -1) {
		if len(match) < 3 {
			continue
		}
		
		enum := ProtoEnum{
			Name:    match[1],
			Values:  []ProtoEnumValue{},
			Options: make(map[string]string),
		}
		
		enumBody := match[2]
		
		// Parse enum values
		valuePattern := regexp.MustCompile(`(?m)(\w+)\s*=\s*(\d+)`)
		for _, valueMatch := range valuePattern.FindAllStringSubmatch(enumBody, -1) {
			if len(valueMatch) < 3 {
				continue
			}
			
			var number int
			fmt.Sscanf(valueMatch[2], "%d", &number)
			
			value := ProtoEnumValue{
				Name:    valueMatch[1],
				Number:  number,
				Options: make(map[string]string),
			}
			enum.Values = append(enum.Values, value)
		}
		
		enums = append(enums, enum)
	}
	
	return enums
}

// getDescription extracts description from proto file
func (pf *ProtoFile) getDescription() string {
	if len(pf.Comments) > 0 {
		return strings.Join(pf.Comments, "\n")
	}
	return fmt.Sprintf("gRPC API for package %s", pf.Package)
}

// convertServices converts proto services to unified endpoints
func (p *GRPCParser) convertServices(protoFile *ProtoFile) []UnifiedEndpoint {
	var endpoints []UnifiedEndpoint
	
	for _, service := range protoFile.Services {
		for _, method := range service.Methods {
			endpoint := UnifiedEndpoint{
				ID:          fmt.Sprintf("%s.%s", service.Name, method.Name),
				Name:        method.Name,
				Description: strings.Join(method.Comments, "\n"),
				Method:      "POST", // gRPC uses POST
				Path:        fmt.Sprintf("/%s/%s/%s", protoFile.Package, service.Name, method.Name),
				Parameters:  []Parameter{},
				RequestBody: &RequestBody{
					Required:    true,
					ContentType: "application/grpc",
					Schema: &TypeReference{
						Ref:  method.InputType,
						Type: "object",
					},
				},
				Responses: []Response{
					{
						StatusCode:  "200",
						Description: "Successful response",
						ContentType: "application/grpc",
						Schema: &TypeReference{
							Ref:  method.OutputType,
							Type: "object",
						},
					},
				},
				Tags: []string{service.Name},
				Extensions: map[string]interface{}{
					"grpc_service":      service.Name,
					"grpc_method":       method.Name,
					"client_streaming":  method.ClientStream,
					"server_streaming":  method.ServerStream,
					"bidirectional":     method.ClientStream && method.ServerStream,
				},
			}
			
			// Add streaming info if applicable
			if method.ServerStream || method.ClientStream {
				streamType := "unary"
				if method.ClientStream && method.ServerStream {
					streamType = "bidirectional"
				} else if method.ClientStream {
					streamType = "client-stream"
				} else if method.ServerStream {
					streamType = "server-stream"
				}
				
				endpoint.Streaming = &StreamingInfo{
					Type: streamType,
					Settings: map[string]interface{}{
						"protocol": "grpc",
					},
				}
			}
			
			endpoints = append(endpoints, endpoint)
		}
	}
	
	return endpoints
}

// convertMessages converts proto messages to type definitions
func (p *GRPCParser) convertMessages(protoFile *ProtoFile) []TypeDefinition {
	var types []TypeDefinition
	
	for _, message := range protoFile.Messages {
		typeDef := TypeDefinition{
			Name:        message.Name,
			Type:        "object",
			Description: "",
			Properties:  make(map[string]PropertyDefinition),
			Required:    []string{},
			Extensions: map[string]interface{}{
				"proto_message": true,
			},
		}
		
		for _, field := range message.Fields {
			prop := PropertyDefinition{
				Type:        p.protoTypeToJSONType(field.Type),
				Description: "",
				Format:      "",
			}
			
			if field.Repeated {
				prop.Type = "array"
				prop.Items = &TypeReference{
					Type: p.protoTypeToJSONType(field.Type),
				}
			}
			
			if field.Map {
				prop.Type = "object"
				prop.AdditionalProperties = json.RawMessage(`true`)
			}
			
			typeDef.Properties[field.Name] = prop
			
			// In proto3, all fields are optional by default
			// In proto2, required fields should be added to Required array
			if protoFile.Syntax == "proto2" && !field.Optional {
				typeDef.Required = append(typeDef.Required, field.Name)
			}
		}
		
		types = append(types, typeDef)
	}
	
	// Add enum types
	for _, enum := range protoFile.Enums {
		var enumValues []interface{}
		for _, value := range enum.Values {
			enumValues = append(enumValues, value.Name)
		}
		
		typeDef := TypeDefinition{
			Name:        enum.Name,
			Type:        "string",
			Description: "",
			Enum:        enumValues,
			Extensions: map[string]interface{}{
				"proto_enum": true,
			},
		}
		
		types = append(types, typeDef)
	}
	
	return types
}

// protoTypeToJSONType converts proto types to JSON schema types
func (p *GRPCParser) protoTypeToJSONType(protoType string) string {
	typeMap := map[string]string{
		"double":   "number",
		"float":    "number",
		"int32":    "integer",
		"int64":    "integer",
		"uint32":   "integer",
		"uint64":   "integer",
		"sint32":   "integer",
		"sint64":   "integer",
		"fixed32":  "integer",
		"fixed64":  "integer",
		"sfixed32": "integer",
		"sfixed64": "integer",
		"bool":     "boolean",
		"string":   "string",
		"bytes":    "string",
	}
	
	if jsonType, ok := typeMap[protoType]; ok {
		return jsonType
	}
	
	// If not a primitive type, it's a reference to another message
	return "object"
}
