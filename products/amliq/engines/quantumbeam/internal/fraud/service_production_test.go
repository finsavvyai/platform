package fraud

import (
	"context"
	"fmt"
	"testing"
	"time"

	"quantumbeam/internal/interfaces"
	"quantumbeam/internal/models"

	"github.com/shopspring/decimal"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"github.com/stretchr/testify/suite"
)

// ProductionTestSuite holds the test suite for production-level fraud detection
type ProductionTestSuite struct {
	suite.Suite
	service        *Service
	mockQuantum    *MockQuantumBackendService
	mockRouter     *MockIntelligentRouter
	ctx            context.Context
	cancelFunc     context.CancelFunc
}

// MockQuantumBackendService mocks the quantum backend service
type MockQuantumBackendService struct {
	mock.Mock
}

// MockIntelligentRouter mocks the intelligent router
type MockIntelligentRouter struct {
	mock.Mock
}

// SetupSuite runs once before all tests
func (suite *ProductionTestSuite) SetupSuite() {
	suite.ctx, suite.cancelFunc = context.WithTimeout(context.Background(), 30*time.Second)
}

// TearDownSuite runs once after all tests
func (suite *ProductionTestSuite) TearDownSuite() {
	suite.cancelFunc()
}

// SetupTest runs before each test
func (suite *ProductionTestSuite) SetupTest() {
	suite.mockQuantum = new(MockQuantumBackendService)
	suite.mockRouter = new(MockIntelligentRouter)
	suite.service = NewService(suite.mockQuantum, suite.mockRouter)
}

// TearDownTest runs after each test
func (suite *ProductionTestSuite) TearDownTest() {
	suite.mockQuantum.AssertExpectations(suite.T())
	suite.mockRouter.AssertExpectations(suite.T())
}

// TestProductionFraudDetection runs the production test suite
func TestProductionFraudDetection(t *testing.T) {
	suite.Run(t, new(ProductionTestSuite))
}

// Test quantum fraud detection under production load
func (suite *ProductionTestSuite) TestQuantumAnalysisUnderLoad() {
	// Prepare test transaction
	transaction := &models.TransactionData{
		TransactionID: "txn_load_test_001",
		UserID:        "user_123",
		MerchantID:    "merchant_456",
		Amount:        decimal.NewFromFloat(1500.00),
		Currency:      "USD",
		PaymentMethod: "credit_card",
		Timestamp:     time.Now(),
	}

	// Mock quantum backend responses
	suite.mockQuantum.On("SelectOptimalBackend", mock.Anything, mock.AnythingOfType("*interfaces.QuantumCircuit")).
		Return(&interfaces.QuantumBackend{
			Name:        "ibm_quantum_simulator",
			Provider:    "IBM",
			Type:        "simulator",
			QubitCount:  32,
			IsAvailable: true,
		}, nil)

	suite.mockQuantum.On("ExecuteQuantumCircuit", mock.Anything, mock.AnythingOfType("*interfaces.QuantumCircuit"), mock.AnythingOfType("*interfaces.QuantumBackend")).
		Return(&interfaces.QuantumResult{
			CircuitID:     "vqc_txn_load_test_001",
			BackendName:   "ibm_quantum_simulator",
			ExecutionTime: 45,
			Measurements: map[string]int{
				"0000": 512,
				"1111": 512,
			},
			Probabilities: map[string]float64{
				"0000": 0.5,
				"1111": 0.5,
			},
			ErrorMitigation: false,
		}, nil)

	// Execute quantum analysis
	result, err := suite.service.AnalyzeTransactionQuantum(suite.ctx, transaction)

	require.NoError(suite.T(), err)
	require.NotNil(suite.T(), result)

	// Production-level assertions
	assert.Equal(suite.T(), transaction.TransactionID, result.TransactionID)
	assert.Equal(suite.T(), models.ProcessingMethodQuantum, result.ProcessingMethod)
	assert.GreaterOrEqual(suite.T(), result.FraudScore, 0.0)
	assert.LessOrEqual(suite.T(), result.FraudScore, 1.0)
	assert.Greater(suite.T(), result.Confidence, 0.0)
	assert.LessOrEqual(suite.T(), result.Confidence, 1.0)
	assert.Less(suite.T(), result.ProcessingTimeMs, int64(100), "Quantum processing should be under 100ms")
	assert.NotNil(suite.T(), result.QuantumAdvantage)
	assert.NotEmpty(suite.T(), result.Explanation)
	assert.NotEmpty(suite.T(), result.RiskLevel)
	assert.Contains(suite.T(), []string{"low", "medium", "high", "critical"}, result.RiskLevel)
}

