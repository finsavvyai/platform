package sdln

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/url"
	"strings"
	"testing"
	"time"
)

func TestHTTPBuilder_BuildURL(t *testing.T) {
	tests := []struct {
		name        string
		baseURL     string
		path        string
		params      map[string]string
		expected    string
		expectError bool
	}{
		{
			name:     "simple URL",
			baseURL:  "https://api.example.com",
			path:     "/v1/users",
			params:   nil,
			expected: "https://api.example.com/v1/users",
		},
		{
			name:    "URL with query parameters",
			baseURL: "https://api.example.com",
			path:    "/v1/users",
			params: map[string]string{
				"page":  "1",
				"limit": "10",
			},
			expected: "https://api.example.com/v1/users?page=1&limit=10",
		},
		{
			name:     "URL with path parameters",
			baseURL:  "https://api.example.com",
			path:     "/v1/users/123",
			params:   nil,
			expected: "https://api.example.com/v1/users/123",
		},
		{
			name:    "URL with encoded parameters",
			baseURL: "https://api.example.com",
			path:    "/v1/search",
			params: map[string]string{
				"q": "hello world",
			},
			expected: "https://api.example.com/v1/search?q=hello+world",
		},
		{
			name:     "URL with trailing slash",
			baseURL:  "https://api.example.com/",
			path:     "/v1/users/",
			params:   nil,
			expected: "https://api.example.com/v1/users",
		},
		{
			name:    "URL with empty parameters",
			baseURL: "https://api.example.com",
			path:    "/v1/users",
			params: map[string]string{
				"empty": "",
				"valid": "value",
			},
			expected: "https://api.example.com/v1/users?valid=value",
		},
		{
			name:        "invalid base URL",
			baseURL:     "://invalid-url",
			path:        "/v1/users",
			params:      nil,
			expectError: true,
		},
		{
			name:        "URL with invalid characters",
			baseURL:     "https://api.example.com",
			path:        "/v1/users\x00",
			params:      nil,
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			builder := NewHTTPBuilder(tt.baseURL)
			builder.SetPath(tt.path)

			for k, v := range tt.params {
				builder.AddQueryParam(k, v)
			}

			result, err := builder.BuildURL()

			if tt.expectError {
				if err == nil {
					t.Fatal("Expected error but got none")
				}
			} else {
				if err != nil {
					t.Fatalf("Unexpected error: %v", err)
				}
				if result != tt.expected {
					t.Fatalf("Expected URL %q, got %q", tt.expected, result)
				}
			}
		})
	}
}

