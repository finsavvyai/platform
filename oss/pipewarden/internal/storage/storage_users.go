package storage

import (
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"
)

// UserRecord is a row in the users table. password_hash is the bcrypt
// digest — never log, never return in API responses, only used for login
// verification and password change flows.
type UserRecord struct {
	ID              int64     `json:"id"`
	Email           string    `json:"email"`
	PasswordHash    string    `json:"-"`
	Name            string    `json:"name"`
	Company         string    `json:"company"`
	Onboarded       bool      `json:"onboarded"`
	EmailVerified   bool      `json:"email_verified"`
	PasswordVersion int64     `json:"-"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}

// ErrUserNotFound is returned when a lookup fails to find any matching
// row. Callers should map this to 401 (login) or 404 (admin lookup) at
// the HTTP boundary.
var ErrUserNotFound = errors.New("user not found")

// ErrUserExists is returned by CreateUser when the email is already
// registered. Maps to HTTP 409 at the boundary.
var ErrUserExists = errors.New("user already exists")

// CreateUser inserts a new user. Returns the created row including the
// auto-generated ID. Email is normalised to lowercase + trim — every
// caller must use the same canonical form for lookup.
func (s *DB) CreateUser(email, passwordHash, name, company string) (*UserRecord, error) {
	email = canonicalEmail(email)
	if email == "" {
		return nil, fmt.Errorf("email is required")
	}
	if passwordHash == "" {
		return nil, fmt.Errorf("password_hash is required")
	}

	q := s.dialectPlaceholders(`INSERT INTO users (email, password_hash, name, company) VALUES (?, ?, ?, ?)`)
	res, err := s.db.Exec(q, email, passwordHash, name, company)
	if err != nil {
		if isUniqueViolation(err) {
			return nil, ErrUserExists
		}
		return nil, fmt.Errorf("insert user: %w", err)
	}
	id, err := res.LastInsertId()
	if err != nil {
		// Postgres + lib/pq doesn't support LastInsertId — re-query by email.
		return s.GetUserByEmail(email)
	}
	return s.GetUserByID(id)
}

// GetUserByEmail looks up a user by canonical email. Returns
// ErrUserNotFound when no row matches.
func (s *DB) GetUserByEmail(email string) (*UserRecord, error) {
	q := s.dialectPlaceholders(`SELECT id, email, password_hash, name, company, onboarded, email_verified, password_version, created_at, updated_at FROM users WHERE email = ?`)
	row := s.db.QueryRow(q, canonicalEmail(email))
	return scanUserRow(row)
}

// GetUserByID looks up a user by primary key.
func (s *DB) GetUserByID(id int64) (*UserRecord, error) {
	q := s.dialectPlaceholders(`SELECT id, email, password_hash, name, company, onboarded, email_verified, password_version, created_at, updated_at FROM users WHERE id = ?`)
	row := s.db.QueryRow(q, id)
	return scanUserRow(row)
}

// MarkOnboarded toggles the onboarded flag + updates name/company in one
// shot. Used at the end of the signup-onboarding wizard.
func (s *DB) MarkOnboarded(id int64, name, company string) error {
	q := s.dialectPlaceholders(`UPDATE users SET name = ?, company = ?, onboarded = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
	if s.driver == EnginePostgres {
		q = `UPDATE users SET name = $1, company = $2, onboarded = TRUE, updated_at = NOW() WHERE id = $3`
	}
	_, err := s.db.Exec(q, name, company, id)
	if err != nil {
		return fmt.Errorf("update onboarded: %w", err)
	}
	return nil
}

func scanUserRow(row *sql.Row) (*UserRecord, error) {
	var u UserRecord
	err := row.Scan(&u.ID, &u.Email, &u.PasswordHash, &u.Name, &u.Company, &u.Onboarded, &u.EmailVerified, &u.PasswordVersion, &u.CreatedAt, &u.UpdatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrUserNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("scan user: %w", err)
	}
	return &u, nil
}

// canonicalEmail lowercases + trims. We don't normalise the local-part
// (no plus-stripping) so users can use email aliases as separate accounts.
func canonicalEmail(s string) string {
	return strings.ToLower(strings.TrimSpace(s))
}

// dialectPlaceholders converts SQLite "?" to Postgres "$N" when needed.
// Naive but sufficient: we don't use literal "?" inside user data here.
func (s *DB) dialectPlaceholders(q string) string {
	if s.driver != EnginePostgres {
		return q
	}
	out := make([]byte, 0, len(q))
	n := 0
	for i := 0; i < len(q); i++ {
		if q[i] == '?' {
			n++
			out = append(out, '$')
			out = append(out, []byte(fmt.Sprintf("%d", n))...)
			continue
		}
		out = append(out, q[i])
	}
	return string(out)
}

// isUniqueViolation peeks at the error string to detect duplicate-key
// errors across SQLite + Postgres. Cheap and good enough — both drivers
// surface a stable substring.
func isUniqueViolation(err error) bool {
	if err == nil {
		return false
	}
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "unique constraint") ||
		strings.Contains(msg, "unique") && strings.Contains(msg, "violat") ||
		strings.Contains(msg, "duplicate key")
}
