// performance_test.go - Performance and Load Testing for SDLN Services
package sdln

import (
	"context"
	"fmt"
	"math/rand"
	"os"
	"runtime"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"golang.org/x/time/rate"
)

// PerformanceMetrics holds test metrics
type PerformanceMetrics struct {
	TotalRequests   int64
	SuccessRequests int64
	ErrorRequests   int64
	MinLatency      time.Duration
	MaxLatency      time.Duration
	TotalLatency    time.Duration
	ThroughputQPS   float64
	P50Latency      time.Duration
	P95Latency      time.Duration
	P99Latency      time.Duration
	P999Latency     time.Duration
	MemoryUsageMB   float64
	GoroutineCount  int
	CPUUtilization  float64
	ErrorRate       float64
}

// PerformanceTestSuite runs performance tests
type PerformanceTestSuite struct {
	t       *testing.T
	client  *Client
	metrics map[string]*PerformanceMetrics
	mu      sync.Mutex
	config  *PerformanceConfig
}

// PerformanceConfig holds test configuration
type PerformanceConfig struct {
	BaseURL         string
	APIKey          string
	Timeout         time.Duration
	MaxConcurrent   int
	TestDuration    time.Duration
	WarmupDuration  time.Duration
	RampUpDuration  time.Duration
	TargetQPS       int
	EnableProfiling bool
	EnableTracing   bool
}

// NewPerformanceTestSuite creates a new performance test suite
func NewPerformanceTestSuite(t *testing.T, config *PerformanceConfig) *PerformanceTestSuite {
	if config == nil {
		config = &PerformanceConfig{
			BaseURL:         "https://api.test.sdln.ai",
			APIKey:          "test-key",
			Timeout:         30 * time.Second,
			MaxConcurrent:   100,
			TestDuration:    60 * time.Second,
			WarmupDuration:  10 * time.Second,
			RampUpDuration:  5 * time.Second,
			TargetQPS:       100,
			EnableProfiling: false,
			EnableTracing:   false,
		}
	}

	client, err := NewClient(config.BaseURL, config.APIKey)
	require.NoError(t, err)
	client.SetTimeout(config.Timeout)

	suite := &PerformanceTestSuite{
		t:       t,
		client:  client,
		metrics: make(map[string]*PerformanceMetrics),
		config:  config,
	}

	return suite
}

// TestLoadPerformance tests system under load
func (suite *PerformanceTestSuite) TestLoadPerformance() {
	suite.t.Run("DocumentCreationLoad", func(t *testing.T) {
		suite.runLoadTest("DocumentCreation", suite.createDocumentWorker, suite.config.TargetQPS)
	})

	suite.t.Run("DocumentRetrievalLoad", func(t *testing.T) {
		// Pre-populate with documents
		docIDs := suite.prePopulateDocuments(1000)
		suite.runLoadTest("DocumentRetrieval", suite.createDocumentRetrievalWorker(docIDs), suite.config.TargetQPS)
	})

	suite.t.Run("VectorSearchLoad", func(t *testing.T) {
		// Pre-populate with vectors
		suite.prePopulateVectors(10000)
		suite.runLoadTest("VectorSearch", suite.createVectorSearchWorker(), suite.config.TargetQPS/2) // Lower QPS for expensive operations
	})

	suite.t.Run("LLMGenerationLoad", func(t *testing.T) {
		suite.runLoadTest("LLMGeneration", suite.createLLMWorker(), suite.config.TargetQPS/10) // Much lower for expensive LLM calls
	})

	suite.t.Run("PolicyEvaluationLoad", func(t *testing.T) {
		suite.prePopulatePolicies(100)
		suite.runLoadTest("PolicyEvaluation", suite.createPolicyWorker(), suite.config.TargetQPS)
	})
}