func TestHTTPBuilder_BuildRequest(t *testing.T) {
	tests := []struct {
		name        string
		setupFunc   func(*HTTPBuilder)
		expectError bool
		errorMsg    string
		validate    func(*http.Request) error
	}{
		{
			name: "GET request",
			setupFunc: func(b *HTTPBuilder) {
				b.SetMethod("GET")
				b.SetPath("/v1/users")
				b.AddQueryParam("page", "1")
			},
			expectError: false,
			validate: func(req *http.Request) error {
				if req.Method != "GET" {
					return fmt.Errorf("expected GET method, got %s", req.Method)
				}
				expectedURL := "/v1/users?page=1"
				if req.URL.String() != expectedURL {
					return fmt.Errorf("expected URL %q, got %q", expectedURL, req.URL.String())
				}
				return nil
			},
		},
		{
			name: "POST request with JSON body",
			setupFunc: func(b *HTTPBuilder) {
				b.SetMethod("POST")
				b.SetPath("/v1/users")
				b.SetJSONBody(map[string]interface{}{
					"name":  "John Doe",
					"email": "john@example.com",
				})
			},
			expectError: false,
			validate: func(req *http.Request) error {
				if req.Method != "POST" {
					return fmt.Errorf("expected POST method, got %s", req.Method)
				}
				if req.Header.Get("Content-Type") != "application/json" {
					return fmt.Errorf("expected Content-Type application/json, got %s", req.Header.Get("Content-Type"))
				}
				body, err := io.ReadAll(req.Body)
				if err != nil {
					return fmt.Errorf("failed to read body: %v", err)
				}
				var data map[string]interface{}
				if err := json.Unmarshal(body, &data); err != nil {
					return fmt.Errorf("failed to unmarshal JSON: %v", err)
				}
				if data["name"] != "John Doe" {
					return fmt.Errorf("expected name 'John Doe', got %v", data["name"])
				}
				return nil
			},
		},
		{
			name: "PUT request with form data",
			setupFunc: func(b *HTTPBuilder) {
				b.SetMethod("PUT")
				b.SetPath("/v1/users/123")
				b.SetFormData(map[string]string{
					"name":  "Jane Doe",
					"email": "jane@example.com",
				})
			},
			expectError: false,
			validate: func(req *http.Request) error {
				if req.Method != "PUT" {
					return fmt.Errorf("expected PUT method, got %s", req.Method)
				}
				if req.Header.Get("Content-Type") != "application/x-www-form-urlencoded" {
					return fmt.Errorf("expected Content-Type application/x-www-form-urlencoded, got %s", req.Header.Get("Content-Type"))
				}
				body, err := io.ReadAll(req.Body)
				if err != nil {
					return fmt.Errorf("failed to read body: %v", err)
				}
				expectedBody := "name=Jane+Doe&email=jane%40example.com"
				if string(body) != expectedBody {
					return fmt.Errorf("expected body %q, got %q", expectedBody, string(body))
				}
				return nil
			},
		},
		{
			name: "request with headers",
			setupFunc: func(b *HTTPBuilder) {
				b.SetMethod("GET")
				b.SetPath("/v1/users")
				b.AddHeader("Authorization", "Bearer token123")
				b.AddHeader("X-API-Version", "v1")
			},
			expectError: false,
			validate: func(req *http.Request) error {
				if req.Header.Get("Authorization") != "Bearer token123" {
					return fmt.Errorf("expected Authorization header, got %s", req.Header.Get("Authorization"))
				}
				if req.Header.Get("X-API-Version") != "v1" {
					return fmt.Errorf("expected X-API-Version v1, got %s", req.Header.Get("X-API-Version"))
				}
				return nil
			},
		},
		{
			name: "request with timeout",
			setupFunc: func(b *HTTPBuilder) {
				b.SetMethod("GET")
				b.SetPath("/v1/users")
				b.SetTimeout(5 * time.Second)
			},
			expectError: false,
			validate: func(req *http.Request) error {
				ctx := req.Context()
				deadline, ok := ctx.Deadline()
				if !ok {
					return fmt.Errorf("expected deadline in context")
				}
				expectedDeadline := time.Now().Add(5 * time.Second)
				if deadline.Before(expectedDeadline.Add(-1*time.Second)) || deadline.After(expectedDeadline.Add(1*time.Second)) {
					return fmt.Errorf("deadline not properly set")
				}
				return nil
			},
		},
		{
			name: "invalid method",
			setupFunc: func(b *HTTPBuilder) {
				b.SetMethod("INVALID")
				b.SetPath("/v1/users")
			},
			expectError: true,
			errorMsg:    "invalid HTTP method",
		},
		{
			name: "missing method",
			setupFunc: func(b *HTTPBuilder) {
				b.SetPath("/v1/users")
			},
			expectError: true,
			errorMsg:    "HTTP method not set",
		},
		{
			name: "missing path",
			setupFunc: func(b *HTTPBuilder) {
				b.SetMethod("GET")
			},
			expectError: true,
			errorMsg:    "path not set",
		},
		{
			name: "invalid JSON body",
			setupFunc: func(b *HTTPBuilder) {
				b.SetMethod("POST")
				b.SetPath("/v1/users")
				b.SetJSONBody(make(chan int)) // Unmarshalable type
			},
			expectError: true,
			errorMsg:    "failed to marshal JSON",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			builder := NewHTTPBuilder("https://api.example.com")
			tt.setupFunc(builder)

			req, err := builder.BuildRequest()

			if tt.expectError {
				if err == nil {
					t.Fatal("Expected error but got none")
				}
				if tt.errorMsg != "" && !strings.Contains(strings.ToLower(err.Error()), strings.ToLower(tt.errorMsg)) {
					t.Fatalf("Expected error containing %q, got %q", tt.errorMsg, err.Error())
				}
			} else {
				if err != nil {
					t.Fatalf("Unexpected error: %v", err)
				}
				if req == nil {
					t.Fatal("Expected non-nil request")
				}
				if tt.validate != nil {
					if err := tt.validate(req); err != nil {
						t.Fatalf("Request validation failed: %v", err)
					}
				}
			}
		})
	}
}

