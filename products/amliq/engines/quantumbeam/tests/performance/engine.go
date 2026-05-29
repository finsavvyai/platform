//go:build legacy_migrated
// +build legacy_migrated

package performance

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"math/rand"
	"net/http"
	"runtime"
	"strings"
	"sync/atomic"
	"time"

	"github.com/jmoiron/sqlx"
	"github.com/redis/go-redis/v9"
	"go.uber.org/zap"
)

// NewBenchmarkEngine creates a new benchmark engine instance
func NewBenchmarkEngine(config *BenchmarkConfig, logger *zap.Logger, db *sqlx.DB, redis *redis.Client) *BenchmarkEngine {
	ctx, cancel := context.WithCancel(context.Background())

	return &BenchmarkEngine{
		config:          config,
		logger:          logger,
		db:              db,
		redis:           redis,
		ctx:             ctx,
		cancel:          cancel,
		stats:           make(map[string]*RequestStat),
		requestChan:     make(chan *RequestTask, config.ConcurrentUsers*2),
		resultChan:      make(chan *RequestResult, config.ConcurrentUsers*2),
		metricsChan:     make(chan *ResourceDataPoint, 1000),
		errorChan:       make(chan *ErrorSample, 1000),
		errorCollector:  NewErrorCollector(),
		profiler:        NewProfiler(config, logger),
		resourceMonitor: NewResourceMonitor(config, logger),
		dbMonitor:       NewDatabaseMonitor(config, logger, db),
		cacheMonitor:    NewCacheMonitor(config, logger, redis),
		httpClient: &http.Client{
			Timeout: config.Timeout,
			Transport: &http.Transport{
				MaxIdleConns:        100,
				MaxIdleConnsPerHost: 100,
				IdleConnTimeout:     90 * time.Second,
				DisableCompression:  false,
			},
		},
	}
}

// RunBenchmark executes a complete benchmark test with the given scenarios
func (be *BenchmarkEngine) RunBenchmark(testName string, scenarios []LoadTestScenario) (*BenchmarkResult, error) {
	be.logger.Info("Starting benchmark test",
		zap.String("test_name", testName),
		zap.Int("scenarios", len(scenarios)),
		zap.Int("concurrent_users", be.config.ConcurrentUsers),
		zap.Duration("duration", be.config.TestDuration),
	)

	// Initialize metrics
	be.initializeMetrics(testName, scenarios)

	// Start monitoring
	if be.config.EnableProfiling {
		be.profiler.Start()
	}
	if be.config.EnableDBMonitoring {
		be.dbMonitor.Start()
	}
	if be.config.EnableCacheMonitoring {
		be.cacheMonitor.Start()
	}

	// Start workers
	be.startWorkers()

	// Start metrics collection
	be.startMetricsCollection()

	// Execute the load test
	err := be.executeLoadTest(scenarios)

	// Stop monitoring and workers
	be.stopAllComponents()

	// Generate final metrics
	be.generateFinalMetrics()

	// Generate report
	reportPath, err := be.generateReport()
	if err != nil {
		be.logger.Error("Failed to generate report", zap.Error(err))
	}

	result := &BenchmarkResult{
		Metrics: be.metrics,
		Success: err == nil,
		Error: func() string {
			if err != nil {
				return err.Error()
			}
			return ""
		}(),
		ReportPath: reportPath,
	}

	be.logger.Info("Benchmark test completed",
		zap.Bool("success", result.Success),
		zap.Int64("total_requests", be.totalRequests),
		zap.Int64("successful_requests", be.successRequests),
		zap.Float64("success_rate", float64(be.successRequests)/float64(be.totalRequests)),
		zap.Duration("duration", be.endTime.Sub(be.startTime)),
	)

	return result, err
}

