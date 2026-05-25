package ml

import (
	"context"
	"errors"
	"math"
	"sort"
	"time"

	"github.com/google/uuid"
)

// EvaluationSample represents a single labeled prediction sample.
type EvaluationSample struct {
	Features       map[string]float64 `json:"features"`
	Label          bool               `json:"label"`
	PredictedScore float64            `json:"predicted_score"`
}

// EvaluationResult holds computed metrics from evaluating a model version.
type EvaluationResult struct {
	ID                string    `json:"id"`
	TenantID          string    `json:"tenant_id"`
	ModelVersionID    string    `json:"model_version_id"`
	Accuracy          float64   `json:"accuracy"`
	Precision         float64   `json:"precision"`
	Recall            float64   `json:"recall"`
	F1Score           float64   `json:"f1_score"`
	AUCROC            float64   `json:"auc_roc"`
	FalsePositiveRate float64   `json:"false_positive_rate"`
	SampleCount       int       `json:"sample_count"`
	EvaluatedAt       time.Time `json:"evaluated_at"`
}

// EvaluationComparison holds the result of comparing two model evaluations.
type EvaluationComparison struct {
	Current           EvaluationResult `json:"current"`
	Candidate         EvaluationResult `json:"candidate"`
	ImprovementMargin float64          `json:"improvement_margin"`
	ShouldPromote     bool             `json:"should_promote"`
	Reason            string           `json:"reason"`
}

// ModelEvaluator defines the interface for model evaluation and comparison.
type ModelEvaluator interface {
	Evaluate(ctx context.Context, tenantID string, modelVersionID string,
		dataset []EvaluationSample) (*EvaluationResult, error)
	Compare(ctx context.Context, current *EvaluationResult,
		candidate *EvaluationResult, minMargin float64) (*EvaluationComparison, error)
}

// InMemoryEvaluator implements ModelEvaluator with in-process computation.
type InMemoryEvaluator struct{}

// NewInMemoryEvaluator creates a new InMemoryEvaluator.
func NewInMemoryEvaluator() *InMemoryEvaluator {
	return &InMemoryEvaluator{}
}

// Evaluate computes classification metrics from labeled prediction samples.
func (e *InMemoryEvaluator) Evaluate(
	ctx context.Context, tenantID string, modelVersionID string,
	dataset []EvaluationSample,
) (*EvaluationResult, error) {
	if len(dataset) == 0 {
		return nil, errors.New("dataset must not be empty")
	}

	tp, fp, tn, fn := computeConfusionMatrix(dataset, 0.5)
	total := float64(tp + fp + tn + fn)

	precision := safeDivide(float64(tp), float64(tp+fp))
	recall := safeDivide(float64(tp), float64(tp+fn))

	return &EvaluationResult{
		ID:                uuid.New().String(),
		TenantID:          tenantID,
		ModelVersionID:    modelVersionID,
		Accuracy:          float64(tp+tn) / total,
		Precision:         precision,
		Recall:            recall,
		F1Score:           calculateF1(precision, recall),
		AUCROC:            computeAUCROC(dataset),
		FalsePositiveRate: safeDivide(float64(fp), float64(fp+tn)),
		SampleCount:       len(dataset),
		EvaluatedAt:       time.Now(),
	}, nil
}

// Compare checks whether the candidate model improves over the current model.
func (e *InMemoryEvaluator) Compare(
	ctx context.Context, current *EvaluationResult,
	candidate *EvaluationResult, minMargin float64,
) (*EvaluationComparison, error) {
	if current == nil || candidate == nil {
		return nil, errors.New("both current and candidate results are required")
	}

	margin := candidate.F1Score - current.F1Score
	promote := margin >= minMargin
	reason := "candidate does not meet minimum improvement margin"
	if promote {
		reason = "candidate improves F1 score by sufficient margin"
	}

	return &EvaluationComparison{
		Current:           *current,
		Candidate:         *candidate,
		ImprovementMargin: margin,
		ShouldPromote:     promote,
		Reason:            reason,
	}, nil
}

// calculateF1 computes the harmonic mean of precision and recall.
func calculateF1(precision, recall float64) float64 {
	if precision+recall == 0 {
		return 0
	}
	return 2 * precision * recall / (precision + recall)
}

func safeDivide(num, denom float64) float64 {
	if denom == 0 {
		return 0
	}
	return num / denom
}

func computeConfusionMatrix(
	dataset []EvaluationSample, threshold float64,
) (tp, fp, tn, fn int) {
	for _, s := range dataset {
		predicted := s.PredictedScore >= threshold
		switch {
		case s.Label && predicted:
			tp++
		case !s.Label && predicted:
			fp++
		case !s.Label && !predicted:
			tn++
		default:
			fn++
		}
	}
	return
}

// computeAUCROC calculates the area under the ROC curve using the
// trapezoidal rule over sorted thresholds.
func computeAUCROC(dataset []EvaluationSample) float64 {
	sorted := make([]EvaluationSample, len(dataset))
	copy(sorted, dataset)
	sort.Slice(sorted, func(i, j int) bool {
		return sorted[i].PredictedScore > sorted[j].PredictedScore
	})

	totalPos, totalNeg := 0, 0
	for _, s := range sorted {
		if s.Label {
			totalPos++
		} else {
			totalNeg++
		}
	}
	if totalPos == 0 || totalNeg == 0 {
		return 0
	}

	auc, tpCount, fpCount := 0.0, 0.0, 0.0
	prevFPR, prevTPR := 0.0, 0.0

	for _, s := range sorted {
		if s.Label {
			tpCount++
		} else {
			fpCount++
		}
		fpr := fpCount / float64(totalNeg)
		tpr := tpCount / float64(totalPos)
		auc += (fpr - prevFPR) * (tpr + prevTPR) / 2
		prevFPR, prevTPR = fpr, tpr
	}

	return math.Round(auc*1e6) / 1e6
}
