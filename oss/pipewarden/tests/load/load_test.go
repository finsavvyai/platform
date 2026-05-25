package load

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"sort"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/finsavvyai/pipewarden/internal/aianalysis"
	"github.com/finsavvyai/pipewarden/internal/analysis"
	"github.com/finsavvyai/pipewarden/internal/config"
	"github.com/finsavvyai/pipewarden/internal/integrations"
	"github.com/finsavvyai/pipewarden/internal/logging"
	"github.com/finsavvyai/pipewarden/internal/router"
	"github.com/finsavvyai/pipewarden/internal/storage"
	"github.com/finsavvyai/pipewarden/internal/vault"
	"github.com/stretchr/testify/require"
)

var mockGitHubAPIBaseURL string

// LoadTestMetrics captures performance metrics.
type LoadTestMetrics struct {
	TotalRequests  int64
	SuccessfulReqs int64
	FailedReqs     int64
	TotalDuration  time.Duration
	Latencies      []time.Duration
	MinLatency     time.Duration
	MaxLatency     time.Duration
	AvgLatency     time.Duration
	P50Latency     time.Duration
	P95Latency     time.Duration
	P99Latency     time.Duration
	RequestsPerSec float64
}

// setupLoadTestServer creates a test server optimized for load testing.
func setupLoadTestServer(t *testing.T) *httptest.Server {
	mockGitHubAPI := newMockGitHubAPIServer()
	mockGitHubAPIBaseURL = mockGitHubAPI.URL

	// Create in-memory database
	db, err := storage.NewInMemory()
	require.NoError(t, err)

	// Create logger (minimal output)
	cfg := &config.LoggingConfig{Level: "error"}
	logger, err := logging.New(cfg)
	require.NoError(t, err)

	// Create manager
	manager := integrations.NewManager(logger)

	// Create analyzers
	claudeAnalyzer := aianalysis.NewClaudeAnalyzer(
		aianalysis.ClaudeConfig{APIKey: "", Model: "claude-3-haiku"},
		logger,
	)
	heuristicAnalyzer := analysis.NewHeuristicAnalyzer()

	// Create vault
	v, err := vault.New("test-load-master-key")
	require.NoError(t, err)

	// Create router
	mux := router.New(db, manager, claudeAnalyzer, heuristicAnalyzer, logger, v)

	server := httptest.NewServer(mux)
	t.Cleanup(func() {
		mockGitHubAPI.Close()
		server.Close()
		_ = db.Close()
	})

	return server
}

// TestConcurrent100Scans tests that 100 concurrent scans complete without errors.
func TestConcurrent100Scans(t *testing.T) {
	server := setupLoadTestServer(t)

	// Setup: Add test connection
	addTestConnection(t, server, "load-test-conn")

	concurrency := 100
	var wg sync.WaitGroup
	var successCount, failCount int64

	startTime := time.Now()

	for i := 0; i < concurrency; i++ {
		wg.Add(1)
		go func(id int) {
			defer wg.Done()

			scanPayload := quickScanPayload("load-test-conn", fmt.Sprintf("workflow-%d", id))
			payload, _ := json.Marshal(scanPayload)

			resp, err := http.Post(
				fmt.Sprintf("%s/api/v1/analysis/quick", server.URL),
				"application/json",
				bytes.NewBuffer(payload),
			)

			if err != nil || resp.StatusCode != http.StatusOK {
				atomic.AddInt64(&failCount, 1)
				if resp != nil {
					_ = resp.Body.Close()
				}
				return
			}

			atomic.AddInt64(&successCount, 1)
			_ = resp.Body.Close()
		}(i)
	}

	wg.Wait()
	duration := time.Since(startTime)

	// Assert all scans completed successfully
	require.Equal(t, int64(concurrency), successCount, "all scans should succeed")
	require.Equal(t, int64(0), failCount, "no scans should fail")

	t.Logf("Concurrent scans completed: %d in %v", concurrency, duration)
}

