package fraud

import (
	"fmt"
	"time"
)

// ModelStatus represents the lifecycle state of a model version.
type ModelStatus string

const (
	ModelStatusActive   ModelStatus = "active"
	ModelStatusInactive ModelStatus = "inactive"
	ModelStatusStaging  ModelStatus = "staging"
	ModelStatusRetired  ModelStatus = "retired"
)

// ABTestStatus represents the state of an A/B test.
type ABTestStatus string

const (
	ABTestStatusPending   ABTestStatus = "pending"
	ABTestStatusRunning   ABTestStatus = "running"
	ABTestStatusCompleted ABTestStatus = "completed"
	ABTestStatusCancelled ABTestStatus = "cancelled"
)

// ModelMetrics holds performance metrics for a model version.
type ModelMetrics struct {
	Accuracy        float64 `json:"accuracy" validate:"min=0,max=1"`
	Precision       float64 `json:"precision" validate:"min=0,max=1"`
	Recall          float64 `json:"recall" validate:"min=0,max=1"`
	F1Score         float64 `json:"f1_score" validate:"min=0,max=1"`
	AUCROC          float64 `json:"auc_roc" validate:"min=0,max=1"`
	ProcessingTimeMs int64  `json:"processing_time_ms" validate:"min=0"`
}

// ModelVersion represents a single version of the fraud detection model.
type ModelVersion struct {
	ID          string       `json:"id"`
	Name        string       `json:"name" validate:"required"`
	Description string       `json:"description"`
	Algorithm   string       `json:"algorithm" validate:"required"`
	Version     string       `json:"version" validate:"required"`
	Status      ModelStatus  `json:"status"`
	Metrics     ModelMetrics `json:"metrics"`
	ParentID    string       `json:"parent_id,omitempty"`
	CreatedAt   time.Time    `json:"created_at"`
	UpdatedAt   time.Time    `json:"updated_at"`
}

// ABTestConfig defines the configuration for an A/B test between two models.
type ABTestConfig struct {
	ID           string       `json:"id"`
	Name         string       `json:"name" validate:"required"`
	ModelAID     string       `json:"model_a_id" validate:"required"`
	ModelBID     string       `json:"model_b_id" validate:"required"`
	TrafficSplit int          `json:"traffic_split" validate:"min=1,max=99"`
	Status       ABTestStatus `json:"status"`
	StartedAt    time.Time    `json:"started_at"`
	EndedAt      *time.Time   `json:"ended_at,omitempty"`
	CreatedAt    time.Time    `json:"created_at"`
}

// ABTestResult holds the outcome of a completed A/B test.
type ABTestResult struct {
	TestID        string       `json:"test_id"`
	ModelAMetrics ModelMetrics `json:"model_a_metrics"`
	ModelBMetrics ModelMetrics `json:"model_b_metrics"`
	Winner        string       `json:"winner"`
	Confidence    float64      `json:"confidence" validate:"min=0,max=1"`
	CompletedAt   time.Time    `json:"completed_at"`
}

// ModelDeploymentStatus tracks where a model is deployed.
type ModelDeploymentStatus struct {
	VersionID         string  `json:"version_id"`
	Region            string  `json:"region"`
	Status            string  `json:"status"`
	TrafficPercentage float64 `json:"traffic_percentage" validate:"min=0,max=100"`
}

// ModelComparison is a side-by-side comparison of two model versions.
type ModelComparison struct {
	ModelA  ModelVersion `json:"model_a"`
	ModelB  ModelVersion `json:"model_b"`
	Summary string       `json:"summary"`
}

// ValidateABTestConfig validates that traffic split is valid.
func ValidateABTestConfig(cfg ABTestConfig) error {
	if cfg.TrafficSplit < 1 || cfg.TrafficSplit > 99 {
		return fmt.Errorf("traffic_split must be between 1 and 99, got %d", cfg.TrafficSplit)
	}
	if cfg.ModelAID == "" || cfg.ModelBID == "" {
		return fmt.Errorf("both model_a_id and model_b_id are required")
	}
	if cfg.ModelAID == cfg.ModelBID {
		return fmt.Errorf("model_a_id and model_b_id must be different")
	}
	return nil
}

// ValidateModelMetrics validates that all metric values are within [0,1].
func ValidateModelMetrics(m ModelMetrics) error {
	checks := map[string]float64{
		"accuracy":  m.Accuracy,
		"precision": m.Precision,
		"recall":    m.Recall,
		"f1_score":  m.F1Score,
		"auc_roc":   m.AUCROC,
	}
	for name, val := range checks {
		if val < 0 || val > 1 {
			return fmt.Errorf("%s must be between 0 and 1, got %f", name, val)
		}
	}
	if m.ProcessingTimeMs < 0 {
		return fmt.Errorf("processing_time_ms must be >= 0")
	}
	return nil
}
