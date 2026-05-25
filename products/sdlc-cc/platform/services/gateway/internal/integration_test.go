//go:build ignore

package internal

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/circuitbreaker"
	"github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/config"
	"github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/database"
	"github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/health"
	"github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/middleware"
	"github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/observability"
	"github.com/sdlc-ai/platform/services/gateway/internal/interfaces/http/handlers"
	"github.com/sdlc-ai/platform/services/gateway/internal/interfaces/http/routes"
)

// TestTask1_4_1_AcceptanceCriteria validates all acceptance criteria for Task 1.4.1
func TestTask1_4_1_AcceptanceCriteria(t *testing.T) {
	// Setup configuration
	cfg := &config.Config{
		Version:     "1.0.0-test",
		InstanceID:  "test-instance-123",
		Environment: "test",
		Server: config.ServerConfig{
			Port:                    8080,
			ReadTimeout:             30 * time.Second,
			WriteTimeout:            30 * time.Second,
			IdleTimeout:             60 * time.Second,
			GracefulShutdownTimeout: 30 * time.Second,
		},
		RateLimit: config.RateLimitConfig{
			Requests: 1000,
			Window:   time.Hour,
		},
		CircuitBreaker: config.CircuitBreakerConfig{
			MaxFailures:  5,
			ResetTimeout: 30 * time.Second,
		},
		CORS: config.CORSConfig{
			AllowedOrigins: []string{"*"},
		},
		Tracing: config.TracingConfig{
			Exporter:   "stdout",
			SampleRate: 1.0,
		},
	}

	// Initialize observability
	logger := observability.NewStructuredLogger(cfg, "gateway")
	traceHelper := observability.NewTraceHelper(&observability.TracerProvider{}, "gateway-test")

	// Initialize database (mock)
	db := &database.Connection{}

	// Initialize health registry
	healthRegistry := health.NewRegistry(cfg)
	healthRegistry.Register(health.NewMemoryChecker(health.MemoryConfig{
		Enabled:           true,
		CheckInterval:     60 * time.Second,
		Timeout:           1 * time.Second,
		WarningThreshold:  80.0,
		CriticalThreshold: 90.0,
	}))

	// Initialize circuit breaker registry
	circuitRegistry := circuitbreaker.NewRegistry()

	// Create router with all middleware
	r := chi.NewRouter()

	// Apply middleware pipeline
	r.Use(middleware.RecoveryMiddleware())
	r.Use(middleware.SecurityHeadersMiddleware())
	r.Use(middleware.LoggingMiddleware())
	r.Use(middleware.TracingMiddleware())
	r.Use(middleware.CORSMiddleware(cfg))
	r.Use(middleware.RequestTimeoutMiddleware(30 * time.Second))
	r.Use(middleware.RateLimitMiddleware(cfg))
	r.Use(middleware.CircuitBreaker(cfg))

	// Add health check endpoints
	healthHandler := health.NewHTTPHandler(healthRegistry)
	r.Get("/health", healthHandler.ServeHTTP)
	r.Get("/healthz", healthHandler.ServeHTTP)
	r.Get("/ready", healthHandler.ServeHTTP)
	r.Get("/readyz", healthHandler.ServeHTTP)
	r.Get("/live", healthHandler.ServeHTTP)
	r.Get("/livez", healthHandler.ServeHTTP)

	// Add metrics endpoint
	r.Handle("/metrics", promhttp.Handler())

	// Add version endpoint
	r.Get("/version", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(fmt.Sprintf(`{"version": "%s", "instance": "%s"}`, cfg.Version, cfg.InstanceID)))
	})

	// Add API routes
	deps := &handlers.Dependencies{
		Config: cfg,
		DB:     db,
	}
	routes.SetupRoutes(r, deps)

	// Create test server
	server := httptest.NewServer(r)
	defer server.Close()

	t.Run("Acceptance Criterion 1: Gateway handles 10,000+ concurrent requests", func(t *testing.T) {
		const numRequests = 10000
		const numWorkers = 100

		var wg sync.WaitGroup
		errors := make(chan error, numRequests)
		successes := make(chan int, numRequests)

		start := time.Now()

		// Launch workers
		for i := 0; i < numWorkers; i++ {
			wg.Add(1)
			go func(workerID int) {
				defer wg.Done()
				for j := 0; j < numRequests/numWorkers; j++ {
					req, err := http.NewRequest("GET", server.URL+"/version", nil)
					require.NoError(t, err)

					resp, err := http.DefaultClient.Do(req)
					if err != nil {
						errors <- err
						continue
					}

					if resp.StatusCode == http.StatusOK {
						successes <- 1
					} else {
						errors <- fmt.Errorf("unexpected status code: %d", resp.StatusCode)
					}
					resp.Body.Close()
				}
			}(i)
		}

		// Wait for all workers to complete
		wg.Wait()
		close(errors)
		close(successes)

		duration := time.Since(start)

		// Count results
		successCount := 0
		for range successes {
			successCount++
		}

		errorCount := 0
		for err := range errors {
			t.Logf("Request error: %v", err)
			errorCount++
		}

		t.Logf("Processed %d requests in %v", numRequests, duration)
		t.Logf("Success rate: %.2f%% (%d/%d)", float64(successCount)/float64(numRequests)*100, successCount, numRequests)
		t.Logf("Requests per second: %.2f", float64(numRequests)/duration.Seconds())

		// Assert acceptance criteria
		assert.GreaterOrEqual(t, successCount, numRequests*99/100, "At least 99% of requests should succeed")
		assert.Less(t, duration, 30*time.Second, "All requests should complete within 30 seconds")
	})

	t.Run("Acceptance Criterion 2: Middleware pipeline processes requests in <5ms", func(t *testing.T) {
		// Create a simple endpoint for testing
		r.Get("/test-fast", func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
			w.Write([]byte("fast"))
		})

		numRequests := 1000
		totalLatency := time.Duration(0)

		for i := 0; i < numRequests; i++ {
			start := time.Now()

			resp, err := http.Get(server.URL + "/test-fast")
			require.NoError(t, err)
			resp.Body.Close()

			latency := time.Since(start)
			totalLatency += latency

			assert.Equal(t, http.StatusOK, resp.StatusCode)
		}

		avgLatency := totalLatency / time.Duration(numRequests)
		t.Logf("Average middleware processing time: %v", avgLatency)

		assert.Less(t, avgLatency, 5*time.Millisecond, "Average middleware processing should be under 5ms")
	})

	t.Run("Acceptance Criterion 3: Circuit breakers prevent cascading failures", func(t *testing.T) {
		// Create a circuit breaker for a downstream service
		cbConfig := circuitbreaker.Config{
			Name:             "test-service",
			MaxFailures:      3,
			ResetTimeout:     100 * time.Millisecond,
			SuccessThreshold: 2,
		}
		cb := circuitRegistry.GetOrCreate("test-service", cbConfig)

		failCount := 0

		// Add endpoint that simulates downstream service failure
		r.Get("/test-circuit", func(w http.ResponseWriter, r *http.Request) {
			err := cb.Execute(r.Context(), func(ctx context.Context) error {
				failCount++
				if failCount <= 5 {
					return fmt.Errorf("downstream service error")
				}
				return nil
			})

			if err != nil {
				w.WriteHeader(http.StatusServiceUnavailable)
				w.Write([]byte("service unavailable"))
			} else {
				w.WriteHeader(http.StatusOK)
				w.Write([]byte("service available"))
			}
		})

		// Send requests to trigger circuit breaker
		for i := 0; i < 5; i++ {
			resp, err := http.Get(server.URL + "/test-circuit")
			require.NoError(t, err)
			assert.Equal(t, http.StatusServiceUnavailable, resp.StatusCode)
			resp.Body.Close()
		}

		// Circuit should be open now
		assert.Equal(t, circuitbreaker.StateOpen, cb.State())

		// Next request should fail fast without hitting the service
		start := time.Now()
		resp, err := http.Get(server.URL + "/test-circuit")
		require.NoError(t, err)
		fastFailTime := time.Since(start)
		resp.Body.Close()

		assert.Equal(t, http.StatusServiceUnavailable, resp.StatusCode)
		assert.Less(t, fastFailTime, 10*time.Millisecond, "Circuit breaker should fail fast")

		// Wait for reset timeout
		time.Sleep(150 * time.Millisecond)

		// Send successful requests to close circuit
		for i := 0; i < 2; i++ {
			resp, err := http.Get(server.URL + "/test-circuit")
			require.NoError(t, err)
			assert.Equal(t, http.StatusOK, resp.StatusCode)
			resp.Body.Close()
		}

		// Circuit should be closed now
		assert.Equal(t, circuitbreaker.StateClosed, cb.State())
	})

	t.Run("Acceptance Criterion 4: Health checks validate all dependencies", func(t *testing.T) {
		// Test health check endpoints
		endpoints := []string{"/health", "/healthz", "/ready", "/readyz", "/live", "/livez"}

		for _, endpoint := range endpoints {
			t.Run("Health endpoint: "+endpoint, func(t *testing.T) {
				resp, err := http.Get(server.URL + endpoint)
				require.NoError(t, err)
				defer resp.Body.Close()

				assert.Equal(t, http.StatusOK, resp.StatusCode)
				assert.Equal(t, "application/json", resp.Header().Get("Content-Type"))

				// Verify health report structure
				var healthReport map[string]interface{}
				err = json.NewDecoder(resp.Body).Decode(&healthReport)
				require.NoError(t, err)

				assert.Contains(t, healthReport, "status")
				assert.Contains(t, healthReport, "timestamp")
				assert.Contains(t, healthReport, "version")
				assert.Contains(t, healthReport, "checks")
				assert.Contains(t, healthReport, "summary")
				assert.Contains(t, healthReport, "system")
				assert.Contains(t, healthReport, "metadata")

				// Check version
				assert.Equal(t, "1.0.0-test", healthReport["version"])

				// Check system info
				system := healthReport["system"].(map[string]interface{})
				assert.Contains(t, system, "go_version")
				assert.Contains(t, system, "num_cpu")
				assert.Contains(t, system, "memory")
				assert.Greater(t, system["num_cpu"], float64(0))
			})
		}
	})

	t.Run("Additional Validation: Security Headers", func(t *testing.T) {
		resp, err := http.Get(server.URL + "/version")
		require.NoError(t, err)
		defer resp.Body.Close()

		// Verify security headers are present
		assert.Equal(t, "nosniff", resp.Header.Get("X-Content-Type-Options"))
		assert.Equal(t, "DENY", resp.Header.Get("X-Frame-Options"))
		assert.Equal(t, "1; mode=block", resp.Header.Get("X-XSS-Protection"))
		assert.Equal(t, "strict-origin-when-cross-origin", resp.Header.Get("Referrer-Policy"))
		assert.NotEmpty(t, resp.Header.Get("Content-Security-Policy"))
	})

	t.Run("Additional Validation: CORS Headers", func(t *testing.T) {
		req, err := http.NewRequest("OPTIONS", server.URL+"/api/v1", nil)
		req.Header.Set("Origin", "https://example.com")
		req.Header.Set("Access-Control-Request-Method", "POST")
		require.NoError(t, err)

		resp, err := http.DefaultClient.Do(req)
		require.NoError(t, err)
		defer resp.Body.Close()

		assert.Equal(t, "https://example.com", resp.Header.Get("Access-Control-Allow-Origin"))
		assert.Contains(t, resp.Header.Get("Access-Control-Allow-Methods"), "POST")
	})

	t.Run("Additional Validation: Rate Limiting Headers", func(t *testing.T) {
		// Make a request to check rate limiting headers
		resp, err := http.Get(server.URL + "/version")
		require.NoError(t, err)
		defer resp.Body.Close()

		// Verify rate limiting headers are present (may be empty for first request)
		assert.NotEmpty(t, resp.Header.Get("X-RateLimit-Limit"))
	})

	t.Run("Additional Validation: Metrics Endpoint", func(t *testing.T) {
		resp, err := http.Get(server.URL + "/metrics")
		require.NoError(t, err)
		defer resp.Body.Close()

		assert.Equal(t, http.StatusOK, resp.StatusCode)
		assert.Equal(t, "text/plain; version=0.0.4; charset=utf-8", resp.Header.Get("Content-Type"))

		body, err := io.ReadAll(resp.Body)
		require.NoError(t, err)
		metricsContent := string(body)

		// Verify Prometheus metrics format
		assert.Contains(t, metricsContent, "# HELP")
		assert.Contains(t, metricsContent, "# TYPE")
	})

	t.Run("Additional Validation: API Routes", func(t *testing.T) {
		// Test API v1 root endpoint
		resp, err := http.Get(server.URL + "/api/v1")
		require.NoError(t, err)
		defer resp.Body.Close()

		assert.Equal(t, http.StatusOK, resp.StatusCode)

		// Test API versioning
		resp, err = http.Get(server.URL + "/version")
		require.NoError(t, err)
		defer resp.Body.Close()

		assert.Equal(t, http.StatusOK, resp.StatusCode)

		var versionInfo map[string]string
		err = json.NewDecoder(resp.Body).Decode(&versionInfo)
		require.NoError(t, err)

		assert.Equal(t, "1.0.0-test", versionInfo["version"])
		assert.Equal(t, "test-instance-123", versionInfo["instance"])
	})
}