// BenchmarkConcurrentScans measures throughput of concurrent heuristic scans.
// Run with: go test -bench=BenchmarkConcurrentScans -benchtime=10s ./tests/load
func BenchmarkConcurrentScans(b *testing.B) {
	server := setupLoadTestServer(&testing.T{})
	addTestConnection(&testing.T{}, server, "bench-scans")

	concurrency := 100
	metrics := &LoadTestMetrics{
		Latencies: make([]time.Duration, 0, b.N*concurrency),
	}

	b.ResetTimer()
	startTime := time.Now()

	var wg sync.WaitGroup
	var mu sync.Mutex

	for iteration := 0; iteration < b.N; iteration++ {
		for i := 0; i < concurrency; i++ {
			wg.Add(1)
			go func(id int) {
				defer wg.Done()

				scanPayload := quickScanPayload("bench-scans", fmt.Sprintf("bench-workflow-%d", id))
				payload, _ := json.Marshal(scanPayload)

				reqStart := time.Now()
				resp, err := http.Post(
					fmt.Sprintf("%s/api/v1/analysis/quick", server.URL),
					"application/json",
					bytes.NewBuffer(payload),
				)
				latency := time.Since(reqStart)

				mu.Lock()
				if err == nil && resp.StatusCode == http.StatusOK {
					atomic.AddInt64(&metrics.SuccessfulReqs, 1)
				} else {
					atomic.AddInt64(&metrics.FailedReqs, 1)
				}
				metrics.Latencies = append(metrics.Latencies, latency)
				mu.Unlock()

				if resp != nil {
					_ = resp.Body.Close()
				}
			}(i)
		}
	}

	wg.Wait()
	metrics.TotalDuration = time.Since(startTime)
	metrics.TotalRequests = int64(b.N * concurrency)

	// Calculate statistics
	calculateMetrics(metrics)

	b.ReportMetric(metrics.RequestsPerSec, "req/sec")
	b.Logf("\nConcurrent Scans Benchmark:\n"+
		"  Requests: %d\n"+
		"  Success: %d, Failed: %d\n"+
		"  Duration: %v\n"+
		"  Throughput: %.2f req/sec\n"+
		"  Latency - Min: %v, Max: %v, Avg: %v\n"+
		"  Percentiles - P50: %v, P95: %v, P99: %v",
		metrics.TotalRequests, metrics.SuccessfulReqs, metrics.FailedReqs,
		metrics.TotalDuration, metrics.RequestsPerSec,
		metrics.MinLatency, metrics.MaxLatency, metrics.AvgLatency,
		metrics.P50Latency, metrics.P95Latency, metrics.P99Latency)
}

// BenchmarkAPIEndpoints measures throughput of concurrent API operations.
// Run with: go test -bench=BenchmarkAPIEndpoints -benchtime=10s ./tests/load
func BenchmarkAPIEndpoints(b *testing.B) {
	server := setupLoadTestServer(&testing.T{})

	metrics := &LoadTestMetrics{
		Latencies: make([]time.Duration, 0, b.N*50),
	}

	b.ResetTimer()
	startTime := time.Now()

	var wg sync.WaitGroup
	var mu sync.Mutex

	// Mix of API calls: GET connections, GET findings, POST scans
	endpoints := []struct {
		name   string
		method string
		path   string
		body   interface{}
	}{
		{"GET /connections", "GET", "/api/v1/connections", nil},
		{"GET /findings", "GET", "/api/v1/analysis/findings", nil},
		{"GET /stats", "GET", "/api/v1/analysis/stats", nil},
		{"GET /overview", "GET", "/api/v1/dashboard/overview", nil},
		{"GET /history", "GET", "/api/v1/analysis/history", nil},
	}

	for iteration := 0; iteration < b.N; iteration++ {
		for _, endpoint := range endpoints {
			wg.Add(1)
			go func(ep struct {
				name   string
				method string
				path   string
				body   interface{}
			}) {
				defer wg.Done()

				reqStart := time.Now()
				var resp *http.Response
				var err error

				if ep.method == "GET" {
					resp, err = http.Get(server.URL + ep.path)
				} else {
					payload, _ := json.Marshal(ep.body)
					resp, err = http.Post(server.URL+ep.path, "application/json", bytes.NewBuffer(payload))
				}

				latency := time.Since(reqStart)

				mu.Lock()
				if err == nil && resp.StatusCode == http.StatusOK {
					atomic.AddInt64(&metrics.SuccessfulReqs, 1)
				} else {
					atomic.AddInt64(&metrics.FailedReqs, 1)
				}
				metrics.Latencies = append(metrics.Latencies, latency)
				mu.Unlock()

				if resp != nil {
					_ = resp.Body.Close()
				}
			}(endpoint)
		}
	}

	wg.Wait()
	metrics.TotalDuration = time.Since(startTime)
	metrics.TotalRequests = int64(b.N * len(endpoints))

	calculateMetrics(metrics)

	b.ReportMetric(metrics.RequestsPerSec, "req/sec")
	b.Logf("\nAPI Endpoints Benchmark:\n"+
		"  Requests: %d\n"+
		"  Success: %d, Failed: %d\n"+
		"  Duration: %v\n"+
		"  Throughput: %.2f req/sec\n"+
		"  Latency - Min: %v, Max: %v, Avg: %v\n"+
		"  Percentiles - P50: %v, P95: %v, P99: %v",
		metrics.TotalRequests, metrics.SuccessfulReqs, metrics.FailedReqs,
		metrics.TotalDuration, metrics.RequestsPerSec,
		metrics.MinLatency, metrics.MaxLatency, metrics.AvgLatency,
		metrics.P50Latency, metrics.P95Latency, metrics.P99Latency)
}

