package interfaces

import (
	"context"

	"quantumbeam/internal/models"
)

// FraudDetectionService defines the core fraud detection interface
type FraudDetectionService interface {
	// Primary quantum processing endpoints
	AnalyzeTransactionQuantum(ctx context.Context, transaction *models.TransactionData) (*models.FraudResult, error)
	AnalyzeBatchQuantum(ctx context.Context, transactions []*models.TransactionData) ([]*models.FraudResult, error)
	DetectFraudRingsQAOA(ctx context.Context, graphData *NetworkGraph) (*QuantumCommunityResult, error)

	// Quantum performance and optimization
	GetQuantumPerformance(ctx context.Context) (*QuantumPerformanceMetrics, error)
	OptimizeQuantumCircuits(ctx context.Context, circuitType string) (*OptimizationResult, error)
	GetQuantumBackendStatus(ctx context.Context) (*QuantumBackendStatus, error)

	// Classical fallback (secondary)
	AnalyzeTransactionClassical(ctx context.Context, transaction *models.TransactionData) (*ClassicalFraudResult, error)
	CompareQuantumClassical(ctx context.Context, transaction *models.TransactionData) (*ComparisonResult, error)
}

// QuantumBackendService defines quantum hardware management interface
type QuantumBackendService interface {
	SelectOptimalBackend(ctx context.Context, circuit *QuantumCircuit) (*QuantumBackend, error)
	ExecuteQuantumCircuit(ctx context.Context, circuit *QuantumCircuit, backend *QuantumBackend) (*QuantumResult, error)
	MonitorQuantumHardware(ctx context.Context) (*HardwareStatus, error)
	HandleQuantumErrors(ctx context.Context, error *QuantumError) (*ErrorRecovery, error)
}

// IntelligentRouter defines the routing logic between quantum and classical processing
type IntelligentRouter interface {
	RouteTransaction(ctx context.Context, transaction *models.TransactionData) (ProcessingMethod, error)
	GetRoutingDecision(ctx context.Context, features map[string]float64) (*RoutingDecision, error)
	UpdateRoutingStrategy(ctx context.Context, strategy *RoutingStrategy) error
}

// Supporting types for fraud detection interfaces

// NetworkGraph represents transaction network for fraud ring detection
type NetworkGraph struct {
	Nodes []NetworkNode `json:"nodes"`
	Edges []NetworkEdge `json:"edges"`
}

// NetworkNode represents a node in the transaction network
type NetworkNode struct {
	ID         string                 `json:"id"`
	Type       string                 `json:"type"` // user, merchant, account
	Attributes map[string]interface{} `json:"attributes"`
}

// NetworkEdge represents a connection between nodes
type NetworkEdge struct {
	Source    string  `json:"source"`
	Target    string  `json:"target"`
	Weight    float64 `json:"weight"`
	EdgeType  string  `json:"edge_type"` // transaction, shared_device, etc.
	Timestamp int64   `json:"timestamp"`
}

// QuantumCommunityResult represents fraud ring detection results
type QuantumCommunityResult struct {
	Communities      []Community `json:"communities"`
	FraudRings       []FraudRing `json:"fraud_rings"`
	ConfidenceScore  float64     `json:"confidence_score"`
	ProcessingTimeMs int64       `json:"processing_time_ms"`
	QuantumAdvantage float64     `json:"quantum_advantage"`
}

// Community represents a detected community in the network
type Community struct {
	ID         string   `json:"id"`
	Members    []string `json:"members"`
	Centrality float64  `json:"centrality"`
	FraudScore float64  `json:"fraud_score"`
	RiskLevel  string   `json:"risk_level"`
}

// FraudRing represents a detected fraud ring
type FraudRing struct {
	RingID           string   `json:"ring_id"`
	Members          []string `json:"members"`
	ConfidenceScore  float64  `json:"confidence_score"`
	TransactionCount int      `json:"transaction_count"`
	TotalAmount      float64  `json:"total_amount"`
	DetectionMethod  string   `json:"detection_method"`
	RiskIndicators   []string `json:"risk_indicators"`
}

// QuantumPerformanceMetrics represents quantum processing performance
type QuantumPerformanceMetrics struct {
	AverageProcessingTime  float64            `json:"average_processing_time"`
	QuantumAdvantage       float64            `json:"quantum_advantage"`
	AccuracyImprovement    float64            `json:"accuracy_improvement"`
	FalsePositiveReduction float64            `json:"false_positive_reduction"`
	BackendUtilization     map[string]float64 `json:"backend_utilization"`
	CircuitDepth           int                `json:"circuit_depth"`
	GateCount              int                `json:"gate_count"`
}

// OptimizationResult represents quantum circuit optimization results
type OptimizationResult struct {
	OriginalDepth    int     `json:"original_depth"`
	OptimizedDepth   int     `json:"optimized_depth"`
	GateReduction    float64 `json:"gate_reduction"`
	ExpectedSpeedup  float64 `json:"expected_speedup"`
	OptimizationTime int64   `json:"optimization_time_ms"`
}

