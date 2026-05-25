package sdln

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	neturl "net/url"
	"reflect"
	"strings"
	"time"
)

// HTTPRequest wraps http.Request for middleware compatibility
type HTTPRequest struct {
	*http.Request
}

// newHTTPRequest creates a new HTTPRequest wrapper
func newHTTPRequest(req *http.Request) *HTTPRequest {
	return &HTTPRequest{Request: req}
}

// Header returns a header value
func (r *HTTPRequest) Header(key string) string {
	return r.Request.Header.Get(key)
}

// SetHeader sets a header value
func (r *HTTPRequest) SetHeader(key, value string) {
	r.Request.Header.Set(key, value)
}

// Method returns the HTTP method
func (r *HTTPRequest) Method() string {
	return r.Request.Method
}

// URL returns the request URL
func (r *HTTPRequest) URL() string {
	return r.Request.URL.String()
}

// HTTPResponse wraps http.Response for middleware compatibility
type HTTPResponse struct {
	*http.Response
	body []byte
}

// newHTTPResponse creates a new HTTPResponse wrapper
func newHTTPResponse(resp *http.Response) *HTTPResponse {
	return &HTTPResponse{Response: resp}
}

// StatusCode returns the status code
func (r *HTTPResponse) StatusCode() int {
	return r.Response.StatusCode
}

// Header returns a header value
func (r *HTTPResponse) Header(key string) string {
	return r.Response.Header.Get(key)
}

// Headers returns all headers
func (r *HTTPResponse) Headers() map[string][]string {
	return r.Response.Header
}

// Body returns the response body
func (r *HTTPResponse) Body() []byte {
	if r.body == nil {
		if r.Response.Body != nil {
			defer r.Response.Body.Close()
			body, err := io.ReadAll(r.Response.Body)
			if err == nil {
				r.body = body
			}
		}
	}
	return r.body
}

// ========================================
// HTTP Builder Pattern
// ========================================

// RequestBuilder provides a fluent interface for building HTTP requests
type RequestBuilder struct {
	request *http.Request
	err     error
}

// NewRequestBuilder creates a new request builder
func NewRequestBuilder(method, url string) *RequestBuilder {
	req, err := http.NewRequest(method, url, nil)
	return &RequestBuilder{
		request: req,
		err:     err,
	}
}

// Method sets the HTTP method
func (b *RequestBuilder) Method(method string) *RequestBuilder {
	if b.err != nil {
		return b
	}
	b.request.Method = method
	return b
}

// URL sets the request URL
func (b *RequestBuilder) URL(url string) *RequestBuilder {
	if b.err != nil {
		return b
	}
	parsedURL, err := neturl.Parse(url)
	if err != nil {
		b.err = err
		return b
	}
	b.request.URL = parsedURL
	return b
}

// Header adds a header
func (b *RequestBuilder) Header(key, value string) *RequestBuilder {
	if b.err != nil {
		return b
	}
	b.request.Header.Add(key, value)
	return b
}

// Headers adds multiple headers
func (b *RequestBuilder) Headers(headers map[string]string) *RequestBuilder {
	if b.err != nil {
		return b
	}
	for key, value := range headers {
		b.request.Header.Add(key, value)
	}
	return b
}

// Body sets the request body
func (b *RequestBuilder) Body(body interface{}) *RequestBuilder {
	if b.err != nil {
		return b
	}
	switch v := body.(type) {
	case []byte:
		b.request.Body = io.NopCloser(bytes.NewReader(v))
	case string:
		b.request.Body = io.NopCloser(strings.NewReader(v))
	case io.Reader:
		b.request.Body = io.NopCloser(v)
	default:
		data, err := json.Marshal(body)
		if err != nil {
			b.err = err
			return b
		}
		b.request.Body = io.NopCloser(bytes.NewReader(data))
		b.request.Header.Set("Content-Type", "application/json")
	}
	return b
}

// JSONBody sets a JSON body
func (b *RequestBuilder) JSONBody(body interface{}) *RequestBuilder {
	return b.Header("Content-Type", "application/json").Body(body)
}

// Query adds a query parameter
func (b *RequestBuilder) Query(key, value string) *RequestBuilder {
	if b.err != nil {
		return b
	}
	if b.request.URL == nil {
		b.err = fmt.Errorf("URL not set")
		return b
	}
	q := b.request.URL.Query()
	q.Add(key, value)
	b.request.URL.RawQuery = q.Encode()
	return b
}