// BenchmarkDatabaseWrites measures concurrent database writes (SQLite WAL mode stress test).
// Run with: go test -bench=BenchmarkDatabaseWrites -benchtime=10s ./tests/load
func BenchmarkDatabaseWrites(b *testing.B) {
	server := setupLoadTestServer(&testing.T{})
	addTestConnection(&testing.T{}, server, "db-stress-test")

	metrics := &LoadTestMetrics{
		Latencies: make([]time.Duration, 0, b.N*100),
	}

	b.ResetTimer()
	startTime := time.Now()

	var wg sync.WaitGroup
	var mu sync.Mutex

	concurrency := 100
	for iteration := 0; iteration < b.N; iteration++ {
		for i := 0; i < concurrency; i++ {
			wg.Add(1)
			go func(id int) {
				defer wg.Done()

				scanPayload := quickScanPayload("db-stress-test", fmt.Sprintf("stress-test-%d-%d", iteration, id))
				payload, _ := json.Marshal(scanPayload)

				reqStart := time.Now()
				resp, err := http.Post(
					fmt.Sprintf("%s/api/v1/analysis/quick", server.URL),
					"application/json",
					bytes.NewBuffer(payload),
				)
				latency := time.Since(reqStart)

				mu.Lock()
				if err == nil && resp.StatusCode == http.StatusOK {
					atomic.AddInt64(&metrics.SuccessfulReqs, 1)
				} else {
					atomic.AddInt64(&metrics.FailedReqs, 1)
				}
				metrics.Latencies = append(metrics.Latencies, latency)
				mu.Unlock()

				if resp != nil {
					_ = resp.Body.Close()
				}
			}(i)
		}
	}

	wg.Wait()
	metrics.TotalDuration = time.Since(startTime)
	metrics.TotalRequests = int64(b.N * concurrency)

	calculateMetrics(metrics)

	b.ReportMetric(metrics.RequestsPerSec, "req/sec")
	b.Logf("\nDatabase Writes Benchmark (SQLite WAL):\n"+
		"  Writes: %d\n"+
		"  Success: %d, Failed: %d\n"+
		"  Duration: %v\n"+
		"  Throughput: %.2f writes/sec\n"+
		"  Latency - Min: %v, Max: %v, Avg: %v\n"+
		"  Percentiles - P50: %v, P95: %v, P99: %v",
		metrics.TotalRequests, metrics.SuccessfulReqs, metrics.FailedReqs,
		metrics.TotalDuration, metrics.RequestsPerSec,
		metrics.MinLatency, metrics.MaxLatency, metrics.AvgLatency,
		metrics.P50Latency, metrics.P95Latency, metrics.P99Latency)
}