func TestHTTPBuilder_MultipartForm(t *testing.T) {
	tests := []struct {
		name        string
		setupFunc   func(*HTTPBuilder)
		expectError bool
		errorMsg    string
		validate    func(*http.Request) error
	}{
		{
			name: "multipart form with fields",
			setupFunc: func(b *HTTPBuilder) {
				b.SetMethod("POST")
				b.SetPath("/v1/upload")
				b.SetMultipartForm(map[string]interface{}{
					"name":  "John Doe",
					"email": "john@example.com",
				})
			},
			expectError: false,
			validate: func(req *http.Request) error {
				contentType := req.Header.Get("Content-Type")
				if !strings.Contains(contentType, "multipart/form-data") {
					return fmt.Errorf("expected multipart/form-data Content-Type, got %s", contentType)
				}

				if err := req.ParseMultipartForm(1024 * 1024); err != nil {
					return fmt.Errorf("failed to parse multipart form: %v", err)
				}

				if req.FormValue("name") != "John Doe" {
					return fmt.Errorf("expected name 'John Doe', got %s", req.FormValue("name"))
				}
				if req.FormValue("email") != "john@example.com" {
					return fmt.Errorf("expected email 'john@example.com', got %s", req.FormValue("email"))
				}

				return nil
			},
		},
		{
			name: "multipart form with file",
			setupFunc: func(b *HTTPBuilder) {
				fileContent := []byte("test file content")
				b.SetMethod("POST")
				b.SetPath("/v1/upload")
				b.SetMultipartForm(map[string]interface{}{
					"file": FormFile{
						Name:     "test.txt",
						Content:  fileContent,
						MimeType: "text/plain",
					},
					"description": "Test file",
				})
			},
			expectError: false,
			validate: func(req *http.Request) error {
				if err := req.ParseMultipartForm(1024 * 1024); err != nil {
					return fmt.Errorf("failed to parse multipart form: %v", err)
				}

				file, handler, err := req.FormFile("file")
				if err != nil {
					return fmt.Errorf("failed to get file from form: %v", err)
				}
				defer file.Close()

				if handler.Filename != "test.txt" {
					return fmt.Errorf("expected filename 'test.txt', got %s", handler.Filename)
				}

				content, err := io.ReadAll(file)
				if err != nil {
					return fmt.Errorf("failed to read file content: %v", err)
				}

				expectedContent := "test file content"
				if string(content) != expectedContent {
					return fmt.Errorf("expected file content %q, got %q", expectedContent, string(content))
				}

				if req.FormValue("description") != "Test file" {
					return fmt.Errorf("expected description 'Test file', got %s", req.FormValue("description"))
				}

				return nil
			},
		},
		{
			name: "invalid form data type",
			setupFunc: func(b *HTTPBuilder) {
				b.SetMethod("POST")
				b.SetPath("/v1/upload")
				b.SetMultipartForm(map[string]interface{}{
					"invalid": make(chan int), // Unmarshalable type
				})
			},
			expectError: true,
			errorMsg:    "failed to create multipart form",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			builder := NewHTTPBuilder("https://api.example.com")
			tt.setupFunc(builder)

			req, err := builder.BuildRequest()

			if tt.expectError {
				if err == nil {
					t.Fatal("Expected error but got none")
				}
				if tt.errorMsg != "" && !strings.Contains(strings.ToLower(err.Error()), strings.ToLower(tt.errorMsg)) {
					t.Fatalf("Expected error containing %q, got %q", tt.errorMsg, err.Error())
				}
			} else {
				if err != nil {
					t.Fatalf("Unexpected error: %v", err)
				}
				if req == nil {
					t.Fatal("Expected non-nil request")
				}
				if tt.validate != nil {
					if err := tt.validate(req); err != nil {
						t.Fatalf("Request validation failed: %v", err)
					}
				}
			}
		})
	}
}

func TestHTTPResponseHelper_ExtractData(t *testing.T) {
	tests := []struct {
		name        string
		response    *http.Response
		target      interface{}
		expectError bool
		errorMsg    string
		validate    func(interface{}) error
	}{
		{
			name: "successful JSON extraction",
			response: &http.Response{
				StatusCode: http.StatusOK,
				Body: io.NopCloser(strings.NewReader(`{
					"id": 123,
					"name": "John Doe",
					"email": "john@example.com"
				}`)),
				Header: make(http.Header),
			},
			target:      &map[string]interface{}{},
			expectError: false,
			validate: func(data interface{}) error {
				result, ok := data.(*map[string]interface{})
				if !ok {
					return fmt.Errorf("expected map[string]interface{}, got %T", data)
				}
				if (*result)["id"] != float64(123) {
					return fmt.Errorf("expected id 123, got %v", (*result)["id"])
				}
				if (*result)["name"] != "John Doe" {
					return fmt.Errorf("expected name 'John Doe', got %v", (*result)["name"])
				}
				return nil
			},
		},
		{
			name: "invalid JSON response",
			response: &http.Response{
				StatusCode: http.StatusOK,
				Body:       io.NopCloser(strings.NewReader(`{invalid json}`)),
				Header:     make(http.Header),
			},
			target:      &map[string]interface{}{},
			expectError: true,
			errorMsg:    "failed to decode JSON",
		},
		{
			name: "empty response body",
			response: &http.Response{
				StatusCode: http.StatusNoContent,
				Body:       io.NopCloser(strings.NewReader("")),
				Header:     make(http.Header),
			},
			target:      nil,
			expectError: false,
		},
		{
			name: "response with error status code",
			response: &http.Response{
				StatusCode: http.StatusBadRequest,
				Body: io.NopCloser(strings.NewReader(`{
					"error": {
						"message": "Bad request",
						"code": 400
					}
				}`)),
				Header: make(http.Header),
			},
			target:      &map[string]interface{}{},
			expectError: true,
			errorMsg:    "API error",
		},
		{
			name: "nil response body",
			response: &http.Response{
				StatusCode: http.StatusOK,
				Body:       nil,
				Header:     make(http.Header),
			},
			target:      &map[string]interface{}{},
			expectError: true,
			errorMsg:    "response body is nil",
		},
		{
			name: "large response body",
			response: &http.Response{
				StatusCode: http.StatusOK,
				Body: io.NopCloser(strings.NewReader(
					`{"data": "` + strings.Repeat("x", 1024*1024) + `"}`,
				)),
				Header: make(http.Header),
			},
			target:      &map[string]interface{}{},
			expectError: false,
			validate: func(data interface{}) error {
				result, ok := data.(*map[string]interface{})
				if !ok {
					return fmt.Errorf("expected map[string]interface{}, got %T", data)
				}
				dataStr, ok := (*result)["data"].(string)
				if !ok {
					return fmt.Errorf("expected string data, got %T", (*result)["data"])
				}
				if len(dataStr) != 1024*1024 {
					return fmt.Errorf("expected data length %d, got %d", 1024*1024, len(dataStr))
				}
				return nil
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ExtractResponseData(tt.response, tt.target)

			if tt.expectError {
				if err == nil {
					t.Fatal("Expected error but got none")
				}
				if tt.errorMsg != "" && !strings.Contains(strings.ToLower(err.Error()), strings.ToLower(tt.errorMsg)) {
					t.Fatalf("Expected error containing %q, got %q", tt.errorMsg, err.Error())
				}
			} else {
				if err != nil {
					t.Fatalf("Unexpected error: %v", err)
				}
				if tt.validate != nil && tt.target != nil {
					if err := tt.validate(tt.target); err != nil {
						t.Fatalf("Response validation failed: %v", err)
					}
				}
			}
		})
	}
}

