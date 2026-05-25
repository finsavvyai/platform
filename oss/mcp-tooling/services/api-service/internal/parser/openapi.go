package parser

import (
	"net/url"
	"strings"

	"github.com/getkin/kin-openapi/openapi3"
	"github.com/pkg/errors"
)

// OpenAPIParser handles parsing of OpenAPI specifications
type OpenAPIParser struct {
	loader *openapi3.Loader
}

// NewOpenAPIParser creates a new OpenAPI parser instance
func NewOpenAPIParser() *OpenAPIParser {
	loader := openapi3.NewLoader()
	loader.IsExternalRefsAllowed = true
	return &OpenAPIParser{
		loader: loader,
	}
}

// ParseSpec parses an OpenAPI specification
func (p *OpenAPIParser) ParseSpec(specContent string) (*ParsedSpec, error) {
	doc, err := p.loader.LoadFromData([]byte(specContent))
	if err != nil {
		return nil, errors.Wrap(err, "failed to load OpenAPI specification")
	}

	if err := doc.Validate(p.loader.Context); err != nil {
		// Log but continue
	}

	return p.convertDocToParsedSpec(doc)
}

// ParseSpecFromURL parses an OpenAPI specification from a URL
func (p *OpenAPIParser) ParseSpecFromURL(specURL string) (*ParsedSpec, error) {
	parsedURL, err := url.Parse(specURL)
	if err != nil {
		return nil, errors.Wrap(err, "invalid URL provided")
	}

	doc, err := p.loader.LoadFromURI(parsedURL)
	if err != nil {
		return nil, errors.Wrap(err, "failed to load OpenAPI specification from URL")
	}

	return p.convertDocToParsedSpec(doc)
}

func (p *OpenAPIParser) convertDocToParsedSpec(doc *openapi3.T) (*ParsedSpec, error) {
	endpoints := p.extractEndpoints(doc)
	metadata := p.extractMetadata(doc)

	parsedSpec := &ParsedSpec{
		Info:       mapInfo(doc.Info),
		Servers:    mapServers(doc.Servers),
		Paths:      mapPaths(doc.Paths),
		Components: mapComponents(doc.Components),
		Security:   mapSecurity(doc.Security),
		Tags:       mapTags(doc.Tags),
		Endpoints:  endpoints,
		Metadata:   metadata,
		Validation: p.validateSpec(doc),
	}

	return parsedSpec, nil
}

// Helper mapping functions

func mapInfo(info *openapi3.Info) SpecInfo {
	if info == nil {
		return SpecInfo{Title: "Unknown API", Version: "0.0.0"}
	}
	return SpecInfo{
		Title:          info.Title,
		Description:    info.Description,
		Version:        info.Version,
		TermsOfService: info.TermsOfService,
		Contact:        mapContact(info.Contact),
		License:        mapLicense(info.License),
	}
}

func mapContact(contact *openapi3.Contact) *ContactInfo {
	if contact == nil {
		return nil
	}
	return &ContactInfo{
		Name:  contact.Name,
		Email: contact.Email,
		URL:   contact.URL,
	}
}

func mapLicense(license *openapi3.License) *LicenseInfo {
	if license == nil {
		return nil
	}
	return &LicenseInfo{
		Name: license.Name,
		URL:  license.URL,
	}
}

func mapServers(servers openapi3.Servers) []Server {
	var results []Server
	for _, s := range servers {
		results = append(results, Server{
			URL:         s.URL,
			Description: s.Description,
			Variables:   mapServerVariables(s.Variables),
		})
	}
	return results
}

func mapServerVariables(vars map[string]*openapi3.ServerVariable) map[string]string {
	results := make(map[string]string)
	for k, v := range vars {
		results[k] = v.Default
	}
	return results
}

func mapPaths(paths *openapi3.Paths) map[string]Path {
	results := make(map[string]Path)
	if paths == nil {
		return results
	}

	for k, v := range paths.Map() {
		results[k] = Path{
			Summary:     v.Summary,
			Description: v.Description,
			Operations:  mapOperations(v),
		}
	}
	return results
}