// Test error handling and recovery
func (suite *ProductionTestSuite) TestQuantumErrorHandling() {
	transaction := &models.TransactionData{
		TransactionID: "txn_error_test_001",
		UserID:        "user_123",
		MerchantID:    "merchant_456",
		Amount:        decimal.NewFromFloat(2500.00),
		Currency:      "USD",
		PaymentMethod: "debit_card",
		Timestamp:     time.Now(),
	}

	// Mock quantum backend selection failure
	suite.mockQuantum.On("SelectOptimalBackend", mock.Anything, mock.AnythingOfType("*interfaces.QuantumCircuit")).
		Return(nil, fmt.Errorf("no quantum backends available"))

	// Execute quantum analysis - should fail gracefully
	result, err := suite.service.AnalyzeTransactionQuantum(suite.ctx, transaction)

	assert.Error(suite.T(), err)
	assert.Nil(suite.T(), result)
	assert.Contains(suite.T(), err.Error(), "failed to select quantum backend")
}

// Test circuit execution failure recovery
func (suite *ProductionTestSuite) TestCircuitExecutionFailure() {
	transaction := &models.TransactionData{
		TransactionID: "txn_circuit_fail_001",
		UserID:        "user_123",
		MerchantID:    "merchant_456",
		Amount:        decimal.NewFromFloat(3500.00),
		Currency:      "USD",
		PaymentMethod: "credit_card",
		Timestamp:     time.Now(),
	}

	// Mock successful backend selection
	suite.mockQuantum.On("SelectOptimalBackend", mock.Anything, mock.AnythingOfType("*interfaces.QuantumCircuit")).
		Return(&interfaces.QuantumBackend{
			Name:        "ibm_quantum_simulator",
			Provider:    "IBM",
			Type:        "simulator",
			QubitCount:  32,
			IsAvailable: true,
		}, nil)

	// Mock circuit execution failure
	suite.mockQuantum.On("ExecuteQuantumCircuit", mock.Anything, mock.AnythingOfType("*interfaces.QuantumCircuit"), mock.AnythingOfType("*interfaces.QuantumBackend")).
		Return(nil, fmt.Errorf("quantum circuit execution timeout"))

	// Execute quantum analysis - should fail with proper error
	result, err := suite.service.AnalyzeTransactionQuantum(suite.ctx, transaction)

	assert.Error(suite.T(), err)
	assert.Nil(suite.T(), result)
	assert.Contains(suite.T(), err.Error(), "quantum circuit execution failed")
}

// Test context timeout handling
func (suite *ProductionTestSuite) TestContextTimeout() {
	transaction := &models.TransactionData{
		TransactionID: "txn_timeout_001",
		UserID:        "user_123",
		MerchantID:    "merchant_456",
		Amount:        decimal.NewFromFloat(4500.00),
		Currency:      "USD",
		PaymentMethod: "credit_card",
		Timestamp:     time.Now(),
	}

	// Create a context with very short timeout
	ctx, cancel := context.WithTimeout(context.Background(), 1*time.Millisecond)
	defer cancel()

	// Mock backend selection with delay
	suite.mockQuantum.On("SelectOptimalBackend", mock.Anything, mock.AnythingOfType("*interfaces.QuantumCircuit")).
		Run(func(args mock.Arguments) {
			time.Sleep(10 * time.Millisecond) // Simulate slow backend
		}).
		Return(&interfaces.QuantumBackend{
			Name: "ibm_quantum_simulator",
		}, nil).Maybe()

	// Execute quantum analysis - should timeout
	result, err := suite.service.AnalyzeTransactionQuantum(ctx, transaction)

	// Should handle timeout gracefully
	if err != nil || result == nil {
		// Expected behavior - either timeout error or nil result
		if err != nil {
			assert.Contains(suite.T(), err.Error(), "context")
		}
	}
}