func TestHTTPResponseHelper_IsSuccess(t *testing.T) {
	tests := []struct {
		name     string
		status   int
		expected bool
	}{
		{
			name:     "200 OK",
			status:   http.StatusOK,
			expected: true,
		},
		{
			name:     "201 Created",
			status:   http.StatusCreated,
			expected: true,
		},
		{
			name:     "204 No Content",
			status:   http.StatusNoContent,
			expected: true,
		},
		{
			name:     "400 Bad Request",
			status:   http.StatusBadRequest,
			expected: false,
		},
		{
			name:     "401 Unauthorized",
			status:   http.StatusUnauthorized,
			expected: false,
		},
		{
			name:     "404 Not Found",
			status:   http.StatusNotFound,
			expected: false,
		},
		{
			name:     "500 Internal Server Error",
			status:   http.StatusInternalServerError,
			expected: false,
		},
		{
			name:     "299 Custom Success",
			status:   299,
			expected: true,
		},
		{
			name:     "300 Multiple Choices",
			status:   http.StatusMultipleChoices,
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			response := &http.Response{
				StatusCode: tt.status,
				Header:     make(http.Header),
			}

			result := IsSuccessResponse(response)
			if result != tt.expected {
				t.Fatalf("Expected %v for status %d, got %v", tt.expected, tt.status, result)
			}
		})
	}
}

func TestHTTPResponseHelper_GetError(t *testing.T) {
	tests := []struct {
		name        string
		response    *http.Response
		expectError bool
		errorMsg    string
		validate    func(*APIError) error
	}{
		{
			name: "error response with proper format",
			response: &http.Response{
				StatusCode: http.StatusBadRequest,
				Body: io.NopCloser(strings.NewReader(`{
					"error": {
						"message": "Invalid request data",
						"code": 400,
						"details": {
							"field": "email",
							"reason": "invalid format"
						}
					}
				}`)),
				Header: make(http.Header),
			},
			expectError: true,
			errorMsg:    "Invalid request data",
			validate: func(apiErr *APIError) error {
				if apiErr.Code != 400 {
					return fmt.Errorf("expected error code 400, got %d", apiErr.Code)
				}
				if apiErr.Message != "Invalid request data" {
					return fmt.Errorf("expected message 'Invalid request data', got %s", apiErr.Message)
				}
				if apiErr.Details == nil {
					return fmt.Errorf("expected error details, got nil")
				}
				return nil
			},
		},
		{
			name: "error response without error object",
			response: &http.Response{
				StatusCode: http.StatusInternalServerError,
				Body: io.NopCloser(strings.NewReader(`{
					"message": "Internal server error"
				}`)),
				Header: make(http.Header),
			},
			expectError: true,
			errorMsg:    "server error",
		},
		{
			name: "non-error response",
			response: &http.Response{
				StatusCode: http.StatusOK,
				Body: io.NopCloser(strings.NewReader(`{
					"success": true,
					"data": "test"
				}`)),
				Header: make(http.Header),
			},
			expectError: false,
		},
		{
			name: "malformed JSON response",
			response: &http.Response{
				StatusCode: http.StatusBadRequest,
				Body:       io.NopCloser(strings.NewReader(`{invalid json`)),
				Header:     make(http.Header),
			},
			expectError: true,
			errorMsg:    "failed to decode error response",
		},
		{
			name: "empty error response",
			response: &http.Response{
				StatusCode: http.StatusBadRequest,
				Body:       io.NopCloser(strings.NewReader("")),
				Header:     make(http.Header),
			},
			expectError: true,
			errorMsg:    "bad request",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := GetResponseError(tt.response)

			if tt.expectError {
				if err == nil {
					t.Fatal("Expected error but got none")
				}
				if tt.errorMsg != "" && !strings.Contains(strings.ToLower(err.Error()), strings.ToLower(tt.errorMsg)) {
					t.Fatalf("Expected error containing %q, got %q", tt.errorMsg, err.Error())
				}

				if apiErr, ok := err.(*APIError); ok && tt.validate != nil {
					if err := tt.validate(apiErr); err != nil {
						t.Fatalf("API error validation failed: %v", err)
					}
				}
			} else {
				if err != nil {
					t.Fatalf("Unexpected error: %v", err)
				}
			}
		})
	}
}