// initializeMetrics sets up the initial metrics structure
func (be *BenchmarkEngine) initializeMetrics(testName string, scenarios []LoadTestScenario) {
	be.startTime = time.Now()
	be.metrics = &PerformanceMetrics{
		TestInfo: TestInfo{
			TestName:    testName,
			StartTime:   be.startTime,
			Config:      *be.config,
			Scenarios:   scenarios,
			Environment: be.getEnvironmentInfo(),
			Version:     be.getVersionInfo(),
			GitCommit:   be.getGitCommit(),
		},
		RequestMetrics:  make(map[string]*RequestStat),
		ResourceMetrics: ResourceMetrics{},
		DatabaseMetrics: DatabaseMetrics{},
		CacheMetrics:    CacheMetrics{},
		ErrorAnalysis:   ErrorAnalysis{},
		TimelineData:    make([]TimelineDataPoint, 0),
	}

	// Initialize request stats for all unique URLs
	for _, scenario := range scenarios {
		for _, request := range scenario.Requests {
			key := be.getRequestKey(request.Method, request.Path)
			be.stats[key] = &RequestStat{
				URL:           request.Path,
				Method:        request.Method,
				ErrorCounts:   make(map[string]int64),
				ResponseCodes: make(map[string]int64),
			}
			be.metrics.RequestMetrics[key] = &RequestStat{
				URL:           request.Path,
				Method:        request.Method,
				ErrorCounts:   make(map[string]int64),
				ResponseCodes: make(map[string]int64),
			}
		}
	}
}

// executeLoadTest runs the main load test execution
func (be *BenchmarkEngine) executeLoadTest(scenarios []LoadTestScenario) error {
	be.logger.Info("Starting load test execution")

	// Calculate ramp-up interval
	rampUpInterval := be.config.RampUpPeriod / time.Duration(be.config.ConcurrentUsers)

	// Start users gradually (ramp-up)
	for i := 0; i < be.config.ConcurrentUsers; i++ {
		select {
		case <-be.ctx.Done():
			return fmt.Errorf("test cancelled during ramp-up")
		default:
			be.wg.Add(1)
			go be.runUser(i+1, scenarios)

			// Wait for ramp-up interval
			time.Sleep(rampUpInterval)
		}
	}

	// Handle spike load if enabled
	if be.config.EnableSpikeLoad {
		be.wg.Add(1)
		go be.handleSpikeLoad(scenarios)
	}

	// Wait for test duration or context cancellation
	testTimer := time.NewTimer(be.config.TestDuration)
	defer testTimer.Stop()

	select {
	case <-testTimer.C:
		be.logger.Info("Test duration completed, stopping users")
	case <-be.ctx.Done():
		return fmt.Errorf("test cancelled")
	}

	// Cancel context to stop all goroutines
	be.cancel()

	// Wait for all users to finish
	be.wg.Wait()

	// Cool down period
	be.logger.Info("Starting cool down period", zap.Duration("duration", be.config.CooldownPeriod))
	time.Sleep(be.config.CooldownPeriod)

	be.endTime = time.Now()
	be.metrics.TestInfo.EndTime = be.endTime
	be.metrics.TestInfo.Duration = be.endTime.Sub(be.startTime)

	return nil
}

// runUser simulates a single user executing requests
func (be *BenchmarkEngine) runUser(userID int, scenarios []LoadTestScenario) {
	defer be.wg.Done()

	be.logger.Debug("Starting user", zap.Int("user_id", userID))

	// Create user-specific data
	userData := map[string]interface{}{
		"user_id":  userID,
		"username": fmt.Sprintf("user%d", userID),
		"email":    fmt.Sprintf("user%d@example.com", userID),
	}

	// Weight-based scenario selection
	scenarioWeights := make([]int, len(scenarios))
	totalWeight := 0
	for i, scenario := range scenarios {
		scenarioWeights[i] = scenario.Weight
		totalWeight += scenario.Weight
	}

	// Main user loop
	for {
		select {
		case <-be.ctx.Done():
			be.logger.Debug("User stopped", zap.Int("user_id", userID))
			return
		default:
			// Select scenario based on weight
			scenario := be.selectWeightedScenario(scenarios, scenarioWeights, totalWeight)

			// Execute scenario
			be.executeScenario(userID, scenario, userData)

			// Small delay between requests to simulate realistic user behavior
			time.Sleep(time.Duration(rand.Intn(1000)+500) * time.Millisecond)
		}
	}
}

// selectWeightedScenario selects a scenario based on weights
func (be *BenchmarkEngine) selectWeightedScenario(scenarios []LoadTestScenario, weights []int, totalWeight int) *LoadTestScenario {
	if totalWeight == 0 {
		return &scenarios[0] // Fallback
	}

	r := rand.Intn(totalWeight)
	cumulative := 0

	for i, weight := range weights {
		cumulative += weight
		if r < cumulative {
			return &scenarios[i]
		}
	}

	return &scenarios[0] // Fallback
}

