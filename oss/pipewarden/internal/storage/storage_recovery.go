package storage

import (
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/base32"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"
)

// RecoveryCodeCount is how many one-shot codes we issue per generation.
// 8 matches GitHub / GitLab / 1Password convention; enough that a user
// can lose a device several times before regenerating, few enough that
// a stolen sheet of codes is brute-forceable in finite time only with
// the secret list.
const RecoveryCodeCount = 8

// GenerateRecoveryCodes issues a fresh batch of one-shot 2FA-recovery
// codes for the user, replacing any existing batch. Returns the
// plaintext codes (caller shows once + discards) and stores SHA-256
// hashes — we never persist plaintext. The user printing or saving
// the codes is the only record that survives.
func (s *DB) GenerateRecoveryCodes(userID int64) ([]string, error) {
	// Drop prior codes — re-generation is a "rotate everything" signal,
	// e.g. after suspected device loss.
	if _, err := s.db.Exec(s.dialectPlaceholders(`DELETE FROM recovery_codes WHERE user_id = ?`), userID); err != nil {
		return nil, fmt.Errorf("clear recovery codes: %w", err)
	}

	codes := make([]string, RecoveryCodeCount)
	for i := range codes {
		c, err := newRecoveryCode()
		if err != nil {
			return nil, err
		}
		codes[i] = c
		hash := hashRecoveryCode(c)
		_, err = s.db.Exec(s.dialectPlaceholders(`INSERT INTO recovery_codes (user_id, code_hash) VALUES (?, ?)`), userID, hash)
		if err != nil {
			return nil, fmt.Errorf("store recovery code: %w", err)
		}
	}
	return codes, nil
}

// ConsumeRecoveryCode atomically marks a code used and returns nil on
// success. ErrTokenInvalid for unknown / already-used codes — same
// generic error as the auth-token consumer, no enumeration.
func (s *DB) ConsumeRecoveryCode(userID int64, code string) error {
	hash := hashRecoveryCode(code)
	q := s.dialectPlaceholders(`UPDATE recovery_codes SET used_at = CURRENT_TIMESTAMP WHERE user_id = ? AND code_hash = ? AND used_at IS NULL`)
	if s.driver == EnginePostgres {
		q = `UPDATE recovery_codes SET used_at = NOW() WHERE user_id = $1 AND code_hash = $2 AND used_at IS NULL`
	}
	res, err := s.db.Exec(q, userID, hash)
	if err != nil {
		return fmt.Errorf("consume recovery code: %w", err)
	}
	rows, _ := res.RowsAffected()
	if rows == 0 {
		return ErrTokenInvalid
	}
	return nil
}

// CountUnusedRecoveryCodes returns how many codes the user still has,
// for the /settings/ page to show ("4 codes remaining — regenerate if
// you're running low").
func (s *DB) CountUnusedRecoveryCodes(userID int64) (int, error) {
	q := s.dialectPlaceholders(`SELECT COUNT(*) FROM recovery_codes WHERE user_id = ? AND used_at IS NULL`)
	row := s.db.QueryRow(q, userID)
	var n int
	if err := row.Scan(&n); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return 0, nil
		}
		return 0, fmt.Errorf("count recovery codes: %w", err)
	}
	return n, nil
}

// newRecoveryCode returns a 10-char base32 (Crockford) code split with
// a hyphen for readability: "XXXXX-XXXXX". 50 bits of entropy — well
// above the 30-bit floor at which an 8-code batch resists brute force.
func newRecoveryCode() (string, error) {
	b := make([]byte, 7)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	enc := base32.StdEncoding.WithPadding(base32.NoPadding).EncodeToString(b)
	enc = strings.ToLower(enc)[:10]
	return enc[:5] + "-" + enc[5:], nil
}

// hashRecoveryCode normalises whitespace + case before hashing so the
// user can paste codes formatted any way they remember.
func hashRecoveryCode(code string) string {
	c := strings.ToLower(strings.ReplaceAll(strings.TrimSpace(code), " ", ""))
	sum := sha256.Sum256([]byte(c))
	return hex.EncodeToString(sum[:])
}