func TestFormValidation(t *testing.T) {
	tests := []struct {
		name        string
		form        map[string]string
		expectError bool
		errorMsg    string
	}{
		{
			name: "valid form",
			form: map[string]string{
				"name":  "John Doe",
				"email": "john@example.com",
				"age":   "30",
			},
			expectError: false,
		},
		{
			name:        "empty form",
			form:        map[string]string{},
			expectError: false,
		},
		{
			name: "form with empty values",
			form: map[string]string{
				"name":  "",
				"email": "valid@example.com",
			},
			expectError: false,
		},
		{
			name: "form with special characters",
			form: map[string]string{
				"message": "Hello, world! How are you? #test",
				"emoji":   "👋😊",
			},
			expectError: false,
		},
		{
			name: "form with unicode characters",
			form: map[string]string{
				"name": "Jürgen Müller",
				"city": "München",
			},
			expectError: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Test form validation by encoding and decoding
			values := url.Values{}
			for k, v := range tt.form {
				values.Set(k, v)
			}

			encoded := values.Encode()
			decoded, err := url.ParseQuery(encoded)

			if err != nil {
				if !tt.expectError {
					t.Fatalf("Unexpected error parsing form: %v", err)
				}
				if tt.errorMsg != "" && !strings.Contains(strings.ToLower(err.Error()), strings.ToLower(tt.errorMsg)) {
					t.Fatalf("Expected error containing %q, got %q", tt.errorMsg, err.Error())
				}
			} else {
				if tt.expectError {
					t.Fatal("Expected error but got none")
				}

				// Validate all values are preserved
				for k, expectedValue := range tt.form {
					actualValue := decoded.Get(k)
					if actualValue != expectedValue {
						t.Fatalf("Expected form value %q for key %q, got %q", expectedValue, k, actualValue)
					}
				}
			}
		})
	}
}

func TestJSONValidation(t *testing.T) {
	tests := []struct {
		name        string
		data        interface{}
		expectError bool
		errorMsg    string
		validate    func([]byte) error
	}{
		{
			name: "valid simple object",
			data: map[string]interface{}{
				"name":  "John Doe",
				"age":   30,
				"email": "john@example.com",
			},
			expectError: false,
			validate: func(data []byte) error {
				var result map[string]interface{}
				if err := json.Unmarshal(data, &result); err != nil {
					return fmt.Errorf("failed to unmarshal: %v", err)
				}
				if result["name"] != "John Doe" {
					return fmt.Errorf("expected name 'John Doe', got %v", result["name"])
				}
				return nil
			},
		},
		{
			name: "valid nested object",
			data: map[string]interface{}{
				"user": map[string]interface{}{
					"id":   123,
					"name": "John Doe",
					"address": map[string]interface{}{
						"street": "123 Main St",
						"city":   "New York",
					},
				},
			},
			expectError: false,
		},
		{
			name: "valid array",
			data: []interface{}{
				"item1",
				"item2",
				"item3",
			},
			expectError: false,
		},
		{
			name: "valid mixed types",
			data: map[string]interface{}{
				"string":  "hello",
				"number":  42,
				"boolean": true,
				"null":    nil,
				"array":   []interface{}{1, 2, 3},
			},
			expectError: false,
		},
		{
			name: "invalid data type - function",
			data: map[string]interface{}{
				"valid":   "data",
				"invalid": func() string { return "test" },
			},
			expectError: true,
			errorMsg:    "unsupported type",
		},
		{
			name: "invalid data type - channel",
			data: map[string]interface{}{
				"valid":   "data",
				"invalid": make(chan int),
			},
			expectError: true,
			errorMsg:    "unsupported type",
		},
		{
			name: "circular reference",
			data: func() interface{} {
				m := make(map[string]interface{})
				m["self"] = m
				return m
			}(),
			expectError: true,
			errorMsg:    "circular reference",
		},
		{
			name: "large data",
			data: map[string]interface{}{
				"data": strings.Repeat("x", 10*1024*1024), // 10MB string
			},
			expectError: false,
			validate: func(data []byte) error {
				if len(data) < 10*1024*1024 {
					return fmt.Errorf("expected at least 10MB of data, got %d bytes", len(data))
				}
				return nil
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			jsonData, err := json.Marshal(tt.data)

			if tt.expectError {
				if err == nil {
					t.Fatal("Expected error but got none")
				}
				if tt.errorMsg != "" && !strings.Contains(strings.ToLower(err.Error()), strings.ToLower(tt.errorMsg)) {
					t.Fatalf("Expected error containing %q, got %q", tt.errorMsg, err.Error())
				}
			} else {
				if err != nil {
					t.Fatalf("Unexpected error: %v", err)
				}
				if tt.validate != nil {
					if err := tt.validate(jsonData); err != nil {
						t.Fatalf("JSON validation failed: %v", err)
					}
				}
			}
		})
	}
}

