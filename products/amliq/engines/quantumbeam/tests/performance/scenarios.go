package performance

import (
	"time"
)

// GetDefaultScenarios returns a set of default load test scenarios for QuantumBeam
func GetDefaultScenarios() []LoadTestScenario {
	return []LoadTestScenario{
		{
			Name:        "Health Check",
			Description: "Basic health check endpoint to verify system availability",
			Weight:      10,
			Requests: []RequestDefinition{
				{
					Method:  "GET",
					Path:    "/health",
					Headers: map[string]string{"Content-Type": "application/json"},
					Timeout: 5 * time.Second,
					Weight:  100,
					Assertions: []Assertion{
						{
							Type:     "status_code",
							Value:    200,
							Operator: "equals",
						},
						{
							Type:     "response_time",
							Value:    100,
							Operator: "less_than",
						},
					},
				},
			},
			ExpectedResults: ExpectedResults{
				ResponseTime: 50 * time.Millisecond,
				SuccessRate:  1.0,
				Throughput:   100,
				ErrorRate:    0.0,
			},
			Timeout: 5 * time.Second,
			RetryPolicy: RetryPolicy{
				MaxAttempts: 3,
				BackoffType: "exponential",
				BaseDelay:   100 * time.Millisecond,
				MaxDelay:    1 * time.Second,
			},
		},
		{
			Name:        "User Authentication",
			Description: "User login and authentication endpoints",
			Weight:      20,
			Requests: []RequestDefinition{
				{
					Method:  "POST",
					Path:    "/api/v1/auth/login",
					Headers: map[string]string{"Content-Type": "application/json"},
					Body: map[string]interface{}{
						"email":    "test@example.com",
						"password": "testpassword123",
					},
					Timeout: 10 * time.Second,
					Weight:  50,
					Assertions: []Assertion{
						{
							Type:     "status_code",
							Value:    200,
							Operator: "equals",
						},
						{
							Type:     "response_time",
							Value:    500,
							Operator: "less_than",
						},
						{
							Type:     "body",
							Value:    "token",
							Operator: "contains",
						},
					},
				},
			},
			ExpectedResults: ExpectedResults{
				ResponseTime: 300 * time.Millisecond,
				SuccessRate:  0.95,
				Throughput:   50,
				ErrorRate:    0.05,
			},
			Timeout: 10 * time.Second,
			RetryPolicy: RetryPolicy{
				MaxAttempts: 3,
				BackoffType: "exponential",
				BaseDelay:   200 * time.Millisecond,
				MaxDelay:    2 * time.Second,
			},
		},
		{
			Name:        "Transaction Analysis",
			Description: "AI-powered transaction fraud analysis",
			Weight:      40,
			Requests: []RequestDefinition{
				{
					Method: "POST",
					Path:   "/api/v1/transactions/analyze",
					Headers: map[string]string{
						"Content-Type":  "application/json",
						"Authorization": "Bearer test-token",
					},
					Body: map[string]interface{}{
						"transaction_id": "txn_test_123456",
						"amount":         100.50,
						"currency":       "USD",
						"merchant_id":    "merchant_123",
						"user_id":        "user_456",
						"payment_method": "credit_card",
						"card_last4":     "1234",
						"description":    "Test transaction",
						"timestamp":      "2023-10-15T10:30:00Z",
						"location": map[string]interface{}{
							"ip_address": "192.168.1.100",
							"country":    "US",
							"city":       "New York",
						},
						"device": map[string]interface{}{
							"user_agent": "Mozilla/5.0 (Test Browser)",
							"device_id":  "device_test_789",
						},
					},
					Timeout: 30 * time.Second,
					Weight:  100,
					Assertions: []Assertion{
						{
							Type:     "status_code",
							Value:    200,
							Operator: "equals",
						},
						{
							Type:     "response_time",
							Value:    2000,
							Operator: "less_than",
						},
						{
							Type:     "body",
							Value:    "fraud_score",
							Operator: "contains",
						},
						{
							Type:     "body",
							Value:    "risk_level",
							Operator: "contains",
						},
					},
				},
			},
			ExpectedResults: ExpectedResults{
				ResponseTime: 1500 * time.Millisecond,
				SuccessRate:  0.98,
				Throughput:   20,
				ErrorRate:    0.02,
				MemoryUsage:  50 * 1024 * 1024, // 50MB
				CPUUsage:     30.0,
			},
			Timeout: 30 * time.Second,
			RetryPolicy: RetryPolicy{
				MaxAttempts: 2,
				BackoffType: "fixed",
				BaseDelay:   500 * time.Millisecond,
				MaxDelay:    1 * time.Second,
			},
		},
		{
			Name:        "Transaction History",
			Description: "Retrieve transaction history for users",
			Weight:      15,
			Requests: []RequestDefinition{
				{
					Method: "GET",
					Path:   "/api/v1/transactions/history",
					Headers: map[string]string{
						"Content-Type":  "application/json",
						"Authorization": "Bearer test-token",
					},
					QueryParams: map[string]string{
						"limit":      "50",
						"offset":     "0",
						"start_date": "2023-10-01",
						"end_date":   "2023-10-31",
					},
					Timeout: 15 * time.Second,
					Weight:  80,
					Assertions: []Assertion{
						{
							Type:     "status_code",
							Value:    200,
							Operator: "equals",
						},
						{
							Type:     "response_time",
							Value:    1000,
							Operator: "less_than",
						},
						{
							Type:     "body",
							Value:    "transactions",
							Operator: "contains",
						},
					},
				},
			},
			ExpectedResults: ExpectedResults{
				ResponseTime: 500 * time.Millisecond,
				SuccessRate:  0.99,
				Throughput:   40,
				ErrorRate:    0.01,
			},
			Timeout: 15 * time.Second,
			RetryPolicy: RetryPolicy{
				MaxAttempts: 3,
				BackoffType: "linear",
				BaseDelay:   100 * time.Millisecond,
				MaxDelay:    500 * time.Millisecond,
			},
		},
		{
			Name:        "User Profile",
			Description: "User profile management endpoints",
			Weight:      10,
			Requests: []RequestDefinition{
				{
					Method: "GET",
					Path:   "/api/v1/users/profile",
					Headers: map[string]string{
						"Content-Type":  "application/json",
						"Authorization": "Bearer test-token",
					},
					Timeout: 10 * time.Second,
					Weight:  60,
					Assertions: []Assertion{
						{
							Type:     "status_code",
							Value:    200,
							Operator: "equals",
						},
						{
							Type:     "response_time",
							Value:    300,
							Operator: "less_than",
						},
						{
							Type:     "body",
							Value:    "email",
							Operator: "contains",
						},
					},
				},
				{
					Method: "PUT",
					Path:   "/api/v1/users/profile",
					Headers: map[string]string{
						"Content-Type":  "application/json",
						"Authorization": "Bearer test-token",
					},
					Body: map[string]interface{}{
						"first_name": "Test",
						"last_name":  "User",
						"phone":      "+1234567890",
					},
					Timeout: 10 * time.Second,
					Weight:  40,
					Assertions: []Assertion{
						{
							Type:     "status_code",
							Value:    200,
							Operator: "equals",
						},
						{
							Type:     "response_time",
							Value:    500,
							Operator: "less_than",
						},
					},
				},
			},
			ExpectedResults: ExpectedResults{
				ResponseTime: 200 * time.Millisecond,
				SuccessRate:  0.98,
				Throughput:   30,
				ErrorRate:    0.02,
			},
			Timeout: 10 * time.Second,
			RetryPolicy: RetryPolicy{
				MaxAttempts: 3,
				BackoffType: "exponential",
				BaseDelay:   150 * time.Millisecond,
				MaxDelay:    1 * time.Second,
			},
		},
		{
			Name:        "API Key Management",
			Description: "API key generation and management",
			Weight:      5,
			Requests: []RequestDefinition{
				{
					Method: "POST",
					Path:   "/api/v1/api-keys",
					Headers: map[string]string{
						"Content-Type":  "application/json",
						"Authorization": "Bearer test-token",
					},
					Body: map[string]interface{}{
						"name":        "Test API Key",
						"description": "API key for performance testing",
						"permissions": []string{"read", "write"},
						"expires_at":  "2024-10-15T10:30:00Z",
					},
					Timeout: 10 * time.Second,
					Weight:  50,
					Assertions: []Assertion{
						{
							Type:     "status_code",
							Value:    201,
							Operator: "equals",
						},
						{
							Type:     "response_time",
							Value:    1000,
							Operator: "less_than",
						},
						{
							Type:     "body",
							Value:    "api_key",
							Operator: "contains",
						},
					},
				},
				{
					Method: "GET",
					Path:   "/api/v1/api-keys",
					Headers: map[string]string{
						"Content-Type":  "application/json",
						"Authorization": "Bearer test-token",
					},
					Timeout: 10 * time.Second,
					Weight:  50,
					Assertions: []Assertion{
						{
							Type:     "status_code",
							Value:    200,
							Operator: "equals",
						},
						{
							Type:     "response_time",
							Value:    500,
							Operator: "less_than",
						},
					},
				},
			},
			ExpectedResults: ExpectedResults{
				ResponseTime: 400 * time.Millisecond,
				SuccessRate:  0.95,
				Throughput:   10,
				ErrorRate:    0.05,
			},
			Timeout: 10 * time.Second,
			RetryPolicy: RetryPolicy{
				MaxAttempts: 3,
				BackoffType: "fixed",
				BaseDelay:   200 * time.Millisecond,
				MaxDelay:    1 * time.Second,
			},
		},
	}
}

