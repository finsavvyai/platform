package parser

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"

	"github.com/pkg/errors"
)

// PostmanParser handles parsing of Postman collections
type PostmanParser struct {
	httpClient *HTTPClient
}

// NewPostmanParser creates a new Postman parser instance
func NewPostmanParser() *PostmanParser {
	return &PostmanParser{
		httpClient: &HTTPClient{},
	}
}

// PostmanCollection represents a Postman collection v2.1
type PostmanCollection struct {
	Info struct {
		Name        string `json:"name"`
		Description string `json:"description,omitempty"`
		Version     string `json:"version,omitempty"`
		Schema      string `json:"schema"`
	} `json:"info"`
	Item     []PostmanItem     `json:"item"`
	Variable []PostmanVariable `json:"variable,omitempty"`
	Auth     *PostmanAuth      `json:"auth,omitempty"`
	Event    []PostmanEvent    `json:"event,omitempty"`
}

// PostmanItem represents a folder or request in a Postman collection
type PostmanItem struct {
	Name        string            `json:"name"`
	Description interface{}       `json:"description,omitempty"`
	Item        []PostmanItem     `json:"item,omitempty"`
	Request     *PostmanRequest   `json:"request,omitempty"`
	Response    []interface{}     `json:"response,omitempty"`
	Event       []PostmanEvent    `json:"event,omitempty"`
	Variable    []PostmanVariable `json:"variable,omitempty"`
	Auth        *PostmanAuth      `json:"auth,omitempty"`
}

// PostmanRequest represents a request in Postman
type PostmanRequest struct {
	URL         PostmanURL          `json:"url"`
	Method      string              `json:"method"`
	Header      []PostmanHeader     `json:"header,omitempty"`
	Body        *PostmanBody        `json:"body,omitempty"`
	Description interface{}         `json:"description,omitempty"`
	Auth        *PostmanAuth        `json:"auth,omitempty"`
	Proxy       *PostmanProxy       `json:"proxy,omitempty"`
	Certificate *PostmanCertificate `json:"certificate,omitempty"`
}

// PostmanURL represents a URL in Postman
type PostmanURL interface{}

// PostmanURLString represents a simple string URL
type PostmanURLString string

// PostmanURLObject represents a structured URL object
type PostmanURLObject struct {
	Raw      string              `json:"raw,omitempty"`
	Protocol string              `json:"protocol,omitempty"`
	Host     []string            `json:"host,omitempty"`
	Path     []string            `json:"path,omitempty"`
	Query    []PostmanQueryParam `json:"query,omitempty"`
	Variable []PostmanVariable   `json:"variable,omitempty"`
}

// PostmanHeader represents a header in Postman
type PostmanHeader struct {
	Key         string `json:"key"`
	Value       string `json:"value"`
	Description string `json:"description,omitempty"`
	Disabled    bool   `json:"disabled,omitempty"`
}

// PostmanBody represents a request body in Postman
type PostmanBody struct {
	Mode       string                   `json:"mode"`
	Raw        string                   `json:"raw,omitempty"`
	URLencoded []PostmanURLEncodedParam `json:"urlencoded,omitempty"`
	Formdata   []PostmanFormDataParam   `json:"formdata,omitempty"`
	File       *PostmanFile             `json:"file,omitempty"`
	GraphQL    *PostmanGraphQL          `json:"graphql,omitempty"`
	Options    *PostmanBodyOptions      `json:"options,omitempty"`
}

// PostmanURLEncodedParam represents a URL-encoded parameter
type PostmanURLEncodedParam struct {
	Key         string `json:"key"`
	Value       string `json:"value"`
	Description string `json:"description,omitempty"`
	Disabled    bool   `json:"disabled,omitempty"`
	Type        string `json:"type,omitempty"`
}

// PostmanFormDataParam represents a form data parameter
type PostmanFormDataParam struct {
	Key         string `json:"key"`
	Value       string `json:"value,omitempty"`
	Description string `json:"description,omitempty"`
	Disabled    bool   `json:"disabled,omitempty"`
	Type        string `json:"type,omitempty"`
	Src         string `json:"src,omitempty"`
}

// PostmanFile represents a file upload
type PostmanFile struct {
	Src string `json:"src,omitempty"`
}

