package fraud

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestModelMetrics_JSONSerialization(t *testing.T) {
	metrics := ModelMetrics{
		Accuracy:         0.95,
		Precision:        0.92,
		Recall:           0.88,
		F1Score:          0.90,
		AUCROC:           0.97,
		ProcessingTimeMs: 45,
	}

	data, err := json.Marshal(metrics)
	require.NoError(t, err)

	var decoded ModelMetrics
	err = json.Unmarshal(data, &decoded)
	require.NoError(t, err)
	assert.InDelta(t, 0.95, decoded.Accuracy, 0.001)
	assert.InDelta(t, 0.92, decoded.Precision, 0.001)
	assert.InDelta(t, 0.88, decoded.Recall, 0.001)
	assert.Equal(t, int64(45), decoded.ProcessingTimeMs)
}

func TestModelVersion_JSONSerialization(t *testing.T) {
	now := time.Now().Truncate(time.Second)
	version := ModelVersion{
		ID:          "model-v1",
		Name:        "Classical Detector v1",
		Description: "Rule-based fraud detection model",
		Algorithm:   "gradient_boosting",
		Version:     "1.0.0",
		Status:      ModelStatusActive,
		Metrics:     ModelMetrics{Accuracy: 0.94, F1Score: 0.91},
		CreatedAt:   now,
		UpdatedAt:   now,
	}

	data, err := json.Marshal(version)
	require.NoError(t, err)

	var decoded ModelVersion
	err = json.Unmarshal(data, &decoded)
	require.NoError(t, err)
	assert.Equal(t, "model-v1", decoded.ID)
	assert.Equal(t, ModelStatusActive, decoded.Status)
	assert.Equal(t, "gradient_boosting", decoded.Algorithm)
}

func TestValidateABTestConfig_ValidSplit(t *testing.T) {
	cfg := ABTestConfig{
		ModelAID:     "model-a",
		ModelBID:     "model-b",
		TrafficSplit: 50,
	}
	err := ValidateABTestConfig(cfg)
	assert.NoError(t, err)
}

func TestValidateABTestConfig_InvalidSplit(t *testing.T) {
	tests := []struct {
		name  string
		split int
	}{
		{"zero", 0},
		{"hundred", 100},
		{"negative", -5},
		{"over_hundred", 150},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cfg := ABTestConfig{
				ModelAID:     "a",
				ModelBID:     "b",
				TrafficSplit: tt.split,
			}
			err := ValidateABTestConfig(cfg)
			assert.Error(t, err)
			assert.Contains(t, err.Error(), "traffic_split")
		})
	}
}

func TestValidateABTestConfig_SameModel(t *testing.T) {
	cfg := ABTestConfig{
		ModelAID:     "same-model",
		ModelBID:     "same-model",
		TrafficSplit: 50,
	}
	err := ValidateABTestConfig(cfg)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "must be different")
}

func TestValidateABTestConfig_MissingModels(t *testing.T) {
	cfg := ABTestConfig{
		ModelAID:     "",
		ModelBID:     "model-b",
		TrafficSplit: 50,
	}
	err := ValidateABTestConfig(cfg)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "required")
}

func TestValidateModelMetrics_Valid(t *testing.T) {
	m := ModelMetrics{
		Accuracy: 0.95, Precision: 0.92, Recall: 0.88,
		F1Score: 0.90, AUCROC: 0.97, ProcessingTimeMs: 10,
	}
	assert.NoError(t, ValidateModelMetrics(m))
}

func TestValidateModelMetrics_OutOfRange(t *testing.T) {
	m := ModelMetrics{Accuracy: 1.5}
	err := ValidateModelMetrics(m)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "accuracy")
}

func TestValidateModelMetrics_NegativeProcessingTime(t *testing.T) {
	m := ModelMetrics{ProcessingTimeMs: -1}
	err := ValidateModelMetrics(m)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "processing_time_ms")
}

func TestABTestConfig_JSONSerialization(t *testing.T) {
	now := time.Now().Truncate(time.Second)
	cfg := ABTestConfig{
		ID:           "test-1",
		Name:         "GBM vs Quantum",
		ModelAID:     "model-a",
		ModelBID:     "model-b",
		TrafficSplit: 70,
		Status:       ABTestStatusRunning,
		StartedAt:    now,
		CreatedAt:    now,
	}
	data, err := json.Marshal(cfg)
	require.NoError(t, err)

	var decoded ABTestConfig
	err = json.Unmarshal(data, &decoded)
	require.NoError(t, err)
	assert.Equal(t, "test-1", decoded.ID)
	assert.Equal(t, 70, decoded.TrafficSplit)
	assert.Equal(t, ABTestStatusRunning, decoded.Status)
}