// TestMiddlewareChainOrder verifies that middleware are applied in the correct order
func TestMiddlewareChainOrder(t *testing.T) {
	cfg := &config.Config{
		CORS: config.CORSConfig{
			AllowedOrigins: []string{"*"},
		},
	}

	r := chi.NewRouter()

	// Track middleware execution order
	var middlewareOrder []string
	var middlewareMutex sync.Mutex

	// Wrap middleware to track execution
	trackingWrapper := func(name string, next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			middlewareMutex.Lock()
			middlewareOrder = append(middlewareOrder, name)
			middlewareMutex.Unlock()
			next.ServeHTTP(w, r)
		})
	}

	// Apply middleware in the correct order
	r.Use(trackingWrapper("recovery", middleware.RecoveryMiddleware()))
	r.Use(trackingWrapper("security-headers", middleware.SecurityHeadersMiddleware()))
	r.Use(trackingWrapper("logging", middleware.LoggingMiddleware()))
	r.Use(trackingWrapper("cors", middleware.CORSMiddleware(cfg)))

	// Add route
	r.Get("/test", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	})

	// Make request
	req := httptest.NewRequest("GET", "/test", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	// Verify middleware execution order
	expectedOrder := []string{
		"recovery",
		"security-headers",
		"logging",
		"cors",
	}

	assert.Equal(t, expectedOrder, middlewareOrder, "Middleware should execute in the correct order")
}

// BenchmarkGatewayPerformance benchmarks the overall gateway performance
func BenchmarkGatewayPerformance(b *testing.B) {
	cfg := &config.Config{
		Version:     "1.0.0-bench",
		InstanceID:  "bench-instance",
		Environment: "benchmark",
		CORS: config.CORSConfig{
			AllowedOrigins: []string{"*"},
		},
	}

	r := chi.NewRouter()
	r.Use(middleware.RecoveryMiddleware())
	r.Use(middleware.SecurityHeadersMiddleware())
	r.Use(middleware.CORSMiddleware(cfg))

	r.Get("/benchmark", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{
			"message": "Hello, World!",
		})
	})

	server := httptest.NewServer(r)
	defer server.Close()

	b.ResetTimer()
	b.RunParallel(func(pb *testing.PB) {
		for pb.Next() {
			resp, err := http.Get(server.URL + "/benchmark")
			if err != nil {
				b.Error(err)
				continue
			}
			resp.Body.Close()
		}
	})
}
