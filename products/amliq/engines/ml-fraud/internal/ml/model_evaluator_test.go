package ml

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestEvaluate_PerfectPredictions(t *testing.T) {
	ev := NewInMemoryEvaluator()
	dataset := []EvaluationSample{
		{Features: map[string]float64{"a": 1}, Label: true, PredictedScore: 0.9},
		{Features: map[string]float64{"a": 2}, Label: true, PredictedScore: 0.8},
		{Features: map[string]float64{"a": 3}, Label: false, PredictedScore: 0.1},
		{Features: map[string]float64{"a": 4}, Label: false, PredictedScore: 0.2},
	}

	result, err := ev.Evaluate(context.Background(), "t1", "v1", dataset)
	require.NoError(t, err)

	assert.Equal(t, "t1", result.TenantID)
	assert.Equal(t, "v1", result.ModelVersionID)
	assert.Equal(t, 4, result.SampleCount)
	assert.Equal(t, 1.0, result.Accuracy)
	assert.Equal(t, 1.0, result.Precision)
	assert.Equal(t, 1.0, result.Recall)
	assert.Equal(t, 1.0, result.F1Score)
	assert.Equal(t, 1.0, result.AUCROC)
	assert.Equal(t, 0.0, result.FalsePositiveRate)
	assert.NotEmpty(t, result.ID)
	assert.False(t, result.EvaluatedAt.IsZero())
}

func TestEvaluate_MixedPredictions(t *testing.T) {
	ev := NewInMemoryEvaluator()
	dataset := []EvaluationSample{
		{Label: true, PredictedScore: 0.9},  // TP
		{Label: true, PredictedScore: 0.3},  // FN
		{Label: false, PredictedScore: 0.7}, // FP
		{Label: false, PredictedScore: 0.2}, // TN
	}

	result, err := ev.Evaluate(context.Background(), "t1", "v2", dataset)
	require.NoError(t, err)

	// TP=1, FP=1, TN=1, FN=1
	assert.Equal(t, 0.5, result.Accuracy)
	assert.Equal(t, 0.5, result.Precision)
	assert.Equal(t, 0.5, result.Recall)
	assert.Equal(t, 0.5, result.F1Score)
	assert.Equal(t, 0.5, result.FalsePositiveRate)
}

func TestEvaluate_EmptyDataset(t *testing.T) {
	ev := NewInMemoryEvaluator()

	result, err := ev.Evaluate(context.Background(), "t1", "v1", nil)
	assert.Nil(t, result)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "dataset must not be empty")

	result2, err2 := ev.Evaluate(context.Background(), "t1", "v1", []EvaluationSample{})
	assert.Nil(t, result2)
	require.Error(t, err2)
}

func TestCompare_CandidateBetter(t *testing.T) {
	ev := NewInMemoryEvaluator()
	current := &EvaluationResult{F1Score: 0.7}
	candidate := &EvaluationResult{F1Score: 0.85}

	cmp, err := ev.Compare(context.Background(), current, candidate, 0.05)
	require.NoError(t, err)

	assert.True(t, cmp.ShouldPromote)
	assert.InDelta(t, 0.15, cmp.ImprovementMargin, 1e-9)
	assert.Contains(t, cmp.Reason, "improves")
}

func TestCompare_CandidateWorse(t *testing.T) {
	ev := NewInMemoryEvaluator()
	current := &EvaluationResult{F1Score: 0.9}
	candidate := &EvaluationResult{F1Score: 0.85}

	cmp, err := ev.Compare(context.Background(), current, candidate, 0.05)
	require.NoError(t, err)

	assert.False(t, cmp.ShouldPromote)
	assert.InDelta(t, -0.05, cmp.ImprovementMargin, 1e-9)
	assert.Contains(t, cmp.Reason, "does not meet")
}

func TestCompare_ExactMarginBoundary(t *testing.T) {
	ev := NewInMemoryEvaluator()
	current := &EvaluationResult{F1Score: 0.5}
	candidate := &EvaluationResult{F1Score: 0.75}

	// Margin of 0.25 exactly meets minMargin of 0.25 (>=)
	cmp, err := ev.Compare(context.Background(), current, candidate, 0.25)
	require.NoError(t, err)
	assert.True(t, cmp.ShouldPromote)

	// Margin of 0.25 does not meet minMargin of 0.26
	cmp2, err2 := ev.Compare(context.Background(), current, candidate, 0.26)
	require.NoError(t, err2)
	assert.False(t, cmp2.ShouldPromote)
}

func TestCompare_NilInputs(t *testing.T) {
	ev := NewInMemoryEvaluator()

	_, err := ev.Compare(context.Background(), nil, &EvaluationResult{}, 0.05)
	require.Error(t, err)

	_, err2 := ev.Compare(context.Background(), &EvaluationResult{}, nil, 0.05)
	require.Error(t, err2)
}

func TestCalculateF1_ZeroPrecisionAndRecall(t *testing.T) {
	assert.Equal(t, 0.0, calculateF1(0, 0))
}

func TestCalculateF1_ZeroPrecisionOnly(t *testing.T) {
	assert.Equal(t, 0.0, calculateF1(0, 1.0))
}

func TestCalculateF1_ZeroRecallOnly(t *testing.T) {
	assert.Equal(t, 0.0, calculateF1(1.0, 0))
}

func TestCalculateF1_PerfectScores(t *testing.T) {
	assert.Equal(t, 1.0, calculateF1(1.0, 1.0))
}

func TestCalculateF1_TypicalValues(t *testing.T) {
	// F1 = 2 * 0.8 * 0.6 / (0.8 + 0.6) = 0.96 / 1.4 ~= 0.6857
	f1 := calculateF1(0.8, 0.6)
	assert.InDelta(t, 0.6857, f1, 0.001)
}

func TestAUCROC_PerfectSeparation(t *testing.T) {
	dataset := []EvaluationSample{
		{Label: true, PredictedScore: 0.9},
		{Label: true, PredictedScore: 0.8},
		{Label: false, PredictedScore: 0.2},
		{Label: false, PredictedScore: 0.1},
	}
	auc := computeAUCROC(dataset)
	assert.Equal(t, 1.0, auc)
}

func TestAUCROC_RandomPerformance(t *testing.T) {
	dataset := []EvaluationSample{
		{Label: true, PredictedScore: 0.9},
		{Label: false, PredictedScore: 0.8},
		{Label: true, PredictedScore: 0.3},
		{Label: false, PredictedScore: 0.2},
	}
	auc := computeAUCROC(dataset)
	assert.InDelta(t, 0.5, auc, 0.25)
}

func TestAUCROC_NoPositives(t *testing.T) {
	dataset := []EvaluationSample{
		{Label: false, PredictedScore: 0.5},
	}
	assert.Equal(t, 0.0, computeAUCROC(dataset))
}
