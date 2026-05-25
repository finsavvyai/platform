// Package models contains domain model types shared across gateway services.
package models

// JSONB is a type alias for arbitrary JSON-compatible data stored in
// PostgreSQL JSONB columns.
type JSONB map[string]interface{}