// PostmanGraphQL represents GraphQL request data
type PostmanGraphQL struct {
	Query     string `json:"query"`
	Variables string `json:"variables,omitempty"`
}

// PostmanBodyOptions represents body options
type PostmanBodyOptions struct {
	Raw struct {
		Language string `json:"language,omitempty"`
	} `json:"raw,omitempty"`
}

// PostmanQueryParam represents a query parameter
type PostmanQueryParam struct {
	Key         string `json:"key"`
	Value       string `json:"value,omitempty"`
	Description string `json:"description,omitempty"`
	Disabled    bool   `json:"disabled,omitempty"`
}

// PostmanVariable represents a variable in Postman
type PostmanVariable struct {
	Key         string      `json:"key"`
	Value       interface{} `json:"value,omitempty"`
	Description string      `json:"description,omitempty"`
	Disabled    bool        `json:"disabled,omitempty"`
	Type        string      `json:"type,omitempty"`
}

// PostmanAuth represents authentication in Postman
type PostmanAuth struct {
	Type   string             `json:"type"`
	Basic  *PostmanAuthBasic  `json:"basic,omitempty"`
	OAuth1 *PostmanAuthOAuth1 `json:"oauth1,omitempty"`
	OAuth2 *PostmanAuthOAuth2 `json:"oauth2,omitempty"`
	APIKey *PostmanAuthAPIKey `json:"apikey,omitempty"`
	Bearer *PostmanAuthBearer `json:"bearer,omitempty"`
}

// PostmanAuthBasic represents basic authentication
type PostmanAuthBasic struct {
	Username     string `json:"username,omitempty"`
	Password     string `json:"password,omitempty"`
	ShowPassword bool   `json:"showPassword,omitempty"`
}

// PostmanAuthOAuth1 represents OAuth1 authentication
type PostmanAuthOAuth1 struct {
	ConsumerKey       string `json:"consumerKey,omitempty"`
	ConsumerSecret    string `json:"consumerSecret,omitempty"`
	Token             string `json:"token,omitempty"`
	TokenSecret       string `json:"tokenSecret,omitempty"`
	SignatureMethod   string `json:"signatureMethod,omitempty"`
	Timestamp         string `json:"timestamp,omitempty"`
	Nonce             string `json:"nonce,omitempty"`
	Version           string `json:"version,omitempty"`
	Realm             string `json:"realm,omitempty"`
	AutoAddParameters bool   `json:"autoAddParameters,omitempty"`
}

// PostmanAuthOAuth2 represents OAuth2 authentication
type PostmanAuthOAuth2 struct {
	AuthType     string `json:"authType,omitempty"`
	AccessToken  string `json:"accessToken,omitempty"`
	AddTokenTo   string `json:"addTokenTo,omitempty"`
	HeaderPrefix string `json:"headerPrefix,omitempty"`
}

// PostmanAuthAPIKey represents API key authentication
type PostmanAuthAPIKey struct {
	Key   string `json:"key,omitempty"`
	Value string `json:"value,omitempty"`
	In    string `json:"in,omitempty"`
}

// PostmanAuthBearer represents bearer token authentication
type PostmanAuthBearer struct {
	Token string `json:"token,omitempty"`
}

// PostmanEvent represents an event in Postman
type PostmanEvent struct {
	Listen string         `json:"listen,omitempty"`
	Script *PostmanScript `json:"script,omitempty"`
}

// PostmanScript represents a script in Postman
type PostmanScript struct {
	Type   string   `json:"type,omitempty"`
	Exec   []string `json:"exec,omitempty"`
	Target string   `json:"target,omitempty"`
}

// PostmanProxy represents proxy configuration
type PostmanProxy struct {
	Match  string `json:"match,omitempty"`
	Host   string `json:"host,omitempty"`
	Port   int    `json:"port,omitempty"`
	Tunnel bool   `json:"tunnel,omitempty"`
}

// PostmanCertificate represents certificate configuration
type PostmanCertificate struct {
	Name       string `json:"name,omitempty"`
	Pem        string `json:"pem,omitempty"`
	Key        string `json:"key,omitempty"`
	Passphrase string `json:"passphrase,omitempty"`
}

