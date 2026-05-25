package middleware

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func okHandler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(200)
	})
}

func TestRateLimiterBlocks(t *testing.T) {
	tests := []struct {
		name    string
		rate    int
		calls   int
		blocked bool
	}{
		{"under limit", 5, 3, false},
		{"at limit", 5, 5, false},
		{"over limit", 5, 6, true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rl := NewRateLimiter(tt.rate, time.Minute)
			h := rl.Middleware(okHandler())
			var lastCode int
			for i := 0; i < tt.calls; i++ {
				rr := httptest.NewRecorder()
				req := httptest.NewRequest("GET", "/", nil)
				req.RemoteAddr = "1.2.3.4:1234"
				h.ServeHTTP(rr, req)
				lastCode = rr.Code
			}
			got429 := lastCode == 429
			if got429 != tt.blocked {
				t.Errorf("blocked=%v want %v (code=%d)", got429, tt.blocked, lastCode)
			}
		})
	}
}

func TestRecoveryCatchesPanic(t *testing.T) {
	logger := NewLogger()
	panicH := http.HandlerFunc(func(http.ResponseWriter, *http.Request) {
		panic("test panic")
	})
	h := Recovery(logger)(panicH)
	rr := httptest.NewRecorder()
	req := httptest.NewRequest("GET", "/boom", nil)
	h.ServeHTTP(rr, req)
	if rr.Code != 500 {
		t.Fatalf("got %d want 500", rr.Code)
	}
	var body map[string]string
	json.Unmarshal(rr.Body.Bytes(), &body)
	if body["error_id"] == "" {
		t.Error("expected error_id in response")
	}
}

func TestCORSSetsHeaders(t *testing.T) {
	tests := []struct {
		name   string
		origin string
		expect bool
	}{
		{"allowed", "https://pushci.dev", true},
		{"denied", "https://evil.com", false},
		{"localhost", "http://localhost:5173", true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			h := CORS(okHandler())
			rr := httptest.NewRecorder()
			req := httptest.NewRequest("OPTIONS", "/", nil)
			req.Header.Set("Origin", tt.origin)
			h.ServeHTTP(rr, req)
			got := rr.Header().Get("Access-Control-Allow-Origin")
			if tt.expect && got != tt.origin {
				t.Errorf("got origin=%q want %q", got, tt.origin)
			}
			if !tt.expect && got != "" {
				t.Errorf("got origin=%q want empty", got)
			}
		})
	}
}