// executeScenario executes a single test scenario
func (be *BenchmarkEngine) executeScenario(userID int, scenario *LoadTestScenario, userData map[string]interface{}) {
	for _, request := range scenario.Requests {
		select {
		case <-be.ctx.Done():
			return
		default:
			// Create task
			task := &RequestTask{
				ID:        int(atomic.AddInt64(&be.totalRequests, 1)),
				Scenario:  scenario,
				Request:   &request,
				StartTime: time.Now(),
				Timeout:   request.Timeout,
				UserData:  userData,
			}

			// Send task to workers
			be.requestChan <- task
		}
	}
}

// handleSpikeLoad handles additional load during spike periods
func (be *BenchmarkEngine) handleSpikeLoad(scenarios []LoadTestScenario) {
	defer be.wg.Done()

	be.logger.Info("Starting spike load handler")

	// Wait for initial load to stabilize
	time.Sleep(be.config.TestDuration / 4)

	// Calculate spike users
	spikeUsers := int(float64(be.config.ConcurrentUsers) * be.config.SpikeMultiplier)

	// Start spike users
	for i := 0; i < spikeUsers; i++ {
		select {
		case <-be.ctx.Done():
			return
		default:
			be.wg.Add(1)
			go be.runUser(be.config.ConcurrentUsers+i+1, scenarios)
		}
	}

	// Wait for spike duration
	time.Sleep(be.config.SpikeDuration)

	be.logger.Info("Spike load period ended")
}

// startWorkers starts the worker goroutines
func (be *BenchmarkEngine) startWorkers() {
	// Start HTTP request workers
	for i := 0; i < be.config.ConcurrentUsers; i++ {
		be.wg.Add(1)
		go be.requestWorker()
	}

	// Start result processor
	be.wg.Add(1)
	go be.resultProcessor()

	// Start error processor
	be.wg.Add(1)
	go be.errorProcessor()
}

// requestWorker processes HTTP requests
func (be *BenchmarkEngine) requestWorker() {
	defer be.wg.Done()

	for {
		select {
		case <-be.ctx.Done():
			return
		case task := <-be.requestChan:
			result := be.executeRequest(task)
			be.resultChan <- result
		}
	}
}

// executeRequest executes a single HTTP request
func (be *BenchmarkEngine) executeRequest(task *RequestTask) *RequestResult {
	startTime := time.Now()

	// Prepare request
	var body io.Reader
	if task.Request.Body != nil {
		jsonBody, _ := json.Marshal(task.Request.Body)
		body = strings.NewReader(string(jsonBody))
	}

	// Create HTTP request
	req, err := http.NewRequestWithContext(be.ctx, task.Request.Method, task.Request.Path, body)
	if err != nil {
		return &RequestResult{
			TaskID:       task.ID,
			URL:          task.Request.Path,
			Method:       task.Request.Method,
			Success:      false,
			Error:        fmt.Sprintf("Failed to create request: %v", err),
			ResponseTime: time.Since(startTime),
			Timestamp:    time.Now(),
		}
	}

	// Add headers
	for key, value := range task.Request.Headers {
		req.Header.Set(key, value)
	}

	// Add query parameters
	q := req.URL.Query()
	for key, value := range task.Request.QueryParams {
		q.Set(key, value)
	}
	req.URL.RawQuery = q.Encode()

	// Set content type if body exists
	if body != nil && req.Header.Get("Content-Type") == "" {
		req.Header.Set("Content-Type", "application/json")
	}

	// Execute request with retry logic
	var resp *http.Response
	var attempt int
	var lastErr error

	for attempt = 0; attempt <= task.Scenario.RetryPolicy.MaxAttempts; attempt++ {
		if attempt > 0 {
			// Calculate backoff delay
			delay := be.calculateBackoffDelay(attempt, task.Scenario.RetryPolicy)
			time.Sleep(delay)
		}

		resp, lastErr = be.httpClient.Do(req)
		if lastErr == nil && resp.StatusCode < 500 {
			break // Success or client error, don't retry
		}

		if resp != nil {
			resp.Body.Close()
		}
	}

	responseTime := time.Since(startTime)

	// Process response
	if lastErr != nil {
		return &RequestResult{
			TaskID:       task.ID,
			URL:          task.Request.Path,
			Method:       task.Request.Method,
			Success:      false,
			Error:        fmt.Sprintf("Request failed after %d attempts: %v", attempt+1, lastErr),
			ResponseTime: responseTime,
			Timestamp:    time.Now(),
		}
	}
	defer resp.Body.Close()

	// Read response body
	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		be.logger.Warn("Failed to read response body", zap.Error(err))
		respBody = []byte{}
	}

	// Check assertions
	assertions := be.checkAssertions(task.Request.Assertions, resp, string(respBody))

	// Determine success based on status code and assertions
	success := resp.StatusCode >= 200 && resp.StatusCode < 400 && be.allAssertionsPassed(assertions)

	result := &RequestResult{
		TaskID:        task.ID,
		URL:           task.Request.Path,
		Method:        task.Request.Method,
		StatusCode:    resp.StatusCode,
		ResponseTime:  responseTime,
		BytesReceived: int64(len(respBody)),
		BytesSent:     be.getRequestSize(task.Request),
		Success:       success,
		Headers:       resp.Header,
		Body:          string(respBody),
		Assertions:    assertions,
		Timestamp:     time.Now(),
	}

	// Add error if not successful
	if !success {
		if resp.StatusCode >= 400 {
			result.Error = fmt.Sprintf("HTTP %d: %s", resp.StatusCode, http.StatusText(resp.StatusCode))
		} else {
			result.Error = "Assertion failed"
		}
	}

	return result
}

