package ml

import (
	"context"
	"sync"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestValidateTrainingMetrics_Valid(t *testing.T) {
	m := TrainingMetrics{
		Accuracy:           0.95,
		Precision:          0.93,
		Recall:             0.91,
		F1Score:            0.92,
		AUCROC:             0.97,
		TrainingDurationMs: 5000,
		DatasetSize:        10000,
	}
	assert.NoError(t, ValidateTrainingMetrics(m))
}

func TestValidateTrainingMetrics_InvalidValues(t *testing.T) {
	tests := []struct {
		name    string
		metrics TrainingMetrics
	}{
		{"negative accuracy", TrainingMetrics{Accuracy: -0.1, DatasetSize: 1}},
		{"accuracy > 1", TrainingMetrics{Accuracy: 1.1, DatasetSize: 1}},
		{"negative precision", TrainingMetrics{Precision: -0.5, DatasetSize: 1}},
		{"negative recall", TrainingMetrics{Recall: -0.1, DatasetSize: 1}},
		{"f1 > 1", TrainingMetrics{F1Score: 1.5, DatasetSize: 1}},
		{"auc_roc > 1", TrainingMetrics{AUCROC: 2.0, DatasetSize: 1}},
		{"negative duration", TrainingMetrics{TrainingDurationMs: -1, DatasetSize: 1}},
		{"zero dataset", TrainingMetrics{DatasetSize: 0}},
		{"negative dataset", TrainingMetrics{DatasetSize: -5}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Error(t, ValidateTrainingMetrics(tt.metrics))
		})
	}
}

func TestTriggerRetrain_ConcurrentSafety(t *testing.T) {
	orch := NewInMemoryOrchestrator()
	ctx := context.Background()

	var wg sync.WaitGroup
	results := make(chan error, 20)

	// 20 goroutines all trying to trigger same tenant+model
	for i := 0; i < 20; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_, err := orch.TriggerRetrain(ctx, "tenant-1", "fraud-score")
			results <- err
		}()
	}
	wg.Wait()
	close(results)

	successCount := 0
	for err := range results {
		if err == nil {
			successCount++
		}
	}
	// Exactly one goroutine should succeed
	assert.Equal(t, 1, successCount)
}
