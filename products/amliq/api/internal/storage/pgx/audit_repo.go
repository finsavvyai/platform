package pgx

import (
	"database/sql"
	"encoding/json"
	"fmt"

	"github.com/aegis-aml/aegis/internal/domain"
)

type AuditRepository struct {
	db *sql.DB
}

func NewAuditRepository(db *sql.DB) *AuditRepository {
	return &AuditRepository{db: db}
}

func (r *AuditRepository) Create(entry domain.AuditEntry) error {
	details, err := json.Marshal(entry.Details)
	if err != nil {
		return fmt.Errorf("marshal details: %w", err)
	}

	_, err = r.db.Exec(`
		INSERT INTO audit_entries (
			id, tenant_id, action, actor_id, resource_type, resource_id,
			details, previous_hash, hash, created_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
	`,
		entry.ID,
		entry.TenantID.String(),
		entry.Action.String(),
		entry.ActorID,
		entry.ResourceType,
		entry.ResourceID,
		details,
		entry.PreviousHash,
		entry.Hash,
		entry.Timestamp,
	)
	return err
}

func (r *AuditRepository) GetByID(id string) (*domain.AuditEntry, error) {
	return nil, fmt.Errorf("not implemented")
}

func (r *AuditRepository) ListByTenant(
	tenantID domain.TenantID) ([]domain.AuditEntry, error) {
	rows, err := r.db.Query(`
		SELECT id, tenant_id, action, actor_id, resource_type,
		       resource_id, details, previous_hash, hash, created_at
		FROM audit_entries WHERE tenant_id = $1 ORDER BY created_at DESC
	`, tenantID.String())
	if err != nil {
		return nil, fmt.Errorf("query audit: %w", err)
	}
	defer rows.Close()

	var results []domain.AuditEntry
	for rows.Next() {
		entry, err := scanAuditFromRows(rows)
		if err != nil {
			return nil, err
		}
		results = append(results, *entry)
	}
	return results, rows.Err()
}

func (r *AuditRepository) ListByResource(
	resourceID string) ([]domain.AuditEntry, error) {
	rows, err := r.db.Query(`
		SELECT id, tenant_id, action, actor_id, resource_type,
		       resource_id, details, previous_hash, hash, created_at
		FROM audit_entries WHERE resource_id = $1 ORDER BY created_at DESC
	`, resourceID)
	if err != nil {
		return nil, fmt.Errorf("query audit: %w", err)
	}
	defer rows.Close()

	var results []domain.AuditEntry
	for rows.Next() {
		entry, err := scanAuditFromRows(rows)
		if err != nil {
			return nil, err
		}
		results = append(results, *entry)
	}
	return results, rows.Err()
}