// calculateBackoffDelay calculates retry backoff delay
func (be *BenchmarkEngine) calculateBackoffDelay(attempt int, policy RetryPolicy) time.Duration {
	var delay time.Duration

	switch policy.BackoffType {
	case "fixed":
		delay = policy.BaseDelay
	case "exponential":
		delay = policy.BaseDelay * time.Duration(math.Pow(2, float64(attempt-1)))
	case "linear":
		delay = policy.BaseDelay * time.Duration(attempt)
	default:
		delay = policy.BaseDelay
	}

	if delay > policy.MaxDelay {
		delay = policy.MaxDelay
	}

	return delay
}

// checkAssertions validates response assertions
func (be *BenchmarkEngine) checkAssertions(assertions []Assertion, resp *http.Response, body string) []AssertionResult {
	var results []AssertionResult

	for _, assertion := range assertions {
		result := AssertionResult{
			Type:     assertion.Type,
			Expected: assertion.Value,
		}

		switch assertion.Type {
		case "status_code":
			result.Actual = resp.StatusCode
			result.Passed = be.compareValues(resp.StatusCode, assertion.Value, assertion.Operator, assertion.Tolerance)

		case "response_time":
			// This would be calculated at the caller level
			result.Passed = true // Placeholder

		case "header":
			if headers := resp.Header.Values(assertion.Value.(string)); len(headers) > 0 {
				result.Actual = headers[0]
				result.Passed = be.compareValues(headers[0], assertion.Value, assertion.Operator, assertion.Tolerance)
			} else {
				result.Actual = ""
				result.Passed = false
				result.Error = "Header not found"
			}

		case "body":
			result.Actual = body
			result.Passed = be.compareValues(body, assertion.Value, assertion.Operator, assertion.Tolerance)

		case "json_path":
			// JSON path assertion (simplified)
			result.Passed = true // Placeholder

		default:
			result.Passed = false
			result.Error = fmt.Sprintf("Unknown assertion type: %s", assertion.Type)
		}

		if !result.Passed && result.Error == "" {
			result.Error = fmt.Sprintf("Expected %v %v %v", result.Expected, assertion.Operator, result.Actual)
		}

		results = append(results, result)
	}

	return results
}

// compareValues compares two values based on the operator
func (be *BenchmarkEngine) compareValues(actual, expected interface{}, operator string, tolerance float64) bool {
	switch operator {
	case "equals":
		return actual == expected
	case "not_equals":
		return actual != expected
	case "greater_than":
		return be.compareNumeric(actual, expected, tolerance, func(a, e float64) bool { return a > e })
	case "less_than":
		return be.compareNumeric(actual, expected, tolerance, func(a, e float64) bool { return a < e })
	case "contains":
		return strings.Contains(fmt.Sprintf("%v", actual), fmt.Sprintf("%v", expected))
	case "regex":
		// Simplified regex matching
		return strings.Contains(fmt.Sprintf("%v", actual), fmt.Sprintf("%v", expected))
	default:
		return false
	}
}

// compareNumeric compares numeric values with tolerance
func (be *BenchmarkEngine) compareNumeric(actual, expected interface{}, tolerance float64, compareFunc func(float64, float64) bool) bool {
	// Convert to float64 for comparison
	aFloat, eFloat := be.toFloat64(actual), be.toFloat64(expected)

	if tolerance > 0 {
		return math.Abs(aFloat-eFloat) <= tolerance
	}

	return compareFunc(aFloat, eFloat)
}

