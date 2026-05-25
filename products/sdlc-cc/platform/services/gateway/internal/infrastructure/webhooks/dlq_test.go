package webhooks

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
)

type fakeReenqueuer struct {
	called  int
	lastURL string
	err     error
}

func (f *fakeReenqueuer) Reenqueue(_ context.Context, e DLQEntry) error {
	f.called++
	f.lastURL = e.URL
	return f.err
}

func newMockDLQ(t *testing.T) (*PostgresDLQ, sqlmock.Sqlmock, func()) {
	t.Helper()
	db, mock, err := sqlmock.New(sqlmock.QueryMatcherOption(sqlmock.QueryMatcherEqual))
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	return NewPostgresDLQ(db), mock, func() { _ = db.Close() }
}

func TestPostgresDLQ_Push_InsertsRow(t *testing.T) {
	dlq, mock, cleanup := newMockDLQ(t)
	defer cleanup()

	hdr := SignedHeaders{Timestamp: "t", Nonce: "n", Signature: "sig"}
	hdrJSON, _ := json.Marshal(hdr)
	failedAt := time.Now().UTC()
	entry := DLQEntry{
		EndpointID: "ep1", TenantID: "t1", URL: "https://x.test",
		Payload: []byte(`{"x":1}`), Headers: hdr, Attempts: 5,
		LastStatus: 500, LastError: "boom", FailedAt: failedAt,
	}

	mock.ExpectExec(`
		INSERT INTO webhook_dlq
		(endpoint_id, tenant_id, url, payload, headers,
		 attempts, last_status, last_error, failed_at, replayed)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, false)
	`).WithArgs(
		"ep1", "t1", "https://x.test", entry.Payload, hdrJSON,
		5, 500, "boom", failedAt,
	).WillReturnResult(sqlmock.NewResult(1, 1))

	if err := dlq.Push(context.Background(), entry); err != nil {
		t.Fatalf("push: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}

func TestPostgresDLQ_Push_PropagatesError(t *testing.T) {
	dlq, mock, cleanup := newMockDLQ(t)
	defer cleanup()
	mock.ExpectExec(`
		INSERT INTO webhook_dlq
		(endpoint_id, tenant_id, url, payload, headers,
		 attempts, last_status, last_error, failed_at, replayed)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, false)
	`).WillReturnError(sql.ErrConnDone)

	err := dlq.Push(context.Background(), DLQEntry{Headers: SignedHeaders{}})
	if !errors.Is(err, sql.ErrConnDone) {
		t.Fatalf("expected ErrConnDone; got %v", err)
	}
}

func TestPostgresDLQ_Replay_HappyPath(t *testing.T) {
	dlq, mock, cleanup := newMockDLQ(t)
	defer cleanup()

	hdr := SignedHeaders{Timestamp: "t", Nonce: "n", Signature: "sig"}
	hdrJSON, _ := json.Marshal(hdr)
	failedAt := time.Now().UTC()

	mock.ExpectQuery(`
		SELECT endpoint_id, tenant_id, url, payload, headers,
		       attempts, last_status, last_error, failed_at, replayed
		FROM webhook_dlq WHERE id = $1
	`).WithArgs(int64(7)).WillReturnRows(
		sqlmock.NewRows([]string{
			"endpoint_id", "tenant_id", "url", "payload", "headers",
			"attempts", "last_status", "last_error", "failed_at", "replayed",
		}).AddRow("ep1", "t1", "https://x.test", []byte(`{"x":1}`), hdrJSON,
			5, 500, "boom", failedAt, false),
	)
	mock.ExpectExec(`UPDATE webhook_dlq SET replayed = true, replayed_at = $2 WHERE id = $1`).
		WithArgs(int64(7), sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(0, 1))

	q := &fakeReenqueuer{}
	if err := dlq.Replay(context.Background(), 7, q); err != nil {
		t.Fatalf("replay: %v", err)
	}
	if q.called != 1 || q.lastURL != "https://x.test" {
		t.Fatalf("reenqueue not called correctly: %+v", q)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}

func TestPostgresDLQ_Replay_AlreadyReplayed(t *testing.T) {
	dlq, mock, cleanup := newMockDLQ(t)
	defer cleanup()

	hdrJSON, _ := json.Marshal(SignedHeaders{})
	mock.ExpectQuery(`
		SELECT endpoint_id, tenant_id, url, payload, headers,
		       attempts, last_status, last_error, failed_at, replayed
		FROM webhook_dlq WHERE id = $1
	`).WithArgs(int64(9)).WillReturnRows(
		sqlmock.NewRows([]string{
			"endpoint_id", "tenant_id", "url", "payload", "headers",
			"attempts", "last_status", "last_error", "failed_at", "replayed",
		}).AddRow("e", "t", "u", []byte(`{}`), hdrJSON, 5, 500, "", time.Now(), true),
	)

	q := &fakeReenqueuer{}
	err := dlq.Replay(context.Background(), 9, q)
	if !errors.Is(err, ErrAlreadyReplayed) {
		t.Fatalf("want ErrAlreadyReplayed; got %v", err)
	}
	if q.called != 0 {
		t.Fatalf("reenqueue should not be called for replayed row")
	}
}