// GetStressTestScenarios returns scenarios for stress testing
func GetStressTestScenarios() []LoadTestScenario {
	return []LoadTestScenario{
		{
			Name:        "High Volume Transaction Analysis",
			Description: "Stress test for transaction analysis under high load",
			Weight:      60,
			Requests: []RequestDefinition{
				{
					Method: "POST",
					Path:   "/api/v1/transactions/analyze",
					Headers: map[string]string{
						"Content-Type":  "application/json",
						"Authorization": "Bearer test-token",
					},
					Body: map[string]interface{}{
						"transaction_id": "txn_stress_123456",
						"amount":         1000.00,
						"currency":       "USD",
						"merchant_id":    "merchant_stress",
						"user_id":        "user_stress",
						"payment_method": "credit_card",
						"description":    "Stress test transaction",
						"timestamp":      "2023-10-15T10:30:00Z",
					},
					Timeout: 60 * time.Second,
					Weight:  100,
					Assertions: []Assertion{
						{
							Type:     "status_code",
							Value:    200,
							Operator: "equals",
						},
						{
							Type:     "response_time",
							Value:    5000,
							Operator: "less_than",
						},
					},
				},
			},
			ExpectedResults: ExpectedResults{
				ResponseTime: 3000 * time.Millisecond,
				SuccessRate:  0.90,
				Throughput:   10,
				ErrorRate:    0.10,
				MemoryUsage:  100 * 1024 * 1024, // 100MB
				CPUUsage:     70.0,
			},
			Timeout: 60 * time.Second,
			RetryPolicy: RetryPolicy{
				MaxAttempts: 1,
				BackoffType: "fixed",
				BaseDelay:   1 * time.Second,
				MaxDelay:    1 * time.Second,
			},
		},
		{
			Name:        "Concurrent User Sessions",
			Description: "Multiple users accessing the system simultaneously",
			Weight:      40,
			Requests: []RequestDefinition{
				{
					Method:  "POST",
					Path:    "/api/v1/auth/login",
					Headers: map[string]string{"Content-Type": "application/json"},
					Body: map[string]interface{}{
						"email":    "stress@example.com",
						"password": "stresspassword123",
					},
					Timeout: 30 * time.Second,
					Weight:  30,
					Assertions: []Assertion{
						{
							Type:     "status_code",
							Value:    200,
							Operator: "equals",
						},
						{
							Type:     "response_time",
							Value:    2000,
							Operator: "less_than",
						},
					},
				},
				{
					Method: "GET",
					Path:   "/api/v1/transactions/history",
					Headers: map[string]string{
						"Content-Type":  "application/json",
						"Authorization": "Bearer stress-token",
					},
					QueryParams: map[string]string{
						"limit":  "100",
						"offset": "0",
					},
					Timeout: 30 * time.Second,
					Weight:  70,
					Assertions: []Assertion{
						{
							Type:     "status_code",
							Value:    200,
							Operator: "equals",
						},
						{
							Type:     "response_time",
							Value:    3000,
							Operator: "less_than",
						},
					},
				},
			},
			ExpectedResults: ExpectedResults{
				ResponseTime: 1500 * time.Millisecond,
				SuccessRate:  0.85,
				Throughput:   25,
				ErrorRate:    0.15,
				MemoryUsage:  150 * 1024 * 1024, // 150MB
				CPUUsage:     80.0,
			},
			Timeout: 30 * time.Second,
			RetryPolicy: RetryPolicy{
				MaxAttempts: 2,
				BackoffType: "exponential",
				BaseDelay:   500 * time.Millisecond,
				MaxDelay:    3 * time.Second,
			},
		},
	}
}

