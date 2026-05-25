// Package ml provides machine learning model management for fraud detection.
package ml

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/google/uuid"
)

// JobStatus represents the lifecycle state of a training job.
type JobStatus string

const (
	JobStatusQueued     JobStatus = "QUEUED"
	JobStatusTraining   JobStatus = "TRAINING"
	JobStatusEvaluating JobStatus = "EVALUATING"
	JobStatusPromoting  JobStatus = "PROMOTING"
	JobStatusRejected   JobStatus = "REJECTED"
	JobStatusFailed     JobStatus = "FAILED"
	JobStatusCompleted  JobStatus = "COMPLETED"
)

var (
	ErrActiveJobExists = errors.New("active training job already exists for this model type")
	ErrJobNotFound     = errors.New("training job not found")
	ErrInvalidTenantID = errors.New("tenant ID is required")
	ErrInvalidModel    = errors.New("model type is required")
)

// TrainingMetrics holds evaluation metrics for a completed training run.
type TrainingMetrics struct {
	Accuracy           float64 `json:"accuracy"`
	Precision          float64 `json:"precision"`
	Recall             float64 `json:"recall"`
	F1Score            float64 `json:"f1_score"`
	AUCROC             float64 `json:"auc_roc"`
	TrainingDurationMs int64   `json:"training_duration_ms"`
	DatasetSize        int     `json:"dataset_size"`
}

// TrainingJob represents a single model retraining run.
type TrainingJob struct {
	ID          string           `json:"id"`
	TenantID    string           `json:"tenant_id"`
	ModelType   string           `json:"model_type"`
	Status      JobStatus        `json:"status"`
	StartedAt   time.Time        `json:"started_at"`
	CompletedAt *time.Time       `json:"completed_at,omitempty"`
	Metrics     *TrainingMetrics `json:"metrics,omitempty"`
	Error       string           `json:"error,omitempty"`
	CreatedAt   time.Time        `json:"created_at"`
}

// isActive returns true if the job is in an active (non-terminal) state.
func (j *TrainingJob) isActive() bool {
	switch j.Status {
	case JobStatusQueued, JobStatusTraining, JobStatusEvaluating, JobStatusPromoting:
		return true
	default:
		return false
	}
}

// TrainingOrchestrator manages the lifecycle of model retraining jobs.
type TrainingOrchestrator interface {
	TriggerRetrain(ctx context.Context, tenantID, modelType string) (*TrainingJob, error)
	GetJobStatus(ctx context.Context, tenantID, jobID string) (*TrainingJob, error)
	ListJobs(ctx context.Context, tenantID string, limit, offset int) ([]*TrainingJob, int, error)
}

// ValidateTrainingMetrics checks that all metric values are within valid ranges.
func ValidateTrainingMetrics(m TrainingMetrics) error {
	fields := map[string]float64{
		"accuracy":  m.Accuracy,
		"precision": m.Precision,
		"recall":    m.Recall,
		"f1_score":  m.F1Score,
		"auc_roc":   m.AUCROC,
	}
	for name, val := range fields {
		if val < 0 || val > 1 {
			return fmt.Errorf("%s must be between 0 and 1, got %f", name, val)
		}
	}
	if m.TrainingDurationMs < 0 {
		return fmt.Errorf("training duration must be non-negative")
	}
	if m.DatasetSize <= 0 {
		return fmt.Errorf("dataset size must be positive")
	}
	return nil
}

// InMemoryOrchestrator is a thread-safe in-memory TrainingOrchestrator.
type InMemoryOrchestrator struct {
	mu   sync.RWMutex
	jobs []*TrainingJob
}

// NewInMemoryOrchestrator creates a new in-memory orchestrator.
func NewInMemoryOrchestrator() *InMemoryOrchestrator {
	return &InMemoryOrchestrator{
		jobs: make([]*TrainingJob, 0),
	}
}

// TriggerRetrain creates a new training job if no active job exists
// for the given tenant and model type combination.
func (o *InMemoryOrchestrator) TriggerRetrain(
	_ context.Context, tenantID, modelType string,
) (*TrainingJob, error) {
	if tenantID == "" {
		return nil, ErrInvalidTenantID
	}
	if modelType == "" {
		return nil, ErrInvalidModel
	}
	o.mu.Lock()
	defer o.mu.Unlock()

	for _, j := range o.jobs {
		if j.TenantID == tenantID && j.ModelType == modelType && j.isActive() {
			return nil, ErrActiveJobExists
		}
	}

	now := time.Now().UTC()
	job := &TrainingJob{
		ID:        uuid.New().String(),
		TenantID:  tenantID,
		ModelType: modelType,
		Status:    JobStatusQueued,
		StartedAt: now,
		CreatedAt: now,
	}
	o.jobs = append(o.jobs, job)
	return job, nil
}

// GetJobStatus retrieves a training job by tenant and job ID.
func (o *InMemoryOrchestrator) GetJobStatus(
	_ context.Context, tenantID, jobID string,
) (*TrainingJob, error) {
	o.mu.RLock()
	defer o.mu.RUnlock()

	for _, j := range o.jobs {
		if j.TenantID == tenantID && j.ID == jobID {
			return j, nil
		}
	}
	return nil, ErrJobNotFound
}

// ListJobs returns paginated training jobs for a tenant.
func (o *InMemoryOrchestrator) ListJobs(
	_ context.Context, tenantID string, limit, offset int,
) ([]*TrainingJob, int, error) {
	o.mu.RLock()
	defer o.mu.RUnlock()

	var filtered []*TrainingJob
	for _, j := range o.jobs {
		if j.TenantID == tenantID {
			filtered = append(filtered, j)
		}
	}
	total := len(filtered)
	if offset >= total {
		return []*TrainingJob{}, total, nil
	}
	end := offset + limit
	if end > total {
		end = total
	}
	return filtered[offset:end], total, nil
}
