package pgx

import (
	"context"
	"database/sql"

	"github.com/aegis-aml/aegis/internal/domain"
	"github.com/lib/pq"
)

type EntityClusterRepository struct {
	db *sql.DB
}

func NewEntityClusterRepository(db *sql.DB) *EntityClusterRepository {
	return &EntityClusterRepository{db: db}
}

func (r *EntityClusterRepository) Create(
	ctx context.Context, cluster domain.EntityCluster,
) error {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO entity_clusters
		(cluster_id, tenant_id, entity_ids, merged_name, confidence, status)
		VALUES ($1,$2,$3,$4,$5,$6)`,
		cluster.ClusterID, cluster.TenantID.String(),
		pq.Array(cluster.EntityIDs), cluster.MergedName,
		cluster.Confidence, cluster.Status)
	return err
}

func (r *EntityClusterRepository) ListByTenant(
	ctx context.Context, tenantID domain.TenantID,
) ([]domain.EntityCluster, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT cluster_id, tenant_id, entity_ids, merged_name,
		       confidence, status, created_at
		FROM entity_clusters WHERE tenant_id=$1
		ORDER BY created_at DESC`, tenantID.String())
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var clusters []domain.EntityCluster
	for rows.Next() {
		var c domain.EntityCluster
		var tid string
		if err := rows.Scan(&c.ClusterID, &tid,
			pq.Array(&c.EntityIDs), &c.MergedName,
			&c.Confidence, &c.Status, &c.CreatedAt); err != nil {
			return nil, err
		}
		c.TenantID, _ = domain.NewTenantID(tid)
		clusters = append(clusters, c)
	}
	return clusters, rows.Err()
}

func (r *EntityClusterRepository) UpdateStatus(
	ctx context.Context, clusterID, status string,
) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE entity_clusters SET status=$1 WHERE cluster_id=$2`,
		status, clusterID)
	return err
}