// ParsedPostmanCollection represents a parsed Postman collection
type ParsedPostmanCollection struct {
	Info       CollectionInfo         `json:"info"`
	Items      []ParsedCollectionItem `json:"items"`
	Variables  []PostmanVariable      `json:"variables"`
	Auth       *PostmanAuth           `json:"auth"`
	Metadata   PostmanMetadata        `json:"metadata"`
	Validation ValidationResults      `json:"validation"`
	Endpoints  []Endpoint             `json:"endpoints"`
}

// CollectionInfo contains information about the collection
type CollectionInfo struct {
	Name        string `json:"name"`
	Description string `json:"description,omitempty"`
	Version     string `json:"version,omitempty"`
	Schema      string `json:"schema"`
}

// ParsedCollectionItem represents a parsed item from a Postman collection
type ParsedCollectionItem struct {
	Name        string                 `json:"name"`
	Description string                 `json:"description,omitempty"`
	Request     *ParsedPostmanRequest  `json:"request,omitempty"`
	Items       []ParsedCollectionItem `json:"items,omitempty"`
	Variables   []PostmanVariable      `json:"variables,omitempty"`
	Auth        *PostmanAuth           `json:"auth,omitempty"`
	Type        string                 `json:"type"` // "folder" or "request"
}

// ParsedPostmanRequest represents a parsed request from Postman
type ParsedPostmanRequest struct {
	URL         string          `json:"url"`
	Method      string          `json:"method"`
	Headers     []PostmanHeader `json:"headers"`
	Body        *PostmanBody    `json:"body,omitempty"`
	Description string          `json:"description,omitempty"`
	Auth        *PostmanAuth    `json:"auth,omitempty"`
	Parameters  []Parameter     `json:"parameters"`
}

// PostmanMetadata represents metadata extracted from Postman collection
type PostmanMetadata struct {
	TotalRequests   int      `json:"total_requests"`
	TotalFolders    int      `json:"total_folders"`
	HTTPMethods     []string `json:"http_methods"`
	Authentication  []string `json:"authentication"`
	HasVariables    bool     `json:"has_variables"`
	HasScripts      bool     `json:"has_scripts"`
	ComplexityScore int      `json:"complexity_score"`
	EstimatedTime   int      `json:"estimated_time"`
	BaseURL         string   `json:"base_url"`
}

// ParsePostmanCollection parses a Postman collection from a string
func (p *PostmanParser) ParsePostmanCollection(collectionContent string) (*ParsedPostmanCollection, error) {
	var collection PostmanCollection
	if err := json.Unmarshal([]byte(collectionContent), &collection); err != nil {
		return nil, errors.Wrap(err, "failed to parse Postman collection")
	}

	// Validate collection schema
	if collection.Info.Schema == "" {
		return nil, errors.New("missing schema information in Postman collection")
	}

	// Convert to our internal format
	parsedCollection, err := p.convertPostmanCollection(&collection)
	if err != nil {
		return nil, errors.Wrap(err, "failed to convert Postman collection")
	}

	return parsedCollection, nil
}

// ParsePostmanCollectionFromURL parses a Postman collection from a URL
func (p *PostmanParser) ParsePostmanCollectionFromURL(collectionURL string) (*ParsedPostmanCollection, error) {
	// Download collection from URL
	response, err := p.httpClient.Get(collectionURL)
	if err != nil {
		return nil, errors.Wrap(err, "failed to download Postman collection from URL")
	}
	defer response.Body.Close()

	if response.StatusCode != 200 {
		return nil, fmt.Errorf("failed to download Postman collection: HTTP %d", response.StatusCode)
	}

	var collectionContent string
	if err := json.NewDecoder(response.Body).Decode(&collectionContent); err != nil {
		return nil, errors.Wrap(err, "failed to read Postman collection content")
	}

	return p.ParsePostmanCollection(collectionContent)
}

