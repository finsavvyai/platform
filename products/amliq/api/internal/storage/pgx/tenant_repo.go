package pgx

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"

	"github.com/aegis-aml/aegis/internal/domain"
)

type TenantRepository struct {
	db *sql.DB
}

func NewTenantRepository(db *sql.DB) *TenantRepository {
	return &TenantRepository{db: db}
}

func (r *TenantRepository) Create(tenant domain.Tenant) error {
	configJSON, err := json.Marshal(tenant.Config)
	if err != nil {
		return fmt.Errorf("marshal config: %w", err)
	}
	_, err = r.db.Exec(`
		INSERT INTO tenants (id, name, display_name, config, created_at,
		                     updated_at)
		VALUES ($1, $2, $3, $4, $5, $6)
	`,
		tenant.ID.String(),
		tenant.Name,
		tenant.DisplayName,
		configJSON,
		tenant.CreatedAt,
		tenant.UpdatedAt,
	)
	return err
}

func (r *TenantRepository) GetByName(name string) (*domain.Tenant, error) {
	row := r.db.QueryRow(`
		SELECT id, name, display_name, config, created_at, updated_at
		FROM tenants WHERE name = $1
	`, name)
	t, err := scanTenant(row)
	if err != nil && err.Error() == "sql: no rows in result set" {
		return nil, nil
	}
	return t, err
}

func (r *TenantRepository) GetByID(id domain.TenantID) (*domain.Tenant, error) {
	row := r.db.QueryRow(`
		SELECT id, name, display_name, config, created_at, updated_at
		FROM tenants WHERE id = $1
	`, id.String())

	return scanTenant(row)
}

func (r *TenantRepository) Update(tenant domain.Tenant) error {
	configJSON, err := json.Marshal(tenant.Config)
	if err != nil {
		return fmt.Errorf("marshal config: %w", err)
	}
	_, err = r.db.Exec(`
		UPDATE tenants SET name = $1, display_name = $2, config = $3,
		                   updated_at = $4 WHERE id = $5
	`,
		tenant.Name,
		tenant.DisplayName,
		configJSON,
		tenant.UpdatedAt,
		tenant.ID.String(),
	)
	return err
}

func (r *TenantRepository) List() ([]domain.Tenant, error) {
	rows, err := r.db.Query(`
		SELECT id, name, display_name, config, created_at, updated_at
		FROM tenants ORDER BY created_at DESC
	`)
	if err != nil {
		return nil, fmt.Errorf("query tenants: %w", err)
	}
	defer rows.Close()

	var results []domain.Tenant
	for rows.Next() {
		tenant, err := scanTenantFromRows(rows)
		if err != nil {
			// Skip sentinels like '__global__' (non-tnt_ id).
			log.Printf("tenants.List: skip row: %v", err)
			continue
		}
		results = append(results, *tenant)
	}
	return results, rows.Err()
}