// QueryMap adds multiple query parameters
func (b *RequestBuilder) QueryMap(params map[string]string) *RequestBuilder {
	if b.err != nil {
		return b
	}
	if b.request.URL == nil {
		b.err = fmt.Errorf("URL not set")
		return b
	}
	q := b.request.URL.Query()
	for key, value := range params {
		q.Add(key, value)
	}
	b.request.URL.RawQuery = q.Encode()
	return b
}

// Build builds the HTTP request
func (b *RequestBuilder) Build() (*http.Request, error) {
	if b.err != nil {
		return nil, b.err
	}
	if b.request.Header.Get("User-Agent") == "" {
		b.request.Header.Set("User-Agent", "sdln-sdk-go/1.0.0")
	}
	return b.request, nil
}

// ========================================
// HTTP Utilities
// ========================================

// HTTPClient provides enhanced HTTP client functionality
type HTTPClient struct {
	client  *http.Client
	timeout time.Duration
}

// NewHTTPClient creates a new enhanced HTTP client
func NewHTTPClient(timeout time.Duration) *HTTPClient {
	return &HTTPClient{
		client: &http.Client{
			Timeout: timeout,
		},
		timeout: timeout,
	}
}

// Do executes an HTTP request
func (c *HTTPClient) Do(req *http.Request) (*http.Response, error) {
	return c.client.Do(req)
}

// Get executes a GET request
func (c *HTTPClient) Get(url string) (*http.Response, error) {
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}
	return c.Do(req)
}

// Post executes a POST request
func (c *HTTPClient) Post(url string, contentType string, body io.Reader) (*http.Response, error) {
	req, err := http.NewRequest("POST", url, body)
	if err != nil {
		return nil, err
	}
	if contentType != "" {
		req.Header.Set("Content-Type", contentType)
	}
	return c.Do(req)
}

// PostJSON executes a POST request with JSON body
func (c *HTTPClient) PostJSON(url string, body interface{}) (*http.Response, error) {
	data, err := json.Marshal(body)
	if err != nil {
		return nil, err
	}
	return c.Post(url, "application/json", bytes.NewReader(data))
}

// Put executes a PUT request
func (c *HTTPClient) Put(url string, contentType string, body io.Reader) (*http.Response, error) {
	req, err := http.NewRequest("PUT", url, body)
	if err != nil {
		return nil, err
	}
	if contentType != "" {
		req.Header.Set("Content-Type", contentType)
	}
	return c.Do(req)
}

// PutJSON executes a PUT request with JSON body
func (c *HTTPClient) PutJSON(url string, body interface{}) (*http.Response, error) {
	data, err := json.Marshal(body)
	if err != nil {
		return nil, err
	}
	return c.Put(url, "application/json", bytes.NewReader(data))
}

// Delete executes a DELETE request
func (c *HTTPClient) Delete(url string) (*http.Response, error) {
	req, err := http.NewRequest("DELETE", url, nil)
	if err != nil {
		return nil, err
	}
	return c.Do(req)
}

// Head executes a HEAD request
func (c *HTTPClient) Head(url string) (*http.Response, error) {
	req, err := http.NewRequest("HEAD", url, nil)
	if err != nil {
		return nil, err
	}
	return c.Do(req)
}

// ========================================
// Response Utilities
// ========================================

// ResponseHelper provides utilities for HTTP responses
type ResponseHelper struct {
	response *http.Response
}

// NewResponseHelper creates a new response helper
func NewResponseHelper(resp *http.Response) *ResponseHelper {
	return &ResponseHelper{response: resp}
}

// IsSuccess returns true if the response status code indicates success
func (r *ResponseHelper) IsSuccess() bool {
	return r.response.StatusCode >= 200 && r.response.StatusCode < 300
}

// IsClientError returns true if the response status code indicates a client error
func (r *ResponseHelper) IsClientError() bool {
	return r.response.StatusCode >= 400 && r.response.StatusCode < 500
}

// IsServerError returns true if the response status code indicates a server error
func (r *ResponseHelper) IsServerError() bool {
	return r.response.StatusCode >= 500
}

// IsError returns true if the response status code indicates any error
func (r *ResponseHelper) IsError() bool {
	return r.response.StatusCode >= 400
}

// ReadBody reads the response body
func (r *ResponseHelper) ReadBody() ([]byte, error) {
	if r.response.Body == nil {
		return nil, nil
	}
	defer r.response.Body.Close()
	return io.ReadAll(r.response.Body)
}

// ReadJSON reads and unmarshals JSON response body
func (r *ResponseHelper) ReadJSON(v interface{}) error {
	body, err := r.ReadBody()
	if err != nil {
		return err
	}
	return json.Unmarshal(body, v)
}