// ConvertPostmanToOpenAPI converts a Postman collection to OpenAPI specification
func (p *PostmanParser) ConvertPostmanToOpenAPI(postmanCollection *ParsedPostmanCollection) (*ParsedSpec, error) {
	// Create a new OpenAPI specification
	openAPISpec := &ParsedSpec{
		Info: SpecInfo{
			Title:       postmanCollection.Info.Name,
			Description: postmanCollection.Info.Description,
			Version:     postmanCollection.Info.Version,
		},
		Servers: []Server{},
		Paths:   map[string]Path{},
		Components: &Components{
			Schemas: map[string]*Schema{},
		},
		Validation: &postmanCollection.Validation,
		Metadata: SpecMetadata{
			"HTTPMethods":     postmanCollection.Metadata.HTTPMethods,
			"Authentication":  postmanCollection.Metadata.Authentication,
			"DataTypes":       []string{},
			"Category":        "Postman Collection",
			"TotalEndpoints":  postmanCollection.Metadata.TotalRequests,
			"BaseURL":         postmanCollection.Metadata.BaseURL,
			"ComplexityScore": postmanCollection.Metadata.ComplexityScore,
			"EstimatedTime":   postmanCollection.Metadata.EstimatedTime,
		},
	}

	// Add server if base URL is available
	if postmanCollection.Metadata.BaseURL != "" {
		openAPISpec.Servers = append(openAPISpec.Servers, Server{
			URL:         postmanCollection.Metadata.BaseURL,
			Description: "Base URL from Postman collection",
		})
	}

	// Convert Postman items to OpenAPI paths
	paths := make(map[string]Path)
	for _, item := range postmanCollection.Items {
		if item.Request != nil {
			path, operation := p.convertPostmanRequestToOpenAPI(item)
			if path != "" {
				if _, exists := paths[path]; !exists {
					paths[path] = Path{
						Operations: map[string]*Operation{},
					}
				}
				paths[path].Operations[strings.ToLower(item.Request.Method)] = operation
			}
		}
	}

	openAPISpec.Paths = paths
	openAPISpec.Endpoints = postmanCollection.Endpoints

	return openAPISpec, nil
}

// Helper methods

func (p *PostmanParser) convertPostmanCollection(collection *PostmanCollection) (*ParsedPostmanCollection, error) {
	parsedCollection := &ParsedPostmanCollection{
		Info: CollectionInfo{
			Name:        collection.Info.Name,
			Description: p.extractDescription(collection.Info.Description),
			Version:     collection.Info.Version,
			Schema:      collection.Info.Schema,
		},
		Items:     []ParsedCollectionItem{},
		Variables: collection.Variable,
		Auth:      collection.Auth,
		Validation: ValidationResults{
			IsValid:  true,
			Errors:   []ValidationError{},
			Warnings: []ValidationError{},
			Infos:    []ValidationError{},
		},
		Endpoints: []Endpoint{},
		Metadata: PostmanMetadata{
			TotalRequests:   0,
			TotalFolders:    0,
			HTTPMethods:     []string{},
			Authentication:  []string{},
			HasVariables:    len(collection.Variable) > 0,
			HasScripts:      len(collection.Event) > 0,
			ComplexityScore: 0,
			EstimatedTime:   0,
			BaseURL:         "",
		},
	}

	// Recursively convert items
	parsedItems, endpoints, metadata := p.convertPostmanItems(collection.Item)
	parsedCollection.Items = parsedItems
	parsedCollection.Endpoints = endpoints
	parsedCollection.Metadata = p.mergeMetadata(parsedCollection.Metadata, metadata)

	return parsedCollection, nil
}

