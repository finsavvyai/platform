package storage

import (
	"database/sql"
	"fmt"
	"time"
)

// TeamMemberRow represents a row in the team_members table.
type TeamMemberRow struct {
	ID        int64      `json:"id"`
	Email     string     `json:"email"`
	Role      string     `json:"role"`
	Status    string     `json:"status"`
	InvitedAt time.Time  `json:"invited_at"`
	JoinedAt  *time.Time `json:"joined_at,omitempty"`
}

// ensureTeamMembersTable creates the team_members table if it doesn't exist.
func (s *DB) ensureTeamMembersTable() error {
	idType := "INTEGER PRIMARY KEY AUTOINCREMENT"
	nowExpr := "CURRENT_TIMESTAMP"
	tsType := s.timestampType()
	if s.driver == EnginePostgres {
		idType = "BIGSERIAL PRIMARY KEY"
		nowExpr = "NOW()"
	}
	stmt := fmt.Sprintf(`
CREATE TABLE IF NOT EXISTS team_members (
    id         %s,
    email      TEXT NOT NULL UNIQUE,
    role       TEXT NOT NULL DEFAULT 'member',
    status     TEXT NOT NULL DEFAULT 'invited',
    invited_at %s NOT NULL DEFAULT %s,
    joined_at  %s
)`, idType, tsType, nowExpr, tsType)
	_, err := s.db.Exec(stmt)
	return err
}

// InviteMember inserts a new team member in 'invited' status.
func (s *DB) InviteMember(email, role string) error {
	if err := s.ensureTeamMembersTable(); err != nil {
		return fmt.Errorf("ensure team_members: %w", err)
	}
	query := s.bind(`INSERT INTO team_members (email, role, status, invited_at) VALUES (?, ?, 'invited', CURRENT_TIMESTAMP)`)
	if s.driver == EnginePostgres {
		query = `INSERT INTO team_members (email, role, status, invited_at) VALUES ($1, $2, 'invited', NOW())`
	}
	if _, err := s.db.Exec(query, email, role); err != nil {
		return fmt.Errorf("invite member: %w", err)
	}
	return nil
}

// ListMembers returns all team members ordered by invite time.
func (s *DB) ListMembers() ([]TeamMemberRow, error) {
	if err := s.ensureTeamMembersTable(); err != nil {
		return nil, fmt.Errorf("ensure team_members: %w", err)
	}
	rows, err := s.db.Query(`SELECT id, email, role, status, invited_at, joined_at FROM team_members ORDER BY invited_at ASC`)
	if err != nil {
		return nil, fmt.Errorf("list members: %w", err)
	}
	defer func() { _ = rows.Close() }()

	var members []TeamMemberRow
	for rows.Next() {
		m, err := scanTeamMember(rows)
		if err != nil {
			return nil, err
		}
		members = append(members, *m)
	}
	return members, rows.Err()
}

// RemoveMember deletes a team member by email.
func (s *DB) RemoveMember(email string) error {
	if err := s.ensureTeamMembersTable(); err != nil {
		return fmt.Errorf("ensure team_members: %w", err)
	}
	result, err := s.db.Exec(s.bind(`DELETE FROM team_members WHERE email = ?`), email)
	if err != nil {
		return fmt.Errorf("remove member: %w", err)
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		return fmt.Errorf("member %q not found", email)
	}
	return nil
}

// UpdateRole changes the role of a team member by email.
func (s *DB) UpdateRole(email, role string) error {
	if err := s.ensureTeamMembersTable(); err != nil {
		return fmt.Errorf("ensure team_members: %w", err)
	}
	result, err := s.db.Exec(s.bind(`UPDATE team_members SET role = ? WHERE email = ?`), role, email)
	if err != nil {
		return fmt.Errorf("update role: %w", err)
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		return fmt.Errorf("member %q not found", email)
	}
	return nil
}

func scanTeamMember(scanner rowScanner) (*TeamMemberRow, error) {
	var m TeamMemberRow
	var joinedAt sql.NullTime
	if err := scanner.Scan(&m.ID, &m.Email, &m.Role, &m.Status, &m.InvitedAt, &joinedAt); err != nil {
		return nil, fmt.Errorf("scan team member: %w", err)
	}
	if joinedAt.Valid {
		m.JoinedAt = &joinedAt.Time
	}
	return &m, nil
}
