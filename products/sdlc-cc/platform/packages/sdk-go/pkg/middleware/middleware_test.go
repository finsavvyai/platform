//go:build never
// +build never

package middleware

import (
	"bytes"
	"compress/gzip"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"
)

func TestLoggingMiddleware(t *testing.T) {
	tests := []struct {
		name           string
		method         string
		path           string
		body           string
		expectedStatus int
		validateLog    func(logEntry map[string]interface{}) error
	}{
		{
			name:           "GET request",
			method:         "GET",
			path:           "/api/v1/users",
			expectedStatus: http.StatusOK,
			validateLog: func(logEntry map[string]interface{}) error {
				if logEntry["method"] != "GET" {
					return fmt.Errorf("expected method 'GET', got %v", logEntry["method"])
				}
				if logEntry["path"] != "/api/v1/users" {
					return fmt.Errorf("expected path '/api/v1/users', got %v", logEntry["path"])
				}
				if logEntry["status_code"] != float64(200) {
					return fmt.Errorf("expected status 200, got %v", logEntry["status_code"])
				}
				return nil
			},
		},
		{
			name:           "POST request with body",
			method:         "POST",
			path:           "/api/v1/users",
			body:           `{"name": "John Doe", "email": "john@example.com"}`,
			expectedStatus: http.StatusCreated,
			validateLog: func(logEntry map[string]interface{}) error {
				if logEntry["method"] != "POST" {
					return fmt.Errorf("expected method 'POST', got %v", logEntry["method"])
				}
				if logEntry["content_length"] == nil {
					return fmt.Errorf("expected content_length to be logged")
				}
				return nil
			},
		},
		{
			name:           "request with headers",
			method:         "GET",
			path:           "/api/v1/users",
			expectedStatus: http.StatusOK,
			validateLog: func(logEntry map[string]interface{}) error {
				if logEntry["user_agent"] == nil {
					return fmt.Errorf("expected user_agent to be logged")
				}
				return nil
			},
		},
		{
			name:           "error response",
			method:         "GET",
			path:           "/api/v1/error",
			expectedStatus: http.StatusInternalServerError,
			validateLog: func(logEntry map[string]interface{}) error {
				if logEntry["status_code"] != float64(500) {
					return fmt.Errorf("expected status 500, got %v", logEntry["status_code"])
				}
				return nil
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var loggedEntry map[string]interface{}
			var logMutex sync.Mutex

			// Create a custom logger that captures log entries
			logger := &TestLogger{
				LogFunc: func(entry map[string]interface{}) {
					logMutex.Lock()
					defer logMutex.Unlock()
					loggedEntry = entry
				},
			}

			// Create test handler
			testHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(tt.expectedStatus)
				w.Write([]byte("response"))
			})

			// Apply logging middleware
			middleware := NewLoggingMiddleware(logger)
			handler := middleware(testHandler)

			// Create request
			var body io.Reader
			if tt.body != "" {
				body = strings.NewReader(tt.body)
			}
			req := httptest.NewRequest(tt.method, tt.path, body)
			req.Header.Set("User-Agent", "test-agent/1.0")

			// Create response recorder
			rr := httptest.NewRecorder()

			// Serve request
			handler.ServeHTTP(rr, req)

			// Validate response
			if rr.Code != tt.expectedStatus {
				t.Fatalf("Expected status %d, got %d", tt.expectedStatus, rr.Code)
			}

			// Validate log entry
			logMutex.Lock()
			defer logMutex.Unlock()

			if loggedEntry == nil {
				t.Fatal("Expected log entry to be created")
			}

			if tt.validateLog != nil {
				if err := tt.validateLog(loggedEntry); err != nil {
					t.Fatalf("Log validation failed: %v", err)
				}
			}
		})
	}
}