// GetContentType returns the content type header
func (r *ResponseHelper) GetContentType() string {
	return r.response.Header.Get("Content-Type")
}

// GetContentLength returns the content length header
func (r *ResponseHelper) GetContentLength() int64 {
	return r.response.ContentLength
}

// GetHeader returns a specific header value
func (r *ResponseHelper) GetHeader(key string) string {
	return r.response.Header.Get(key)
}

// GetHeaders returns all headers for a specific key
func (r *ResponseHelper) GetHeaders(key string) []string {
	return r.response.Header.Values(key)
}

// ========================================
// URL Utilities
// ========================================

// URLBuilder provides a fluent interface for building URLs
type URLBuilder struct {
	url  *neturl.URL
	err  error
	path []string
}

// NewURLBuilder creates a new URL builder
func NewURLBuilder(baseURL string) *URLBuilder {
	parsedURL, err := neturl.Parse(baseURL)
	return &URLBuilder{
		url:  parsedURL,
		err:  err,
		path: []string{},
	}
}

// Path adds a path segment
func (b *URLBuilder) Path(segment string) *URLBuilder {
	if b.err != nil {
		return b
	}
	b.path = append(b.path, strings.Trim(segment, "/"))
	return b
}

// Paths adds multiple path segments
func (b *URLBuilder) Paths(segments ...string) *URLBuilder {
	if b.err != nil {
		return b
	}
	for _, segment := range segments {
		b.Path(segment)
	}
	return b
}

// Fragment sets the URL fragment
func (b *URLBuilder) Fragment(fragment string) *URLBuilder {
	if b.err != nil {
		return b
	}
	b.url.Fragment = fragment
	return b
}

// Scheme sets the URL scheme
func (b *URLBuilder) Scheme(scheme string) *URLBuilder {
	if b.err != nil {
		return b
	}
	b.url.Scheme = scheme
	return b
}

// Host sets the URL host
func (b *URLBuilder) Host(host string) *URLBuilder {
	if b.err != nil {
		return b
	}
	b.url.Host = host
	return b
}

// Port sets the URL port
func (b *URLBuilder) Port(port int) *URLBuilder {
	if b.err != nil {
		return b
	}
	b.url.Host = fmt.Sprintf("%s:%d", strings.Split(b.url.Host, ":")[0], port)
	return b
}

// Query adds a query parameter
func (b *URLBuilder) Query(key, value string) *URLBuilder {
	if b.err != nil {
		return b
	}
	q := b.url.Query()
	q.Add(key, value)
	b.url.RawQuery = q.Encode()
	return b
}

// QueryMap adds multiple query parameters
func (b *URLBuilder) QueryMap(params map[string]string) *URLBuilder {
	if b.err != nil {
		return b
	}
	q := b.url.Query()
	for key, value := range params {
		q.Add(key, value)
	}
	b.url.RawQuery = q.Encode()
	return b
}

// Build builds the URL
func (b *URLBuilder) Build() (string, error) {
	if b.err != nil {
		return "", b.err
	}

	// Build the path
	if len(b.path) > 0 {
		b.url.Path = "/" + strings.Join(b.path, "/")
	}

	return b.url.String(), nil
}

// MustBuild builds the URL and panics on error
func (b *URLBuilder) MustBuild() string {
	url, err := b.Build()
	if err != nil {
		panic(err)
	}
	return url
}

// ========================================
// Form Utilities
// ========================================

// FormBuilder provides a fluent interface for building form data
type FormBuilder struct {
	values neturl.Values
}

// NewFormBuilder creates a new form builder
func NewFormBuilder() *FormBuilder {
	return &FormBuilder{
		values: make(neturl.Values),
	}
}

// Add adds a form field
func (b *FormBuilder) Add(key, value string) *FormBuilder {
	b.values.Add(key, value)
	return b
}

// Set sets a form field
func (b *FormBuilder) Set(key, value string) *FormBuilder {
	b.values.Set(key, value)
	return b
}

// AddMap adds multiple form fields
func (b *FormBuilder) AddMap(values map[string]string) *FormBuilder {
	for key, value := range values {
		b.Add(key, value)
	}
	return b
}

// AddArray adds form fields from an array
func (b *FormBuilder) AddArray(key string, values []string) *FormBuilder {
	for _, value := range values {
		b.Add(key, value)
	}
	return b
}

// Encode encodes the form data
func (b *FormBuilder) Encode() string {
	return b.values.Encode()
}