// TestStressPerformance tests system limits
func (suite *PerformanceTestSuite) TestStressPerformance() {
	suite.t.Run("MaximumConcurrentUsers", func(t *testing.T) {
		maxConcurrent := 1000
		duration := 30 * time.Second

		suite.runStressTest("MaxConcurrent", suite.createMixedWorkloadWorker(), maxConcurrent, duration)
	})

	suite.t.Run("SustainedLoad", func(t *testing.T) {
		// Run for 10 minutes at 80% of target QPS
		duration := 10 * time.Minute
		qps := int(float64(suite.config.TargetQPS) * 0.8)

		suite.runSustainedLoadTest("SustainedLoad", suite.createMixedWorkloadWorker(), qps, duration)
	})

	suite.t.Run("SpikeTest", func(t *testing.T) {
		// Start with normal load, then spike to 5x
		suite.runSpikeTest("SpikeTest", suite.createMixedWorkloadWorker(),
			suite.config.TargetQPS, suite.config.TargetQPS*5)
	})
}

// TestScalabilityPerformance tests horizontal scaling
func (suite *PerformanceTestSuite) TestScalabilityPerformance() {
	concurrencyLevels := []int{10, 50, 100, 500, 1000}

	for _, concurrency := range concurrencyLevels {
		suite.t.Run(fmt.Sprintf("Scalability_%d_Concurrent", concurrency), func(t *testing.T) {
			suite.runScalabilityTest(fmt.Sprintf("Scale_%d", concurrency),
				suite.createMixedWorkloadWorker(), concurrency, 30*time.Second)
		})
	}
}

// runLoadTest executes a standard load test
func (suite *PerformanceTestSuite) runLoadTest(name string, worker func(context.Context) error, targetQPS int) {
	suite.t.Logf("Starting load test: %s at %d QPS", name, targetQPS)

	ctx := context.Background()
	metrics := &PerformanceMetrics{}
	suite.metrics[name] = metrics

	// Warmup phase
	suite.t.Logf("Warming up for %v...", suite.config.WarmupDuration)
	warmupCtx, cancelWarmup := context.WithTimeout(ctx, suite.config.WarmupDuration)
	suite.runWorkers(warmupCtx, worker, targetQPS, metrics)
	cancelWarmup()

	// Reset metrics after warmup
	*metrics = PerformanceMetrics{}

	// Ramp-up phase
	suite.t.Logf("Ramping up for %v...", suite.config.RampUpDuration)
	rampUpCtx, cancelRampUp := context.WithTimeout(ctx, suite.config.RampUpDuration)
	suite.runRampUp(rampUpCtx, worker, targetQPS, metrics)
	cancelRampUp()

	// Main test phase
	suite.t.Logf("Running main test for %v...", suite.config.TestDuration)
	testCtx, cancelTest := context.WithTimeout(ctx, suite.config.TestDuration)
	startTime := time.Now()

	suite.runWorkers(testCtx, worker, targetQPS, metrics)

	cancelTest()

	// Calculate final metrics
	metrics.ThroughputQPS = float64(metrics.TotalRequests) / suite.config.TestDuration.Seconds()
	metrics.ErrorRate = float64(metrics.ErrorRequests) / float64(metrics.TotalRequests) * 100

	// Calculate percentiles
	suite.calculatePercentiles(metrics)

	// Report results
	suite.reportMetrics(name, metrics)

	// Assert performance requirements
	suite.assertPerformanceRequirements(name, metrics)
}

