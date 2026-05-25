package storage

import (
	"database/sql"
	"errors"
	"fmt"
)

// SetTOTPSecret stores or rotates the user's TOTP secret. enabled=false
// sets it as provisional (enrolment in progress); the user must prove
// they have the authenticator before TOTP becomes a login requirement.
func (s *DB) SetTOTPSecret(userID int64, secret string, enabled bool) error {
	enabledInt := 0
	if enabled {
		enabledInt = 1
	}
	q := s.dialectPlaceholders(`UPDATE users SET totp_secret = ?, totp_enabled = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
	if s.driver == EnginePostgres {
		q = `UPDATE users SET totp_secret = $1, totp_enabled = $2, updated_at = NOW() WHERE id = $3`
	}
	res, err := s.db.Exec(q, secret, enabledInt, userID)
	if err != nil {
		return fmt.Errorf("update totp: %w", err)
	}
	rows, _ := res.RowsAffected()
	if rows == 0 {
		return ErrUserNotFound
	}
	return nil
}

// GetTOTPState returns the secret + enabled flag for the user. The secret
// is empty when the user has never started enrolment.
func (s *DB) GetTOTPState(userID int64) (secret string, enabled bool, err error) {
	q := s.dialectPlaceholders(`SELECT totp_secret, totp_enabled FROM users WHERE id = ?`)
	row := s.db.QueryRow(q, userID)
	var enabledInt int
	if err = row.Scan(&secret, &enabledInt); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return "", false, ErrUserNotFound
		}
		return "", false, fmt.Errorf("scan totp: %w", err)
	}
	return secret, enabledInt != 0, nil
}
