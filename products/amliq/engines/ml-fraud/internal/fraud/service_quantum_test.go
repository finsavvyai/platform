package fraud

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"quantumbeam/internal/models"
)

func TestNewService(t *testing.T) {
	mockBackend := new(MockQuantumBackendService)
	svc := NewService(mockBackend, nil)
	assert.NotNil(t, svc)
	assert.Equal(t, mockBackend, svc.quantumBackend)
}

func TestAnalyzeTransactionQuantum_Success(t *testing.T) {
	mockBackend := new(MockQuantumBackendService)
	svc := NewService(mockBackend, nil)
	ctx := context.Background()
	tx := newTestTransaction("txn_001", 5000.0, "credit_card")

	mockBackend.On("SelectOptimalBackend", ctx, mock.Anything).Return(newMockBackend(), nil)
	mockBackend.On("ExecuteQuantumCircuit", ctx, mock.Anything, mock.Anything).Return(newMockQuantumResult(), nil)

	result, err := svc.AnalyzeTransactionQuantum(ctx, tx)
	assert.NoError(t, err)
	assert.NotNil(t, result)
	assert.Equal(t, "txn_001", result.TransactionID)
	assert.Equal(t, models.ProcessingMethodQuantum, result.ProcessingMethod)
	assert.Equal(t, 0.7, result.FraudScore)
	assert.NotNil(t, result.QuantumAdvantage)
	assert.Equal(t, "vqc-v1.0", result.ModelVersion)
	assert.NotEmpty(t, result.Explanation)
	mockBackend.AssertExpectations(t)
}

func TestAnalyzeTransactionQuantum_BackendSelectionFails(t *testing.T) {
	mockBackend := new(MockQuantumBackendService)
	svc := NewService(mockBackend, nil)
	ctx := context.Background()
	tx := newTestTransaction("txn_002", 1000.0, "debit_card")

	mockBackend.On("SelectOptimalBackend", ctx, mock.Anything).Return(nil, assert.AnError)

	result, err := svc.AnalyzeTransactionQuantum(ctx, tx)
	assert.Error(t, err)
	assert.Nil(t, result)
	assert.Contains(t, err.Error(), "failed to select quantum backend")
}

func TestAnalyzeTransactionQuantum_CircuitExecutionFails(t *testing.T) {
	mockBackend := new(MockQuantumBackendService)
	svc := NewService(mockBackend, nil)
	ctx := context.Background()
	tx := newTestTransaction("txn_003", 2000.0, "bank_transfer")

	mockBackend.On("SelectOptimalBackend", ctx, mock.Anything).Return(newMockBackend(), nil)
	mockBackend.On("ExecuteQuantumCircuit", ctx, mock.Anything, mock.Anything).Return(nil, assert.AnError)

	result, err := svc.AnalyzeTransactionQuantum(ctx, tx)
	assert.Error(t, err)
	assert.Nil(t, result)
	assert.Contains(t, err.Error(), "quantum circuit execution failed")
}

func TestAnalyzeBatchQuantum_Success(t *testing.T) {
	mockBackend := new(MockQuantumBackendService)
	svc := NewService(mockBackend, nil)
	ctx := context.Background()
	txns := []*models.TransactionData{
		newTestTransaction("txn_b1", 1000.0, "credit_card"),
		newTestTransaction("txn_b2", 2000.0, "debit_card"),
	}

	mockBackend.On("SelectOptimalBackend", ctx, mock.Anything).Return(newMockBackend(), nil)
	mockBackend.On("ExecuteQuantumCircuit", ctx, mock.Anything, mock.Anything).Return(newMockQuantumResult(), nil)

	results, err := svc.AnalyzeBatchQuantum(ctx, txns)
	assert.NoError(t, err)
	assert.Len(t, results, 2)
	assert.NotNil(t, results[0])
	assert.NotNil(t, results[1])
}

func TestAnalyzeBatchQuantum_PartialFailure(t *testing.T) {
	mockBackend := new(MockQuantumBackendService)
	svc := NewService(mockBackend, nil)
	ctx := context.Background()
	txns := []*models.TransactionData{
		newTestTransaction("txn_p1", 1000.0, "credit_card"),
		newTestTransaction("txn_p2", 2000.0, "debit_card"),
	}

	mockBackend.On("SelectOptimalBackend", ctx, mock.Anything).Return(newMockBackend(), nil).Once()
	mockBackend.On("ExecuteQuantumCircuit", ctx, mock.Anything, mock.Anything).Return(newMockQuantumResult(), nil).Once()
	mockBackend.On("SelectOptimalBackend", ctx, mock.Anything).Return(nil, assert.AnError).Once()

	results, err := svc.AnalyzeBatchQuantum(ctx, txns)
	assert.NoError(t, err)
	assert.Len(t, results, 2)
	assert.NotNil(t, results[0])
	assert.Nil(t, results[1])
}

func TestGetQuantumPerformance_ReturnsMetrics(t *testing.T) {
	svc := NewService(nil, nil)
	ctx := context.Background()
	metrics, err := svc.GetQuantumPerformance(ctx)
	assert.NoError(t, err)
	assert.NotNil(t, metrics)
	assert.Equal(t, 75.5, metrics.AverageProcessingTime)
	assert.Equal(t, 0.40, metrics.QuantumAdvantage)
	assert.Equal(t, 8, metrics.CircuitDepth)
	assert.Len(t, metrics.BackendUtilization, 3)
}

func TestOptimizeQuantumCircuits_ReturnsResult(t *testing.T) {
	svc := NewService(nil, nil)
	ctx := context.Background()
	result, err := svc.OptimizeQuantumCircuits(ctx, "vqc")
	assert.NoError(t, err)
	assert.NotNil(t, result)
	assert.Equal(t, 12, result.OriginalDepth)
	assert.Equal(t, 8, result.OptimizedDepth)
	assert.Equal(t, 0.33, result.GateReduction)
}
