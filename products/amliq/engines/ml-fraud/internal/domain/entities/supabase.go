package entities

import "time"

// RLSPolicy represents a Row-Level Security policy in Supabase
type RLSPolicy struct {
	Name       string    `json:"name"`
	Action     string    `json:"action"` // SELECT, INSERT, UPDATE, DELETE
	Roles      []string  `json:"roles"`
	Qualifier  string    `json:"qualifier"` // USING, WITH CHECK
	Definition string    `json:"definition"`
	Table      string    `json:"table"`
	Schema     string    `json:"schema"`
	CreatedAt  time.Time `json:"created_at"`
}

// SupabaseFunction represents a Postgres function in Supabase
type SupabaseFunction struct {
	ID         string    `json:"id"`
	Name       string    `json:"name"`
	Schema     string    `json:"schema"`
	Language   string    `json:"language"` // plpgsql, sql, etc.
	Definition string    `json:"definition"`
	ReturnType string    `json:"return_type"`
	Arguments  []string  `json:"arguments"`
	IsTrigger  bool      `json:"is_trigger"`
	CreatedAt  time.Time `json:"created_at"`
}

// SupabaseMetadata contains metadata about a Supabase project/database
type SupabaseMetadata struct {
	ProjectID     string             `json:"project_id"`
	ProjectName   string             `json:"project_name"`
	Region        string             `json:"region"`
	Functions     []SupabaseFunction `json:"functions"`
	Policies      []RLSPolicy        `json:"policies"`
	TablesCount   int                `json:"tables_count"`
	Version       string             `json:"version"`
	LastRefreshAt time.Time          `json:"last_refresh_at"`
}