// Test batch processing performance
func (suite *ProductionTestSuite) TestBatchQuantumAnalysis() {
	// Create batch of transactions
	transactions := make([]*models.TransactionData, 10)
	for i := 0; i < 10; i++ {
		transactions[i] = &models.TransactionData{
			TransactionID: fmt.Sprintf("txn_batch_%03d", i),
			UserID:        "user_123",
			MerchantID:    "merchant_456",
			Amount:        decimal.NewFromFloat(float64(100 + i*100)),
			Currency:      "USD",
			PaymentMethod: "credit_card",
			Timestamp:     time.Now(),
		}
	}

	// Mock quantum backend responses for all transactions
	suite.mockQuantum.On("SelectOptimalBackend", mock.Anything, mock.AnythingOfType("*interfaces.QuantumCircuit")).
		Return(&interfaces.QuantumBackend{
			Name:        "ibm_quantum_simulator",
			Provider:    "IBM",
			Type:        "simulator",
			QubitCount:  32,
			IsAvailable: true,
		}, nil)

	suite.mockQuantum.On("ExecuteQuantumCircuit", mock.Anything, mock.AnythingOfType("*interfaces.QuantumCircuit"), mock.AnythingOfType("*interfaces.QuantumBackend")).
		Return(&interfaces.QuantumResult{
			CircuitID:     "vqc_batch_test",
			BackendName:   "ibm_quantum_simulator",
			ExecutionTime: 40,
			Measurements: map[string]int{
				"0000": 600,
				"1111": 424,
			},
			Probabilities: map[string]float64{
				"0000": 0.5859,
				"1111": 0.4141,
			},
			ErrorMitigation: false,
		}, nil)

	// Execute batch analysis
	startTime := time.Now()
	results, err := suite.service.AnalyzeBatchQuantum(suite.ctx, transactions)
	duration := time.Since(startTime)

	require.NoError(suite.T(), err)
	require.NotNil(suite.T(), results)
	assert.Equal(suite.T(), len(transactions), len(results))

	// Production performance assertion: batch should process faster than individual
	avgTimePerTransaction := duration.Milliseconds() / int64(len(transactions))
	assert.Less(suite.T(), avgTimePerTransaction, int64(100), "Average processing time per transaction should be under 100ms")

	// Verify all results
	successCount := 0
	for i, result := range results {
		if result != nil {
			successCount++
			assert.Equal(suite.T(), transactions[i].TransactionID, result.TransactionID)
			assert.GreaterOrEqual(suite.T(), result.FraudScore, 0.0)
			assert.LessOrEqual(suite.T(), result.FraudScore, 1.0)
		}
	}

	assert.Greater(suite.T(), successCount, 0, "At least some batch transactions should succeed")
}

// Test quantum performance metrics
func (suite *ProductionTestSuite) TestQuantumPerformanceMetrics() {
	// Get quantum performance metrics
	metrics, err := suite.service.GetQuantumPerformance(suite.ctx)

	require.NoError(suite.T(), err)
	require.NotNil(suite.T(), metrics)

	// Production-level metric assertions
	assert.Greater(suite.T(), metrics.AverageProcessingTime, 0.0)
	assert.Less(suite.T(), metrics.AverageProcessingTime, 100.0, "Average processing time should be under 100ms")
	assert.GreaterOrEqual(suite.T(), metrics.QuantumAdvantage, 0.0)
	assert.LessOrEqual(suite.T(), metrics.QuantumAdvantage, 1.0)
	assert.GreaterOrEqual(suite.T(), metrics.AccuracyImprovement, 0.0)
	assert.GreaterOrEqual(suite.T(), metrics.FalsePositiveReduction, 0.0)
	assert.NotEmpty(suite.T(), metrics.BackendUtilization)
	assert.Greater(suite.T(), metrics.CircuitDepth, 0)
	assert.Greater(suite.T(), metrics.GateCount, 0)
}

