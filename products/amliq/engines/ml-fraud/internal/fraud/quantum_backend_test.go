package fraud

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"quantumbeam/internal/interfaces"
)

func TestNewQuantumBackendService(t *testing.T) {
	service := NewQuantumBackendService()

	assert.NotNil(t, service)
	assert.NotNil(t, service.config)
	assert.NotEmpty(t, service.backends)
	assert.True(t, service.config.SimulatorFallback)
}

func TestSelectOptimalBackend_SuccessAndFallback(t *testing.T) {
	service := NewQuantumBackendService()
	circuit := &interfaces.QuantumCircuit{ID: "c1", QubitCount: 8}

	backend, err := service.SelectOptimalBackend(context.Background(), circuit)
	assert.NoError(t, err)
	assert.NotNil(t, backend)
	assert.GreaterOrEqual(t, backend.QubitCount, circuit.QubitCount)

	// Force candidate filtering to fail and verify simulator fallback path is used.
	service.config.MaxQueueTime = -1
	fallbackBackend, fallbackErr := service.SelectOptimalBackend(context.Background(), circuit)
	assert.NoError(t, fallbackErr)
	assert.NotNil(t, fallbackBackend)
	assert.Equal(t, "simulator", fallbackBackend.Type)
}

func TestSelectOptimalBackend_NoBackendAvailable(t *testing.T) {
	service := NewQuantumBackendService()
	service.config.SimulatorFallback = false

	for _, backend := range service.backends {
		backend.IsAvailable = false
	}

	circuit := &interfaces.QuantumCircuit{ID: "c2", QubitCount: 4}
	selected, err := service.SelectOptimalBackend(context.Background(), circuit)

	assert.Nil(t, selected)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "no suitable quantum backend available")
}

func TestExecuteQuantumCircuit_SuccessAndCancelled(t *testing.T) {
	service := NewQuantumBackendService()

	vqcCircuit := &interfaces.QuantumCircuit{
		ID:         "vqc-circuit",
		QubitCount: 4,
		GateCount:  10,
		Depth:      6,
		Parameters: map[string]float64{"theta1": 0.1, "theta2": 0.8},
		CircuitData: map[string]interface{}{
			"circuit_type": "vqc",
		},
	}

	simulatorBackend := &interfaces.QuantumBackend{
		Name:        "local_simulator",
		Provider:    "Local",
		Type:        "simulator",
		QubitCount:  16,
		IsAvailable: true,
	}

	result, err := service.ExecuteQuantumCircuit(context.Background(), vqcCircuit, simulatorBackend)
	assert.NoError(t, err)
	assert.Equal(t, vqcCircuit.ID, result.CircuitID)
	assert.Equal(t, "local_simulator", result.BackendName)
	assert.NotEmpty(t, result.Measurements)
	assert.NotEmpty(t, result.Probabilities)
	assert.False(t, result.ErrorMitigation)
	assert.GreaterOrEqual(t, result.ExecutionTime, int64(0))

	hardwareBackend := &interfaces.QuantumBackend{
		Name:        "ibm_quantum_hardware",
		Provider:    "IBM",
		Type:        "hardware",
		QubitCount:  16,
		IsAvailable: true,
	}
	hardwareResult, hardwareErr := service.ExecuteQuantumCircuit(context.Background(), vqcCircuit, hardwareBackend)
	assert.NoError(t, hardwareErr)
	assert.True(t, hardwareResult.ErrorMitigation)

	cancelledCtx, cancel := context.WithCancel(context.Background())
	cancel()
	cancelledResult, cancelledErr := service.ExecuteQuantumCircuit(cancelledCtx, vqcCircuit, simulatorBackend)
	assert.Nil(t, cancelledResult)
	assert.Error(t, cancelledErr)
	assert.Contains(t, cancelledErr.Error(), "cancelled")
}

func TestMonitorQuantumHardware_HealthCalculation(t *testing.T) {
	service := NewQuantumBackendService()

	status, err := service.MonitorQuantumHardware(context.Background())
	assert.NoError(t, err)
	assert.Equal(t, len(service.backends), status.TotalBackends)
	assert.Greater(t, status.AvailableBackends, 0)
	assert.NotEmpty(t, status.SystemHealth)
	assert.NotEmpty(t, status.BackendDetails)

	// Force a degraded state for switch coverage.
	for _, backend := range service.backends {
		backend.IsAvailable = false
		backend.QueueTime = 300
	}

	degraded, degradedErr := service.MonitorQuantumHardware(context.Background())
	assert.NoError(t, degradedErr)
	assert.Equal(t, "critical", degraded.SystemHealth)
}