// GetSpikeTestScenarios returns scenarios for spike testing
func GetSpikeTestScenarios() []LoadTestScenario {
	return []LoadTestScenario{
		{
			Name:        "Spike Load Transaction Analysis",
			Description: "Sudden spike in transaction analysis requests",
			Weight:      80,
			Requests: []RequestDefinition{
				{
					Method: "POST",
					Path:   "/api/v1/transactions/analyze",
					Headers: map[string]string{
						"Content-Type":  "application/json",
						"Authorization": "Bearer spike-token",
					},
					Body: map[string]interface{}{
						"transaction_id": "txn_spike_123456",
						"amount":         500.00,
						"currency":       "USD",
						"merchant_id":    "merchant_spike",
						"user_id":        "user_spike",
						"payment_method": "credit_card",
						"description":    "Spike test transaction",
						"timestamp":      "2023-10-15T10:30:00Z",
					},
					Timeout: 45 * time.Second,
					Weight:  100,
					Assertions: []Assertion{
						{
							Type:     "status_code",
							Value:    200,
							Operator: "equals",
						},
						{
							Type:     "response_time",
							Value:    10000,
							Operator: "less_than",
						},
					},
				},
			},
			ExpectedResults: ExpectedResults{
				ResponseTime: 5000 * time.Millisecond,
				SuccessRate:  0.80,
				Throughput:   50,
				ErrorRate:    0.20,
				MemoryUsage:  200 * 1024 * 1024, // 200MB
				CPUUsage:     90.0,
			},
			Timeout: 45 * time.Second,
			RetryPolicy: RetryPolicy{
				MaxAttempts: 1,
				BackoffType: "fixed",
				BaseDelay:   2 * time.Second,
				MaxDelay:    2 * time.Second,
			},
		},
	}
}

