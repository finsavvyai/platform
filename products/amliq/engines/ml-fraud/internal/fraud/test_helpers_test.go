package fraud

import (
	"context"
	"time"

	"github.com/shopspring/decimal"
	"github.com/stretchr/testify/mock"
	"quantumbeam/internal/interfaces"
	"quantumbeam/internal/models"
)

// MockQuantumBackendService mocks the QuantumBackendService interface
type MockQuantumBackendService struct {
	mock.Mock
}

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

func (m *MockQuantumBackendService) HandleQuantumErrors(ctx context.Context, qErr *interfaces.QuantumError) (*interfaces.ErrorRecovery, error) {
	args := m.Called(ctx, qErr)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*interfaces.ErrorRecovery), args.Error(1)
}

func newTestTransaction(id string, amount float64, method string) *models.TransactionData {
	return &models.TransactionData{
		TransactionID: id,
		Amount:        decimal.NewFromFloat(amount),
		Timestamp:     time.Now(),
		MerchantID:    "merchant_001",
		UserID:        "user_001",
		PaymentMethod: method,
		Features:      map[string]float64{"risk_indicator": 0.5},
	}
}

func newMockQuantumResult() *interfaces.QuantumResult {
	return &interfaces.QuantumResult{
		CircuitID:   "test_circuit",
		BackendName: "test_backend",
		Probabilities: map[string]float64{
			"0000": 0.3,
			"1111": 0.7,
		},
		Measurements:    map[string]int{"0000": 300, "1111": 700},
		ErrorMitigation: true,
	}
}

func newMockBackend() *interfaces.QuantumBackend {
	return &interfaces.QuantumBackend{
		Name: "test_backend", Provider: "test", Type: "simulator",
		QubitCount: 8, IsAvailable: true,
	}
}
