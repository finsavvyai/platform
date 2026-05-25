package storage

import (
	"database/sql"
	"fmt"
	"time"
)

// TemplateRow represents a persisted webhook notification template.
type TemplateRow struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Destination string    `json:"destination"`
	Template    string    `json:"template"`
	IsDefault   bool      `json:"is_default"`
	CreatedAt   time.Time `json:"created_at"`
}

// CreateTemplate inserts a new webhook template.
func (s *DB) CreateTemplate(t TemplateRow) error {
	query := s.bind(`INSERT INTO webhook_templates
		(id, name, destination, template, is_default, created_at)
		VALUES (?, ?, ?, ?, ?, ?)`)
	_, err := s.db.Exec(query,
		t.ID, t.Name, t.Destination, t.Template,
		s.boolValue(t.IsDefault), time.Now().UTC(),
	)
	if err != nil {
		return fmt.Errorf("failed to create template: %w", err)
	}
	return nil
}

// ListTemplates returns all webhook templates.
func (s *DB) ListTemplates() ([]TemplateRow, error) {
	rows, err := s.db.Query(`SELECT id, name, destination, template, is_default, created_at FROM webhook_templates ORDER BY created_at ASC`)
	if err != nil {
		return nil, fmt.Errorf("failed to list templates: %w", err)
	}
	defer func() { _ = rows.Close() }()

	var templates []TemplateRow
	for rows.Next() {
		tmpl, err := scanTemplateRow(rows)
		if err != nil {
			return nil, err
		}
		templates = append(templates, tmpl)
	}
	return templates, rows.Err()
}

// GetTemplate retrieves a single webhook template by id.
func (s *DB) GetTemplate(id string) (*TemplateRow, error) {
	rows, err := s.db.Query(
		s.bind(`SELECT id, name, destination, template, is_default, created_at FROM webhook_templates WHERE id=?`),
		id,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to get template: %w", err)
	}
	defer func() { _ = rows.Close() }()

	if !rows.Next() {
		return nil, fmt.Errorf("template not found")
	}
	tmpl, err := scanTemplateRow(rows)
	if err != nil {
		return nil, err
	}
	return &tmpl, nil
}

func scanTemplateRow(rows *sql.Rows) (TemplateRow, error) {
	var (
		t          TemplateRow
		rawDefault any
	)
	err := rows.Scan(&t.ID, &t.Name, &t.Destination, &t.Template, &rawDefault, &t.CreatedAt)
	t.IsDefault = dbToBool(rawDefault)
	return t, err
}
