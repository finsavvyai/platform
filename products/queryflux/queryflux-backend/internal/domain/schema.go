package domain

type Schema struct {
	Tables []Table `json:"tables"`
}

type Table struct {
	Name    string   `json:"name"`
	Columns []Column `json:"columns"`
	Indexes []Index  `json:"indexes"`
}

type Column struct {
	Name       string `json:"name"`
	Type       string `json:"type"`
	Nullable   bool   `json:"nullable"`
	Default    string `json:"default,omitempty"`
	PrimaryKey bool   `json:"isPrimaryKey"`
}

type Index struct {
	Name    string   `json:"name"`
	Columns []string `json:"columns"`
	Unique  bool     `json:"unique"`
}

type SchemaRequest struct {
	DatabaseID string `json:"database_id" binding:"required"`
}
