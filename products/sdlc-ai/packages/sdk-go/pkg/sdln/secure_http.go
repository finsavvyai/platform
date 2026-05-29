package sdln

import (
	"bytes"
	"crypto/tls"
	"crypto/x509"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"strings"
	"time"
)

// SecureHTTPClient provides a secure HTTP client configuration
type SecureHTTPClient struct {
	client     *http.Client
	timeout    time.Duration
	maxRetries int
	userAgent  string
}

// NewSecureHTTPClient creates a new secure HTTP client
func NewSecureHTTPClient() *SecureHTTPClient {
	// Create secure TLS configuration
	tlsConfig := &tls.Config{
		MinVersion:               tls.VersionTLS12,
		CurvePreferences:         []tls.CurveID{tls.X25519, tls.CurveP256},
		PreferServerCipherSuites: true,
		CipherSuites: []uint16{
			tls.TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384,
			tls.TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384,
			tls.TLS_ECDHE_ECDSA_WITH_CHACHA20_POLY1305,
			tls.TLS_ECDHE_RSA_WITH_CHACHA20_POLY1305,
			tls.TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256,
			tls.TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256,
		},
	}

	// Create HTTP client with security settings
	client := &http.Client{
		Transport: &http.Transport{
			TLSClientConfig: tlsConfig,
			DialContext: (&net.Dialer{
				Timeout:   10 * time.Second,
				KeepAlive: 30 * time.Second,
			}).DialContext,
			MaxIdleConns:          100,
			MaxIdleConnsPerHost:   10,
			IdleConnTimeout:       90 * time.Second,
			TLSHandshakeTimeout:   10 * time.Second,
			ExpectContinueTimeout: 1 * time.Second,
		},
		Timeout: 30 * time.Second,
	}

	return &SecureHTTPClient{
		client:     client,
		timeout:    30 * time.Second,
		maxRetries: 3,
		userAgent:  "SDLC-SDK-Go/1.0",
	}
}

// WithTimeout sets the request timeout
func (s *SecureHTTPClient) WithTimeout(timeout time.Duration) *SecureHTTPClient {
	s.timeout = timeout
	s.client.Timeout = timeout
	return s
}

// WithMaxRetries sets the maximum number of retries
func (s *SecureHTTPClient) WithMaxRetries(maxRetries int) *SecureHTTPClient {
	s.maxRetries = maxRetries
	return s
}

// WithUserAgent sets the user agent
func (s *SecureHTTPClient) WithUserAgent(userAgent string) *SecureHTTPClient {
	s.userAgent = userAgent
	return s
}

// WithCustomCA adds a custom certificate authority
func (s *SecureHTTPClient) WithCustomCA(caCert []byte) (*SecureHTTPClient, error) {
	caCertPool := x509.NewCertPool()
	if !caCertPool.AppendCertsFromPEM(caCert) {
		return nil, fmt.Errorf("failed to append CA certificate")
	}

	if transport, ok := s.client.Transport.(*http.Transport); ok {
		if transport.TLSClientConfig == nil {
			transport.TLSClientConfig = &tls.Config{}
		}
		transport.TLSClientConfig.RootCAs = caCertPool
	}

	return s, nil
}

// GetClient returns the underlying HTTP client
func (s *SecureHTTPClient) GetClient() *http.Client {
	return s.client
}