// Build builds the form data
func (b *FormBuilder) Build() neturl.Values {
	return b.values
}

// ========================================
// Multipart Form Utilities
// ========================================

// MultipartBuilder provides a fluent interface for building multipart forms
type MultipartBuilder struct {
	buffer *bytes.Buffer
	writer *multipartWriter
}

// multipartWriter wraps multipart.Writer with error handling
type multipartWriter struct {
	writer *multipart.Writer
	err    error
}

// NewMultipartBuilder creates a new multipart form builder
func NewMultipartBuilder() *MultipartBuilder {
	var buffer bytes.Buffer
	writer := multipart.NewWriter(&buffer)

	return &MultipartBuilder{
		buffer: &buffer,
		writer: &multipartWriter{writer: writer},
	}
}

// AddField adds a text field
func (b *MultipartBuilder) AddField(key, value string) *MultipartBuilder {
	if b.writer.err != nil {
		return b
	}
	b.writer.err = b.writer.writer.WriteField(key, value)
	return b
}

// AddFile adds a file field
func (b *MultipartBuilder) AddFile(key, filename string, data []byte, contentType string) *MultipartBuilder {
	if b.writer.err != nil {
		return b
	}

	part, err := b.writer.writer.CreateFormFile(key, filename)
	if err != nil {
		b.writer.err = err
		return b
	}

	_, err = part.Write(data)
	if err != nil {
		b.writer.err = err
	}

	return b
}

// AddReader adds a file field from a reader
func (b *MultipartBuilder) AddReader(key, filename string, reader io.Reader, contentType string) *MultipartBuilder {
	if b.writer.err != nil {
		return b
	}

	part, err := b.writer.writer.CreateFormFile(key, filename)
	if err != nil {
		b.writer.err = err
		return b
	}

	_, err = io.Copy(part, reader)
	if err != nil {
		b.writer.err = err
	}

	return b
}

// Build builds the multipart form
func (b *MultipartBuilder) Build() (io.Reader, string, error) {
	if b.writer.err != nil {
		return nil, "", b.writer.err
	}

	err := b.writer.writer.Close()
	if err != nil {
		return nil, "", err
	}

	contentType := b.writer.writer.FormDataContentType()
	return bytes.NewReader(b.buffer.Bytes()), contentType, nil
}

// ========================================
// HTTP Context Utilities
// ========================================

// ContextHelper provides utilities for HTTP contexts
type ContextHelper struct {
	ctx    context.Context
	Cancel context.CancelFunc // populated by WithTimeout/WithCancel; safe-noop nil check on call
}

// NewContextHelper creates a new context helper
func NewContextHelper(ctx context.Context) *ContextHelper {
	return &ContextHelper{ctx: ctx}
}

// WithTimeout adds timeout to context. The cancel func is returned via the
// helper's Cancel field so callers can release the timer; previous version
// silently dropped it (vet: context leak).
func (h *ContextHelper) WithTimeout(timeout time.Duration) *ContextHelper {
	ctx, cancel := context.WithTimeout(h.ctx, timeout)
	h.ctx = ctx
	h.Cancel = cancel
	return h
}

// WithCancel adds cancellation to context
func (h *ContextHelper) WithCancel() (context.CancelFunc, *ContextHelper) {
	ctx, cancel := context.WithCancel(h.ctx)
	return cancel, &ContextHelper{ctx: ctx}
}

// WithValue adds a value to context
func (h *ContextHelper) WithValue(key interface{}, value interface{}) *ContextHelper {
	ctx := context.WithValue(h.ctx, key, value)
	h.ctx = ctx
	return h
}

// Context returns the context
func (h *ContextHelper) Context() context.Context {
	return h.ctx
}

// ========================================
// Reflection Utilities
// ========================================

// StructHelper provides utilities for struct reflection
type StructHelper struct {
	value reflect.Value
}

// NewStructHelper creates a new struct helper
func NewStructHelper(obj interface{}) *StructHelper {
	return &StructHelper{
		value: reflect.ValueOf(obj),
	}
}