// BenchmarkDLPScanning measures DLP pattern matching performance under load.
// Run with: go test -bench=BenchmarkDLPScanning -benchtime=10s ./tests/load
func BenchmarkDLPScanning(b *testing.B) {
	server := setupLoadTestServer(&testing.T{})
	addTestConnection(&testing.T{}, server, "dlp-bench")

	metrics := &LoadTestMetrics{
		Latencies: make([]time.Duration, 0, b.N*100),
	}

	b.ResetTimer()
	startTime := time.Now()

	var wg sync.WaitGroup
	var mu sync.Mutex

	concurrency := 100
	for iteration := 0; iteration < b.N; iteration++ {
		for i := 0; i < concurrency; i++ {
			wg.Add(1)
			go func(id int) {
				defer wg.Done()

				scanPayload := quickScanPayload("dlp-bench", fmt.Sprintf("dlp-scan-%d-%d", iteration, id))
				payload, _ := json.Marshal(scanPayload)

				reqStart := time.Now()
				resp, err := http.Post(
					fmt.Sprintf("%s/api/v1/analysis/quick", server.URL),
					"application/json",
					bytes.NewBuffer(payload),
				)
				latency := time.Since(reqStart)

				mu.Lock()
				if err == nil && resp.StatusCode == http.StatusOK {
					atomic.AddInt64(&metrics.SuccessfulReqs, 1)
				} else {
					atomic.AddInt64(&metrics.FailedReqs, 1)
				}
				metrics.Latencies = append(metrics.Latencies, latency)
				mu.Unlock()

				if resp != nil {
					_ = resp.Body.Close()
				}
			}(i)
		}
	}

	wg.Wait()
	metrics.TotalDuration = time.Since(startTime)
	metrics.TotalRequests = int64(b.N * concurrency)

	calculateMetrics(metrics)

	b.ReportMetric(metrics.RequestsPerSec, "req/sec")
	b.Logf("\nDLP Scanning Benchmark:\n"+
		"  Scans: %d\n"+
		"  Success: %d, Failed: %d\n"+
		"  Duration: %v\n"+
		"  Throughput: %.2f scans/sec\n"+
		"  Latency - Min: %v, Max: %v, Avg: %v\n"+
		"  Percentiles - P50: %v, P95: %v, P99: %v",
		metrics.TotalRequests, metrics.SuccessfulReqs, metrics.FailedReqs,
		metrics.TotalDuration, metrics.RequestsPerSec,
		metrics.MinLatency, metrics.MaxLatency, metrics.AvgLatency,
		metrics.P50Latency, metrics.P95Latency, metrics.P99Latency)
}

// BenchmarkPolicyEvaluation measures policy engine performance under load.
// Run with: go test -bench=BenchmarkPolicyEvaluation -benchtime=10s ./tests/load
func BenchmarkPolicyEvaluation(b *testing.B) {
	server := setupLoadTestServer(&testing.T{})
	addTestConnection(&testing.T{}, server, "policy-bench")

	metrics := &LoadTestMetrics{
		Latencies: make([]time.Duration, 0, b.N*100),
	}

	b.ResetTimer()
	startTime := time.Now()

	var wg sync.WaitGroup
	var mu sync.Mutex

	concurrency := 100
	for iteration := 0; iteration < b.N; iteration++ {
		for i := 0; i < concurrency; i++ {
			wg.Add(1)
			go func(id int) {
				defer wg.Done()

				scanPayload := quickScanPayload("policy-bench", fmt.Sprintf("policy-eval-%d-%d", iteration, id))
				payload, _ := json.Marshal(scanPayload)

				reqStart := time.Now()
				resp, err := http.Post(
					fmt.Sprintf("%s/api/v1/analysis/quick", server.URL),
					"application/json",
					bytes.NewBuffer(payload),
				)
				latency := time.Since(reqStart)

				mu.Lock()
				if err == nil && resp.StatusCode == http.StatusOK {
					atomic.AddInt64(&metrics.SuccessfulReqs, 1)
				} else {
					atomic.AddInt64(&metrics.FailedReqs, 1)
				}
				metrics.Latencies = append(metrics.Latencies, latency)
				mu.Unlock()

				if resp != nil {
					_ = resp.Body.Close()
				}
			}(i)
		}
	}

	wg.Wait()
	metrics.TotalDuration = time.Since(startTime)
	metrics.TotalRequests = int64(b.N * concurrency)

	calculateMetrics(metrics)

	b.ReportMetric(metrics.RequestsPerSec, "req/sec")
	b.Logf("\nPolicy Evaluation Benchmark:\n"+
		"  Evaluations: %d\n"+
		"  Success: %d, Failed: %d\n"+
		"  Duration: %v\n"+
		"  Throughput: %.2f evals/sec\n"+
		"  Latency - Min: %v, Max: %v, Avg: %v\n"+
		"  Percentiles - P50: %v, P95: %v, P99: %v",
		metrics.TotalRequests, metrics.SuccessfulReqs, metrics.FailedReqs,
		metrics.TotalDuration, metrics.RequestsPerSec,
		metrics.MinLatency, metrics.MaxLatency, metrics.AvgLatency,
		metrics.P50Latency, metrics.P95Latency, metrics.P99Latency)
}