// QuantumBackendStatus represents the status of quantum backends
type QuantumBackendStatus struct {
	AvailableBackends    []BackendInfo      `json:"available_backends"`
	RecommendedBackend   string             `json:"recommended_backend"`
	QueueTimes           map[string]int     `json:"queue_times"`
	NoiseCharacteristics map[string]float64 `json:"noise_characteristics"`
}

// BackendInfo represents information about a quantum backend
type BackendInfo struct {
	Name        string  `json:"name"`
	Provider    string  `json:"provider"`
	QubitCount  int     `json:"qubit_count"`
	IsSimulator bool    `json:"is_simulator"`
	IsAvailable bool    `json:"is_available"`
	QueueTime   int     `json:"queue_time"`
	ErrorRate   float64 `json:"error_rate"`
}

// ClassicalFraudResult represents classical fraud detection results
type ClassicalFraudResult struct {
	TransactionID    string   `json:"transaction_id"`
	FraudScore       float64  `json:"fraud_score"`
	RiskLevel        string   `json:"risk_level"`
	Confidence       float64  `json:"confidence"`
	ProcessingTimeMs int64    `json:"processing_time_ms"`
	ModelVersion     string   `json:"model_version"`
	Explanation      []string `json:"explanation"`
}

// ComparisonResult represents quantum vs classical comparison
type ComparisonResult struct {
	TransactionID    string                `json:"transaction_id"`
	QuantumResult    *models.FraudResult   `json:"quantum_result"`
	ClassicalResult  *ClassicalFraudResult `json:"classical_result"`
	QuantumAdvantage float64               `json:"quantum_advantage"`
	AccuracyDelta    float64               `json:"accuracy_delta"`
	SpeedDelta       int64                 `json:"speed_delta_ms"`
	Recommendation   string                `json:"recommendation"`
}

// QuantumCircuit represents a quantum circuit for execution
type QuantumCircuit struct {
	ID          string                 `json:"id"`
	QubitCount  int                    `json:"qubit_count"`
	GateCount   int                    `json:"gate_count"`
	Depth       int                    `json:"depth"`
	Parameters  map[string]float64     `json:"parameters"`
	CircuitData interface{}            `json:"circuit_data"`
	Metadata    map[string]interface{} `json:"metadata"`
}

// QuantumBackend represents a quantum computing backend
type QuantumBackend struct {
	Name        string `json:"name"`
	Provider    string `json:"provider"`
	Type        string `json:"type"` // simulator, hardware
	QubitCount  int    `json:"qubit_count"`
	IsAvailable bool   `json:"is_available"`
}

// QuantumResult represents the result of quantum circuit execution
type QuantumResult struct {
	CircuitID       string                 `json:"circuit_id"`
	BackendName     string                 `json:"backend_name"`
	ExecutionTime   int64                  `json:"execution_time_ms"`
	Measurements    map[string]int         `json:"measurements"`
	Probabilities   map[string]float64     `json:"probabilities"`
	Metadata        map[string]interface{} `json:"metadata"`
	ErrorMitigation bool                   `json:"error_mitigation"`
}

// HardwareStatus represents quantum hardware status
type HardwareStatus struct {
	TotalBackends     int                    `json:"total_backends"`
	AvailableBackends int                    `json:"available_backends"`
	AverageQueueTime  float64                `json:"average_queue_time"`
	SystemHealth      string                 `json:"system_health"`
	BackendDetails    map[string]interface{} `json:"backend_details"`
}

// QuantumError represents quantum processing errors
type QuantumError struct {
	Type        string `json:"type"`
	Message     string `json:"message"`
	BackendName string `json:"backend_name"`
	CircuitID   string `json:"circuit_id"`
	Timestamp   int64  `json:"timestamp"`
}

// ErrorRecovery represents error recovery actions
type ErrorRecovery struct {
	Action          string `json:"action"`
	FallbackBackend string `json:"fallback_backend,omitempty"`
	RetryCount      int    `json:"retry_count"`
	RecoveryTime    int64  `json:"recovery_time_ms"`
	Success         bool   `json:"success"`
}

// ProcessingMethod represents the method used for processing
type ProcessingMethod string

const (
	ProcessingMethodQuantum   ProcessingMethod = "quantum"
	ProcessingMethodClassical ProcessingMethod = "classical"
	ProcessingMethodHybrid    ProcessingMethod = "hybrid"
)

// RoutingDecision represents a routing decision
type RoutingDecision struct {
	Method            ProcessingMethod `json:"method"`
	Confidence        float64          `json:"confidence"`
	Reasoning         string           `json:"reasoning"`
	ExpectedAdvantage float64          `json:"expected_advantage"`
}

// RoutingStrategy represents routing strategy configuration
type RoutingStrategy struct {
	Name              string                 `json:"name"`
	QuantumThreshold  float64                `json:"quantum_threshold"`
	ComplexityWeight  float64                `json:"complexity_weight"`
	PerformanceWeight float64                `json:"performance_weight"`
	Parameters        map[string]interface{} `json:"parameters"`
}
