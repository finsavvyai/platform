package pgx

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/aegis-aml/aegis/internal/domain"
)

type BatchRepository struct {
	db *sql.DB
}

func NewBatchRepository(db *sql.DB) *BatchRepository {
	return &BatchRepository{db: db}
}

func (r *BatchRepository) Create(ctx context.Context, job domain.BatchJob) error {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO batch_jobs (id, tenant_id, entity_count, processed_at,
			match_count, status, format, error_message, created_at, completed_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
		job.ID, job.TenantID.String(), job.EntityCount, job.ProcessedAt,
		job.MatchCount, string(job.Status), job.Format,
		nullString(job.ErrorMessage), job.CreatedAt, job.CompletedAt,
	)
	return err
}

func (r *BatchRepository) GetByID(ctx context.Context, id string) (*domain.BatchJob, error) {
	var job domain.BatchJob
	var tenantStr, status, format string
	var errMsg sql.NullString

	err := r.db.QueryRowContext(ctx, `
		SELECT id, tenant_id, entity_count, processed_at, match_count,
		       status, format, error_message, created_at, completed_at
		FROM batch_jobs WHERE id=$1`, id).Scan(
		&job.ID, &tenantStr, &job.EntityCount, &job.ProcessedAt,
		&job.MatchCount, &status, &format, &errMsg,
		&job.CreatedAt, &job.CompletedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("batch not found: %w", err)
	}
	job.TenantID, _ = domain.NewTenantID(tenantStr)
	job.Status = domain.BatchStatus(status)
	job.Format = format
	if errMsg.Valid {
		job.ErrorMessage = errMsg.String
	}
	return &job, nil
}

func (r *BatchRepository) Update(ctx context.Context, job domain.BatchJob) error {
	_, err := r.db.ExecContext(ctx, `
		UPDATE batch_jobs SET processed_at=$1, match_count=$2, status=$3,
		  error_message=$4, completed_at=$5 WHERE id=$6`,
		job.ProcessedAt, job.MatchCount, string(job.Status),
		nullString(job.ErrorMessage), job.CompletedAt, job.ID,
	)
	return err
}
