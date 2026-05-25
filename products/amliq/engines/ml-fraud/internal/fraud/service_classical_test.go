package fraud

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"quantumbeam/internal/interfaces"
)

func TestGetQuantumBackendStatus_Success(t *testing.T) {
	mockBackend := new(MockQuantumBackendService)
	svc := NewService(mockBackend, nil)
	ctx := context.Background()
	hwStatus := &interfaces.HardwareStatus{
		TotalBackends: 3, AvailableBackends: 2,
		AverageQueueTime: 30.0, SystemHealth: "good",
		BackendDetails: map[string]interface{}{
			"ibm_quantum": map[string]interface{}{
				"provider": "ibm", "qubit_count": float64(27),
				"is_simulator": false, "is_available": true,
				"queue_time": float64(30), "error_rate": 0.01,
			},
			"aws_braket": map[string]interface{}{
				"provider": "aws", "qubit_count": float64(16),
				"is_simulator": true, "is_available": false,
				"queue_time": float64(0), "error_rate": 0.001,
			},
		},
	}
	mockBackend.On("MonitorQuantumHardware", ctx).Return(hwStatus, nil)

	status, err := svc.GetQuantumBackendStatus(ctx)
	assert.NoError(t, err)
	assert.Len(t, status.AvailableBackends, 2)
	assert.NotEmpty(t, status.RecommendedBackend)
	assert.Len(t, status.QueueTimes, 2)
}

func TestGetQuantumBackendStatus_MonitorFails(t *testing.T) {
	mockBackend := new(MockQuantumBackendService)
	svc := NewService(mockBackend, nil)
	ctx := context.Background()
	mockBackend.On("MonitorQuantumHardware", ctx).Return(nil, assert.AnError)
	status, err := svc.GetQuantumBackendStatus(ctx)
	assert.Error(t, err)
	assert.Nil(t, status)
}

func TestGetQuantumBackendStatus_NonMapDetails(t *testing.T) {
	mockBackend := new(MockQuantumBackendService)
	svc := NewService(mockBackend, nil)
	ctx := context.Background()
	hwStatus := &interfaces.HardwareStatus{
		TotalBackends: 1, AvailableBackends: 1, SystemHealth: "good",
		BackendDetails: map[string]interface{}{"invalid": "not_a_map"},
	}
	mockBackend.On("MonitorQuantumHardware", ctx).Return(hwStatus, nil)
	status, err := svc.GetQuantumBackendStatus(ctx)
	assert.NoError(t, err)
	assert.Empty(t, status.AvailableBackends)
}

func TestAnalyzeTransactionClassical_Success(t *testing.T) {
	svc := NewService(nil, nil)
	ctx := context.Background()
	tx := newTestTransaction("txn_c1", 15000.0, "digital_wallet")
	result, err := svc.AnalyzeTransactionClassical(ctx, tx)
	assert.NoError(t, err)
	assert.Equal(t, "txn_c1", result.TransactionID)
	assert.Greater(t, result.FraudScore, 0.0)
	assert.Equal(t, 0.75, result.Confidence)
	assert.Equal(t, "classical-ml-v2.1", result.ModelVersion)
}

func TestCompareQuantumClassical_BothSucceed(t *testing.T) {
	mockBackend := new(MockQuantumBackendService)
	svc := NewService(mockBackend, nil)
	ctx := context.Background()
	tx := newTestTransaction("txn_cmp1", 5000.0, "credit_card")
	mockBackend.On("SelectOptimalBackend", ctx, mock.Anything).Return(newMockBackend(), nil)
	mockBackend.On("ExecuteQuantumCircuit", ctx, mock.Anything, mock.Anything).Return(newMockQuantumResult(), nil)

	result, err := svc.CompareQuantumClassical(ctx, tx)
	assert.NoError(t, err)
	assert.NotNil(t, result.QuantumResult)
	assert.NotNil(t, result.ClassicalResult)
	assert.Contains(t, result.Recommendation, "quantum processing")
}

func TestCompareQuantumClassical_QuantumFails(t *testing.T) {
	mockBackend := new(MockQuantumBackendService)
	svc := NewService(mockBackend, nil)
	ctx := context.Background()
	tx := newTestTransaction("txn_cmp2", 500.0, "debit_card")
	mockBackend.On("SelectOptimalBackend", ctx, mock.Anything).Return(nil, assert.AnError)

	result, err := svc.CompareQuantumClassical(ctx, tx)
	assert.NoError(t, err)
	assert.Nil(t, result.QuantumResult)
	assert.NotNil(t, result.ClassicalResult)
	assert.Contains(t, result.Recommendation, "Quantum processing failed")
}

func TestDetectFraudRingsQAOA_Success(t *testing.T) {
	mockBackend := new(MockQuantumBackendService)
	svc := NewService(mockBackend, nil)
	ctx := context.Background()
	graphData := &interfaces.NetworkGraph{
		Nodes: []interfaces.NetworkNode{{ID: "n1"}, {ID: "n2"}, {ID: "n3"}, {ID: "n4"}},
		Edges: []interfaces.NetworkEdge{{Source: "n1", Target: "n2"}, {Source: "n2", Target: "n3"}},
	}
	qResult := &interfaces.QuantumResult{
		CircuitID: "qaoa_4", BackendName: "test",
		Measurements: map[string]int{"0011": 600, "1100": 400},
		Probabilities: map[string]float64{},
	}
	mockBackend.On("SelectOptimalBackend", ctx, mock.Anything).Return(newMockBackend(), nil)
	mockBackend.On("ExecuteQuantumCircuit", ctx, mock.Anything, mock.Anything).Return(qResult, nil)

	result, err := svc.DetectFraudRingsQAOA(ctx, graphData)
	assert.NoError(t, err)
	assert.Equal(t, 0.85, result.ConfidenceScore)
}

func TestDetectFraudRingsQAOA_GraphTooLarge(t *testing.T) {
	svc := NewService(new(MockQuantumBackendService), nil)
	ctx := context.Background()
	nodes := make([]interfaces.NetworkNode, 20)
	for i := range nodes {
		nodes[i] = interfaces.NetworkNode{ID: "n"}
	}
	result, err := svc.DetectFraudRingsQAOA(ctx, &interfaces.NetworkGraph{Nodes: nodes})
	assert.Error(t, err)
	assert.Nil(t, result)
	assert.Contains(t, err.Error(), "graph too large")
}