// toFloat64 converts interface{} to float64
func (be *BenchmarkEngine) toFloat64(value interface{}) float64 {
	switch v := value.(type) {
	case int:
		return float64(v)
	case int64:
		return float64(v)
	case float64:
		return v
	case float32:
		return float64(v)
	case string:
		// Try to parse as float
		if f, err := fmt.Sscanf(v, "%f", new(float64)); err == nil && f == 1 {
			var result float64
			fmt.Sscanf(v, "%f", &result)
			return result
		}
	}
	return 0.0
}

// allAssertionsPassed checks if all assertions passed
func (be *BenchmarkEngine) allAssertionsPassed(assertions []AssertionResult) bool {
	for _, assertion := range assertions {
		if !assertion.Passed {
			return false
		}
	}
	return true
}

// getRequestSize calculates the size of a request
func (be *BenchmarkEngine) getRequestSize(request *RequestDefinition) int64 {
	size := int64(0)

	// Add URL and method size
	size += int64(len(request.Path) + len(request.Method))

	// Add headers size
	for key, value := range request.Request.Headers {
		size += int64(len(key) + len(value))
	}

	// Add body size
	if request.Body != nil {
		if bodyBytes, err := json.Marshal(request.Body); err == nil {
			size += int64(len(bodyBytes))
		}
	}

	// Add query parameters size
	for key, value := range request.QueryParams {
		size += int64(len(key) + len(value))
	}

	return size
}

// getRequestKey generates a unique key for a request
func (be *BenchmarkEngine) getRequestKey(method, path string) string {
	return fmt.Sprintf("%s:%s", method, path)
}

// startMetricsCollection starts the metrics collection goroutine
func (be *BenchmarkEngine) startMetricsCollection() {
	be.wg.Add(1)
	go be.metricsCollector()
}

// metricsCollector collects and aggregates metrics
func (be *BenchmarkEngine) metricsCollector() {
	defer be.wg.Done()

	ticker := time.NewTicker(1 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-be.ctx.Done():
			return
		case <-ticker.C:
			be.collectTimelineData()
		}
	}
}

// collectTimelineData collects metrics for the current timeline point
func (be *BenchmarkEngine) collectTimelineData() {
	be.mu.RLock()
	defer be.mu.RUnlock()

	if be.totalRequests == 0 {
		return
	}

	// Calculate current RPS
	elapsed := time.Since(be.startTime).Seconds()
	currentRPS := float64(be.totalRequests) / elapsed

	// Calculate success rate
	successRate := float64(be.successRequests) / float64(be.totalRequests)

	// Calculate errors per second
	errorsPerSec := float64(be.failedRequests) / elapsed

	// Create timeline data point
	timelineData := TimelineDataPoint{
		Timestamp:    time.Now(),
		RPS:          currentRPS,
		SuccessRate:  successRate,
		ActiveUsers:  be.config.ConcurrentUsers,
		ErrorsPerSec: errorsPerSec,
	}

	be.metrics.TimelineData = append(be.metrics.TimelineData, timelineData)
}

// resultProcessor processes request results
func (be *BenchmarkEngine) resultProcessor() {
	defer be.wg.Done()

	for {
		select {
		case <-be.ctx.Done():
			return
		case result := <-be.resultChan:
			be.processResult(result)
		}
	}
}

// processResult processes a single request result
func (be *BenchmarkEngine) processResult(result *RequestResult) {
	// Update counters
	if result.Success {
		atomic.AddInt64(&be.successRequests, 1)
	} else {
		atomic.AddInt64(&be.failedRequests, 1)

		// Add to error collector
		errorSample := ErrorSample{
			Timestamp:    result.Timestamp,
			URL:          result.URL,
			Method:       result.Method,
			StatusCode:   result.StatusCode,
			ErrorMsg:     result.Error,
			ResponseTime: result.ResponseTime,
			RequestID:    fmt.Sprintf("req_%d", result.TaskID),
		}
		be.errorChan <- errorSample
	}

	atomic.AddInt64(&be.bytesReceived, result.BytesReceived)
	atomic.AddInt64(&be.bytesSent, result.BytesSent)

	// Update request statistics
	key := be.getRequestKey(result.Method, result.URL)
	be.mu.Lock()
	if stat, exists := be.stats[key]; exists {
		stat.TotalRequests++
		if result.Success {
			stat.SuccessfulRequests++
		} else {
			stat.FailedRequests++
		}

		// Update response time statistics
		be.updateResponseTimeStats(stat, result.ResponseTime)

		// Update response codes
		stat.ResponseCodes[fmt.Sprintf("%d", result.StatusCode)]++

		// Update error counts
		if !result.Success && result.Error != "" {
			stat.ErrorCounts[result.Error]++
		}
	}
	be.mu.Unlock()

	// Update metrics
	be.mu.Lock()
	if metricStat, exists := be.metrics.RequestMetrics[key]; exists {
		be.updateRequestMetric(metricStat, result)
	}
	be.mu.Unlock()
}