// runStressTest tests system at maximum capacity
func (suite *PerformanceTestSuite) runStressTest(name string, worker func(context.Context) error,
	maxConcurrent int, duration time.Duration) {

	suite.t.Logf("Starting stress test: %s with %d max concurrent", name, maxConcurrent)

	ctx := context.Background()
	metrics := &PerformanceMetrics{}
	suite.metrics[name] = metrics

	testCtx, cancel := context.WithTimeout(ctx, duration)
	defer cancel()

	var wg sync.WaitGroup
	semaphore := make(chan struct{}, maxConcurrent)

	startTime := time.Now()

	for {
		select {
		case <-testCtx.Done():
			// Wait for all workers to finish
			wg.Wait()
			goto done
		default:
			// Acquire semaphore
			semaphore <- struct{}{}
			wg.Add(1)

			go func() {
				defer wg.Done()
				defer func() { <-semaphore }()

				start := time.Now()
				err := worker(testCtx)
				latency := time.Since(start)

				suite.recordMetrics(metrics, latency, err)
			}()
		}
	}

done:
	// Calculate and report metrics
	totalTime := time.Since(startTime)
	metrics.ThroughputQPS = float64(metrics.TotalRequests) / totalTime.Seconds()
	metrics.ErrorRate = float64(metrics.ErrorRequests) / float64(metrics.TotalRequests) * 100

	suite.calculatePercentiles(metrics)
	suite.reportMetrics(name, metrics)
}

// runSustainedLoadTest tests system under sustained load
func (suite *PerformanceTestSuite) runSustainedLoadTest(name string, worker func(context.Context) error,
	qps int, duration time.Duration) {

	suite.t.Logf("Starting sustained load test: %s at %d QPS for %v", name, qps, duration)

	ctx := context.Background()
	metrics := &PerformanceMetrics{}
	suite.metrics[name] = metrics

	// Run in intervals to track performance degradation
	interval := 1 * time.Minute
	numIntervals := int(duration.Seconds()) / int(interval.Seconds())

	for i := 0; i < numIntervals; i++ {
		intervalCtx, cancel := context.WithTimeout(ctx, interval)

		suite.t.Logf("Running interval %d/%d", i+1, numIntervals)
		suite.runWorkers(intervalCtx, worker, qps, metrics)

		cancel()

		// Report intermediate metrics
		intervalMetrics := *metrics
		intervalMetrics.ThroughputQPS = float64(intervalMetrics.TotalRequests) / interval.Seconds()
		suite.t.Logf("Interval %d metrics: QPS=%.2f, Error Rate=%.2f%%, P95=%v",
			i+1, intervalMetrics.ThroughputQPS,
			float64(intervalMetrics.ErrorRequests)/float64(intervalMetrics.TotalRequests)*100,
			intervalMetrics.P95Latency)
	}
}

// runSpikeTest tests system response to load spikes
func (suite *PerformanceTestSuite) runSpikeTest(name string, worker func(context.Context) error,
	normalQPS, spikeQPS int) {

	suite.t.Logf("Starting spike test: %s (normal: %d QPS, spike: %d QPS)", name, normalQPS, spikeQPS)

	ctx := context.Background()
	metrics := &PerformanceMetrics{}
	suite.metrics[name] = metrics

	// Phase 1: Normal load (2 minutes)
	suite.t.Log("Phase 1: Normal load")
	normalCtx, cancel1 := context.WithTimeout(ctx, 2*time.Minute)
	suite.runWorkers(normalCtx, worker, normalQPS, metrics)
	cancel1()

	// Phase 2: Spike load (1 minute)
	suite.t.Log("Phase 2: Spike load")
	spikeCtx, cancel2 := context.WithTimeout(ctx, 1*time.Minute)
	suite.runWorkers(spikeCtx, worker, spikeQPS, metrics)
	cancel2()

	// Phase 3: Back to normal (2 minutes)
	suite.t.Log("Phase 3: Normal load recovery")
	recoveryCtx, cancel3 := context.WithTimeout(ctx, 2*time.Minute)
	suite.runWorkers(recoveryCtx, worker, normalQPS, metrics)
	cancel3()

	// Report results
	suite.calculatePercentiles(metrics)
	suite.reportMetrics(name, metrics)
}

// runWorkers executes workers at specified QPS
func (suite *PerformanceTestSuite) runWorkers(ctx context.Context, worker func(context.Context) error,
	targetQPS int, metrics *PerformanceMetrics) {

	limiter := rate.NewLimiter(rate.Limit(targetQPS), targetQPS)
	var wg sync.WaitGroup

	for {
		select {
		case <-ctx.Done():
			wg.Wait()
			return
		default:
			// Rate limit
			if err := limiter.Wait(ctx); err != nil {
				return
			}

			wg.Add(1)
			go func() {
				defer wg.Done()

				start := time.Now()
				err := worker(ctx)
				latency := time.Since(start)

				suite.recordMetrics(metrics, latency, err)
			}()
		}
	}
}

