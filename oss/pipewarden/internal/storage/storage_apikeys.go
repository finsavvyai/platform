package storage

import (
	"database/sql"
	"fmt"
	"time"
)

// APIKeyRecord represents a stored API key (hashed) for embed widget access.
type APIKeyRecord struct {
	ConnectionName string
	KeyHash        string
	CreatedAt      time.Time
}

// CreateAPIKey stores the SHA-256 hash of a new API key for the given connection.
// Only one key per connection is allowed (upsert).
func (s *DB) CreateAPIKey(connectionName, keyHash string) error {
	if connectionName == "" || keyHash == "" {
		return fmt.Errorf("connection_name and key_hash are required")
	}
	query := s.bind(`INSERT INTO api_keys (connection_name, key_hash, created_at)
		VALUES (?, ?, ?)
		ON CONFLICT(connection_name) DO UPDATE SET key_hash = excluded.key_hash, created_at = excluded.created_at`)
	_, err := s.db.Exec(query, connectionName, keyHash, time.Now().UTC())
	if err != nil {
		return fmt.Errorf("failed to store api key: %w", err)
	}
	return nil
}

// ValidateAPIKey looks up a connection by key hash and returns the connection name.
func (s *DB) ValidateAPIKey(keyHash string) (string, error) {
	if keyHash == "" {
		return "", fmt.Errorf("key_hash is required")
	}
	query := s.bind(`SELECT connection_name FROM api_keys WHERE key_hash = ?`)
	var connName string
	err := s.db.QueryRow(query, keyHash).Scan(&connName)
	if err == sql.ErrNoRows {
		return "", fmt.Errorf("api key not found")
	}
	if err != nil {
		return "", fmt.Errorf("failed to validate api key: %w", err)
	}
	return connName, nil
}

// DeleteAPIKey removes the API key for the given connection.
func (s *DB) DeleteAPIKey(connectionName string) error {
	if connectionName == "" {
		return fmt.Errorf("connection_name is required")
	}
	query := s.bind(`DELETE FROM api_keys WHERE connection_name = ?`)
	_, err := s.db.Exec(query, connectionName)
	if err != nil {
		return fmt.Errorf("failed to delete api key: %w", err)
	}
	return nil
}