func mapOperations(pathItem *openapi3.PathItem) map[string]*Operation {
	ops := make(map[string]*Operation)
	if pathItem == nil {
		return ops
	}

	addOp := func(method string, op *openapi3.Operation) {
		if op != nil {
			var security []SecurityRequirement
			if op.Security != nil {
				security = mapSecurity(*op.Security)
			}

			ops[strings.ToLower(method)] = &Operation{
				ID:          op.OperationID,
				Method:      method,
				Summary:     op.Summary,
				Description: op.Description,
				Tags:        op.Tags,
				Deprecated:  op.Deprecated,
				Parameters:  mapParametersFromRefs(op.Parameters),
				RequestBody: mapRequestBody(op.RequestBody),
				Responses:   mapResponses(op.Responses),
				Security:    security,
			}
		}
	}

	addOp("GET", pathItem.Get)
	addOp("POST", pathItem.Post)
	addOp("PUT", pathItem.Put)
	addOp("DELETE", pathItem.Delete)
	addOp("PATCH", pathItem.Patch)
	addOp("HEAD", pathItem.Head)
	addOp("OPTIONS", pathItem.Options)
	addOp("TRACE", pathItem.Trace)

	return ops
}

func mapParametersFromRefs(refs openapi3.Parameters) []Parameter {
	var results []Parameter
	for _, ref := range refs {
		if ref.Value != nil {
			results = append(results, mapParameter(ref.Value))
		}
	}
	return results
}

func mapParameter(p *openapi3.Parameter) Parameter {
	explode := false
	if p.Explode != nil {
		explode = *p.Explode
	}

	// Convert Schema to TypeReference
	var schema *TypeReference
	if p.Schema != nil {
		mappedSchema := mapSchemaRef(p.Schema)
		if mappedSchema != nil {
			schema = &TypeReference{
				Type: mappedSchema.Type,
				Ref:  mappedSchema.Ref,
			}
		}
	}

	return Parameter{
		Name:        p.Name,
		In:          p.In,
		Description: p.Description,
		Required:    p.Required,
		Deprecated:  p.Deprecated,
		Style:       p.Style,
		Explode:     explode,
		Schema:      schema,
		Example:     p.Example,
	}
}

func mapSchemaRef(ref *openapi3.SchemaRef) *Schema {
	if ref == nil || ref.Value == nil {
		return nil
	}
	s := ref.Value

	typ := ""
	if s.Type != nil && len(*s.Type) > 0 {
		typ = (*s.Type)[0]
	}

	props := make(map[string]*Schema)
	for k, v := range s.Properties {
		props[k] = mapSchemaRef(v)
	}

	var items *Schema
	if s.Items != nil {
		items = mapSchemaRef(s.Items)
	}

	return &Schema{
		Type:             typ,
		Format:           s.Format,
		Description:      s.Description,
		Title:            s.Title,
		Default:          s.Default,
		MultipleOf:       s.MultipleOf,
		Maximum:   s.Max,
		Minimum:   s.Min,
		MaxLength: s.MaxLength,
		MinLength: func() *uint64 {
			if s.MinLength > 0 {
				v := s.MinLength
				return &v
			}
			return nil
		}(),
		Pattern:          s.Pattern,
		Required:         s.Required,
		Enum:             s.Enum,
		Items:            items,
		Properties:       props,
		Nullable:         s.Nullable,
		ReadOnly:         s.ReadOnly,
		WriteOnly:        s.WriteOnly,
		Example: s.Example,
	}
}

func boolToFloatPtr(b bool) *float64 {
	if b {
		f := 1.0
		return &f
	}
	return nil
}

func uint64ToInt64Ptr(v uint64) *int64 {
	i := int64(v)
	return &i
}

func uint64PtrToInt64Ptr(v *uint64) *int64 {
	if v == nil {
		return nil
	}
	i := int64(*v)
	return &i
}

func mapRequestBody(ref *openapi3.RequestBodyRef) *RequestBodyInfo {
	if ref == nil || ref.Value == nil {
		return nil
	}
	return &RequestBodyInfo{
		Description: ref.Value.Description,
		Content:     mapContent(ref.Value.Content),
		Required:    ref.Value.Required,
	}
}