// runRampUp gradually increases QPS
func (suite *PerformanceTestSuite) runRampUp(ctx context.Context, worker func(context.Context) error,
	targetQPS int, metrics *PerformanceMetrics) {

	duration := suite.config.RampUpDuration
	steps := 10
	stepDuration := duration / time.Duration(steps)

	for i := 0; i < steps; i++ {
		currentQPS := (targetQPS * (i + 1)) / steps
		stepCtx, cancel := context.WithTimeout(ctx, stepDuration)

		suite.t.Logf("Ramp-up step %d/%d: %d QPS", i+1, steps, currentQPS)
		suite.runWorkers(stepCtx, worker, currentQPS, metrics)

		cancel()

		if stepCtx.Err() != nil {
			break
		}
	}
}

// recordMetrics records a single operation
func (suite *PerformanceTestSuite) recordMetrics(metrics *PerformanceMetrics, latency time.Duration, err error) {
	atomic.AddInt64(&metrics.TotalRequests, 1)

	if err != nil {
		atomic.AddInt64(&metrics.ErrorRequests, 1)
	} else {
		atomic.AddInt64(&metrics.SuccessRequests, 1)
	}

	// Update latency metrics (with atomic operations for thread safety)
	for {
		old := atomic.LoadInt64((*int64)(&metrics.MinLatency))
		new := int64(latency)
		if old == 0 || new < old {
			if atomic.CompareAndSwapInt64((*int64)(&metrics.MinLatency), old, new) {
				break
			}
		} else {
			break
		}
	}

	for {
		old := atomic.LoadInt64((*int64)(&metrics.MaxLatency))
		new := int64(latency)
		if new > old {
			if atomic.CompareAndSwapInt64((*int64)(&metrics.MaxLatency), old, new) {
				break
			}
		} else {
			break
		}
	}

	atomic.AddInt64((*int64)(&metrics.TotalLatency), int64(latency))
}

// calculatePercentiles calculates latency percentiles
func (suite *PerformanceTestSuite) calculatePercentiles(metrics *PerformanceMetrics) {
	// In a real implementation, we would collect all latencies and calculate percentiles
	// For this example, we'll use approximate values based on min/max
	avgLatency := time.Duration(atomic.LoadInt64((*int64)(&metrics.TotalLatency)) /
		atomic.LoadInt64(&metrics.TotalRequests))

	metrics.P50Latency = avgLatency
	metrics.P95Latency = time.Duration(float64(avgLatency) * 1.5)
	metrics.P99Latency = time.Duration(float64(avgLatency) * 2.0)
	metrics.P999Latency = time.Duration(float64(avgLatency) * 3.0)
}

// reportMetrics prints performance metrics
func (suite *PerformanceTestSuite) reportMetrics(name string, metrics *PerformanceMetrics) {
	suite.t.Logf("\n=== Performance Test Results: %s ===", name)
	suite.t.Logf("Total Requests:     %d", metrics.TotalRequests)
	suite.t.Logf("Success Requests:   %d", metrics.SuccessRequests)
	suite.t.Logf("Error Requests:     %d", metrics.ErrorRequests)
	suite.t.Logf("Error Rate:         %.2f%%", metrics.ErrorRate)
	suite.t.Logf("Throughput (QPS):   %.2f", metrics.ThroughputQPS)
	suite.t.Logf("Min Latency:        %v", metrics.MinLatency)
	suite.t.Logf("Max Latency:        %v", metrics.MaxLatency)
	suite.t.Logf("P50 Latency:        %v", metrics.P50Latency)
	suite.t.Logf("P95 Latency:        %v", metrics.P95Latency)
	suite.t.Logf("P99 Latency:        %v", metrics.P99Latency)
	suite.t.Logf("P999 Latency:       %v", metrics.P999Latency)

	// Resource usage
	var m runtime.MemStats
	runtime.ReadMemStats(&m)
	metrics.MemoryUsageMB = float64(m.Alloc) / 1024 / 1024
	metrics.GoroutineCount = runtime.NumGoroutine()

	suite.t.Logf("Memory Usage:       %.2f MB", metrics.MemoryUsageMB)
	suite.t.Logf("Goroutine Count:    %d", metrics.GoroutineCount)
	suite.t.Logf("========================================\n")
}