func TestMetricsMiddleware(t *testing.T) {
	tests := []struct {
		name           string
		method         string
		path           string
		responseTime   time.Duration
		expectedStatus int
		validateMetric func(metric map[string]interface{}) error
	}{
		{
			name:           "successful request",
			method:         "GET",
			path:           "/api/v1/users",
			responseTime:   100 * time.Millisecond,
			expectedStatus: http.StatusOK,
			validateMetric: func(metric map[string]interface{}) error {
				if metric["method"] != "GET" {
					return fmt.Errorf("expected method 'GET', got %v", metric["method"])
				}
				if metric["path"] != "/api/v1/users" {
					return fmt.Errorf("expected path '/api/v1/users', got %v", metric["path"])
				}
				if metric["status"] != float64(200) {
					return fmt.Errorf("expected status 200, got %v", metric["status"])
				}
				if metric["duration_ms"] == nil {
					return fmt.Errorf("expected duration_ms to be recorded")
				}
				return nil
			},
		},
		{
			name:           "slow request",
			method:         "POST",
			path:           "/api/v1/upload",
			responseTime:   500 * time.Millisecond,
			expectedStatus: http.StatusCreated,
			validateMetric: func(metric map[string]interface{}) error {
				duration, ok := metric["duration_ms"].(float64)
				if !ok {
					return fmt.Errorf("expected duration_ms to be a number")
				}
				if duration < 400 { // Should be at least 400ms
					return fmt.Errorf("expected duration >= 400ms, got %v", duration)
				}
				return nil
			},
		},
		{
			name:           "error request",
			method:         "GET",
			path:           "/api/v1/error",
			responseTime:   50 * time.Millisecond,
			expectedStatus: http.StatusInternalServerError,
			validateMetric: func(metric map[string]interface{}) error {
				if metric["status"] != float64(500) {
					return fmt.Errorf("expected status 500, got %v", metric["status"])
				}
				if metric["error"] != true {
					return fmt.Errorf("expected error flag to be true")
				}
				return nil
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var recordedMetric map[string]interface{}
			var metricMutex sync.Mutex

			// Create a custom metrics collector
			collector := &TestMetricsCollector{
				RecordFunc: func(metric map[string]interface{}) {
					metricMutex.Lock()
					defer metricMutex.Unlock()
					recordedMetric = metric
				},
			}

			// Create test handler that simulates response time
			testHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				time.Sleep(tt.responseTime)
				w.WriteHeader(tt.expectedStatus)
				w.Write([]byte("response"))
			})

			// Apply metrics middleware
			middleware := NewMetricsMiddleware(collector)
			handler := middleware(testHandler)

			// Create request
			req := httptest.NewRequest(tt.method, tt.path, nil)
			rr := httptest.NewRecorder()

			// Record start time
			start := time.Now()

			// Serve request
			handler.ServeHTTP(rr, req)

			// Validate response
			if rr.Code != tt.expectedStatus {
				t.Fatalf("Expected status %d, got %d", tt.expectedStatus, rr.Code)
			}

			// Wait a bit for async metric recording
			time.Sleep(10 * time.Millisecond)

			// Validate metric
			metricMutex.Lock()
			defer metricMutex.Unlock()

			if recordedMetric == nil {
				t.Fatal("Expected metric to be recorded")
			}

			if tt.validateMetric != nil {
				if err := tt.validateMetric(recordedMetric); err != nil {
					t.Fatalf("Metric validation failed: %v", err)
				}
			}
		})
	}
}

func TestSecurityMiddleware(t *testing.T) {
	tests := []struct {
		name            string
		headers         map[string]string
		expectedHeaders map[string]string
		shouldBlock     bool
	}{
		{
			name: "valid request gets security headers",
			headers: map[string]string{
				"User-Agent": "test-agent",
			},
			expectedHeaders: map[string]string{
				"X-Content-Type-Options":    "nosniff",
				"X-Frame-Options":           "DENY",
				"X-XSS-Protection":          "1; mode=block",
				"Strict-Transport-Security": "max-age=31536000; includeSubDomains",
				"Content-Security-Policy":   "default-src 'self'",
			},
			shouldBlock: false,
		},
		{
			name:            "request without User-Agent should be blocked",
			headers:         map[string]string{},
			expectedHeaders: nil,
			shouldBlock:     true,
		},
		{
			name: "request with suspicious User-Agent should be blocked",
			headers: map[string]string{
				"User-Agent": "bot/1.0",
			},
			expectedHeaders: nil,
			shouldBlock:     true,
		},
		{
			name: "request with valid custom User-Agent",
			headers: map[string]string{
				"User-Agent": "MyApp/1.0 (compatible; +https://example.com/bot)",
			},
			expectedHeaders: map[string]string{
				"X-Content-Type-Options": "nosniff",
				"X-Frame-Options":        "DENY",
			},
			shouldBlock: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create test handler
			testHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(http.StatusOK)
				w.Write([]byte("OK"))
			})

			// Apply security middleware
			config := &SecurityConfig{
				BlockNoUserAgent:  true,
				BlockSuspiciousUA: true,
			}
			middleware := NewSecurityMiddleware(config)
			handler := middleware(testHandler)

			// Create request
			req := httptest.NewRequest("GET", "/test", nil)
			for k, v := range tt.headers {
				req.Header.Set(k, v)
			}

			// Create response recorder
			rr := httptest.NewRecorder()

			// Serve request
			handler.ServeHTTP(rr, req)

			if tt.shouldBlock {
				if rr.Code != http.StatusForbidden {
					t.Fatalf("Expected status %d, got %d", http.StatusForbidden, rr.Code)
				}
			} else {
				if rr.Code != http.StatusOK {
					t.Fatalf("Expected status %d, got %d", http.StatusOK, rr.Code)
				}

				// Validate security headers
				for k, expected := range tt.expectedHeaders {
					actual := rr.Header().Get(k)
					if actual != expected {
						t.Fatalf("Expected header %s: %q, got %q", k, expected, actual)
					}
				}
			}
		})
	}
}