func mapResponses(responses *openapi3.Responses) map[string]*LegacyResponse {
	results := make(map[string]*LegacyResponse)
	if responses == nil {
		return results
	}
	// responses.Map() returns map[string]*openapi3.ResponseRef
	for k, v := range responses.Map() {
		if v.Value != nil {
			var desc string
			if v.Value.Description != nil {
				desc = *v.Value.Description
			}
			results[k] = &LegacyResponse{
				Description: desc,
				Content:     mapContent(v.Value.Content),
			}
		}
	}
	return results
}

func mapContent(content openapi3.Content) map[string]*Media {
	results := make(map[string]*Media)
	for k, v := range content {
		results[k] = &Media{
			Schema:  mapSchemaRef(v.Schema),
			Example: v.Example,
		}
	}
	return results
}

func mapHeaders(headers openapi3.Headers) map[string]Header {
	results := make(map[string]Header)
	for k, v := range headers {
		if v.Value != nil {
			// Convert Schema to TypeReference
			var schema *TypeReference
			if v.Value.Schema != nil {
				mappedSchema := mapSchemaRef(v.Value.Schema)
				if mappedSchema != nil {
					schema = &TypeReference{
						Type: mappedSchema.Type,
						Ref:  mappedSchema.Ref,
					}
				}
			}

			results[k] = Header{
				Description: v.Value.Description,
				Required:    v.Value.Required,
				Schema:      schema,
			}
		}
	}
	return results
}

func mapHeadersPtr(headers openapi3.Headers) map[string]*Header {
	results := make(map[string]*Header)
	for k, v := range headers {
		if v.Value != nil {
			// Convert Schema to TypeReference
			var schema *TypeReference
			if v.Value.Schema != nil {
				mappedSchema := mapSchemaRef(v.Value.Schema)
				if mappedSchema != nil {
					schema = &TypeReference{
						Type: mappedSchema.Type,
						Ref:  mappedSchema.Ref,
					}
				}
			}

			h := Header{
				Description: v.Value.Description,
				Required:    v.Value.Required,
				Schema:      schema,
			}
			results[k] = &h
		}
	}
	return results
}

func mapExamples(examples openapi3.Examples) map[string]Example {
	results := make(map[string]Example)
	for k, v := range examples {
		if v.Value != nil {
			var val interface{} = v.Value.Value

			results[k] = Example{
				Summary:       v.Value.Summary,
				Description:   v.Value.Description,
				Value:         val,
				ExternalValue: v.Value.ExternalValue,
			}
		}
	}
	return results
}

func mapComponents(comps *openapi3.Components) *Components {
	if comps == nil {
		return nil
	}
	return &Components{
		Schemas:         mapSchemas(comps.Schemas),
		Responses:       mapResponsesFromRefs(comps.Responses), // ResponseBodies
		Parameters:      mapParametersMap(comps.Parameters),
		RequestBodies:   mapRequestBodies(comps.RequestBodies),
		Headers:         mapHeadersPtr(comps.Headers),
		SecuritySchemes: mapSecuritySchemes(comps.SecuritySchemes),
	}
}

func mapSchemas(schemas openapi3.Schemas) map[string]*Schema {
	results := make(map[string]*Schema)
	for k, v := range schemas {
		results[k] = mapSchemaRef(v)
	}
	return results
}

func mapResponsesFromRefs(resps openapi3.ResponseBodies) map[string]*Response {
	results := make(map[string]*Response)
	for k, v := range resps {
		if v.Value != nil {
			var desc string
			if v.Value.Description != nil {
				desc = *v.Value.Description
			}
			results[k] = &Response{
				Description: desc,
				StatusCode:  k,
			}
		}
	}
	return results
}

func mapParametersMap(params openapi3.ParametersMap) map[string]*Parameter {
	results := make(map[string]*Parameter)
	for k, v := range params {
		if v.Value != nil {
			p := mapParameter(v.Value)
			results[k] = &p
		}
	}
	return results
}

func mapRequestBodies(bodies openapi3.RequestBodies) map[string]*RequestBodyInfo {
	results := make(map[string]*RequestBodyInfo)
	for k, v := range bodies {
		if v.Value != nil {
			results[k] = mapRequestBody(v)
		}
	}
	return results
}

