package storage

import (
	"fmt"
	"time"
)

// Create inserts a new connection record.
func (s *DB) Create(rec *ConnectionRecord) error {
	s.normalizeConnection(rec)
	now := time.Now().UTC()
	rec.CreatedAt = now
	rec.UpdatedAt = now

	query := s.bind(`INSERT INTO connections (name, platform, auth_method, token, username, app_password, base_url, provider_identity, installation_id, credential_ref, health_status, last_verified_at, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)

	if s.driver == EnginePostgres {
		return s.db.QueryRow(query+` RETURNING id`,
			rec.Name, rec.Platform, rec.AuthMethod, rec.Token, rec.Username, rec.AppPassword, rec.BaseURL,
			rec.ProviderIdentity, rec.InstallationID, rec.CredentialRef, rec.HealthStatus, rec.LastVerifiedAt, rec.CreatedAt, rec.UpdatedAt,
		).Scan(&rec.ID)
	}

	result, err := s.db.Exec(query,
		rec.Name, rec.Platform, rec.AuthMethod, rec.Token, rec.Username, rec.AppPassword, rec.BaseURL,
		rec.ProviderIdentity, rec.InstallationID, rec.CredentialRef, rec.HealthStatus, rec.LastVerifiedAt, rec.CreatedAt, rec.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("failed to insert connection: %w", err)
	}
	rec.ID, _ = result.LastInsertId()
	return nil
}

// SaveConnection upserts a connection record by name.
func (s *DB) SaveConnection(rec *ConnectionRecord) error {
	s.normalizeConnection(rec)
	now := time.Now().UTC()
	if rec.CreatedAt.IsZero() {
		rec.CreatedAt = now
	}
	rec.UpdatedAt = now

	query := s.bind(`INSERT INTO connections (name, platform, auth_method, token, username, app_password, base_url, provider_identity, installation_id, credential_ref, health_status, last_verified_at, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(name) DO UPDATE SET
			platform = excluded.platform,
			auth_method = excluded.auth_method,
			token = excluded.token,
			username = excluded.username,
			app_password = excluded.app_password,
			base_url = excluded.base_url,
			provider_identity = excluded.provider_identity,
			installation_id = excluded.installation_id,
			credential_ref = excluded.credential_ref,
			health_status = excluded.health_status,
			last_verified_at = excluded.last_verified_at,
			updated_at = excluded.updated_at`)

	if _, err := s.db.Exec(query,
		rec.Name, rec.Platform, rec.AuthMethod, rec.Token, rec.Username, rec.AppPassword, rec.BaseURL,
		rec.ProviderIdentity, rec.InstallationID, rec.CredentialRef, rec.HealthStatus, rec.LastVerifiedAt, rec.CreatedAt, rec.UpdatedAt,
	); err != nil {
		return fmt.Errorf("failed to save connection: %w", err)
	}

	saved, err := s.GetByName(rec.Name)
	if err != nil {
		return err
	}
	*rec = *saved
	return nil
}

// GetByName retrieves a connection by its unique name.
func (s *DB) GetByName(name string) (*ConnectionRecord, error) {
	row := s.db.QueryRow(
		s.bind(`SELECT id, name, platform, auth_method, token, username, app_password, base_url, provider_identity, installation_id, credential_ref, health_status, last_verified_at, created_at, updated_at
			FROM connections WHERE name = ?`),
		name,
	)
	return scanConnection(row)
}

// List returns all connection records, ordered by creation time.
func (s *DB) List() ([]ConnectionRecord, error) {
	rows, err := s.db.Query(
		`SELECT id, name, platform, auth_method, token, username, app_password, base_url, provider_identity, installation_id, credential_ref, health_status, last_verified_at, created_at, updated_at
		 FROM connections ORDER BY created_at ASC`,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to list connections: %w", err)
	}
	defer func() { _ = rows.Close() }()

	var records []ConnectionRecord
	for rows.Next() {
		rec, err := scanConnection(rows)
		if err != nil {
			return nil, err
		}
		records = append(records, *rec)
	}
	return records, rows.Err()
}

// ListByPlatform returns connections filtered by platform.
func (s *DB) ListByPlatform(platform string) ([]ConnectionRecord, error) {
	rows, err := s.db.Query(
		s.bind(`SELECT id, name, platform, auth_method, token, username, app_password, base_url, provider_identity, installation_id, credential_ref, health_status, last_verified_at, created_at, updated_at
		 FROM connections WHERE platform = ? ORDER BY created_at ASC`),
		platform,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to list connections: %w", err)
	}
	defer func() { _ = rows.Close() }()

	var records []ConnectionRecord
	for rows.Next() {
		rec, err := scanConnection(rows)
		if err != nil {
			return nil, err
		}
		records = append(records, *rec)
	}
	return records, rows.Err()
}

// Update modifies an existing connection by name.
func (s *DB) Update(rec *ConnectionRecord) error {
	s.normalizeConnection(rec)
	rec.UpdatedAt = time.Now().UTC()

	result, err := s.db.Exec(
		s.bind(`UPDATE connections
			SET platform = ?, auth_method = ?, token = ?, username = ?, app_password = ?, base_url = ?, provider_identity = ?, installation_id = ?, credential_ref = ?, health_status = ?, last_verified_at = ?, updated_at = ?
			WHERE name = ?`),
		rec.Platform, rec.AuthMethod, rec.Token, rec.Username, rec.AppPassword, rec.BaseURL, rec.ProviderIdentity,
		rec.InstallationID, rec.CredentialRef, rec.HealthStatus, rec.LastVerifiedAt, rec.UpdatedAt, rec.Name,
	)
	if err != nil {
		return fmt.Errorf("failed to update connection: %w", err)
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return fmt.Errorf("connection %q not found", rec.Name)
	}
	return nil
}

// UpdateConnectionHealth records the latest verification status for a connection.
func (s *DB) UpdateConnectionHealth(name, status, providerIdentity string, verifiedAt time.Time) error {
	result, err := s.db.Exec(
		s.bind(`UPDATE connections
			SET health_status = ?, provider_identity = CASE WHEN ? = '' THEN provider_identity ELSE ? END, last_verified_at = ?, updated_at = ?
			WHERE name = ?`),
		status, providerIdentity, providerIdentity, verifiedAt.UTC(), time.Now().UTC(), name,
	)
	if err != nil {
		return fmt.Errorf("failed to update connection health: %w", err)
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return fmt.Errorf("connection %q not found", name)
	}
	return nil
}

// Delete removes a connection by name.
func (s *DB) Delete(name string) error {
	result, err := s.db.Exec(s.bind(`DELETE FROM connections WHERE name = ?`), name)
	if err != nil {
		return fmt.Errorf("failed to delete connection: %w", err)
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return fmt.Errorf("connection %q not found", name)
	}
	return nil
}

// Count returns the total number of stored connections.
func (s *DB) Count() (int, error) {
	var count int
	err := s.db.QueryRow(`SELECT COUNT(*) FROM connections`).Scan(&count)
	return count, err
}