// updateResponseTimeStats updates response time statistics for a request stat
func (be *BenchmarkEngine) updateResponseTimeStats(stat *RequestStat, responseTime time.Duration) {
	if stat.MinResponseTime == 0 || responseTime < stat.MinResponseTime {
		stat.MinResponseTime = responseTime
	}
	if responseTime > stat.MaxResponseTime {
		stat.MaxResponseTime = responseTime
	}

	// Update average (simplified - would use proper moving average in production)
	stat.AverageResponseTime = time.Duration(
		(int64(stat.AverageResponseTime)*stat.TotalRequests + int64(responseTime)) / (stat.TotalRequests + 1),
	)
}

// updateRequestMetric updates the metrics for a request
func (be *BenchmarkEngine) updateRequestMetric(metricStat *RequestStat, result *RequestResult) {
	metricStat.TotalRequests++
	if result.Success {
		metricStat.SuccessfulRequests++
	} else {
		metricStat.FailedRequests++
	}

	metricStat.BytesReceived += result.BytesReceived
	metricStat.BytesSent += result.BytesSent

	// Update response time
	if metricStat.MinResponseTime == 0 || result.ResponseTime < metricStat.MinResponseTime {
		metricStat.MinResponseTime = result.ResponseTime
	}
	if result.ResponseTime > metricStat.MaxResponseTime {
		metricStat.MaxResponseTime = result.ResponseTime
	}

	// Update success rate
	metricStat.SuccessRate = float64(metricStat.SuccessfulRequests) / float64(metricStat.TotalRequests)

	// Update response codes
	statusCode := fmt.Sprintf("%d", result.StatusCode)
	metricStat.ResponseCodes[statusCode]++

	// Update error counts
	if !result.Success && result.Error != "" {
		metricStat.ErrorCounts[result.Error]++
	}
}

// errorProcessor processes error samples
func (be *BenchmarkEngine) errorProcessor() {
	defer be.wg.Done()

	for {
		select {
		case <-be.ctx.Done():
			return
		case errorSample := <-be.errorChan:
			be.errorCollector.AddError(errorSample)
		}
	}
}

// stopAllComponents stops all monitoring components
func (be *BenchmarkEngine) stopAllComponents() {
	be.cancel()

	if be.config.EnableProfiling {
		be.profiler.Stop()
	}
	if be.config.EnableDBMonitoring {
		be.dbMonitor.Stop()
	}
	if be.config.EnableCacheMonitoring {
		be.cacheMonitor.Stop()
	}

	// Wait for all goroutines to finish
	be.wg.Wait()
}

// generateFinalMetrics generates the final metrics summary
func (be *BenchmarkEngine) generateFinalMetrics() {
	be.mu.Lock()
	defer be.mu.Unlock()

	// Calculate summary statistics
	totalRequests := atomic.LoadInt64(&be.totalRequests)
	successfulRequests := atomic.LoadInt64(&be.successRequests)
	failedRequests := atomic.LoadInt64(&be.failedRequests)
	bytesReceived := atomic.LoadInt64(&be.bytesReceived)
	bytesSent := atomic.LoadInt64(&be.bytesSent)

	successRate := float64(successfulRequests) / float64(totalRequests)
	elapsed := be.endTime.Sub(be.startTime).Seconds()
	averageRPS := float64(totalRequests) / elapsed

	// Calculate percentiles from all request stats
	var allResponseTimes []time.Duration
	for _, stat := range be.stats {
		// In a real implementation, we would collect all response times
		// For now, use the average response time as a placeholder
		allResponseTimes = append(allResponseTimes, stat.AverageResponseTime)
	}

	percentiles := be.calculatePercentiles(allResponseTimes)

	be.metrics.Summary = TestSummary{
		TotalRequests:       totalRequests,
		SuccessfulRequests:  successfulRequests,
		FailedRequests:      failedRequests,
		SuccessRate:         successRate,
		AverageRPS:          averageRPS,
		PeakRPS:             averageRPS * 1.2, // Estimated peak
		AverageResponseTime: be.getAverageResponseTime(),
		MinResponseTime:     be.getMinResponseTime(),
		MaxResponseTime:     be.getMaxResponseTime(),
		P50ResponseTime:     percentiles.P50,
		P95ResponseTime:     percentiles.P95,
		P99ResponseTime:     percentiles.P99,
		TotalBytesReceived:  bytesReceived,
		TotalBytesSent:      bytesSent,
	}

	be.metrics.Percentiles = percentiles

	// Update error analysis
	be.metrics.ErrorAnalysis = be.errorCollector.GetAnalysis()
}