// NewSecureRequest creates a secure HTTP request
func (s *SecureHTTPClient) NewSecureRequest(method, url string, body []byte) (*http.Request, error) {
	req, err := http.NewRequest(method, url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	// Set secure headers
	req.Header.Set("User-Agent", s.userAgent)
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Accept-Encoding", "gzip, deflate")
	req.Header.Set("Connection", "keep-alive")
	req.Header.Set("Cache-Control", "no-cache")
	req.Header.Set("Pragma", "no-cache")

	// Add security headers
	req.Header.Set("X-Content-Type-Options", "nosniff")
	req.Header.Set("X-Frame-Options", "DENY")
	req.Header.Set("X-XSS-Protection", "1; mode=block")
	req.Header.Set("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
	req.Header.Set("Content-Security-Policy", "default-src 'self'")

	// Set body if provided
	if len(body) > 0 {
		req.Body = io.NopCloser(bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		req.ContentLength = int64(len(body))
	}

	return req, nil
}

// ValidateURL validates that a URL is secure
func ValidateURL(url string) error {
	parsedURL, err := url.Parse(url)
	if err != nil {
		return fmt.Errorf("invalid URL: %w", err)
	}

	// Only allow HTTPS (except for localhost)
	if parsedURL.Scheme != "https" &&
		parsedURL.Host != "localhost" &&
		parsedURL.Host != "127.0.0.1" &&
		!strings.HasPrefix(parsedURL.Host, "192.168.") &&
		!strings.HasPrefix(parsedURL.Host, "10.") {
		return fmt.Errorf("insecure URL scheme: %s (must use HTTPS)", parsedURL.Scheme)
	}

	// Check for suspicious patterns in URL
	suspiciousPatterns := []string{
		"..",
		"file://",
		"ftp://",
		"javascript:",
		"data:",
		"vbscript:",
	}

	lowerURL := strings.ToLower(url)
	for _, pattern := range suspiciousPatterns {
		if strings.Contains(lowerURL, pattern) {
			return fmt.Errorf("suspicious URL pattern detected: %s", pattern)
		}
	}

	return nil
}

// SecureDo performs a secure HTTP request with validation
func (s *SecureHTTPClient) SecureDo(req *http.Request) (*http.Response, error) {
	// Validate URL
	if err := ValidateURL(req.URL.String()); err != nil {
		return nil, fmt.Errorf("URL validation failed: %w", err)
	}

	// Add timestamp for security auditing
	req.Header.Set("X-Request-Time", time.Now().UTC().Format(time.RFC3339))

	// Perform request with retries
	var resp *http.Response
	var err error

	for attempt := 0; attempt <= s.maxRetries; attempt++ {
		if attempt > 0 {
			// Exponential backoff
			backoff := time.Duration(1<<uint(attempt-1)) * time.Second
			if backoff > 30*time.Second {
				backoff = 30 * time.Second
			}
			time.Sleep(backoff)
		}

		resp, err = s.client.Do(req)
		if err == nil {
			break
		}

		// Check if error is retryable
		if !isRetryableError(err) {
			break
		}
	}

	if err != nil {
		return nil, fmt.Errorf("request failed after %d attempts: %w", s.maxRetries+1, err)
	}

	// Validate response
	if err := s.validateResponse(resp); err != nil {
		resp.Body.Close()
		return nil, fmt.Errorf("response validation failed: %w", err)
	}

	return resp, nil
}

// isRetryableError checks if an error is retryable
func isRetryableError(err error) bool {
	if netErr, ok := err.(net.Error); ok {
		// Retry on timeout and temporary errors
		if netErr.Timeout() || netErr.Temporary() {
			return true
		}
	}

	// Check for specific retryable error messages
	retryableMessages := []string{
		"connection refused",
		"connection reset",
		"temporary failure",
		"service unavailable",
		"timeout",
	}

	errMsg := strings.ToLower(err.Error())
	for _, msg := range retryableMessages {
		if strings.Contains(errMsg, msg) {
			return true
		}
	}

	return false
}

// validateResponse validates HTTP response for security issues
func (s *SecureHTTPClient) validateResponse(resp *http.Response) error {
	// Check for security headers
	securityHeaders := map[string]string{
		"X-Content-Type-Options": "nosniff",
		"X-Frame-Options":        "DENY",
		"X-XSS-Protection":       "1; mode=block",
	}

	for header, expectedValue := range securityHeaders {
		if value := resp.Header.Get(header); value != expectedValue {
			// Log warning but don't fail the request
			log.Printf("Warning: Missing or incorrect security header %s: got %s, expected %s",
				header, value, expectedValue)
		}
	}

	// Check content type
	contentType := resp.Header.Get("Content-Type")
	if contentType != "" && !strings.Contains(contentType, "application/json") &&
		!strings.Contains(contentType, "text/plain") &&
		!strings.Contains(contentType, "application/octet-stream") {
		log.Printf("Warning: Unexpected content type: %s", contentType)
	}

	return nil
}

// GetSecureClient returns a pre-configured secure HTTP client for Cloudflare
func GetSecureClient() *http.Client {
	secureClient := NewSecureHTTPClient()
	return secureClient.GetClient()
}