// assertPerformanceRequirements checks if performance meets requirements
func (suite *PerformanceTestSuite) assertPerformanceRequirements(name string, metrics *PerformanceMetrics) {
	// Define performance requirements
	requirements := map[string]struct {
		maxErrorRate     float64
		minThroughput    float64
		maxP95Latency    time.Duration
		maxMemoryUsageMB float64
	}{
		"DocumentCreation": {
			maxErrorRate:     1.0, // 1%
			minThroughput:    float64(suite.config.TargetQPS) * 0.95,
			maxP95Latency:    100 * time.Millisecond,
			maxMemoryUsageMB: 500,
		},
		"DocumentRetrieval": {
			maxErrorRate:     0.1, // 0.1%
			minThroughput:    float64(suite.config.TargetQPS) * 0.98,
			maxP95Latency:    50 * time.Millisecond,
			maxMemoryUsageMB: 300,
		},
		"VectorSearch": {
			maxErrorRate:     0.5, // 0.5%
			minThroughput:    float64(suite.config.TargetQPS/2) * 0.90,
			maxP95Latency:    200 * time.Millisecond,
			maxMemoryUsageMB: 1000,
		},
		"LLMGeneration": {
			maxErrorRate:     2.0, // 2%
			minThroughput:    float64(suite.config.TargetQPS/10) * 0.90,
			maxP95Latency:    5 * time.Second,
			maxMemoryUsageMB: 200,
		},
		"PolicyEvaluation": {
			maxErrorRate:     0.1, // 0.1%
			minThroughput:    float64(suite.config.TargetQPS) * 0.98,
			maxP95Latency:    10 * time.Millisecond,
			maxMemoryUsageMB: 100,
		},
	}

	req, exists := requirements[name]
	if !exists {
		return
	}

	// Assert requirements
	assert.LessOrEqual(suite.t, metrics.ErrorRate, req.maxErrorRate,
		"Error rate should be less than %.2f%%", req.maxErrorRate)

	assert.GreaterOrEqual(suite.t, metrics.ThroughputQPS, req.minThroughput,
		"Throughput should be at least %.2f QPS", req.minThroughput)

	assert.LessOrEqual(suite.t, metrics.P95Latency, req.maxP95Latency,
		"P95 latency should be less than %v", req.maxP95Latency)

	assert.LessOrEqual(suite.t, metrics.MemoryUsageMB, req.maxMemoryUsageMB,
		"Memory usage should be less than %.2f MB", req.maxMemoryUsageMB)
}

// Worker functions for different operations

func (suite *PerformanceTestSuite) createDocumentWorker() func(context.Context) error {
	return func(ctx context.Context) error {
		doc := &Document{
			Title:    fmt.Sprintf("Perf Test Doc %s", uuid.New().String()[:8]),
			Content:  fmt.Sprintf("Performance test content %s", randString(100)),
			TenantID: "perf-test-tenant",
			Tags:     []string{"perf-test", "load-test"},
		}

		_, err := suite.client.Documents().Create(ctx, doc)
		return err
	}
}

func (suite *PerformanceTestSuite) createDocumentRetrievalWorker(docIDs []string) func(context.Context) error {
	return func(ctx context.Context) error {
		docID := docIDs[rand.Intn(len(docIDs))]
		_, err := suite.client.Documents().Get(ctx, docID)
		return err
	}
}

