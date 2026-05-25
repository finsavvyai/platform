package domain

import (
	"fmt"
	"time"
)

type BatchStatus string

const (
	BatchPending    BatchStatus = "pending"
	BatchProcessing BatchStatus = "processing"
	BatchCompleted  BatchStatus = "completed"
	BatchFailed     BatchStatus = "failed"
)

type BatchJob struct {
	ID           string
	TenantID     TenantID
	EntityCount  int
	ProcessedAt  int
	MatchCount   int
	Status       BatchStatus
	Format       string
	ErrorMessage string
	CreatedAt    time.Time
	CompletedAt  *time.Time
}

func NewBatchJob(tenantID TenantID, entityCount int, format string) (BatchJob, error) {
	if tenantID.IsZero() || entityCount <= 0 {
		return BatchJob{}, fmt.Errorf("tenant_id and entity_count required")
	}
	if format == "" {
		format = "csv"
	}
	return BatchJob{
		ID:          fmt.Sprintf("batch_%d", time.Now().UnixNano()),
		TenantID:    tenantID,
		EntityCount: entityCount,
		Status:      BatchPending,
		Format:      format,
		CreatedAt:   time.Now().UTC(),
	}, nil
}

func (b *BatchJob) MarkProcessing() {
	b.Status = BatchProcessing
}

func (b *BatchJob) MarkCompleted(matchCount int) {
	b.Status = BatchCompleted
	b.MatchCount = matchCount
	now := time.Now().UTC()
	b.CompletedAt = &now
}

func (b *BatchJob) MarkFailed(err string) {
	b.Status = BatchFailed
	b.ErrorMessage = err
	now := time.Now().UTC()
	b.CompletedAt = &now
}