func TestURLBuilding(t *testing.T) {
	tests := []struct {
		name        string
		baseURL     string
		path        string
		params      map[string]string
		expected    string
		expectError bool
	}{
		{
			name:     "simple URL building",
			baseURL:  "https://api.example.com",
			path:     "/v1/users",
			params:   nil,
			expected: "https://api.example.com/v1/users",
		},
		{
			name:    "URL with query parameters",
			baseURL: "https://api.example.com",
			path:    "/v1/users",
			params: map[string]string{
				"page":  "1",
				"limit": "10",
			},
			expected: "https://api.example.com/v1/users?page=1&limit=10",
		},
		{
			name:    "URL with special characters in parameters",
			baseURL: "https://api.example.com",
			path:    "/v1/search",
			params: map[string]string{
				"q": "hello world & more",
			},
			expected: "https://api.example.com/v1/search?q=hello+world+%26+more",
		},
		{
			name:    "URL with array parameters",
			baseURL: "https://api.example.com",
			path:    "/v1/users",
			params: map[string]string{
				"tags":  "go,test,api",
				"sort":  "name",
				"order": "asc",
			},
			expected: "https://api.example.com/v1/users?tags=go%2Ctest%2Capi&sort=name&order=asc",
		},
		{
			name:    "URL with reserved characters",
			baseURL: "https://api.example.com",
			path:    "/v1/users",
			params: map[string]string{
				"filter": "name>=value",
			},
			expected: "https://api.example.com/v1/users?filter=name%3E%3Dvalue",
		},
		{
			name:     "URL with multiple slashes",
			baseURL:  "https://api.example.com/",
			path:     "/v1/users/",
			params:   nil,
			expected: "https://api.example.com/v1/users",
		},
		{
			name:        "invalid base URL",
			baseURL:     "://invalid",
			path:        "/v1/users",
			params:      nil,
			expectError: true,
		},
		{
			name:        "invalid path characters",
			baseURL:     "https://api.example.com",
			path:        "/v1/users\x00",
			params:      nil,
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			builder := NewHTTPBuilder(tt.baseURL)
			builder.SetPath(tt.path)

			for k, v := range tt.params {
				builder.AddQueryParam(k, v)
			}

			result, err := builder.BuildURL()

			if tt.expectError {
				if err == nil {
					t.Fatal("Expected error but got none")
				}
			} else {
				if err != nil {
					t.Fatalf("Unexpected error: %v", err)
				}
				if result != tt.expected {
					t.Fatalf("Expected URL %q, got %q", tt.expected, result)
				}
			}
		})
	}
}