func mapSecuritySchemes(schemes openapi3.SecuritySchemes) map[string]*SecurityScheme {
	results := make(map[string]*SecurityScheme)
	for k, v := range schemes {
		if v.Value != nil {
			results[k] = &SecurityScheme{
				Type:             v.Value.Type,
				Description:      v.Value.Description,
				Name:             v.Value.Name,
				In:               v.Value.In,
				Scheme:           v.Value.Scheme,
				BearerFormat:     v.Value.BearerFormat,
				OpenIdConnectUrl: v.Value.OpenIdConnectUrl,
				Flows:            mapOAuthFlows(v.Value.Flows),
			}
		}
	}
	return results
}

func mapOAuthFlows(flows *openapi3.OAuthFlows) *OAuthFlows {
	if flows == nil {
		return nil
	}
	return &OAuthFlows{
		Implicit:          mapOAuthFlow(flows.Implicit),
		Password:          mapOAuthFlow(flows.Password),
		ClientCredentials: mapOAuthFlow(flows.ClientCredentials),
		AuthorizationCode: mapOAuthFlow(flows.AuthorizationCode),
	}
}

func mapOAuthFlow(flow *openapi3.OAuthFlow) *OAuthFlow {
	if flow == nil {
		return nil
	}
	return &OAuthFlow{
		AuthorizationURL: flow.AuthorizationURL,
		TokenURL:         flow.TokenURL,
		RefreshURL:       flow.RefreshURL,
		Scopes:           flow.Scopes,
	}
}

func mapSecurity(sec openapi3.SecurityRequirements) []SecurityRequirement {
	var results []SecurityRequirement
	for _, s := range sec {
		results = append(results, SecurityRequirement(s))
	}
	return results
}

func mapTags(tags openapi3.Tags) []TagInfo {
	var results []TagInfo
	for _, t := range tags {
		if t != nil {
			results = append(results, TagInfo{
				Name:        t.Name,
				Description: t.Description,
			})
		}
	}
	return results
}

// Extraction logic

func (p *OpenAPIParser) extractEndpoints(doc *openapi3.T) []Endpoint {
	var endpoints []Endpoint

	if doc.Paths == nil {
		return endpoints
	}

	for path, pathItem := range doc.Paths.Map() {
		operations := map[string]*openapi3.Operation{
			"GET":    pathItem.Get,
			"POST":   pathItem.Post,
			"PUT":    pathItem.Put,
			"DELETE": pathItem.Delete,
			"PATCH":  pathItem.Patch,
		}

		for method, operation := range operations {
			if operation == nil {
				continue
			}

			endpoint := Endpoint{
				Name:        p.generateEndpointName(operation, method, path),
				Method:      strings.ToUpper(method),
				Path:        path,
				Description: getOperationDescription(operation),
			}

			// Parameters
			for _, paramRef := range operation.Parameters {
				if paramRef.Value != nil {
					endpoint.Parameters = append(endpoint.Parameters, mapParameter(paramRef.Value))
				}
			}

			// Body Schema
			if operation.RequestBody != nil && operation.RequestBody.Value != nil {
				// Body schema extracted via RequestBody field
			// for mediaType, mediaTypeObj := range operation.RequestBody.Value.Content {
			// 	if strings.Contains(mediaType, "json") && mediaTypeObj.Schema != nil {
			// 		break
			// 	}
			// }
			}

			// Response Schema
			// Response schema extracted via Responses field
			// if operation.Responses != nil {
			// 	for code, responseRef := range operation.Responses.Map() {
			// 		if strings.HasPrefix(code, "2") && responseRef.Value != nil {
			// 			for mediaType, mediaTypeObj := range responseRef.Value.Content {
			// 				if strings.Contains(mediaType, "json") && mediaTypeObj.Schema != nil {
			// 					break
			// 				}
			// 			}
			// 			break
			// 		}
			// 	}
			// }

			endpoints = append(endpoints, endpoint)
		}
	}

	return endpoints
}