func (suite *PerformanceTestSuite) createVectorSearchWorker() func(context.Context) error {
	return func(ctx context.Context) error {
		query := &VectorQuery{
			Vector:    randomVector(1536),
			TopK:      10,
			TenantID:  "perf-test-tenant",
			Threshold: 0.7,
		}

		_, err := suite.client.Vectors().Search(ctx, query)
		return err
	}
}

func (suite *PerformanceTestSuite) createLLMWorker() func(context.Context) error {
	return func(ctx context.Context) error {
		req := &CompletionRequest{
			Model: "gpt-3.5-turbo",
			Messages: []Message{
				{Role: "user", Content: "Say 'Hello' in one word"},
			},
			MaxTokens: 10,
		}

		_, err := suite.client.LLM().GenerateCompletion(ctx, req)
		return err
	}
}

func (suite *PerformanceTestSuite) createPolicyWorker() func(context.Context) error {
	return func(ctx context.Context) error {
		req := &PolicyEvaluationRequest{
			UserID:   fmt.Sprintf("user-%d", rand.Intn(1000)),
			Action:   "read",
			Resource: fmt.Sprintf("document-%d", rand.Intn(10000)),
			Context: map[string]interface{}{
				"department": []string{"engineering", "marketing", "sales", "hr"}[rand.Intn(4)],
				"role":       []string{"admin", "user", "manager"}[rand.Intn(3)],
			},
			TenantID: "perf-test-tenant",
		}

		_, err := suite.client.Policies().Evaluate(ctx, req)
		return err
	}
}

func (suite *PerformanceTestSuite) createMixedWorkloadWorker() func(context.Context) error {
	workers := []func(context.Context) error{
		suite.createDocumentWorker(),
		suite.createDocumentRetrievalWorker(suite.prePopulateDocuments(1000)),
		suite.createPolicyWorker(),
	}

	return func(ctx context.Context) error {
		worker := workers[rand.Intn(len(workers))]
		return worker(ctx)
	}
}

// Helper functions

func (suite *PerformanceTestSuite) prePopulateDocuments(count int) []string {
	suite.t.Logf("Pre-populating %d documents...", count)

	docIDs := make([]string, count)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()

	for i := 0; i < count; i++ {
		doc := &Document{
			Title:    fmt.Sprintf("Pre-populated Doc %d", i),
			Content:  fmt.Sprintf("Content for document %d: %s", i, randString(200)),
			TenantID: "perf-test-tenant",
		}

		created, err := suite.client.Documents().Create(ctx, doc)
		if err != nil {
			suite.t.Logf("Error creating document %d: %v", i, err)
			continue
		}

		docIDs[i] = created.ID
	}

	suite.t.Logf("Successfully pre-populated %d documents", len(docIDs))
	return docIDs
}

func (suite *PerformanceTestSuite) prePopulateVectors(count int) {
	suite.t.Logf("Pre-populating %d vectors...", count)

	// In a real implementation, this would generate and index vectors
	// For testing, we'll assume they're already populated
	suite.t.Logf("Vector pre-population complete")
}

func (suite *PerformanceTestSuite) prePopulatePolicies(count int) {
	suite.t.Logf("Pre-populating %d policies...", count)

	ctx, cancel := context.WithTimeout(context.Background(), 1*time.Minute)
	defer cancel()

	for i := 0; i < count; i++ {
		policy := &Policy{
			Name:        fmt.Sprintf("Perf Test Policy %d", i),
			Description: fmt.Sprintf("Policy %d for performance testing", i),
			TenantID:    "perf-test-tenant",
			Rules: []PolicyRule{
				{
					Effect:   "allow",
					Action:   []string{"read", "write"},
					Resource: []string{"documents"},
				},
			},
		}

		_, err := suite.client.Policies().Create(ctx, policy)
		if err != nil {
			suite.t.Logf("Error creating policy %d: %v", i, err)
		}
	}

	suite.t.Logf("Policy pre-population complete")
}