func TestHeaderValidation(t *testing.T) {
	tests := []struct {
		name        string
		headers     map[string]string
		expectError bool
		errorMsg    string
		validate    func(http.Header) error
	}{
		{
			name: "valid headers",
			headers: map[string]string{
				"Authorization": "Bearer token123",
				"Content-Type":  "application/json",
				"X-API-Version": "v1",
				"User-Agent":    "MyApp/1.0",
				"Accept":        "application/json",
			},
			expectError: false,
			validate: func(headers http.Header) error {
				if headers.Get("Authorization") != "Bearer token123" {
					return fmt.Errorf("Authorization header not set correctly")
				}
				if headers.Get("Content-Type") != "application/json" {
					return fmt.Errorf("Content-Type header not set correctly")
				}
				return nil
			},
		},
		{
			name: "headers with spaces",
			headers: map[string]string{
				"X-Custom-Header": "value with spaces",
			},
			expectError: false,
		},
		{
			name: "headers with special characters",
			headers: map[string]string{
				"X-Unicode": "café résumé naïve",
				"X-Emoji":   "🎉 test",
			},
			expectError: false,
		},
		{
			name: "invalid header name - spaces",
			headers: map[string]string{
				"Invalid Header": "value",
			},
			expectError: true,
			errorMsg:    "invalid header name",
		},
		{
			name: "invalid header name - colon",
			headers: map[string]string{
				"Invalid:Header": "value",
			},
			expectError: true,
			errorMsg:    "invalid header name",
		},
		{
			name: "invalid header value - control characters",
			headers: map[string]string{
				"X-Test": string(rune(0)), // Null character
			},
			expectError: true,
			errorMsg:    "invalid header value",
		},
		{
			name:        "empty headers",
			headers:     map[string]string{},
			expectError: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			builder := NewHTTPBuilder("https://api.example.com")
			builder.SetMethod("GET")
			builder.SetPath("/test")

			for k, v := range tt.headers {
				builder.AddHeader(k, v)
			}

			req, err := builder.BuildRequest()

			if tt.expectError {
				if err == nil {
					t.Fatal("Expected error but got none")
				}
				if tt.errorMsg != "" && !strings.Contains(strings.ToLower(err.Error()), strings.ToLower(tt.errorMsg)) {
					t.Fatalf("Expected error containing %q, got %q", tt.errorMsg, err.Error())
				}
			} else {
				if err != nil {
					t.Fatalf("Unexpected error: %v", err)
				}
				if tt.validate != nil {
					if err := tt.validate(req.Header); err != nil {
						t.Fatalf("Header validation failed: %v", err)
					}
				}
			}
		})
	}
}

func TestFileHandling(t *testing.T) {
	tests := []struct {
		name        string
		file        FormFile
		expectError bool
		errorMsg    string
		validate    func(*multipart.FileHeader) error
	}{
		{
			name: "valid text file",
			file: FormFile{
				Name:     "test.txt",
				Content:  []byte("This is a test file"),
				MimeType: "text/plain",
			},
			expectError: false,
			validate: func(header *multipart.FileHeader) error {
				if header.Filename != "test.txt" {
					return fmt.Errorf("expected filename 'test.txt', got %s", header.Filename)
				}
				if header.Header.Get("Content-Type") != "text/plain" {
					return fmt.Errorf("expected Content-Type 'text/plain', got %s", header.Header.Get("Content-Type"))
				}
				return nil
			},
		},
		{
			name: "valid JSON file",
			file: FormFile{
				Name:     "data.json",
				Content:  []byte(`{"test": "data"}`),
				MimeType: "application/json",
			},
			expectError: false,
		},
		{
			name: "valid image file",
			file: FormFile{
				Name:     "image.png",
				Content:  []byte{0x89, 0x50, 0x4E, 0x47}, // PNG header
				MimeType: "image/png",
			},
			expectError: false,
		},
		{
			name: "empty filename",
			file: FormFile{
				Name:     "",
				Content:  []byte("test"),
				MimeType: "text/plain",
			},
			expectError: true,
			errorMsg:    "filename cannot be empty",
		},
		{
			name: "empty content",
			file: FormFile{
				Name:     "test.txt",
				Content:  []byte{},
				MimeType: "text/plain",
			},
			expectError: false, // Empty files are allowed
		},
		{
			name: "nil content",
			file: FormFile{
				Name:     "test.txt",
				Content:  nil,
				MimeType: "text/plain",
			},
			expectError: true,
			errorMsg:    "file content cannot be nil",
		},
		{
			name: "large file",
			file: FormFile{
				Name:     "large.txt",
				Content:  make([]byte, 100*1024*1024), // 100MB
				MimeType: "text/plain",
			},
			expectError: false, // Should handle large files
		},
		{
			name: "invalid MIME type",
			file: FormFile{
				Name:     "test.txt",
				Content:  []byte("test"),
				MimeType: "invalid/type with spaces",
			},
			expectError: true,
			errorMsg:    "invalid MIME type",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			builder := NewHTTPBuilder("https://api.example.com")
			builder.SetMethod("POST")
			builder.SetPath("/upload")
			builder.SetMultipartForm(map[string]interface{}{
				"file": tt.file,
			})

			req, err := builder.BuildRequest()

			if tt.expectError {
				if err == nil {
					t.Fatal("Expected error but got none")
				}
				if tt.errorMsg != "" && !strings.Contains(strings.ToLower(err.Error()), strings.ToLower(tt.errorMsg)) {
					t.Fatalf("Expected error containing %q, got %q", tt.errorMsg, err.Error())
				}
			} else {
				if err != nil {
					t.Fatalf("Unexpected error: %v", err)
				}

				// Validate the multipart form
				if err := req.ParseMultipartForm(1024 * 1024); err != nil {
					t.Fatalf("Failed to parse multipart form: %v", err)
				}

				file, header, err := req.FormFile("file")
				if err != nil {
					t.Fatalf("Failed to get file from form: %v", err)
				}
				defer file.Close()

				if tt.validate != nil {
					if err := tt.validate(header); err != nil {
						t.Fatalf("File validation failed: %v", err)
					}
				}
			}
		})
	}
}