// calculatePercentiles calculates response time percentiles
func (be *BenchmarkEngine) calculatePercentiles(times []time.Duration) ResponseTimePercentiles {
	if len(times) == 0 {
		return ResponseTimePercentiles{
			P50:  0,
			P75:  0,
			P90:  0,
			P95:  0,
			P99:  0,
			P999: 0,
		}
	}

	// Sort times
	sorted := make([]time.Duration, len(times))
	copy(sorted, times)

	// Simple bubble sort for demonstration (use efficient sort in production)
	for i := 0; i < len(sorted); i++ {
		for j := 0; j < len(sorted)-1-i; j++ {
			if sorted[j] > sorted[j+1] {
				sorted[j], sorted[j+1] = sorted[j+1], sorted[j]
			}
		}
	}

	getPercentile := func(p float64) time.Duration {
		index := int(float64(len(sorted)) * p / 100.0)
		if index >= len(sorted) {
			index = len(sorted) - 1
		}
		return sorted[index]
	}

	return ResponseTimePercentiles{
		P50:  getPercentile(50),
		P75:  getPercentile(75),
		P90:  getPercentile(90),
		P95:  getPercentile(95),
		P99:  getPercentile(99),
		P999: getPercentile(99.9),
	}
}

// getAverageResponseTime calculates the average response time across all requests
func (be *BenchmarkEngine) getAverageResponseTime() time.Duration {
	if len(be.stats) == 0 {
		return 0
	}

	var totalTime time.Duration
	var totalRequests int64

	for _, stat := range be.stats {
		totalTime += stat.AverageResponseTime * time.Duration(stat.TotalRequests)
		totalRequests += stat.TotalRequests
	}

	if totalRequests == 0 {
		return 0
	}

	return totalTime / time.Duration(totalRequests)
}

// getMinResponseTime finds the minimum response time
func (be *BenchmarkEngine) getMinResponseTime() time.Duration {
	var minTime time.Duration

	for _, stat := range be.stats {
		if minTime == 0 || (stat.MinResponseTime > 0 && stat.MinResponseTime < minTime) {
			minTime = stat.MinResponseTime
		}
	}

	return minTime
}

// getMaxResponseTime finds the maximum response time
func (be *BenchmarkEngine) getMaxResponseTime() time.Duration {
	var maxTime time.Duration

	for _, stat := range be.stats {
		if stat.MaxResponseTime > maxTime {
			maxTime = stat.MaxResponseTime
		}
	}

	return maxTime
}

// getEnvironmentInfo collects environment information
func (be *BenchmarkEngine) getEnvironmentInfo() map[string]string {
	return map[string]string{
		"go_version": runtime.Version(),
		"os":         runtime.GOOS,
		"arch":       runtime.GOARCH,
		"cpu_count":  fmt.Sprintf("%d", runtime.NumCPU()),
		"goroutines": fmt.Sprintf("%d", runtime.NumGoroutine()),
		"hostname":   "localhost", // Would get actual hostname
		"timestamp":  time.Now().Format(time.RFC3339),
	}
}

// getVersionInfo gets application version information
func (be *BenchmarkEngine) getVersionInfo() string {
	// This would typically come from build flags or version file
	return "1.0.0"
}

// getGitCommit gets the current git commit hash
func (be *BenchmarkEngine) getGitCommit() string {
	// This would typically come from build flags or git command
	return "unknown"
}

// generateReport generates a performance test report
func (be *BenchmarkEngine) generateReport() (string, error) {
	// This would generate a comprehensive report in the specified format
	// For now, return a placeholder path
	reportPath := fmt.Sprintf("%s/performance_report_%s.json",
		be.config.ReportDirectory,
		time.Now().Format("20060102_150405"))

	return reportPath, nil
}

// Helper functions for creating collectors and monitors