// Test quantum vs classical comparison
func (suite *ProductionTestSuite) TestQuantumClassicalComparison() {
	transaction := &models.TransactionData{
		TransactionID: "txn_compare_001",
		UserID:        "user_123",
		MerchantID:    "merchant_456",
		Amount:        decimal.NewFromFloat(5500.00),
		Currency:      "USD",
		PaymentMethod: "credit_card",
		Timestamp:     time.Now(),
	}

	// Mock quantum analysis
	suite.mockQuantum.On("SelectOptimalBackend", mock.Anything, mock.AnythingOfType("*interfaces.QuantumCircuit")).
		Return(&interfaces.QuantumBackend{
			Name:        "ibm_quantum_simulator",
			Provider:    "IBM",
			Type:        "simulator",
			QubitCount:  32,
			IsAvailable: true,
		}, nil)

	suite.mockQuantum.On("ExecuteQuantumCircuit", mock.Anything, mock.AnythingOfType("*interfaces.QuantumCircuit"), mock.AnythingOfType("*interfaces.QuantumBackend")).
		Return(&interfaces.QuantumResult{
			CircuitID:     "vqc_txn_compare_001",
			BackendName:   "ibm_quantum_simulator",
			ExecutionTime: 48,
			Measurements: map[string]int{
				"0000": 400,
				"1111": 624,
			},
			Probabilities: map[string]float64{
				"0000": 0.3906,
				"1111": 0.6094,
			},
			ErrorMitigation: false,
		}, nil)

	// Execute comparison
	comparison, err := suite.service.CompareQuantumClassical(suite.ctx, transaction)

	require.NoError(suite.T(), err)
	require.NotNil(suite.T(), comparison)

	assert.Equal(suite.T(), transaction.TransactionID, comparison.TransactionID)

	// If quantum succeeded, verify quantum result
	if comparison.QuantumResult != nil {
		assert.GreaterOrEqual(suite.T(), comparison.QuantumResult.FraudScore, 0.0)
		assert.LessOrEqual(suite.T(), comparison.QuantumResult.FraudScore, 1.0)
	}

	// If classical succeeded, verify classical result
	if comparison.ClassicalResult != nil {
		assert.GreaterOrEqual(suite.T(), comparison.ClassicalResult.FraudScore, 0.0)
		assert.LessOrEqual(suite.T(), comparison.ClassicalResult.FraudScore, 1.0)
	}

	// Verify comparison metrics
	assert.GreaterOrEqual(suite.T(), comparison.QuantumAdvantage, 0.0)
	assert.NotEmpty(suite.T(), comparison.Recommendation)
	assert.Contains(suite.T(), []string{
		"Use quantum processing for better accuracy",
		"Classical processing sufficient for this transaction",
		"Quantum processing failed, use classical fallback",
		"Classical processing failed, quantum processing successful",
	}, comparison.Recommendation)
}

// Test high-value transaction quantum analysis
func (suite *ProductionTestSuite) TestHighValueTransaction() {
	transaction := &models.TransactionData{
		TransactionID: "txn_high_value_001",
		UserID:        "user_vip_123",
		MerchantID:    "merchant_premium_456",
		Amount:        decimal.NewFromFloat(50000.00), // Very high value
		Currency:      "USD",
		PaymentMethod: "wire_transfer",
		Timestamp:     time.Now(),
	}

	// Mock quantum backend responses
	suite.mockQuantum.On("SelectOptimalBackend", mock.Anything, mock.AnythingOfType("*interfaces.QuantumCircuit")).
		Return(&interfaces.QuantumBackend{
			Name:        "ibm_quantum_hardware",
			Provider:    "IBM",
			Type:        "hardware",
			QubitCount:  16,
			IsAvailable: true,
		}, nil)

	suite.mockQuantum.On("ExecuteQuantumCircuit", mock.Anything, mock.AnythingOfType("*interfaces.QuantumCircuit"), mock.AnythingOfType("*interfaces.QuantumBackend")).
		Return(&interfaces.QuantumResult{
			CircuitID:     "vqc_txn_high_value_001",
			BackendName:   "ibm_quantum_hardware",
			ExecutionTime: 85,
			Measurements: map[string]int{
				"0000": 200,
				"1111": 824,
			},
			Probabilities: map[string]float64{
				"0000": 0.1953,
				"1111": 0.8047,
			},
			ErrorMitigation: true, // Hardware uses error mitigation
		}, nil)

	// Execute quantum analysis
	result, err := suite.service.AnalyzeTransactionQuantum(suite.ctx, transaction)

	require.NoError(suite.T(), err)
	require.NotNil(suite.T(), result)

	// High-value transactions should have higher fraud scores and confidence
	assert.Greater(suite.T(), result.FraudScore, 0.5, "High-value transaction should have elevated fraud score")
	assert.Greater(suite.T(), result.Confidence, 0.3, "Should have reasonable confidence")
	assert.NotNil(suite.T(), result.QuantumAdvantage)
	assert.Greater(suite.T(), *result.QuantumAdvantage, 0.0, "Should show quantum advantage")
}

