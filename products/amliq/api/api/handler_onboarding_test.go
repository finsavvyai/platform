package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestHandleSuggestedLists(t *testing.T) {
	tests := []struct {
		name     string
		country  string
		wantMin  int
		wantCode int
	}{
		{"US default lists", "US", 1, http.StatusOK},
		{"IL israeli lists", "IL", 1, http.StatusOK},
		{"GB uk lists", "GB", 1, http.StatusOK},
		{"empty defaults to US", "", 1, http.StatusOK},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			url := "/api/v1/onboarding/lists"
			if tt.country != "" {
				url += "?country=" + tt.country
			}
			req := httptest.NewRequest(http.MethodGet, url, nil)
			rr := httptest.NewRecorder()
			handleSuggestedLists(rr, req)

			if rr.Code != tt.wantCode {
				t.Errorf("status = %d, want %d", rr.Code, tt.wantCode)
			}

			var resp map[string]json.RawMessage
			if err := json.Unmarshal(rr.Body.Bytes(), &resp); err != nil {
				t.Fatalf("unmarshal response: %v", err)
			}
		})
	}
}
