package pgx

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	"github.com/aegis-aml/aegis/internal/domain"
)

type UsageRepository struct {
	db *sql.DB
}

func NewUsageRepository(db *sql.DB) *UsageRepository {
	return &UsageRepository{db: db}
}

func (r *UsageRepository) GetOrCreate(
	ctx context.Context, tenantID domain.TenantID, product domain.Product, period string,
) (*domain.UsageRecord, error) {
	row := r.db.QueryRowContext(ctx, `
		SELECT id, tenant_id, product, period, metrics, last_updated_at
		FROM usage_records
		WHERE tenant_id=$1 AND product=$2 AND period=$3`,
		tenantID.String(), string(product), period)
	rec, err := scanUsageRecord(row)
	if err == nil {
		return rec, nil
	}
	return r.createRecord(ctx, tenantID, product, period)
}

func (r *UsageRepository) createRecord(
	ctx context.Context, tenantID domain.TenantID, product domain.Product, period string,
) (*domain.UsageRecord, error) {
	rec, _ := domain.NewUsageRecord(tenantID.String(), product, period)
	metricsJSON, _ := json.Marshal(rec.Metrics)
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO usage_records (id, tenant_id, product, period, metrics, last_updated_at)
		VALUES ($1,$2,$3,$4,$5,$6)
		ON CONFLICT (tenant_id, product, period) DO NOTHING`,
		rec.ID, tenantID.String(), string(product), period, metricsJSON, rec.LastUpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("create usage: %w", err)
	}
	return &rec, nil
}

func (r *UsageRepository) IncrementMetric(
	ctx context.Context, tenantID domain.TenantID, product domain.Product,
	period string, metric domain.UsageMetric, count int64,
) error {
	rec, err := r.GetOrCreate(ctx, tenantID, product, period)
	if err != nil {
		return err
	}
	rec.RecordUsage(metric, count)
	metricsJSON, _ := json.Marshal(rec.Metrics)
	_, err = r.db.ExecContext(ctx, `
		UPDATE usage_records SET metrics=$1, last_updated_at=$2
		WHERE tenant_id=$3 AND product=$4 AND period=$5`,
		metricsJSON, time.Now().UTC(),
		tenantID.String(), string(product), period)
	return err
}

func (r *UsageRepository) GetHistory(
	ctx context.Context, tenantID domain.TenantID, product domain.Product, months int,
) ([]domain.UsageRecord, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, tenant_id, product, period, metrics, last_updated_at
		FROM usage_records WHERE tenant_id=$1 AND product=$2
		ORDER BY period DESC LIMIT $3`,
		tenantID.String(), string(product), months)
	if err != nil {
		return nil, fmt.Errorf("query usage history: %w", err)
	}
	defer rows.Close()
	return collectUsageRecords(rows)
}