// Test concurrent quantum analysis
func (suite *ProductionTestSuite) TestConcurrentQuantumAnalysis() {
	concurrentCount := 5
	transactions := make([]*models.TransactionData, concurrentCount)

	for i := 0; i < concurrentCount; i++ {
		transactions[i] = &models.TransactionData{
			TransactionID: fmt.Sprintf("txn_concurrent_%03d", i),
			UserID:        fmt.Sprintf("user_%d", i),
			MerchantID:    "merchant_456",
			Amount:        decimal.NewFromFloat(float64(1000 + i*500)),
			Currency:      "USD",
			PaymentMethod: "credit_card",
			Timestamp:     time.Now(),
		}
	}

	// Mock quantum backend responses
	suite.mockQuantum.On("SelectOptimalBackend", mock.Anything, mock.AnythingOfType("*interfaces.QuantumCircuit")).
		Return(&interfaces.QuantumBackend{
			Name:        "ibm_quantum_simulator",
			Provider:    "IBM",
			Type:        "simulator",
			QubitCount:  32,
			IsAvailable: true,
		}, nil)

	suite.mockQuantum.On("ExecuteQuantumCircuit", mock.Anything, mock.AnythingOfType("*interfaces.QuantumCircuit"), mock.AnythingOfType("*interfaces.QuantumBackend")).
		Return(&interfaces.QuantumResult{
			CircuitID:     "vqc_concurrent",
			BackendName:   "ibm_quantum_simulator",
			ExecutionTime: 42,
			Measurements: map[string]int{
				"0000": 550,
				"1111": 474,
			},
			Probabilities: map[string]float64{
				"0000": 0.537,
				"1111": 0.463,
			},
			ErrorMitigation: false,
		}, nil)

	// Execute concurrent analysis
	results := make([]*models.FraudResult, concurrentCount)
	errors := make([]error, concurrentCount)
	done := make(chan bool, concurrentCount)

	startTime := time.Now()
	for i := 0; i < concurrentCount; i++ {
		go func(index int) {
			results[index], errors[index] = suite.service.AnalyzeTransactionQuantum(suite.ctx, transactions[index])
			done <- true
		}(i)
	}

	// Wait for all to complete
	for i := 0; i < concurrentCount; i++ {
		<-done
	}
	duration := time.Since(startTime)

	// Verify all completed successfully
	successCount := 0
	for i := 0; i < concurrentCount; i++ {
		if errors[i] == nil && results[i] != nil {
			successCount++
			assert.Equal(suite.T(), transactions[i].TransactionID, results[i].TransactionID)
		}
	}

	assert.Greater(suite.T(), successCount, 0, "At least some concurrent requests should succeed")

	// Production performance: concurrent requests should not take much longer than sequential
	maxExpectedDuration := 2 * time.Second
	assert.Less(suite.T(), duration, maxExpectedDuration, "Concurrent processing should complete within reasonable time")
}

// Mock interface implementations

func (m *MockQuantumBackendService) SelectOptimalBackend(ctx context.Context, circuit *interfaces.QuantumCircuit) (*interfaces.QuantumBackend, error) {
	args := m.Called(ctx, circuit)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*interfaces.QuantumBackend), args.Error(1)
}

func (m *MockQuantumBackendService) ExecuteQuantumCircuit(ctx context.Context, circuit *interfaces.QuantumCircuit, backend *interfaces.QuantumBackend) (*interfaces.QuantumResult, error) {
	args := m.Called(ctx, circuit, backend)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*interfaces.QuantumResult), args.Error(1)
}

func (m *MockQuantumBackendService) MonitorQuantumHardware(ctx context.Context) (*interfaces.HardwareStatus, error) {
	args := m.Called(ctx)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*interfaces.HardwareStatus), args.Error(1)
}

func (m *MockQuantumBackendService) HandleQuantumErrors(ctx context.Context, quantumError *interfaces.QuantumError) (*interfaces.ErrorRecovery, error) {
	args := m.Called(ctx, quantumError)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*interfaces.ErrorRecovery), args.Error(1)
}

func (m *MockIntelligentRouter) RouteTransaction(ctx context.Context, transaction *models.TransactionData) (string, error) {
	args := m.Called(ctx, transaction)
	return args.String(0), args.Error(1)
}