func TestRateLimitMiddleware(t *testing.T) {
	tests := []struct {
		name          string
		clientID      string
		requests      int
		window        time.Duration
		limit         int
		expectedBlock int // Number of requests that should be blocked
	}{
		{
			name:          "within rate limit",
			clientID:      "client1",
			requests:      5,
			window:        time.Second,
			limit:         10,
			expectedBlock: 0,
		},
		{
			name:          "exceeds rate limit",
			clientID:      "client2",
			requests:      15,
			window:        time.Second,
			limit:         10,
			expectedBlock: 5,
		},
		{
			name:          "multiple clients",
			clientID:      "client3",
			requests:      15,
			window:        time.Second,
			limit:         10,
			expectedBlock: 5,
		},
		{
			name:          "very low limit",
			clientID:      "client4",
			requests:      3,
			window:        time.Second,
			limit:         1,
			expectedBlock: 2,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create test handler
			testHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(http.StatusOK)
				w.Write([]byte("OK"))
			})

			// Apply rate limit middleware
			config := &RateLimitConfig{
				RequestsPerWindow: tt.limit,
				WindowDuration:    tt.window,
				ClientIDExtractor: func(r *http.Request) string {
					return tt.clientID
				},
			}
			middleware := NewRateLimitMiddleware(config)
			handler := middleware(testHandler)

			blockedCount := 0

			// Make multiple requests
			for i := 0; i < tt.requests; i++ {
				req := httptest.NewRequest("GET", "/test", nil)
				req.Header.Set("X-Client-ID", tt.clientID)
				rr := httptest.NewRecorder()

				handler.ServeHTTP(rr, req)

				if rr.Code == http.StatusTooManyRequests {
					blockedCount++
				} else if rr.Code != http.StatusOK {
					t.Fatalf("Unexpected status code: %d", rr.Code)
				}

				// Small delay between requests
				time.Sleep(1 * time.Millisecond)
			}

			if blockedCount != tt.expectedBlock {
				t.Fatalf("Expected %d blocked requests, got %d", tt.expectedBlock, blockedCount)
			}
		})
	}
}