func (p *PostmanParser) convertPostmanItems(items []PostmanItem) ([]ParsedCollectionItem, []Endpoint, PostmanMetadata) {
	var parsedItems []ParsedCollectionItem
	var endpoints []Endpoint
	metadata := PostmanMetadata{
		HTTPMethods: []string{},
	}

	for _, item := range items {
		parsedItem := ParsedCollectionItem{
			Name:        item.Name,
			Description: p.extractDescription(item.Description),
			Variables:   item.Variable,
			Auth:        item.Auth,
		}

		if item.Request != nil {
			// This is a request
			parsedRequest := p.convertPostmanRequest(item.Request)
			parsedItem.Request = &parsedRequest
			parsedItem.Type = "request"

			// Create endpoint
			endpoint := Endpoint{
				Name:        item.Name,
				Method:      strings.ToUpper(parsedRequest.Method),
				Path:        p.extractPathFromURL(parsedRequest.URL),
				Description: parsedRequest.Description,
				Parameters:  parsedRequest.Parameters,
			}
			endpoints = append(endpoints, endpoint)

			// Update metadata
			metadata.TotalRequests++
			if !p.containsString(metadata.HTTPMethods, strings.ToUpper(parsedRequest.Method)) {
				metadata.HTTPMethods = append(metadata.HTTPMethods, strings.ToUpper(parsedRequest.Method))
			}

			if parsedRequest.Auth != nil && parsedRequest.Auth.Type != "" {
				if !p.containsString(metadata.Authentication, parsedRequest.Auth.Type) {
					metadata.Authentication = append(metadata.Authentication, parsedRequest.Auth.Type)
				}
			}
		} else {
			// This is a folder
			parsedItem.Type = "folder"
			metadata.TotalFolders++

			// Recursively process nested items
			nestedItems, nestedEndpoints, nestedMetadata := p.convertPostmanItems(item.Item)
			parsedItem.Items = nestedItems
			endpoints = append(endpoints, nestedEndpoints...)

			// Merge metadata
			metadata = p.mergeMetadata(metadata, nestedMetadata)
		}

		// Check for scripts
		if len(item.Event) > 0 {
			metadata.HasScripts = true
		}

		parsedItems = append(parsedItems, parsedItem)
	}

	return parsedItems, endpoints, metadata
}

func (p *PostmanParser) convertPostmanRequest(request *PostmanRequest) ParsedPostmanRequest {
	parsedRequest := ParsedPostmanRequest{
		URL:         p.convertPostmanURL(request.URL),
		Method:      request.Method,
		Headers:     request.Header,
		Body:        request.Body,
		Description: p.extractDescription(request.Description),
		Auth:        request.Auth,
		Parameters:  []Parameter{},
	}

	// Extract parameters from URL and body
	parsedRequest.Parameters = p.extractParametersFromRequest(&parsedRequest)

	return parsedRequest
}

func (p *PostmanParser) convertPostmanURL(postmanURL PostmanURL) string {
	switch v := postmanURL.(type) {
	case string:
		return v
	case map[string]interface{}:
		// Handle URL object
		if raw, ok := v["raw"].(string); ok {
			return raw
		}
		if protocol, ok := v["protocol"].(string); ok {
			if host, ok := v["host"].([]interface{}); ok {
				var hostStr string
				if len(host) > 0 {
					hostStr = fmt.Sprintf("%v", host[0])
				}
				if path, ok := v["path"].([]interface{}); ok {
					var pathStr string
					for _, p := range path {
						pathStr += "/" + fmt.Sprintf("%v", p)
					}
					return protocol + "://" + hostStr + pathStr
				}
				return protocol + "://" + hostStr
			}
		}
	}
	return ""
}

func (p *PostmanParser) extractDescription(description interface{}) string {
	if description == nil {
		return ""
	}
	if str, ok := description.(string); ok {
		return str
	}
	if desc, ok := description.(map[string]interface{}); ok {
		if content, ok := desc["content"].(string); ok {
			return content
		}
	}
	return fmt.Sprintf("%v", description)
}

func (p *PostmanParser) extractPathFromURL(urlString string) string {
	if urlString == "" {
		return "/"
	}

	parsedURL, err := url.Parse(urlString)
	if err != nil {
		return "/" // Fallback to root
	}

	return parsedURL.Path
}

func (p *PostmanParser) extractParametersFromRequest(request *ParsedPostmanRequest) []Parameter {
	var parameters []Parameter

	// Extract query parameters from URL
	parsedURL, err := url.Parse(request.URL)
	if err == nil {
		for key, values := range parsedURL.Query() {
			for _, value := range values {
				parameters = append(parameters, Parameter{
					Name:        key,
					In:          "query",
					Description: "",
					Required:    false,
					Schema: &TypeReference{
						Type: "string",
					},
					Example: value,
				})
			}
		}
	}

	// Extract parameters from body if it's form data or URL encoded
	if request.Body != nil {
		switch request.Body.Mode {
		case "formdata":
			for _, param := range request.Body.Formdata {
				parameters = append(parameters, Parameter{
					Name:        param.Key,
					In:          "formData",
					Description: param.Description,
					Required:    !param.Disabled,
					Schema: &TypeReference{
						Type: "string",
					},
					Example: param.Value,
				})
			}
		case "urlencoded":
			for _, param := range request.Body.URLencoded {
				parameters = append(parameters, Parameter{
					Name:        param.Key,
					In:          "formData",
					Description: param.Description,
					Required:    !param.Disabled,
					Schema: &TypeReference{
						Type: "string",
					},
					Example: param.Value,
				})
			}
		}
	}

	// Extract headers as parameters (for documentation purposes)
	for _, header := range request.Headers {
		if !header.Disabled {
			parameters = append(parameters, Parameter{
				Name:        header.Key,
				In:          "header",
				Description: header.Description,
				Required:    false,
				Schema: &TypeReference{
					Type: "string",
				},
				Example: header.Value,
			})
		}
	}

	return parameters
}