// Helper functions

// calculateMetrics computes statistical metrics from collected latencies.
func calculateMetrics(m *LoadTestMetrics) {
	if len(m.Latencies) == 0 {
		return
	}

	sort.Slice(m.Latencies, func(i, j int) bool {
		return m.Latencies[i] < m.Latencies[j]
	})

	m.MinLatency = m.Latencies[0]
	m.MaxLatency = m.Latencies[len(m.Latencies)-1]

	var totalLatency time.Duration
	for _, latency := range m.Latencies {
		totalLatency += latency
	}
	m.AvgLatency = time.Duration(int64(totalLatency) / int64(len(m.Latencies)))

	// Percentiles
	m.P50Latency = m.Latencies[len(m.Latencies)*50/100]
	m.P95Latency = m.Latencies[len(m.Latencies)*95/100]
	m.P99Latency = m.Latencies[len(m.Latencies)*99/100]

	// Requests per second
	m.RequestsPerSec = float64(m.TotalRequests) / m.TotalDuration.Seconds()
}

// addTestConnection is a helper to add a test connection.
func addTestConnection(t *testing.T, server *httptest.Server, name string) {
	connPayload := map[string]interface{}{
		"name":     name,
		"platform": "github",
		"token":    fmt.Sprintf("ghp_%s_load_test", name),
		"base_url": mockGitHubAPIBaseURL,
	}

	payload, _ := json.Marshal(connPayload)
	resp, err := http.Post(
		fmt.Sprintf("%s/api/v1/connections", server.URL),
		"application/json",
		bytes.NewBuffer(payload),
	)

	if t != nil && err != nil {
		t.Fatalf("failed to add test connection: %v", err)
	}
	if resp != nil {
		if t != nil && resp.StatusCode != http.StatusCreated {
			t.Fatalf("failed to add test connection: status %d", resp.StatusCode)
		}
		_ = resp.Body.Close()
	}
}

func quickScanPayload(connectionName, runID string) map[string]interface{} {
	return map[string]interface{}{
		"connection_name": connectionName,
		"owner":           "loadtest",
		"repo":            "repo",
		"run_id":          runID,
	}
}

func newMockGitHubAPIServer() *httptest.Server {
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		switch {
		case r.URL.Path == "/user":
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"login": "load-test-bot",
				"id":    1,
			})
		case strings.Contains(r.URL.Path, "/actions/runs/"):
			now := time.Now().UTC()
			runID := pathTail(r.URL.Path)
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"id":             9001,
				"name":           "Load Test CI",
				"workflow_id":    42,
				"status":         "completed",
				"conclusion":     "success",
				"head_branch":    "main",
				"head_sha":       "abc123def456",
				"html_url":       "https://example.com/runs/" + runID,
				"created_at":     now.Add(-2 * time.Minute).Format(time.RFC3339),
				"updated_at":     now.Format(time.RFC3339),
				"run_started_at": now.Add(-3 * time.Minute).Format(time.RFC3339),
			})
		default:
			http.NotFound(w, r)
		}
	}))
}

func pathTail(path string) string {
	parts := strings.Split(strings.Trim(path, "/"), "/")
	if len(parts) == 0 {
		return ""
	}
	return parts[len(parts)-1]
}
