package storage

import (
	"database/sql"
	"fmt"
	"time"
)

// WaitlistSignup represents a marketing-site waitlist entry.
type WaitlistSignup struct {
	ID        int64     `json:"id"`
	Email     string    `json:"email"`
	Tier      string    `json:"tier"`
	Company   string    `json:"company,omitempty"`
	Source    string    `json:"source,omitempty"`
	CreatedAt time.Time `json:"created_at"`
}

// CreateWaitlistSignup inserts a waitlist entry.
func (s *DB) CreateWaitlistSignup(w WaitlistSignup) (int64, error) {
	if w.Email == "" {
		return 0, fmt.Errorf("email is required")
	}
	if w.Tier == "" {
		w.Tier = "starter"
	}
	now := time.Now().UTC()

	query := s.bind(`INSERT INTO waitlist_signups (email, tier, company, source, created_at)
		VALUES (?, ?, ?, ?, ?)`)

	if s.driver == EnginePostgres {
		var id int64
		err := s.db.QueryRow(query+` RETURNING id`,
			w.Email, w.Tier, w.Company, w.Source, now).Scan(&id)
		if err != nil {
			return 0, fmt.Errorf("insert waitlist signup: %w", err)
		}
		return id, nil
	}

	res, err := s.db.Exec(query, w.Email, w.Tier, w.Company, w.Source, now)
	if err != nil {
		return 0, fmt.Errorf("insert waitlist signup: %w", err)
	}
	return res.LastInsertId()
}

// CountWaitlistSignups returns the total number of waitlist entries.
func (s *DB) CountWaitlistSignups() (int, error) {
	var n sql.NullInt64
	err := s.db.QueryRow(`SELECT COUNT(*) FROM waitlist_signups`).Scan(&n)
	if err != nil {
		return 0, fmt.Errorf("count waitlist: %w", err)
	}
	return int(n.Int64), nil
}