func (p *PostmanParser) convertPostmanRequestToOpenAPI(item ParsedCollectionItem) (string, *Operation) {
	if item.Request == nil {
		return "", nil
	}

	path := p.extractPathFromURL(item.Request.URL)
	operation := &Operation{
		ID:          p.generateOperationID(item.Name, item.Request.Method),
		Method:      strings.ToUpper(item.Request.Method),
		Path:        path,
		Summary:     item.Name,
		Description: item.Request.Description,
		Tags:        []string{},
		Parameters:  item.Request.Parameters,
		Responses: map[string]*LegacyResponse{
			"200": {
				Description: "Successful response",
			},
		},
	}

	// Add request body if present
	if item.Request.Body != nil {
		operation.RequestBody = &RequestBodyInfo{
			Description: "Request body",
			Required:    true,
			Content: map[string]*Media{
				"application/json": {
					Schema: &Schema{
						Type: "object",
					},
				},
			},
		}
	}

	return path, operation
}

func (p *PostmanParser) generateOperationID(name, method string) string {
	// Generate a unique operation ID based on name and method
	id := strings.ToLower(method) + "_"
	id = strings.ReplaceAll(strings.ReplaceAll(name, " ", "_"), "-", "_")
	return id
}

func (p *PostmanParser) mergeMetadata(meta1, meta2 PostmanMetadata) PostmanMetadata {
	// Merge HTTP methods
	httpMethods := meta1.HTTPMethods
	for _, method := range meta2.HTTPMethods {
		if !p.containsString(httpMethods, method) {
			httpMethods = append(httpMethods, method)
		}
	}

	// Merge authentication types
	authTypes := meta1.Authentication
	for _, authType := range meta2.Authentication {
		if !p.containsString(authTypes, authType) {
			authTypes = append(authTypes, authType)
		}
	}

	return PostmanMetadata{
		TotalRequests:   meta1.TotalRequests + meta2.TotalRequests,
		TotalFolders:    meta1.TotalFolders + meta2.TotalFolders,
		HTTPMethods:     httpMethods,
		Authentication:  authTypes,
		HasVariables:    meta1.HasVariables || meta2.HasVariables,
		HasScripts:      meta1.HasScripts || meta2.HasScripts,
		ComplexityScore: meta1.ComplexityScore + meta2.ComplexityScore,
		EstimatedTime:   meta1.EstimatedTime + meta2.EstimatedTime,
		BaseURL:         p.selectBaseURL(meta1.BaseURL, meta2.BaseURL),
	}
}

func (p *PostmanParser) selectBaseURL(url1, url2 string) string {
	if url1 != "" {
		return url1
	}
	return url2
}

func (p *PostmanParser) containsString(slice []string, str string) bool {
	for _, s := range slice {
		if s == str {
			return true
		}
	}
	return false
}

// HTTPClient interface for making HTTP requests
type HTTPClient struct{}

func (c *HTTPClient) Get(url string) (*HTTPResponse, error) {
	resp, err := http.Get(url)
	if err != nil {
		return nil, err
	}
	// Note: Caller is responsible for closing body, but we need to pass it
	// In a real app we might read it here or handle it differently
	return &HTTPResponse{
		StatusCode: resp.StatusCode,
		Body:       resp.Body,
	}, nil
}

// HTTPResponse represents an HTTP response
type HTTPResponse struct {
	StatusCode int
	Body       io.ReadCloser
}
