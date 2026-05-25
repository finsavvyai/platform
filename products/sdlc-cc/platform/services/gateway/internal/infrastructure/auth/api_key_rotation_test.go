package auth

import (
	"context"
	"errors"
	"log/slog"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/google/uuid"
)

func TestRotator_Rotate_HappyPath(t *testing.T) {
	db, mock, _ := sqlmock.New(sqlmock.QueryMatcherOption(sqlmock.QueryMatcherRegexp))
	defer func() { _ = db.Close() }()

	rot := NewRotator(db, time.Hour)
	rot.now = func() time.Time { return time.Unix(1_700_000_000, 0) }

	oldID := uuid.New()
	tenantID := uuid.New()
	mock.ExpectBegin()
	mock.ExpectQuery(`SELECT tenant_id, user_id, name, is_active, revoked_at`).
		WithArgs(oldID).
		WillReturnRows(sqlmock.NewRows([]string{"tenant_id", "user_id", "name", "is_active", "revoked_at"}).
			AddRow(tenantID, nil, "test", true, nil))
	mock.ExpectExec(`INSERT INTO api_keys`).WillReturnResult(sqlmock.NewResult(1, 1))
	mock.ExpectExec(`UPDATE api_keys\s+SET rotation_started_at`).
		WithArgs(rot.now(), rot.now().Add(time.Hour), oldID).
		WillReturnResult(sqlmock.NewResult(1, 1))
	mock.ExpectCommit()

	got, err := rot.Rotate(context.Background(), oldID, time.Hour)
	if err != nil {
		t.Fatalf("Rotate: %v", err)
	}
	if got.Plaintext == "" || got.Prefix == "" {
		t.Fatalf("issued key must carry plaintext + prefix")
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}

func TestRotator_Rotate_FailsWhenAlreadyRevoked(t *testing.T) {
	db, mock, _ := sqlmock.New(sqlmock.QueryMatcherOption(sqlmock.QueryMatcherRegexp))
	defer func() { _ = db.Close() }()
	rot := NewRotator(db, time.Hour)

	oldID := uuid.New()
	revoked := time.Now()
	mock.ExpectBegin()
	mock.ExpectQuery(`SELECT tenant_id, user_id, name, is_active, revoked_at`).
		WithArgs(oldID).
		WillReturnRows(sqlmock.NewRows([]string{"tenant_id", "user_id", "name", "is_active", "revoked_at"}).
			AddRow(uuid.New(), nil, "k", false, revoked))
	mock.ExpectRollback()

	_, err := rot.Rotate(context.Background(), oldID, time.Hour)
	if !errors.Is(err, ErrKeyAlreadyRevoked) {
		t.Fatalf("want ErrKeyAlreadyRevoked, got %v", err)
	}
}

func TestRotator_Revoke_Immediate(t *testing.T) {
	db, mock, _ := sqlmock.New(sqlmock.QueryMatcherOption(sqlmock.QueryMatcherRegexp))
	defer func() { _ = db.Close() }()
	rot := NewRotator(db, time.Hour)

	keyID := uuid.New()
	mock.ExpectExec(`UPDATE api_keys\s+SET is_active = false`).
		WillReturnResult(sqlmock.NewResult(0, 1))

	if err := rot.Revoke(context.Background(), keyID); err != nil {
		t.Fatalf("Revoke: %v", err)
	}
}

func TestRotator_Revoke_AlreadyRevoked(t *testing.T) {
	db, mock, _ := sqlmock.New(sqlmock.QueryMatcherOption(sqlmock.QueryMatcherRegexp))
	defer func() { _ = db.Close() }()
	rot := NewRotator(db, time.Hour)

	keyID := uuid.New()
	mock.ExpectExec(`UPDATE api_keys`).WillReturnResult(sqlmock.NewResult(0, 0))

	err := rot.Revoke(context.Background(), keyID)
	if !errors.Is(err, ErrKeyAlreadyRevoked) {
		t.Fatalf("want ErrKeyAlreadyRevoked, got %v", err)
	}
}

func TestSweeper_Sweep_RevokesExpiredKeys(t *testing.T) {
	db, mock, _ := sqlmock.New(sqlmock.QueryMatcherOption(sqlmock.QueryMatcherRegexp))
	defer func() { _ = db.Close() }()

	sw := NewSweeper(db, slog.Default(), time.Minute)
	fixedNow := time.Unix(1_700_000_000, 0)
	sw.now = func() time.Time { return fixedNow }

	mock.ExpectExec(`UPDATE api_keys\s+SET is_active = false`).
		WithArgs(fixedNow).
		WillReturnResult(sqlmock.NewResult(0, 3))

	if err := sw.Sweep(context.Background()); err != nil {
		t.Fatalf("Sweep: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}

func TestSweeper_Sweep_IsIdempotent(t *testing.T) {
	db, mock, _ := sqlmock.New(sqlmock.QueryMatcherOption(sqlmock.QueryMatcherRegexp))
	defer func() { _ = db.Close() }()

	sw := NewSweeper(db, slog.Default(), time.Minute)
	mock.ExpectExec(`UPDATE api_keys`).WillReturnResult(sqlmock.NewResult(0, 0))

	if err := sw.Sweep(context.Background()); err != nil {
		t.Fatalf("idempotent Sweep: %v", err)
	}
}

func TestGenerateKey_PrefixesWithSDLC(t *testing.T) {
	plaintext, prefix, hash, err := generateKey()
	if err != nil {
		t.Fatalf("generate: %v", err)
	}
	if len(plaintext) < 20 {
		t.Fatalf("plaintext too short: %q", plaintext)
	}
	if prefix == "" || len(prefix) > 16 {
		t.Fatalf("prefix shape: %q", prefix)
	}
	if len(hash) != 64 {
		t.Fatalf("hex sha256 must be 64 chars, got %d", len(hash))
	}
	if plaintext[:5] != "sdlc_" {
		t.Fatalf("plaintext must start with sdlc_, got %q", plaintext[:5])
	}
}
