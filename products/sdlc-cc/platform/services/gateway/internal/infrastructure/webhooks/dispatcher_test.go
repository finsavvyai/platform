package webhooks

import (
	"context"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"

	"github.com/google/uuid"
)

type fakeStore struct {
	subs []Subscription
}

func (f *fakeStore) List(_ context.Context, _ uuid.UUID, _ string) ([]Subscription, error) {
	return f.subs, nil
}

type memDLQ struct {
	count atomic.Int32
}

func (m *memDLQ) Push(_ context.Context, _ DLQEntry) error {
	m.count.Add(1)
	return nil
}

func TestDispatcher_FansOutToAllSubs(t *testing.T) {
	hits := atomic.Int32{}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		hits.Add(1)
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	store := &fakeStore{subs: []Subscription{
		{ID: uuid.New(), TenantID: uuid.New(), URL: srv.URL, Secret: []byte("secret-1")},
		{ID: uuid.New(), TenantID: uuid.New(), URL: srv.URL, Secret: []byte("secret-2")},
	}}
	r := NewRetrier(&memDLQ{})
	r.Sleep = func(time.Duration) {}
	d := NewDispatcher(store, r)

	n, err := d.Dispatch(context.Background(), uuid.New(), "doc.created", []byte(`{"id":"x"}`))
	if err != nil {
		t.Fatalf("Dispatch: %v", err)
	}
	if n != 2 {
		t.Fatalf("expected 2 subs, got %d", n)
	}
	if got := hits.Load(); got != 2 {
		t.Fatalf("expected 2 receiver hits, got %d", got)
	}
}

func TestDispatcher_NoSubsIsNoOp(t *testing.T) {
	d := NewDispatcher(&fakeStore{}, NewRetrier(&memDLQ{}))
	n, err := d.Dispatch(context.Background(), uuid.New(), "ev", []byte("body"))
	if err != nil || n != 0 {
		t.Fatalf("expected (0, nil); got (%d, %v)", n, err)
	}
}

func TestDispatcher_FailingReceiverGoesToDLQ(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusBadRequest) // permanent failure -> DLQ
	}))
	defer srv.Close()

	store := &fakeStore{subs: []Subscription{
		{ID: uuid.New(), TenantID: uuid.New(), URL: srv.URL, Secret: []byte("k")},
	}}
	dlq := &memDLQ{}
	r := NewRetrier(dlq)
	r.Sleep = func(time.Duration) {}
	d := NewDispatcher(store, r)

	if _, err := d.Dispatch(context.Background(), uuid.New(), "ev", []byte("body")); err != nil {
		t.Fatalf("Dispatch: %v", err)
	}
	if got := dlq.count.Load(); got != 1 {
		t.Fatalf("expected 1 DLQ push, got %d", got)
	}
}