func TestHandleQuantumErrors_Scenarios(t *testing.T) {
	service := NewQuantumBackendService()

	tests := []struct {
		name       string
		errType    string
		setup      func()
		wantAction string
	}{
		{
			name:    "hardware failure falls back",
			errType: "hardware_failure",
			setup: func() {
				service.config.SimulatorFallback = true
			},
			wantAction: "fallback",
		},
		{
			name:    "timeout uses simulator fallback",
			errType: "timeout",
			setup: func() {
				service.config.SimulatorFallback = true
			},
			wantAction: "simulator_fallback",
		},
		{
			name:       "compilation uses optimization",
			errType:    "circuit_compilation_error",
			setup:      func() {},
			wantAction: "circuit_optimization",
		},
		{
			name:       "queue timeout uses queue fallback",
			errType:    "queue_timeout",
			setup:      func() {},
			wantAction: "queue_fallback",
		},
		{
			name:    "unknown error retries",
			errType: "unknown_error",
			setup: func() {
				service.config.RetryAttempts = 3
			},
			wantAction: "retry",
		},
		{
			name:    "unknown error with no retries uses classical fallback",
			errType: "unknown_error",
			setup: func() {
				service.config.RetryAttempts = 0
			},
			wantAction: "classical_fallback",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			service = NewQuantumBackendService()
			tt.setup()

			recovery, err := service.HandleQuantumErrors(context.Background(), &interfaces.QuantumError{
				Type:        tt.errType,
				Message:     "simulated error",
				BackendName: "ibm_quantum_hardware",
				CircuitID:   "c-1",
				Timestamp:   time.Now().Unix(),
			})
			assert.NoError(t, err)
			assert.Equal(t, tt.wantAction, recovery.Action)
			assert.True(t, recovery.Success)
			assert.GreaterOrEqual(t, recovery.RecoveryTime, int64(0))
		})
	}
}

func TestQuantumBackendHelpers(t *testing.T) {
	service := NewQuantumBackendService()
	circuit := &interfaces.QuantumCircuit{
		ID:          "qaoa-circuit",
		QubitCount:  6,
		GateCount:   24,
		Depth:       12,
		Parameters:  map[string]float64{},
		CircuitData: map[string]interface{}{"circuit_type": "qaoa"},
	}

	backendInfo := &interfaces.BackendInfo{
		Name:        "unknown_backend",
		Provider:    "Custom",
		QubitCount:  128,
		IsSimulator: false,
		IsAvailable: true,
		QueueTime:   999,
		ErrorRate:   0.05,
	}

	score := service.calculateBackendScore(backendInfo, circuit)
	assert.GreaterOrEqual(t, score, 0.0)

	assert.Equal(t, "hardware", service.getBackendType(backendInfo))
	backendInfo.IsSimulator = true
	assert.Equal(t, "simulator", service.getBackendType(backendInfo))

	bits := service.generateRandomBitString(12)
	assert.Len(t, bits, 12)

	qaoaMeasurements, qaoaProbabilities := service.simulateQuantumMeasurements(circuit, &interfaces.QuantumBackend{
		Name: "sim",
		Type: "simulator",
	})
	assert.NotEmpty(t, qaoaMeasurements)
	assert.NotEmpty(t, qaoaProbabilities)

	genericMeasurements, genericProbabilities := service.simulateQuantumMeasurements(&interfaces.QuantumCircuit{
		ID:          "generic",
		QubitCount:  4,
		Parameters:  map[string]float64{},
		CircuitData: map[string]interface{}{"circuit_type": "generic"},
	}, &interfaces.QuantumBackend{Name: "sim", Type: "simulator"})
	assert.NotEmpty(t, genericMeasurements)
	assert.NotEmpty(t, genericProbabilities)

	// Ensure fallback helpers produce deterministic, non-empty selections.
	fallback := service.findFallbackBackend("ibm_quantum_simulator")
	assert.NotEmpty(t, fallback)
	assert.NotEqual(t, "ibm_quantum_simulator", fallback)

	simulatorFallback := service.findSimulatorFallback()
	assert.NotEmpty(t, simulatorFallback)

	lowQueue := service.findLowQueueBackend()
	assert.NotEmpty(t, lowQueue)

	service.UpdateBackendStatus("local_simulator", false, 33, 0.2)
	updated := service.backends["local_simulator"]
	assert.False(t, updated.IsAvailable)
	assert.Equal(t, 33, updated.QueueTime)
	assert.Equal(t, 0.2, updated.ErrorRate)
}
