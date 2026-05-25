package pgx

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	"github.com/aegis-aml/aegis/internal/domain"
)

func scanTenant(row *sql.Row) (*domain.Tenant, error) {
	var (
		id, name, displayName string
		config                []byte
		createdAt, updatedAt  time.Time
	)

	err := row.Scan(&id, &name, &displayName, &config, &createdAt, &updatedAt)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("scan tenant: %w", err)
	}

	return buildTenant(id, name, displayName, config, createdAt, updatedAt)
}

func scanTenantFromRows(rows *sql.Rows) (*domain.Tenant, error) {
	var (
		id, name, displayName string
		config                []byte
		createdAt, updatedAt  time.Time
	)

	err := rows.Scan(&id, &name, &displayName, &config, &createdAt, &updatedAt)
	if err != nil {
		return nil, fmt.Errorf("scan tenant: %w", err)
	}

	return buildTenant(id, name, displayName, config, createdAt, updatedAt)
}

func buildTenant(id, name, displayName string, config []byte,
	createdAt, updatedAt time.Time) (*domain.Tenant, error) {

	tenantID, err := domain.NewTenantID(id)
	if err != nil {
		return nil, err
	}

	tenant, err := domain.NewTenant(tenantID, name, displayName)
	if err != nil {
		return nil, err
	}

	if len(config) > 0 {
		json.Unmarshal(config, &tenant.Config)
	}

	tenant.CreatedAt = createdAt
	tenant.UpdatedAt = updatedAt

	return &tenant, nil
}