func TestCompressionMiddleware(t *testing.T) {
	tests := []struct {
		name           string
		acceptEncoding string
		shouldCompress bool
	}{
		{
			name:           "client accepts gzip",
			acceptEncoding: "gzip, deflate",
			shouldCompress: true,
		},
		{
			name:           "client doesn't accept compression",
			acceptEncoding: "",
			shouldCompress: false,
		},
		{
			name:           "client accepts only deflate",
			acceptEncoding: "deflate",
			shouldCompress: false,
		},
		{
			name:           "client accepts multiple encodings",
			acceptEncoding: "identity, gzip, deflate",
			shouldCompress: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create test response
			responseBody := strings.Repeat("Hello, World! ", 100) // Large enough for compression

			// Create test handler
			testHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.Header().Set("Content-Type", "text/plain")
				w.WriteHeader(http.StatusOK)
				w.Write([]byte(responseBody))
			})

			// Apply compression middleware
			config := &CompressionConfig{
				MinLength: 100, // Minimum length to compress
			}
			middleware := NewCompressionMiddleware(config)
			handler := middleware(testHandler)

			// Create request
			req := httptest.NewRequest("GET", "/test", nil)
			if tt.acceptEncoding != "" {
				req.Header.Set("Accept-Encoding", tt.acceptEncoding)
			}

			// Create response recorder
			rr := httptest.NewRecorder()

			// Serve request
			handler.ServeHTTP(rr, req)

			// Validate response
			if rr.Code != http.StatusOK {
				t.Fatalf("Expected status %d, got %d", http.StatusOK, rr.Code)
			}

			if tt.shouldCompress {
				contentEncoding := rr.Header().Get("Content-Encoding")
				if contentEncoding != "gzip" {
					t.Fatalf("Expected Content-Encoding 'gzip', got %q", contentEncoding)
				}

				// Verify that content is actually gzipped
				reader, err := gzip.NewReader(bytes.NewReader(rr.Body.Bytes()))
				if err != nil {
					t.Fatalf("Failed to create gzip reader: %v", err)
				}
				defer reader.Close()

				decompressed, err := io.ReadAll(reader)
				if err != nil {
					t.Fatalf("Failed to read decompressed content: %v", err)
				}

				if string(decompressed) != responseBody {
					t.Fatal("Decompressed content doesn't match original")
				}
			} else {
				contentEncoding := rr.Header().Get("Content-Encoding")
				if contentEncoding == "gzip" {
					t.Fatal("Expected no compression, but got gzip encoding")
				}

				if rr.Body.String() != responseBody {
					t.Fatal("Response content doesn't match expected")
				}
			}
		})
	}
}

func TestCachingMiddleware(t *testing.T) {
	tests := []struct {
		name           string
		method         string
		path           string
		cacheable      bool
		maxAge         int
		expectCacheHit bool
	}{
		{
			name:      "cacheable GET request",
			method:    "GET",
			path:      "/api/v1/users/1",
			cacheable: true,
			maxAge:    300,
		},
		{
			name:      "non-cacheable POST request",
			method:    "POST",
			path:      "/api/v1/users",
			cacheable: false,
			maxAge:    0,
		},
		{
			name:      "cacheable request with short TTL",
			method:    "GET",
			path:      "/api/v1/status",
			cacheable: true,
			maxAge:    60,
		},
		{
			name:      "non-cacheable path",
			method:    "GET",
			path:      "/api/v1/search",
			cacheable: false,
			maxAge:    0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			requestCount := 0

			// Create test handler
			testHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				requestCount++
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusOK)
				w.Write([]byte(fmt.Sprintf(`{"request_count": %d}`, requestCount)))
			})

			// Apply caching middleware
			config := &CacheConfig{
				DefaultMaxAge:     tt.maxAge,
				CacheableMethods:  []string{"GET"},
				CacheablePaths:    []string{"/api/v1/users/", "/api/v1/status"},
				NonCacheablePaths: []string{"/api/v1/search"},
			}
			middleware := NewCachingMiddleware(config)
			handler := middleware(testHandler)

			// First request
			req1 := httptest.NewRequest(tt.method, tt.path, nil)
			rr1 := httptest.NewRecorder()
			handler.ServeHTTP(rr1, req1)

			if rr1.Code != http.StatusOK {
				t.Fatalf("First request: Expected status %d, got %d", http.StatusOK, rr1.Code)
			}

			// Check cache control headers
			if tt.cacheable {
				cacheControl := rr1.Header().Get("Cache-Control")
				if cacheControl == "" {
					t.Fatal("Expected Cache-Control header for cacheable response")
				}
				if !strings.Contains(cacheControl, "max-age") {
					t.Fatalf("Expected max-age in Cache-Control, got %q", cacheControl)
				}
			}

			// Second request (should hit cache if cacheable)
			req2 := httptest.NewRequest(tt.method, tt.path, nil)
			rr2 := httptest.NewRecorder()
			handler.ServeHTTP(rr2, req2)

			if rr2.Code != http.StatusOK {
				t.Fatalf("Second request: Expected status %d, got %d", http.StatusOK, rr2.Code)
			}

			// Check if cache was hit
			if tt.cacheable && requestCount == 1 {
				t.Log("Cache hit detected - request count didn't increase")
			} else if tt.cacheable && requestCount > 1 {
				t.Log("Cache miss detected - request count increased")
			}

			// Verify responses are the same
			if rr1.Body.String() != rr2.Body.String() {
				t.Fatal("Cached response differs from original response")
			}
		})
	}
}

