package record

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"regexp"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/google/uuid"
)

func newRec(t *testing.T) (*AppendOnlyPostgresRecorder, sqlmock.Sqlmock, func()) {
	db, mock, err := sqlmock.New(sqlmock.QueryMatcherOption(sqlmock.QueryMatcherRegexp))
	if err != nil {
		t.Fatal(err)
	}
	tenant := uuid.New()
	r := NewAppendOnlyPostgresRecorder(db, func(_ context.Context) (uuid.UUID, bool) {
		return tenant, true
	})
	return r, mock, func() { _ = db.Close() }
}

func TestRecorder_StartAppendStop_AppendOnly(t *testing.T) {
	r, mock, cleanup := newRec(t)
	defer cleanup()

	insertRe := regexp.MustCompile(`INSERT INTO session_recordings`)
	mock.ExpectExec(insertRe.String()).WillReturnResult(sqlmock.NewResult(1, 1)) // session_start
	mock.ExpectExec(insertRe.String()).WillReturnResult(sqlmock.NewResult(2, 1)) // event
	mock.ExpectExec(insertRe.String()).WillReturnResult(sqlmock.NewResult(3, 1)) // session_stop

	sid, uid := uuid.New(), uuid.New()
	if err := r.Start(context.Background(), sid, uid, "consent-abc"); err != nil {
		t.Fatalf("start: %v", err)
	}
	if token, ok := r.Active(sid); !ok || token != "consent-abc" {
		t.Fatalf("Active mismatch: %q %v", token, ok)
	}
	if err := r.Append(context.Background(), sid, Event{Type: "request", Payload: map[string]any{"q": "hi"}}); err != nil {
		t.Fatalf("append: %v", err)
	}
	if err := r.Stop(context.Background(), sid); err != nil {
		t.Fatalf("stop: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}

func TestRecorder_AppendBeforeStart_Errors(t *testing.T) {
	r, _, cleanup := newRec(t)
	defer cleanup()

	err := r.Append(context.Background(), uuid.New(), Event{Type: "x"})
	if !errors.Is(err, ErrNotRecording) {
		t.Fatalf("want ErrNotRecording, got %v", err)
	}
}

func TestRecorder_StopAfterStop_Errors(t *testing.T) {
	r, mock, cleanup := newRec(t)
	defer cleanup()
	mock.ExpectExec("INSERT INTO session_recordings").WillReturnResult(sqlmock.NewResult(1, 1))
	mock.ExpectExec("INSERT INTO session_recordings").WillReturnResult(sqlmock.NewResult(2, 1))

	sid := uuid.New()
	_ = r.Start(context.Background(), sid, uuid.New(), "tok")
	_ = r.Stop(context.Background(), sid)
	if err := r.Stop(context.Background(), sid); !errors.Is(err, ErrNotRecording) {
		t.Fatalf("double stop: want ErrNotRecording, got %v", err)
	}
}

func TestRecorder_Start_RequiresConsent(t *testing.T) {
	r, _, cleanup := newRec(t)
	defer cleanup()
	err := r.Start(context.Background(), uuid.New(), uuid.New(), "")
	if err == nil {
		t.Fatal("empty consent must error")
	}
}

func TestBannerMiddleware_SetsHeaderWhenActive(t *testing.T) {
	r, mock, cleanup := newRec(t)
	defer cleanup()
	mock.ExpectExec("INSERT INTO session_recordings").WillReturnResult(sqlmock.NewResult(1, 1))

	sid := uuid.New()
	_ = r.Start(context.Background(), sid, uuid.New(), "consent-xyz")

	mw := BannerMiddleware(r)
	handler := mw(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest("GET", "/", nil)
	req.Header.Set("X-Session-ID", sid.String())
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	if got := w.Header().Get("X-Recording-Active"); got != "consent-xyz" {
		t.Fatalf("banner header: got %q want %q", got, "consent-xyz")
	}
}

func TestBannerMiddleware_NoHeaderWhenInactive(t *testing.T) {
	r, _, cleanup := newRec(t)
	defer cleanup()
	mw := BannerMiddleware(r)
	handler := mw(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	req := httptest.NewRequest("GET", "/", nil)
	req.Header.Set("X-Session-ID", uuid.New().String())
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)
	if got := w.Header().Get("X-Recording-Active"); got != "" {
		t.Fatalf("banner header should be empty, got %q", got)
	}
}

func TestSessionFromRequest_BadHeader(t *testing.T) {
	req := httptest.NewRequest("GET", "/", nil)
	if _, ok := SessionFromRequest(req); ok {
		t.Fatal("missing header must be false")
	}
	req.Header.Set("X-Session-ID", "not-a-uuid")
	if _, ok := SessionFromRequest(req); ok {
		t.Fatal("bad uuid must be false")
	}
}
