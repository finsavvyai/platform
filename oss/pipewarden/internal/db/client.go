package db

import (
	"context"
	"database/sql"
	"fmt"

	_ "github.com/mattn/go-sqlite3"
)

type Client struct {
	db *sql.DB
}

func New(dbPath string) (*Client, error) {
	db, err := sql.Open("sqlite3", dbPath)
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	client := &Client{db: db}
	if err := client.migrate(); err != nil {
		return nil, fmt.Errorf("migration failed: %w", err)
	}

	return client, nil
}

func (c *Client) migrate() error {
	schema := `
	CREATE TABLE IF NOT EXISTS analysis_records (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		connection_name TEXT NOT NULL,
		run_id TEXT NOT NULL,
		summary TEXT,
		risk_score INTEGER,
		findings_count INTEGER,
		tokens_used INTEGER,
		model TEXT,
		duration_ms INTEGER,
		analyzed_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS finding_records (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		connection_name TEXT NOT NULL,
		run_id TEXT NOT NULL,
		severity TEXT,
		category TEXT,
		title TEXT,
		description TEXT,
		remediation TEXT,
		file TEXT,
		line INTEGER,
		confidence REAL,
		status TEXT DEFAULT 'open',
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE INDEX IF NOT EXISTS idx_run_id ON analysis_records(run_id);
	CREATE INDEX IF NOT EXISTS idx_connection ON analysis_records(connection_name);
	`

	_, err := c.db.Exec(schema)
	return err
}

func (c *Client) Close() error {
	return c.db.Close()
}

func (c *Client) ListFindings(conn string) ([]map[string]interface{}, error) {
	query := "SELECT id, connection_name, run_id, severity, category, title, description, status FROM finding_records"
	if conn != "" {
		query += " WHERE connection_name = ?"
	}

	var rows *sql.Rows
	var err error
	if conn != "" {
		rows, err = c.db.Query(query, conn)
	} else {
		rows, err = c.db.Query(query)
	}

	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()

	var findings []map[string]interface{}
	for rows.Next() {
		var id int64
		var connName, runID, severity, category, title, description, status string
		if err := rows.Scan(&id, &connName, &runID, &severity, &category, &title, &description, &status); err != nil {
			return nil, err
		}
		findings = append(findings, map[string]interface{}{
			"id":              id,
			"connection_name": connName,
			"run_id":          runID,
			"severity":        severity,
			"category":        category,
			"title":           title,
			"description":     description,
			"status":          status,
		})
	}
	return findings, rows.Err()
}

func (c *Client) ListAnalysisHistory(conn string) ([]map[string]interface{}, error) {
	query := "SELECT id, connection_name, run_id, risk_score, findings_count, analyzed_at FROM analysis_records"
	if conn != "" {
		query += " WHERE connection_name = ?"
	}
	query += " ORDER BY analyzed_at DESC LIMIT 100"

	var rows *sql.Rows
	var err error
	if conn != "" {
		rows, err = c.db.Query(query, conn)
	} else {
		rows, err = c.db.Query(query)
	}

	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()

	var history []map[string]interface{}
	for rows.Next() {
		var id int64
		var connName, runID string
		var riskScore, findingsCount int
		var analyzedAt string
		if err := rows.Scan(&id, &connName, &runID, &riskScore, &findingsCount, &analyzedAt); err != nil {
			return nil, err
		}
		history = append(history, map[string]interface{}{
			"id":              id,
			"connection_name": connName,
			"run_id":          runID,
			"risk_score":      riskScore,
			"findings_count":  findingsCount,
			"analyzed_at":     analyzedAt,
		})
	}
	return history, rows.Err()
}

func (c *Client) GetFindingStats() (map[string]int, error) {
	query := "SELECT severity, COUNT(*) FROM finding_records GROUP BY severity"
	rows, err := c.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()

	stats := make(map[string]int)
	for rows.Next() {
		var severity string
		var count int
		if err := rows.Scan(&severity, &count); err != nil {
			return nil, err
		}
		stats[severity] = count
	}
	return stats, rows.Err()
}

func (c *Client) GetProviders(ctx context.Context) ([]map[string]interface{}, error) {
	return []map[string]interface{}{}, nil
}

func (c *Client) TestAllProviders(ctx context.Context) ([]map[string]interface{}, error) {
	return []map[string]interface{}{}, nil
}

func (c *Client) ProcessPaymentEvent(ctx context.Context, event map[string]interface{}) error {
	return nil
}