func TestTimeoutMiddleware(t *testing.T) {
	tests := []struct {
		name          string
		timeout       time.Duration
		handlerDelay  time.Duration
		expectTimeout bool
	}{
		{
			name:          "request completes within timeout",
			timeout:       100 * time.Millisecond,
			handlerDelay:  50 * time.Millisecond,
			expectTimeout: false,
		},
		{
			name:          "request exceeds timeout",
			timeout:       50 * time.Millisecond,
			handlerDelay:  100 * time.Millisecond,
			expectTimeout: true,
		},
		{
			name:          "request completes exactly at timeout",
			timeout:       100 * time.Millisecond,
			handlerDelay:  100 * time.Millisecond,
			expectTimeout: false, // Should complete just in time
		},
		{
			name:          "very short timeout",
			timeout:       1 * time.Millisecond,
			handlerDelay:  10 * time.Millisecond,
			expectTimeout: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create test handler with delay
			testHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				time.Sleep(tt.handlerDelay)
				w.WriteHeader(http.StatusOK)
				w.Write([]byte("OK"))
			})

			// Apply timeout middleware
			middleware := NewTimeoutMiddleware(tt.timeout)
			handler := middleware(testHandler)

			// Create request
			req := httptest.NewRequest("GET", "/test", nil)
			rr := httptest.NewRecorder()

			// Serve request with timing
			start := time.Now()
			handler.ServeHTTP(rr, req)
			elapsed := time.Since(start)

			if tt.expectTimeout {
				if rr.Code != http.StatusGatewayTimeout {
					t.Fatalf("Expected status %d (timeout), got %d", http.StatusGatewayTimeout, rr.Code)
				}
				// Should complete roughly at timeout time
				if elapsed > tt.timeout+50*time.Millisecond {
					t.Fatalf("Timeout middleware took too long: %v > %v", elapsed, tt.timeout)
				}
			} else {
				if rr.Code != http.StatusOK {
					t.Fatalf("Expected status %d, got %d", http.StatusOK, rr.Code)
				}
				// Should complete roughly at handler delay time
				expectedDuration := tt.handlerDelay
				if elapsed < expectedDuration-10*time.Millisecond || elapsed > expectedDuration+50*time.Millisecond {
					t.Fatalf("Request duration unexpected: %v (expected ~%v)", elapsed, expectedDuration)
				}
			}
		})
	}
}

func TestCORSMiddleware(t *testing.T) {
	tests := []struct {
		name         string
		origin       string
		method       string
		headers      map[string]string
		expectedCORS map[string]string
		shouldBlock  bool
	}{
		{
			name:   "allowed origin",
			origin: "https://example.com",
			method: "GET",
			expectedCORS: map[string]string{
				"Access-Control-Allow-Origin":  "https://example.com",
				"Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
				"Access-Control-Allow-Headers": "Content-Type, Authorization",
			},
			shouldBlock: false,
		},
		{
			name:         "disallowed origin",
			origin:       "https://malicious.com",
			method:       "GET",
			expectedCORS: nil,
			shouldBlock:  false, // CORS doesn't block, just doesn't add headers
		},
		{
			name:   "preflight request",
			origin: "https://example.com",
			method: "OPTIONS",
			headers: map[string]string{
				"Access-Control-Request-Method":  "POST",
				"Access-Control-Request-Headers": "Content-Type",
			},
			expectedCORS: map[string]string{
				"Access-Control-Allow-Origin":  "https://example.com",
				"Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
				"Access-Control-Allow-Headers": "Content-Type, Authorization",
			},
			shouldBlock: false,
		},
		{
			name:         "no origin header",
			origin:       "",
			method:       "GET",
			expectedCORS: nil,
			shouldBlock:  false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create test handler
			testHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(http.StatusOK)
				w.Write([]byte("OK"))
			})

			// Apply CORS middleware
			config := &CORSConfig{
				AllowedOrigins: []string{"https://example.com", "https://api.example.com"},
				AllowedMethods: []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
				AllowedHeaders: []string{"Content-Type", "Authorization"},
				MaxAge:         86400,
			}
			middleware := NewCORSMiddleware(config)
			handler := middleware(testHandler)

			// Create request
			req := httptest.NewRequest(tt.method, "/test", nil)
			if tt.origin != "" {
				req.Header.Set("Origin", tt.origin)
			}
			for k, v := range tt.headers {
				req.Header.Set(k, v)
			}

			// Create response recorder
			rr := httptest.NewRecorder()

			// Serve request
			handler.ServeHTTP(rr, req)

			if tt.shouldBlock {
				if rr.Code != http.StatusForbidden {
					t.Fatalf("Expected status %d, got %d", http.StatusForbidden, rr.Code)
				}
			} else {
				expectedStatus := http.StatusOK
				if tt.method == "OPTIONS" {
					expectedStatus = http.StatusNoContent
				}
				if rr.Code != expectedStatus {
					t.Fatalf("Expected status %d, got %d", expectedStatus, rr.Code)
				}

				// Validate CORS headers
				for k, expected := range tt.expectedCORS {
					actual := rr.Header().Get(k)
					if actual != expected {
						t.Fatalf("Expected CORS header %s: %q, got %q", k, expected, actual)
					}
				}
			}
		})
	}
}

