package webhooks

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

var secret = []byte("0123456789abcdef0123456789abcdef")

func TestSignAndVerify_RoundTrip(t *testing.T) {
	body := []byte(`{"event":"doc.complete"}`)
	now := time.Unix(1_700_000_000, 0)
	h, err := Sign(secret, body, func() time.Time { return now })
	if err != nil {
		t.Fatalf("Sign: %v", err)
	}
	if err := Verify(secret, body, h, 5*time.Minute, func() time.Time { return now }); err != nil {
		t.Fatalf("Verify must succeed, got %v", err)
	}
}

func TestVerify_RejectsTamperedBody(t *testing.T) {
	body := []byte(`{"event":"doc.complete"}`)
	now := time.Unix(1_700_000_000, 0)
	h, _ := Sign(secret, body, func() time.Time { return now })
	err := Verify(secret, []byte(`{"event":"doc.deleted"}`), h, 5*time.Minute, func() time.Time { return now })
	if err == nil || !strings.Contains(err.Error(), "signature") {
		t.Fatalf("tampered body must fail signature, got %v", err)
	}
}

func TestVerify_RejectsExpiredReplay(t *testing.T) {
	body := []byte(`{"x":1}`)
	signed := time.Unix(1_700_000_000, 0)
	h, _ := Sign(secret, body, func() time.Time { return signed })
	// Clock has advanced 10 minutes; tolerance is 5 minutes.
	err := Verify(secret, body, h, 5*time.Minute, func() time.Time {
		return signed.Add(10 * time.Minute)
	})
	if err == nil {
		t.Fatal("replay outside tolerance must be rejected")
	}
}

func TestSetHeaders_RoundTrip(t *testing.T) {
	body := []byte(`{}`)
	h, _ := Sign(secret, body, nil)
	r := httptest.NewRequest(http.MethodPost, "/", strings.NewReader(""))
	SetHeaders(r, h)
	round := HeadersFromRequest(r)
	if round != h {
		t.Fatalf("round trip mismatch: %+v vs %+v", round, h)
	}
}

func TestRetryDelays_ShapeMatchesPolicy(t *testing.T) {
	want := []time.Duration{30 * time.Second, 2 * time.Minute, 10 * time.Minute, time.Hour, 4 * time.Hour}
	got := RetryDelays()
	if len(got) != len(want) {
		t.Fatalf("length mismatch: %d vs %d", len(got), len(want))
	}
	for i := range got {
		if got[i] != want[i] {
			t.Fatalf("delay[%d]: got %v want %v", i, got[i], want[i])
		}
	}
}