// GetEnduranceTestScenarios returns scenarios for endurance testing
func GetEnduranceTestScenarios() []LoadTestScenario {
	return []LoadTestScenario{
		{
			Name:        "Sustained Load Test",
			Description: "Sustained normal load over extended period",
			Weight:      50,
			Requests: []RequestDefinition{
				{
					Method: "POST",
					Path:   "/api/v1/transactions/analyze",
					Headers: map[string]string{
						"Content-Type":  "application/json",
						"Authorization": "Bearer endurance-token",
					},
					Body: map[string]interface{}{
						"transaction_id": "txn_endurance_123456",
						"amount":         250.00,
						"currency":       "USD",
						"merchant_id":    "merchant_endurance",
						"user_id":        "user_endurance",
						"payment_method": "credit_card",
						"description":    "Endurance test transaction",
						"timestamp":      "2023-10-15T10:30:00Z",
					},
					Timeout: 20 * time.Second,
					Weight:  70,
					Assertions: []Assertion{
						{
							Type:     "status_code",
							Value:    200,
							Operator: "equals",
						},
						{
							Type:     "response_time",
							Value:    3000,
							Operator: "less_than",
						},
					},
				},
				{
					Method: "GET",
					Path:   "/api/v1/users/profile",
					Headers: map[string]string{
						"Content-Type":  "application/json",
						"Authorization": "Bearer endurance-token",
					},
					Timeout: 15 * time.Second,
					Weight:  30,
					Assertions: []Assertion{
						{
							Type:     "status_code",
							Value:    200,
							Operator: "equals",
						},
						{
							Type:     "response_time",
							Value:    1000,
							Operator: "less_than",
						},
					},
				},
			},
			ExpectedResults: ExpectedResults{
				ResponseTime: 2000 * time.Millisecond,
				SuccessRate:  0.99,
				Throughput:   15,
				ErrorRate:    0.01,
				MemoryUsage:  75 * 1024 * 1024, // 75MB
				CPUUsage:     40.0,
			},
			Timeout: 20 * time.Second,
			RetryPolicy: RetryPolicy{
				MaxAttempts: 3,
				BackoffType: "exponential",
				BaseDelay:   300 * time.Millisecond,
				MaxDelay:    2 * time.Second,
			},
		},
	}
}