func TestMiddlewareChain(t *testing.T) {
	// Test that multiple middleware work together correctly
	t.Run("middleware chain", func(t *testing.T) {
		var logEntries []map[string]interface{}
		var metrics []map[string]interface{}
		var logMutex, metricsMutex sync.Mutex

		logger := &TestLogger{
			LogFunc: func(entry map[string]interface{}) {
				logMutex.Lock()
				defer logMutex.Unlock()
				logEntries = append(logEntries, entry)
			},
		}

		collector := &TestMetricsCollector{
			RecordFunc: func(metric map[string]interface{}) {
				metricsMutex.Lock()
				defer metricsMutex.Unlock()
				metrics = append(metrics, metric)
			},
		}

		// Create test handler
		testHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
			w.Write([]byte("Hello, World!"))
		})

		// Create middleware chain
		loggingMiddleware := NewLoggingMiddleware(logger)
		metricsMiddleware := NewMetricsMiddleware(collector)
		securityMiddleware := NewSecurityMiddleware(&SecurityConfig{})

		// Apply middleware in reverse order (last wraps first)
		handler := securityMiddleware(metricsMiddleware(loggingMiddleware(testHandler)))

		// Create request
		req := httptest.NewRequest("GET", "/test", nil)
		req.Header.Set("User-Agent", "test-agent")
		rr := httptest.NewRecorder()

		// Serve request
		handler.ServeHTTP(rr, req)

		// Validate response
		if rr.Code != http.StatusOK {
			t.Fatalf("Expected status %d, got %d", http.StatusOK, rr.Code)
		}

		// Check that all middleware ran
		logMutex.Lock()
		metricsMutex.Lock()
		defer logMutex.Unlock()
		defer metricsMutex.Unlock()

		if len(logEntries) == 0 {
			t.Fatal("Expected logging middleware to run")
		}

		if len(metrics) == 0 {
			t.Fatal("Expected metrics middleware to run")
		}

		// Validate security headers are present
		if rr.Header().Get("X-Content-Type-Options") == "" {
			t.Fatal("Expected security headers to be present")
		}
	})
}

func TestMiddlewareErrorHandling(t *testing.T) {
	t.Run("panic recovery in middleware", func(t *testing.T) {
		// Create test handler that panics
		testHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			panic("test panic")
		})

		// Apply logging middleware with panic recovery
		logger := &TestLogger{LogFunc: func(entry map[string]interface{}) {}}
		loggingMiddleware := NewLoggingMiddleware(logger)
		handler := loggingMiddleware(testHandler)

		// Create request
		req := httptest.NewRequest("GET", "/test", nil)
		rr := httptest.NewRecorder()

		// This should recover from panic and return 500
		handler.ServeHTTP(rr, req)

		if rr.Code != http.StatusInternalServerError {
			t.Fatalf("Expected status %d after panic, got %d", http.StatusInternalServerError, rr.Code)
		}
	})

	t.Run("middleware with nil next handler", func(t *testing.T) {
		// This tests robustness against nil handlers
		defer func() {
			if r := recover(); r == nil {
				t.Fatal("Expected panic for nil handler")
			}
		}()

		logger := &TestLogger{LogFunc: func(entry map[string]interface{}) {}}
		middleware := NewLoggingMiddleware(logger)

		// This should panic when trying to call nil handler
		middleware(nil)
	})
}

// Test utilities

type TestLogger struct {
	LogFunc func(map[string]interface{})
}