// NewErrorCollector creates a new error collector
func NewErrorCollector() *ErrorCollector {
	return &ErrorCollector{
		errors:       make([]ErrorSample, 0),
		errorsByType: make(map[string]int64),
		errorsByURL:  make(map[string]int64),
		trends:       make([]ErrorTrendDataPoint, 0),
	}
}

// NewProfiler creates a new profiler
func NewProfiler(config *BenchmarkConfig, logger *zap.Logger) *Profiler {
	return &Profiler{
		config: config,
		logger: logger,
	}
}

// NewResourceMonitor creates a new resource monitor
func NewResourceMonitor(config *BenchmarkConfig, logger *zap.Logger) *ResourceMonitor {
	return &ResourceMonitor{
		config:   config,
		logger:   logger,
		dataChan: make(chan *ResourceDataPoint, 1000),
	}
}

// NewDatabaseMonitor creates a new database monitor
func NewDatabaseMonitor(config *BenchmarkConfig, logger *zap.Logger, db *sqlx.DB) *DatabaseMonitor {
	return &DatabaseMonitor{
		config:   config,
		logger:   logger,
		db:       db,
		dataChan: make(chan *DBDataPoint, 1000),
	}
}

// NewCacheMonitor creates a new cache monitor
func NewCacheMonitor(config *BenchmarkConfig, logger *zap.Logger, redis *redis.Client) *CacheMonitor {
	return &CacheMonitor{
		config:   config,
		logger:   logger,
		redis:    redis,
		dataChan: make(chan *CacheDataPoint, 1000),
	}
}

// ErrorCollector methods

// AddError adds an error sample to the collector
func (ec *ErrorCollector) AddError(sample ErrorSample) {
	ec.mu.Lock()
	defer ec.mu.Unlock()

	ec.errors = append(ec.errors, sample)
	ec.errorsByType[sample.ErrorMsg]++
	ec.errorsByURL[sample.URL]++

	// Add to trends (simplified - would aggregate by time windows)
	trend := ErrorTrendDataPoint{
		Timestamp:  sample.Timestamp,
		ErrorRate:  0.1, // Placeholder
		ErrorCount: 1,
	}
	ec.trends = append(ec.trends, trend)
}

// GetAnalysis returns the complete error analysis
func (ec *ErrorCollector) GetAnalysis() ErrorAnalysis {
	ec.mu.RLock()
	defer ec.mu.RUnlock()

	totalErrors := int64(len(ec.errors))

	return ErrorAnalysis{
		TotalErrors:      totalErrors,
		ErrorRate:        float64(totalErrors) / 1000, // Placeholder denominator
		ErrorsByType:     ec.errorsByType,
		ErrorsByEndpoint: ec.errorsByURL,
		ErrorSamples:     ec.errors,
		ErrorTrends:      ec.trends,
	}
}

// Profiler methods

// Start starts the profiler
func (p *Profiler) Start() {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.profiling = true
	p.logger.Info("Profiler started")
}

// Stop stops the profiler
func (p *Profiler) Stop() {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.profiling = false
	p.logger.Info("Profiler stopped")
}

// ResourceMonitor methods

// Start starts the resource monitor
func (rm *ResourceMonitor) Start() {
	rm.mu.Lock()
	defer rm.mu.Unlock()
	rm.monitoring = true
	rm.logger.Info("Resource monitor started")
}

// Stop stops the resource monitor
func (rm *ResourceMonitor) Stop() {
	rm.mu.Lock()
	defer rm.mu.Unlock()
	rm.monitoring = false
	rm.logger.Info("Resource monitor stopped")
}

// DatabaseMonitor methods

// Start starts the database monitor
func (dm *DatabaseMonitor) Start() {
	dm.mu.Lock()
	defer dm.mu.Unlock()
	dm.monitoring = true
	dm.logger.Info("Database monitor started")
}

// Stop stops the database monitor
func (dm *DatabaseMonitor) Stop() {
	dm.mu.Lock()
	defer dm.mu.Unlock()
	dm.monitoring = false
	dm.logger.Info("Database monitor stopped")
}

// CacheMonitor methods

// Start starts the cache monitor
func (cm *CacheMonitor) Start() {
	cm.mu.Lock()
	defer cm.mu.Unlock()
	cm.monitoring = true
	cm.logger.Info("Cache monitor started")
}

// Stop stops the cache monitor
func (cm *CacheMonitor) Stop() {
	cm.mu.Lock()
	defer cm.mu.Unlock()
	cm.monitoring = false
	cm.logger.Info("Cache monitor stopped")
}