// GetCapacityTestScenarios returns scenarios for capacity testing
func GetCapacityTestScenarios() []LoadTestScenario {
	return []LoadTestScenario{
		{
			Name:        "Maximum Capacity Test",
			Description: "Test system at maximum capacity",
			Weight:      100,
			Requests: []RequestDefinition{
				{
					Method: "POST",
					Path:   "/api/v1/transactions/analyze",
					Headers: map[string]string{
						"Content-Type":  "application/json",
						"Authorization": "Bearer capacity-token",
					},
					Body: map[string]interface{}{
						"transaction_id": "txn_capacity_123456",
						"amount":         750.00,
						"currency":       "USD",
						"merchant_id":    "merchant_capacity",
						"user_id":        "user_capacity",
						"payment_method": "credit_card",
						"description":    "Capacity test transaction",
						"timestamp":      "2023-10-15T10:30:00Z",
					},
					Timeout: 120 * time.Second,
					Weight:  100,
					Assertions: []Assertion{
						{
							Type:     "status_code",
							Value:    200,
							Operator: "equals",
						},
						{
							Type:     "response_time",
							Value:    30000,
							Operator: "less_than",
						},
					},
				},
			},
			ExpectedResults: ExpectedResults{
				ResponseTime: 15000 * time.Millisecond,
				SuccessRate:  0.70,
				Throughput:   5,
				ErrorRate:    0.30,
				MemoryUsage:  500 * 1024 * 1024, // 500MB
				CPUUsage:     95.0,
			},
			Timeout: 120 * time.Second,
			RetryPolicy: RetryPolicy{
				MaxAttempts: 1,
				BackoffType: "fixed",
				BaseDelay:   5 * time.Second,
				MaxDelay:    5 * time.Second,
			},
		},
	}
}

// GetVolumeTestScenarios returns scenarios for volume testing
func GetVolumeTestScenarios() []LoadTestScenario {
	return []LoadTestScenario{
		{
			Name:        "Large Data Volume Test",
			Description: "Test with large amounts of data",
			Weight:      30,
			Requests: []RequestDefinition{
				{
					Method: "GET",
					Path:   "/api/v1/transactions/history",
					Headers: map[string]string{
						"Content-Type":  "application/json",
						"Authorization": "Bearer volume-token",
					},
					QueryParams: map[string]string{
						"limit":      "1000",
						"offset":     "0",
						"start_date": "2023-01-01",
						"end_date":   "2023-12-31",
					},
					Timeout: 60 * time.Second,
					Weight:  100,
					Assertions: []Assertion{
						{
							Type:     "status_code",
							Value:    200,
							Operator: "equals",
						},
						{
							Type:     "response_time",
							Value:    10000,
							Operator: "less_than",
						},
					},
				},
			},
			ExpectedResults: ExpectedResults{
				ResponseTime: 5000 * time.Millisecond,
				SuccessRate:  0.95,
				Throughput:   8,
				ErrorRate:    0.05,
				MemoryUsage:  300 * 1024 * 1024, // 300MB
				CPUUsage:     60.0,
			},
			Timeout: 60 * time.Second,
			RetryPolicy: RetryPolicy{
				MaxAttempts: 2,
				BackoffType: "linear",
				BaseDelay:   1 * time.Second,
				MaxDelay:    3 * time.Second,
			},
		},
	}
}
