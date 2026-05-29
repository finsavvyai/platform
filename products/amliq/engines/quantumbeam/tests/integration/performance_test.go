//go:build legacy_migrated
// +build legacy_migrated

package integration

import (
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func (suite *IntegrationTestSuite) TestPerformance() {
	suite.Run("API Response Times", func() {
		suite.testAPIResponseTimes()
	})

	suite.Run("Concurrent Requests", func() {
		suite.testConcurrentRequests()
	})

	suite.Run("High Volume Fraud Analysis", func() {
		suite.testHighVolumeFraudAnalysis()
	})

	suite.Run("Memory Usage", func() {
		suite.testMemoryUsage()
	})

	suite.Run("Database Performance", func() {
		suite.testDatabasePerformance()
	})

	suite.Run("Rate Limiting Performance", func() {
		suite.testRateLimitingPerformance()
	})
}

func (suite *IntegrationTestSuite) testAPIResponseTimes() {
	suite.authenticateUser()
	suite.createAPIKey()

	// Define expected maximum response times (in milliseconds)
	expectedResponseTimes := map[string]int{
		"/health":          50,
		"/auth/me":         100,
		"/users/profile":   100,
		"/api/keys":        200,
		"/fraud/analyze":   500,  // Longer due to ML processing
		"/admin/analytics": 1000, // Longer due to data aggregation
	}

	headers := map[string]string{
		"Authorization": "Bearer " + suite.testUser.Token,
	}

	apiHeaders := map[string]string{
		"Authorization": "Bearer " + suite.testAPIKey.Key,
	}

	// Test health endpoint
	start := time.Now()
	w := suite.makeRequest("GET", "/health", nil, nil)
	duration := time.Since(start).Milliseconds()
	assert.LessOrEqual(suite.T(), int(duration), expectedResponseTimes["/health"],
		"Health endpoint should respond within %dms, took %dms", expectedResponseTimes["/health"], duration)
	assert.Equal(suite.T(), http.StatusOK, w.Code)

	// Test user profile endpoint
	start = time.Now()
	w = suite.makeRequest("GET", "/users/profile", nil, headers)
	duration = time.Since(start).Milliseconds()
	assert.LessOrEqual(suite.T(), int(duration), expectedResponseTimes["/users/profile"],
		"User profile endpoint should respond within %dms, took %dms", expectedResponseTimes["/users/profile"], duration)
	assert.Equal(suite.T(), http.StatusOK, w.Code)

	// Test API keys endpoint
	start = time.Now()
	w = suite.makeRequest("GET", "/api/keys", nil, headers)
	duration = time.Since(start).Milliseconds()
	assert.LessOrEqual(suite.T(), int(duration), expectedResponseTimes["/api/keys"],
		"API keys endpoint should respond within %dms, took %dms", expectedResponseTimes["/api/keys"], duration)
	assert.Equal(suite.T(), http.StatusOK, w.Code)

	// Test fraud analysis endpoint
	transaction := map[string]interface{}{
		"transaction_id": "perf_test_001",
		"user_id":        suite.testUser.ID,
		"merchant_id":    "test-merchant-id",
		"amount":         500.00,
		"currency":       "USD",
		"description":    "Performance test transaction",
	}

	start = time.Now()
	w = suite.makeRequest("POST", "/fraud/analyze", transaction, apiHeaders)
	duration = time.Since(start).Milliseconds()
	assert.LessOrEqual(suite.T(), int(duration), expectedResponseTimes["/fraud/analyze"],
		"Fraud analysis endpoint should respond within %dms, took %dms", expectedResponseTimes["/fraud/analyze"], duration)
	assert.Equal(suite.T(), http.StatusOK, w.Code)

	// Test admin analytics endpoint
	start = time.Now()
	w = suite.makeRequest("GET", "/admin/analytics", nil, headers)
	duration = time.Since(start).Milliseconds()
	// This might return 403 if user doesn't have admin permissions, but we still check response time
	if w.Code == http.StatusOK {
		assert.LessOrEqual(suite.T(), int(duration), expectedResponseTimes["admin/analytics"],
			"Admin analytics endpoint should respond within %dms, took %dms", expectedResponseTimes["admin/analytics"], duration)
	}
}

func (suite *IntegrationTestSuite) testConcurrentRequests() {
	suite.authenticateUser()
	suite.createAPIKey()

	const numGoroutines = 50
	const requestsPerGoroutine = 10

	var wg sync.WaitGroup
	var mu sync.Mutex
	var successfulRequests int
	var failedRequests int
	var totalResponseTime time.Duration

	headers := map[string]string{
		"Authorization": "Bearer " + suite.testUser.Token,
	}

	start := time.Now()

	for i := 0; i < numGoroutines; i++ {
		wg.Add(1)
		go func(goroutineID int) {
			defer wg.Done()

			for j := 0; j < requestsPerGoroutine; j++ {
				reqStart := time.Now()
				w := suite.makeRequest("GET", "/users/profile", nil, headers)
				reqDuration := time.Since(reqStart)

				mu.Lock()
				if w.Code == http.StatusOK {
					successfulRequests++
				} else {
					failedRequests++
				}
				totalResponseTime += reqDuration
				mu.Unlock()
			}
		}(i)
	}

	wg.Wait()
	totalDuration := time.Since(start)

	totalRequests := numGoroutines * requestsPerGoroutine
	successRate := float64(successfulRequests) / float64(totalRequests) * 100
	avgResponseTime := totalResponseTime / time.Duration(totalRequests)
	requestsPerSecond := float64(totalRequests) / totalDuration.Seconds()

	// Performance assertions
	assert.GreaterOrEqual(suite.T(), successRate, 95.0,
		"Success rate should be at least 95%%, got %.2f%%", successRate)
	assert.Less(suite.T(), avgResponseTime, 200*time.Millisecond,
		"Average response time should be under 200ms, got %v", avgResponseTime)
	assert.Greater(suite.T(), requestsPerSecond, 100.0,
		"Should handle at least 100 requests per second, got %.2f", requestsPerSecond)

	suite.T().Logf("Concurrent request test results:")
	suite.T().Logf("  Total requests: %d", totalRequests)
	suite.T().Logf("  Successful: %d (%.2f%%)", successfulRequests, successRate)
	suite.T().Logf("  Failed: %d", failedRequests)
	suite.T().Logf("  Average response time: %v", avgResponseTime)
	suite.T().Logf("  Requests per second: %.2f", requestsPerSecond)
	suite.T().Logf("  Total duration: %v", totalDuration)
}

func (suite *IntegrationTestSuite) testHighVolumeFraudAnalysis() {
	suite.createAPIKey()

	const numTransactions = 100
	const batchSize = 10

	apiHeaders := map[string]string{
		"Authorization": "Bearer " + suite.testAPIKey.Key,
	}

	// Prepare transactions
	var transactions []map[string]interface{}
	for i := 0; i < numTransactions; i++ {
		transactions = append(transactions, map[string]interface{}{
			"transaction_id": fmt.Sprintf("highvol_txn_%04d", i),
			"user_id":        suite.testUser.ID,
			"merchant_id":    "test-merchant-id",
			"amount":         100.00 + float64(i*10),
			"currency":       "USD",
			"description":    fmt.Sprintf("High volume test transaction %d", i),
			"metadata": map[string]interface{}{
				"batch_id":    "high_volume_test",
				"batch_index": i,
			},
		})
	}

	// Process in batches to simulate real-world usage
	start := time.Now()
	var successfulAnalyses int
	var failedAnalyses int

	for i := 0; i < len(transactions); i += batchSize {
		end := i + batchSize
		if end > len(transactions) {
			end = len(transactions)
		}

		batch := transactions[i:end]
		var wg sync.WaitGroup

		for _, transaction := range batch {
			wg.Add(1)
			go func(tx map[string]interface{}) {
				defer wg.Done()

				w := suite.makeRequest("POST", "/fraud/analyze", tx, apiHeaders)
				if w.Code == http.StatusOK {
					successfulAnalyses++
				} else {
					failedAnalyses++
				}
			}(transaction)
		}

		wg.Wait()
	}

	totalDuration := time.Since(start)
	transactionsPerSecond := float64(numTransactions) / totalDuration.Seconds()
	successRate := float64(successfulAnalyses) / float64(numTransactions) * 100

	// Performance assertions
	assert.GreaterOrEqual(suite.T(), successRate, 95.0,
		"Fraud analysis success rate should be at least 95%%, got %.2f%%", successRate)
	assert.Greater(suite.T(), transactionsPerSecond, 5.0,
		"Should handle at least 5 fraud analyses per second, got %.2f", transactionsPerSecond)

	suite.T().Logf("High volume fraud analysis test results:")
	suite.T().Logf("  Total transactions: %d", numTransactions)
	suite.T().Logf("  Successful analyses: %d (%.2f%%)", successfulAnalyses, successRate)
	suite.T().Logf("  Failed analyses: %d", failedAnalyses)
	suite.T().Logf("  Transactions per second: %.2f", transactionsPerSecond)
	suite.T().Logf("  Total duration: %v", totalDuration)
}

func (suite *IntegrationTestSuite) testMemoryUsage() {
	suite.authenticateUser()

	// This is a basic memory usage test - in a real environment you'd use more sophisticated tools
	var initialMemory runtime.MemStats
	runtime.GC()
	runtime.ReadMemStats(&initialMemory)

	// Perform a series of operations that should consume memory
	headers := map[string]string{
		"Authorization": "Bearer " + suite.testUser.Token,
	}

	const numOperations = 1000
	for i := 0; i < numOperations; i++ {
		// Create API key
		keyData := map[string]interface{}{
			"name":        fmt.Sprintf("Memory test key %d", i),
			"description": "Key for memory testing",
			"permissions": []string{"read"},
		}

		w := suite.makeRequest("POST", "/api/keys", keyData, headers)
		if w.Code != http.StatusCreated {
			continue
		}

		var response map[string]interface{}
		err := json.Unmarshal(w.Body.Bytes(), &response)
		if err != nil {
			continue
		}

		keyID := response["data"].(map[string]interface{})["id"].(string)

		// Get key details
		suite.makeRequest("GET", "/api/keys/"+keyID, nil, headers)

		// Delete key
		suite.makeRequest("DELETE", "/api/keys/"+keyID, nil, headers)
	}

	var finalMemory runtime.MemStats
	runtime.GC()
	runtime.ReadMemStats(&finalMemory)

	memoryIncrease := finalMemory.Alloc - initialMemory.Alloc
	memoryIncreasePerOperation := float64(memoryIncrease) / float64(numOperations)

	// Memory should not increase dramatically (allowing for some GC variance)
	assert.Less(suite.T(), memoryIncreasePerOperation, 1024.0,
		"Memory increase per operation should be less than 1KB, got %.2f bytes", memoryIncreasePerOperation)

	suite.T().Logf("Memory usage test results:")
	suite.T().Logf("  Initial memory: %d bytes", initialMemory.Alloc)
	suite.T().Logf("  Final memory: %d bytes", finalMemory.Alloc)
	suite.T().Logf("  Memory increase: %d bytes", memoryIncrease)
	suite.T().Logf("  Memory increase per operation: %.2f bytes", memoryIncreasePerOperation)
}

func (suite *IntegrationTestSuite) testDatabasePerformance() {
	suite.createAPIKey()

	apiHeaders := map[string]string{
		"Authorization": "Bearer " + suite.testAPIKey.Key,
	}

	// Test database performance under load
	const numTransactions = 100
	var totalDBTime time.Duration
	var successfulTransactions int

	start := time.Now()

	for i := 0; i < numTransactions; i++ {
		transaction := map[string]interface{}{
			"transaction_id":      fmt.Sprintf("db_perf_txn_%03d", i),
			"user_id":             suite.testUser.ID,
			"merchant_id":         "test-merchant-id",
			"amount":              100.00 + float64(i),
			"currency":            "USD",
			"description":         fmt.Sprintf("Database performance test %d", i),
			"request_ai_analysis": true,
		}

		reqStart := time.Now()
		w := suite.makeRequest("POST", "/fraud/analyze", transaction, apiHeaders)
		reqDuration := time.Since(reqStart)

		if w.Code == http.StatusOK {
			successfulTransactions++
			totalDBTime += reqDuration
		}
	}

	totalDuration := time.Since(start)
	avgDBTime := totalDBTime / time.Duration(successfulTransactions)
	transactionsPerSecond := float64(successfulTransactions) / totalDuration.Seconds()

	// Database performance assertions
	assert.Less(suite.T(), avgDBTime, 300*time.Millisecond,
		"Average database operation time should be under 300ms, got %v", avgDBTime)
	assert.Greater(suite.T(), transactionsPerSecond, 3.0,
		"Should handle at least 3 transactions per second with database writes, got %.2f", transactionsPerSecond)

	suite.T().Logf("Database performance test results:")
	suite.T().Logf("  Total transactions: %d", numTransactions)
	suite.T().Logf("  Successful: %d", successfulTransactions)
	suite.T().Logf("  Average DB time: %v", avgDBTime)
	suite.T().Logf("  Transactions per second: %.2f", transactionsPerSecond)
	suite.T().Logf("  Total duration: %v", totalDuration)
}

func (suite *IntegrationTestSuite) testRateLimitingPerformance() {
	suite.createAPIKey()

	// Test that rate limiting doesn't significantly impact performance
	const numRequests = 200
	apiHeaders := map[string]string{
		"Authorization": "Bearer " + suite.testAPIKey.Key,
	}

	start := time.Now()
	var rateLimitedRequests int
	var normalRequests int

	for i := 0; i < numRequests; i++ {
		w := suite.makeRequest("GET", "/users/profile", nil, apiHeaders)
		if w.Code == http.StatusTooManyRequests {
			rateLimitedRequests++
		} else if w.Code == http.StatusOK {
			normalRequests++
		}

		// Small delay to avoid overwhelming the system
		time.Sleep(1 * time.Millisecond)
	}

	totalDuration := time.Since(start)
	requestsPerSecond := float64(numRequests) / totalDuration.Seconds()

	// Performance assertions with rate limiting
	assert.Greater(suite.T(), requestsPerSecond, 50.0,
		"Should handle at least 50 requests per second even with rate limiting, got %.2f", requestsPerSecond)
	assert.Greater(suite.T(), float64(normalRequests)/float64(numRequests), 0.8,
		"At least 80%% of requests should succeed, got %.2f%%", float64(normalRequests)/float64(numRequests)*100)

	suite.T().Logf("Rate limiting performance test results:")
	suite.T().Logf("  Total requests: %d", numRequests)
	suite.T().Logf("  Normal requests: %d", normalRequests)
	suite.T().Logf("  Rate limited requests: %d", rateLimitedRequests)
	suite.T().Logf("  Requests per second: %.2f", requestsPerSecond)
	suite.T().Logf("  Total duration: %v", totalDuration)
}

func (suite *IntegrationTestSuite) TestLoadAndStress() {
	suite.Run("Load Test - Moderate Load", func() {
		suite.testModerateLoad()
	})

	suite.Run("Stress Test - High Load", func() {
		suite.testHighLoad()
	})

	suite.Run("Spike Test - Sudden Load", func() {
		suite.testSuddenLoadSpike()
	})
}

func (suite *IntegrationTestSuite) testModerateLoad() {
	suite.authenticateUser()
	suite.createAPIKey()

	const duration = 30 * time.Second
	const targetQPS = 50

	headers := map[string]string{
		"Authorization": "Bearer " + suite.testUser.Token,
	}

	var (
		totalRequests      int
		successfulRequests int
		failedRequests     int
		mu                 sync.Mutex
	)

	ctx, cancel := context.WithTimeout(context.Background(), duration)
	defer cancel()

	requestTicker := time.NewTicker(time.Second / time.Duration(targetQPS))
	defer requestTicker.Stop()

	start := time.Now()

	for {
		select {
		case <-ctx.Done():
			goto done
		case <-requestTicker.C:
			go func() {
				w := suite.makeRequest("GET", "/users/profile", nil, headers)

				mu.Lock()
				totalRequests++
				if w.Code == http.StatusOK {
					successfulRequests++
				} else {
					failedRequests++
				}
				mu.Unlock()
			}()
		}
	}

done:
	// Wait for all requests to complete
	time.Sleep(2 * time.Second)

	actualDuration := time.Since(start)
	actualQPS := float64(totalRequests) / actualDuration.Seconds()
	successRate := float64(successfulRequests) / float64(totalRequests) * 100

	assert.GreaterOrEqual(suite.T(), actualQPS, float64(targetQPS)*0.8,
		"Should achieve at least 80%% of target QPS, target: %d, actual: %.2f", targetQPS, actualQPS)
	assert.GreaterOrEqual(suite.T(), successRate, 95.0,
		"Success rate should be at least 95%%, got %.2f%%", successRate)

	suite.T().Logf("Moderate load test results:")
	suite.T().Logf("  Duration: %v", actualDuration)
	suite.T().Logf("  Target QPS: %d", targetQPS)
	suite.T().Logf("  Actual QPS: %.2f", actualQPS)
	suite.T().Logf("  Total requests: %d", totalRequests)
	suite.T().Logf("  Successful: %d (%.2f%%)", successfulRequests, successRate)
	suite.T().Logf("  Failed: %d", failedRequests)
}

func (suite *IntegrationTestSuite) testHighLoad() {
	suite.createAPIKey()

	const duration = 60 * time.Second
	const targetQPS = 100

	apiHeaders := map[string]string{
		"Authorization": "Bearer " + suite.testAPIKey.Key,
	}

	var (
		totalRequests      int
		successfulRequests int
		failedRequests     int
		mu                 sync.Mutex
	)

	ctx, cancel := context.WithTimeout(context.Background(), duration)
	defer cancel()

	requestTicker := time.NewTicker(time.Second / time.Duration(targetQPS))
	defer requestTicker.Stop()

	start := time.Now()

	for {
		select {
		case <-ctx.Done():
			goto done
		case <-requestTicker.C:
			go func() {
				transaction := map[string]interface{}{
					"transaction_id": fmt.Sprintf("stress_txn_%d", totalRequests),
					"user_id":        suite.testUser.ID,
					"merchant_id":    "test-merchant-id",
					"amount":         100.00,
					"currency":       "USD",
					"description":    "Stress test transaction",
				}

				w := suite.makeRequest("POST", "/fraud/analyze", transaction, apiHeaders)

				mu.Lock()
				totalRequests++
				if w.Code == http.StatusOK {
					successfulRequests++
				} else {
					failedRequests++
				}
				mu.Unlock()
			}()
		}
	}

done:
	// Wait for all requests to complete
	time.Sleep(5 * time.Second)

	actualDuration := time.Since(start)
	actualQPS := float64(totalRequests) / actualDuration.Seconds()
	successRate := float64(successfulRequests) / float64(totalRequests) * 100

	assert.GreaterOrEqual(suite.T(), actualQPS, float64(targetQPS)*0.6,
		"Should achieve at least 60%% of target QPS under high load, target: %d, actual: %.2f", targetQPS, actualQPS)
	assert.GreaterOrEqual(suite.T(), successRate, 90.0,
		"Success rate should be at least 90%% under high load, got %.2f%%", successRate)

	suite.T().Logf("High load test results:")
	suite.T().Logf("  Duration: %v", actualDuration)
	suite.T().Logf("  Target QPS: %d", targetQPS)
	suite.T().Logf("  Actual QPS: %.2f", actualQPS)
	suite.T().Logf("  Total requests: %d", totalRequests)
	suite.T().Logf("  Successful: %d (%.2f%%)", successfulRequests, successRate)
	suite.T().Logf("  Failed: %d", failedRequests)
}

func (suite *IntegrationTestSuite) testSuddenLoadSpike() {
	suite.createAPIKey()

	// Test system's ability to handle sudden load spikes
	const normalQPS = 10
	const spikeQPS = 200
	const normalDuration = 10 * time.Second
	const spikeDuration = 5 * time.Second

	apiHeaders := map[string]string{
		"Authorization": "Bearer " + suite.testAPIKey.Key,
	}

	var (
		totalRequests      int
		successfulRequests int
		failedRequests     int
		mu                 sync.Mutex
	)

	ctx, cancel := context.WithTimeout(context.Background(), normalDuration+spikeDuration)
	defer cancel()

	// Normal load phase
	normalTicker := time.NewTicker(time.Second / time.Duration(normalQPS))
	defer normalTicker.Stop()

	start := time.Now()
	normalStart := start

	for {
		select {
		case <-ctx.Done():
			goto done
		case <-normalTicker.C:
			if time.Since(normalStart) < normalDuration {
				// Normal load
				go func() {
					w := suite.makeRequest("GET", "/users/profile", nil, apiHeaders)

					mu.Lock()
					totalRequests++
					if w.Code == http.StatusOK {
						successfulRequests++
					} else {
						failedRequests++
					}
					mu.Unlock()
				}()
			} else {
				// Spike load
				for i := 0; i < spikeQPS/normalQPS; i++ {
					go func() {
						w := suite.makeRequest("GET", "/users/profile", nil, apiHeaders)

						mu.Lock()
						totalRequests++
						if w.Code == http.StatusOK {
							successfulRequests++
						} else {
							failedRequests++
						}
						mu.Unlock()
					}()
				}
			}
		}
	}

done:
	// Wait for all requests to complete
	time.Sleep(3 * time.Second)

	actualDuration := time.Since(start)
	overallQPS := float64(totalRequests) / actualDuration.Seconds()
	successRate := float64(successfulRequests) / float64(totalRequests) * 100

	assert.Greater(suite.T(), overallQPS, float64(normalQPS),
		"Overall QPS should be higher than normal load, got %.2f", overallQPS)
	assert.GreaterOrEqual(suite.T(), successRate, 85.0,
		"Success rate should be at least 85%% during spike test, got %.2f%%", successRate)

	suite.T().Logf("Spike load test results:")
	suite.T().Logf("  Duration: %v", actualDuration)
	suite.T().Logf("  Normal QPS: %d for %v", normalQPS, normalDuration)
	suite.T().Logf("  Spike QPS: %d for %v", spikeQPS, spikeDuration)
	suite.T().Logf("  Overall QPS: %.2f", overallQPS)
	suite.T().Logf("  Total requests: %d", totalRequests)
	suite.T().Logf("  Successful: %d (%.2f%%)", successfulRequests, successRate)
	suite.T().Logf("  Failed: %d", failedRequests)
}