func TestContextHandling(t *testing.T) {
	tests := []struct {
		name        string
		timeout     time.Duration
		expectError bool
		errorMsg    string
		validate    func(context.Context) error
	}{
		{
			name:        "context with timeout",
			timeout:     5 * time.Second,
			expectError: false,
			validate: func(ctx context.Context) error {
				deadline, ok := ctx.Deadline()
				if !ok {
					return fmt.Errorf("expected deadline in context")
				}
				expectedDeadline := time.Now().Add(5 * time.Second)
				if deadline.Before(expectedDeadline.Add(-1*time.Second)) || deadline.After(expectedDeadline.Add(1*time.Second)) {
					return fmt.Errorf("deadline not properly set")
				}
				return nil
			},
		},
		{
			name:        "context without timeout",
			timeout:     0,
			expectError: false,
			validate: func(ctx context.Context) error {
				_, ok := ctx.Deadline()
				if ok {
					return fmt.Errorf("expected no deadline in context")
				}
				return nil
			},
		},
		{
			name:        "very short timeout",
			timeout:     1 * time.Nanosecond,
			expectError: false,
			validate: func(ctx context.Context) error {
				deadline, ok := ctx.Deadline()
				if !ok {
					return fmt.Errorf("expected deadline in context")
				}
				expectedDeadline := time.Now().Add(1 * time.Nanosecond)
				if deadline.Before(expectedDeadline.Add(-1*time.Second)) || deadline.After(expectedDeadline.Add(1*time.Second)) {
					return fmt.Errorf("deadline not properly set")
				}
				return nil
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			builder := NewHTTPBuilder("https://api.example.com")
			builder.SetMethod("GET")
			builder.SetPath("/test")

			if tt.timeout > 0 {
				builder.SetTimeout(tt.timeout)
			}

			req, err := builder.BuildRequest()

			if tt.expectError {
				if err == nil {
					t.Fatal("Expected error but got none")
				}
				if tt.errorMsg != "" && !strings.Contains(strings.ToLower(err.Error()), strings.ToLower(tt.errorMsg)) {
					t.Fatalf("Expected error containing %q, got %q", tt.errorMsg, err.Error())
				}
			} else {
				if err != nil {
					t.Fatalf("Unexpected error: %v", err)
				}
				if tt.validate != nil {
					if err := tt.validate(req.Context()); err != nil {
						t.Fatalf("Context validation failed: %v", err)
					}
				}
			}
		})
	}
}

func TestHTTPUtils_EdgeCases(t *testing.T) {
	t.Run("empty string handling", func(t *testing.T) {
		builder := NewHTTPBuilder("https://api.example.com")
		builder.SetMethod("GET")
		builder.SetPath("")
		builder.AddQueryParam("", "")

		_, err := builder.BuildURL()
		if err == nil {
			t.Fatal("Expected error for empty path")
		}
	})

	t.Run("extremely long path", func(t *testing.T) {
		longPath := "/" + strings.Repeat("segment/", 1000)
		builder := NewHTTPBuilder("https://api.example.com")
		builder.SetMethod("GET")
		builder.SetPath(longPath)

		url, err := builder.BuildURL()
		if err != nil {
			t.Fatalf("Unexpected error for long path: %v", err)
		}
		if !strings.Contains(url, longPath) {
			t.Fatal("Long path not preserved in URL")
		}
	})

	t.Run("many query parameters", func(t *testing.T) {
		builder := NewHTTPBuilder("https://api.example.com")
		builder.SetMethod("GET")
		builder.SetPath("/test")

		// Add many query parameters
		for i := 0; i < 1000; i++ {
			builder.AddQueryParam(fmt.Sprintf("param%d", i), fmt.Sprintf("value%d", i))
		}

		url, err := builder.BuildURL()
		if err != nil {
			t.Fatalf("Unexpected error for many query parameters: %v", err)
		}

		// Check that some parameters are present
		if !strings.Contains(url, "param0=value0") {
			t.Fatal("First query parameter not found")
		}
		if !strings.Contains(url, "param999=value999") {
			t.Fatal("Last query parameter not found")
		}
	})

	t.Run("special characters in values", func(t *testing.T) {
		specialChars := "!@#$%^&*()_+-=[]{}|;':\",./<>?"
		builder := NewHTTPBuilder("https://api.example.com")
		builder.SetMethod("GET")
		builder.SetPath("/test")
		builder.AddQueryParam("special", specialChars)

		url, err := builder.BuildURL()
		if err != nil {
			t.Fatalf("Unexpected error for special characters: %v", err)
		}

		// Check that special characters are properly encoded
		if !strings.Contains(url, "special=") {
			t.Fatal("Special parameter not found")
		}
	})
}