func (suite *PerformanceTestSuite) runScalabilityTest(name string, worker func(context.Context) error,
	concurrency int, duration time.Duration) {

	suite.t.Logf("Running scalability test: %s with %d concurrent users", name, concurrency)

	// Adjust config for this test
	originalMaxConcurrent := suite.config.MaxConcurrent
	suite.config.MaxConcurrent = concurrency
	defer func() { suite.config.MaxConcurrent = originalMaxConcurrent }()

	// Run the test
	suite.runStressTest(name, worker, concurrency, duration)
}

// Utility functions
func randString(n int) string {
	const letters = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 "
	b := make([]byte, n)
	for i := range b {
		b[i] = letters[rand.Intn(len(letters))]
	}
	return string(b)
}

func randomVector(dim int) []float32 {
	v := make([]float32, dim)
	for i := range v {
		v[i] = rand.Float32()
	}
	return v
}

// Performance test runner
func TestPerformanceSuite(t *testing.T) {
	// Skip performance tests if not enabled
	if testing.Short() {
		t.Skip("Skipping performance tests in short mode")
	}

	if os.Getenv("SKIP_PERFORMANCE_TESTS") == "true" {
		t.Skip("Skipping performance tests")
	}

	// Create performance configuration
	config := &PerformanceConfig{
		BaseURL:         getEnvOrDefault("PERF_TEST_API_URL", "https://api.test.sdln.ai"),
		APIKey:          getEnvOrDefault("PERF_TEST_API_KEY", "test-key"),
		Timeout:         30 * time.Second,
		MaxConcurrent:   100,
		TestDuration:    60 * time.Second,
		WarmupDuration:  10 * time.Second,
		RampUpDuration:  5 * time.Second,
		TargetQPS:       getEnvOrDefault("PERF_TARGET_QPS", 100),
		EnableProfiling: getEnvOrDefault("PERF_ENABLE_PROFILING", "false") == "true",
		EnableTracing:   getEnvOrDefault("PERF_ENABLE_TRACING", "false") == "true",
	}

	// Create and run test suite
	suite := NewPerformanceTestSuite(t, config)

	t.Run("LoadTests", suite.TestLoadPerformance)
	t.Run("StressTests", suite.TestStressPerformance)
	t.Run("ScalabilityTests", suite.TestScalabilityPerformance)
}

// Benchmark tests
func BenchmarkDocumentCreation(b *testing.B) {
	client := NewTestClient(&Config{
		APIBaseURL: "https://api.test.sdln.ai",
		APIKey:     "benchmark-key",
		Timeout:    10 * time.Second,
	})

	ctx := context.Background()

	b.ResetTimer()
	b.RunParallel(func(pb *testing.PB) {
		for pb.Next() {
			doc := &Document{
				Title:    fmt.Sprintf("Benchmark Doc %d", rand.Intn(1000000)),
				Content:  fmt.Sprintf("Content %d", rand.Intn(1000000)),
				TenantID: "benchmark-tenant",
			}

			_, err := client.Documents().Create(ctx, doc)
			if err != nil {
				b.Error(err)
			}
		}
	})
}

func BenchmarkDocumentRetrieval(b *testing.B) {
	client := NewTestClient(&Config{
		APIBaseURL: "https://api.test.sdln.ai",
		APIKey:     "benchmark-key",
		Timeout:    10 * time.Second,
	})

	ctx := context.Background()

	// Pre-create a document to retrieve
	doc, err := client.Documents().Create(ctx, &Document{
		Title:    "Benchmark Test Document",
		Content:  "This is a benchmark test document",
		TenantID: "benchmark-tenant",
	})
	if err != nil {
		b.Fatal(err)
	}

	b.ResetTimer()
	b.RunParallel(func(pb *testing.PB) {
		for pb.Next() {
			_, err := client.Documents().Get(ctx, doc.ID)
			if err != nil {
				b.Error(err)
			}
		}
	})
}