func (l *TestLogger) Info(msg string, fields map[string]interface{}) {
	if l.LogFunc != nil {
		entry := map[string]interface{}{
			"level":   "info",
			"message": msg,
		}
		for k, v := range fields {
			entry[k] = v
		}
		l.LogFunc(entry)
	}
}

func (l *TestLogger) Error(msg string, fields map[string]interface{}) {
	if l.LogFunc != nil {
		entry := map[string]interface{}{
			"level":   "error",
			"message": msg,
		}
		for k, v := range fields {
			entry[k] = v
		}
		l.LogFunc(entry)
	}
}

type TestMetricsCollector struct {
	RecordFunc func(map[string]interface{})
}

func (c *TestMetricsCollector) RecordHTTPMetric(method, path string, statusCode int, duration time.Duration, headers map[string]string) {
	if c.RecordFunc != nil {
		metric := map[string]interface{}{
			"method":      method,
			"path":        path,
			"status":      statusCode,
			"duration_ms": duration.Milliseconds(),
			"error":       statusCode >= 400,
		}
		for k, v := range headers {
			metric["header_"+strings.ToLower(k)] = v
		}
		c.RecordFunc(metric)
	}
}

func (c *TestMetricsCollector) RecordCustomMetric(name string, value float64, tags map[string]string) {
	if c.RecordFunc != nil {
		metric := map[string]interface{}{
			"name":  name,
			"value": value,
			"tags":  tags,
		}
		c.RecordFunc(metric)
	}
}

func TestMiddlewareConfiguration(t *testing.T) {
	t.Run("custom middleware configuration", func(t *testing.T) {
		// Test that custom configurations are properly applied
		config := &SecurityConfig{
			BlockNoUserAgent:  true,
			BlockSuspiciousUA: false,
			CustomHeaders: map[string]string{
				"X-Custom-Header": "custom-value",
			},
		}

		middleware := NewSecurityMiddleware(config)
		if middleware == nil {
			t.Fatal("Expected middleware to be created")
		}
	})

	t.Run("invalid middleware configuration", func(t *testing.T) {
		// Test that invalid configurations are handled gracefully
		config := &RateLimitConfig{
			RequestsPerWindow: -1, // Invalid
			WindowDuration:    time.Second,
		}

		// Should handle invalid config gracefully
		defer func() {
			if r := recover(); r != nil {
				t.Logf("Recovered from invalid config panic: %v", r)
			}
		}()

		middleware := NewRateLimitMiddleware(config)
		if middleware == nil {
			t.Log("Middleware creation failed for invalid config (expected)")
		}
	})
}

func TestConcurrentMiddleware(t *testing.T) {
	t.Run("concurrent requests", func(t *testing.T) {
		var requestCount int64
		var logEntries []map[string]interface{}
		var logMutex sync.Mutex

		logger := &TestLogger{
			LogFunc: func(entry map[string]interface{}) {
				logMutex.Lock()
				defer logMutex.Unlock()
				logEntries = append(logEntries, entry)
			},
		}

		// Create test handler
		testHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Simulate some work
			time.Sleep(10 * time.Millisecond)
			w.WriteHeader(http.StatusOK)
			w.Write([]byte("OK"))
		})

		// Apply middleware
		middleware := NewLoggingMiddleware(logger)
		handler := middleware(testHandler)

		// Make concurrent requests
		const numGoroutines = 50
		const numRequests = 10

		var wg sync.WaitGroup
		errors := make(chan error, numGoroutines*numRequests)

		for i := 0; i < numGoroutines; i++ {
			wg.Add(1)
			go func(id int) {
				defer wg.Done()

				for j := 0; j < numRequests; j++ {
					req := httptest.NewRequest("GET", fmt.Sprintf("/test?id=%d", id*numRequests+j), nil)
					rr := httptest.NewRecorder()

					handler.ServeHTTP(rr, req)

					if rr.Code != http.StatusOK {
						errors <- fmt.Errorf("goroutine %d, request %d: status %d", id, j, rr.Code)
						return
					}
				}
			}(i)
		}

		wg.Wait()
		close(errors)

		// Check for errors
		for err := range errors {
			t.Errorf("Concurrent request failed: %v", err)
		}

		// Verify all requests were logged
		logMutex.Lock()
		expectedLogCount := numGoroutines * numRequests
		if len(logEntries) != expectedLogCount {
			t.Fatalf("Expected %d log entries, got %d", expectedLogCount, len(logEntries))
		}
		logMutex.Unlock()
	})
}
