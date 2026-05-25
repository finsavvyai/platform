package types

// SchemaInfo represents database schema information returned by
// DatabaseAdapter.GetSchema / IntrospectSchema.
type SchemaInfo struct {
	Database string      `json:"database"`
	Tables   []TableInfo `json:"tables"`
}

// TableInfo represents the structural metadata of a single table.
type TableInfo struct {
	Name    string       `json:"name"`
	Schema  string       `json:"schema"`
	Type    string       `json:"type"`
	Columns []ColumnInfo `json:"columns"`
	Indexes []IndexInfo  `json:"indexes"`
}

// ColumnInfo represents a single column's metadata.
// Default mirrors DefaultValue for adapters that historically used either name.
type ColumnInfo struct {
	Name         string `json:"name"`
	Type         string `json:"type"`
	Nullable     bool   `json:"nullable"`
	DefaultValue string `json:"default_value"`
	Default      string `json:"default"` // Alias for DefaultValue to support legacy adapters
	IsPrimaryKey bool   `json:"is_primary_key"`
	IsForeignKey bool   `json:"is_foreign_key"`
}

// IndexInfo represents an index defined on a table.
type IndexInfo struct {
	Name    string   `json:"name"`
	Columns []string `json:"columns"`
	Unique  bool     `json:"unique"`
}