func (p *OpenAPIParser) generateEndpointName(operation *openapi3.Operation, method, path string) string {
	if operation.OperationID != "" {
		return sanitizeName(operation.OperationID)
	}

	// Generate name from method and path
	path = strings.Trim(path, "/")
	parts := strings.Split(path, "/")

	if len(parts) == 0 || (len(parts) == 1 && parts[0] == "") {
		return method
	}

	var nameParts []string
	for _, part := range parts {
		if strings.HasPrefix(part, "{") && strings.HasSuffix(part, "}") {
			nameParts = append(nameParts, "By"+capitalize(strings.Trim(part, "{}")))
		} else {
			nameParts = append(nameParts, capitalize(part))
		}
	}

	return method + strings.Join(nameParts, "")
}

func sanitizeName(name string) string {
	name = strings.ReplaceAll(name, "-", "_")
	name = strings.ReplaceAll(name, " ", "_")
	name = strings.ReplaceAll(name, ".", "_")
	if len(name) > 0 && (name[0] >= '0' && name[0] <= '9') {
		name = "_" + name
	}
	return name
}

func capitalize(s string) string {
	if len(s) == 0 {
		return s
	}
	return strings.ToUpper(s[:1]) + strings.ToLower(s[1:])
}

func getOperationDescription(operation *openapi3.Operation) string {
	if operation.Description != "" {
		return operation.Description
	}
	if operation.Summary != "" {
		return operation.Summary
	}
	return ""
}

func (p *OpenAPIParser) extractMetadata(doc *openapi3.T) SpecMetadata {
	metadata := SpecMetadata{
		"HTTPMethods":     []string{},
		"Category":        categorizeAPI(doc),
		"DataTypes":       []string{},
		"TotalEndpoints":  0,
		"ComplexityScore": 0,
	}

	methods := make(map[string]bool)
	if doc.Paths != nil {
		totalEndpoints := 0
		for _, pathItem := range doc.Paths.Map() {
			if pathItem.Get != nil {
				methods["GET"] = true
				totalEndpoints++
			}
			if pathItem.Post != nil {
				methods["POST"] = true
				totalEndpoints++
			}
			if pathItem.Put != nil {
				methods["PUT"] = true
				totalEndpoints++
			}
			if pathItem.Delete != nil {
				methods["DELETE"] = true
				totalEndpoints++
			}
			if pathItem.Patch != nil {
				methods["PATCH"] = true
				totalEndpoints++
			}
		}
		metadata["TotalEndpoints"] = totalEndpoints
	}

	httpMethods := []string{}
	for m := range methods {
		httpMethods = append(httpMethods, m)
	}
	metadata["HTTPMethods"] = httpMethods

	if len(doc.Servers) > 0 {
		metadata["BaseURL"] = doc.Servers[0].URL
	}

	// Calc complexity
	complexityScore := calculateComplexity(doc)
	metadata["ComplexityScore"] = complexityScore
	metadata["EstimatedTime"] = complexityScore * 2

	return metadata
}

func categorizeAPI(doc *openapi3.T) string {
	title := strings.ToLower(doc.Info.Title)
	if strings.Contains(title, "payment") {
		return "Payment"
	}
	if strings.Contains(title, "social") {
		return "Social"
	}
	return "General"
}

func calculateComplexity(doc *openapi3.T) int {
	score := 0
	if doc.Paths != nil {
		score += len(doc.Paths.Map()) * 5
	}
	if doc.Components != nil {
		score += len(doc.Components.Schemas) * 2
	}
	return score
}

func (p *OpenAPIParser) validateSpec(doc *openapi3.T) *ValidationResult {
	results := &ValidationResults{
		Valid:    true,
		IsValid:  true,
		Errors:   []ValidationError{},
		Warnings: []ValidationError{},
		Info:     []ValidationError{},
		Infos:    []ValidationError{},
	}

	if doc.Info == nil {
		results.Errors = append(results.Errors, ValidationError{Message: "Missing info", Code: "MISSING_INFO"})
		results.IsValid = false
		results.Valid = false
	} else if doc.Info.Title == "" {
		results.Errors = append(results.Errors, ValidationError{Message: "Missing title", Code: "MISSING_TITLE"})
		results.IsValid = false
		results.Valid = false
	}

	return results
}