// ToMap converts a struct to a map
func (h *StructHelper) ToMap() map[string]interface{} {
	result := make(map[string]interface{})

	if h.value.Kind() == reflect.Ptr {
		h.value = h.value.Elem()
	}

	if h.value.Kind() != reflect.Struct {
		return result
	}

	typ := h.value.Type()
	for i := 0; i < h.value.NumField(); i++ {
		field := typ.Field(i)
		value := h.value.Field(i)

		// Skip unexported fields
		if field.PkgPath != "" {
			continue
		}

		// Get JSON tag or use field name
		tag := field.Tag.Get("json")
		name := field.Name
		if tag != "" && tag != "-" {
			parts := strings.Split(tag, ",")
			if parts[0] != "" {
				name = parts[0]
			}
		}

		// Handle different value types
		switch value.Kind() {
		case reflect.String:
			result[name] = value.String()
		case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64:
			result[name] = value.Int()
		case reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64:
			result[name] = value.Uint()
		case reflect.Float32, reflect.Float64:
			result[name] = value.Float()
		case reflect.Bool:
			result[name] = value.Bool()
		case reflect.Slice, reflect.Array:
			result[name] = h.convertSlice(value)
		case reflect.Map:
			result[name] = h.convertMap(value)
		case reflect.Struct:
			if value.Type() == reflect.TypeOf(time.Time{}) {
				result[name] = value.Interface()
			} else {
				result[name] = NewStructHelper(value.Interface()).ToMap()
			}
		case reflect.Ptr:
			if !value.IsNil() {
				result[name] = NewStructHelper(value.Interface()).ToMap()
			}
		default:
			result[name] = value.Interface()
		}
	}

	return result
}

// convertSlice converts a slice to a slice of interface{}
func (h *StructHelper) convertSlice(value reflect.Value) []interface{} {
	length := value.Len()
	result := make([]interface{}, length)

	for i := 0; i < length; i++ {
		elem := value.Index(i)
		switch elem.Kind() {
		case reflect.Struct:
			result[i] = NewStructHelper(elem.Interface()).ToMap()
		case reflect.Ptr:
			if !elem.IsNil() {
				result[i] = NewStructHelper(elem.Interface()).ToMap()
			}
		default:
			result[i] = elem.Interface()
		}
	}

	return result
}

// convertMap converts a map to a map of string keys and interface{} values
func (h *StructHelper) convertMap(value reflect.Value) map[string]interface{} {
	result := make(map[string]interface{})

	iter := value.MapRange()
	for iter.Next() {
		key := iter.Key()
		val := iter.Value()

		var keyStr string
		if key.Kind() == reflect.String {
			keyStr = key.String()
		} else {
			keyStr = fmt.Sprintf("%v", key.Interface())
		}

		switch val.Kind() {
		case reflect.Struct:
			result[keyStr] = NewStructHelper(val.Interface()).ToMap()
		case reflect.Ptr:
			if !val.IsNil() {
				result[keyStr] = NewStructHelper(val.Interface()).ToMap()
			}
		default:
			result[keyStr] = val.Interface()
		}
	}

	return result
}

// ========================================
// Validation Utilities
// ========================================

// ValidationHelper provides utilities for HTTP validation
type ValidationHelper struct {
	errors map[string]string
}

// NewValidationHelper creates a new validation helper
func NewValidationHelper() *ValidationHelper {
	return &ValidationHelper{
		errors: make(map[string]string),
	}
}

// Required validates that a field is not empty
func (h *ValidationHelper) Required(field, value string) *ValidationHelper {
	if strings.TrimSpace(value) == "" {
		h.errors[field] = "field is required"
	}
	return h
}

// MinLength validates minimum length
func (h *ValidationHelper) MinLength(field, value string, min int) *ValidationHelper {
	if len(value) < min {
		h.errors[field] = fmt.Sprintf("field must be at least %d characters", min)
	}
	return h
}

// MaxLength validates maximum length
func (h *ValidationHelper) MaxLength(field, value string, max int) *ValidationHelper {
	if len(value) > max {
		h.errors[field] = fmt.Sprintf("field must be at most %d characters", max)
	}
	return h
}

// Email validates email format
func (h *ValidationHelper) Email(field, value string) *ValidationHelper {
	if !strings.Contains(value, "@") {
		h.errors[field] = "field must be a valid email address"
	}
	return h
}

// URL validates URL format
func (h *ValidationHelper) URL(field, value string) *ValidationHelper {
	_, err := neturl.ParseRequestURI(value)
	if err != nil {
		h.errors[field] = "field must be a valid URL"
	}
	return h
}

// IsValid returns true if there are no validation errors
func (h *ValidationHelper) IsValid() bool {
	return len(h.errors) == 0
}

// GetErrors returns all validation errors
func (h *ValidationHelper) GetErrors() map[string]string {
	return h.errors
}

// Error returns the first validation error
func (h *ValidationHelper) Error() string {
	for _, err := range h.errors {
		return err
	}
	return ""
}
