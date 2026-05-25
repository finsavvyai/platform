package api

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/aegis-aml/aegis/internal/domain"
	"github.com/aegis-aml/aegis/internal/storage"
)

func TestExportResultsCSV(t *testing.T) {
	tests := []struct {
		name       string
		format     string
		wantStatus int
		wantCT     string
	}{
		{"csv format", "csv", 200, "text/csv"},
		{"json format", "json", 200, "application/json"},
		{"default format", "", 200, "text/csv"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			repo := storage.NewInMemoryScreeningRepo()
			eh := NewExportResultsHandler(repo)

			url := "/api/v1/export/screenings"
			if tt.format != "" {
				url += "?format=" + tt.format
			}
			req := newTenantRequest("GET", url, "tnt_abcdefghijkl")
			w := httptest.NewRecorder()

			eh.ExportScreenings(w, req)

			if w.Code != tt.wantStatus {
				t.Errorf("got status %d, want %d", w.Code, tt.wantStatus)
			}
			ct := w.Header().Get("Content-Type")
			if !strings.Contains(ct, tt.wantCT) {
				t.Errorf("content-type = %s, want %s", ct, tt.wantCT)
			}
		})
	}
}

func TestExportResultsUnauthorized(t *testing.T) {
	repo := storage.NewInMemoryScreeningRepo()
	eh := NewExportResultsHandler(repo)

	req := httptest.NewRequest("GET", "/api/v1/export/screenings", nil)
	w := httptest.NewRecorder()

	eh.ExportScreenings(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("got status %d, want 401", w.Code)
	}
}

func TestExportResultsDateRange(t *testing.T) {
	tests := []struct {
		name string
		from string
		to   string
	}{
		{"rfc3339 dates", "2025-01-01T00:00:00Z", "2025-12-31T23:59:59Z"},
		{"simple dates", "2025-01-01", "2025-12-31"},
		{"empty uses defaults", "", ""},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			repo := storage.NewInMemoryScreeningRepo()
			eh := NewExportResultsHandler(repo)

			url := "/api/v1/export/screenings"
			if tt.from != "" {
				url += "?from=" + tt.from
			}
			if tt.to != "" {
				if strings.Contains(url, "?") {
					url += "&to=" + tt.to
				} else {
					url += "?to=" + tt.to
				}
			}
			req := newTenantRequest("GET", url, "tnt_abcdefghijkl")
			w := httptest.NewRecorder()

			eh.ExportScreenings(w, req)

			if w.Code != 200 {
				t.Errorf("got status %d, want 200", w.Code)
			}
		})
	}
}

func TestParseTime(t *testing.T) {
	tests := []struct {
		name string
		input string
		want bool
	}{
		{"rfc3339", "2025-01-15T10:30:00Z", true},
		{"simple date", "2025-01-15", true},
		{"invalid", "not-a-date", false},
		{"empty", "", false},
	}

	def := time.Now()
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := parseTime(tt.input, def)
			if tt.want {
				if result.Equal(def) {
					t.Error("should parse successfully")
				}
			}
		})
	}
}

func TestFilterByDateRange(t *testing.T) {
	now := time.Now().UTC()
	yesterday := now.AddDate(0, 0, -1)
	tomorrow := now.AddDate(0, 0, 1)

	tests := []struct {
		name string
		from time.Time
		to   time.Time
		want int
	}{
		{"include now", yesterday, tomorrow, 1},
		{"exclude past", tomorrow, tomorrow.AddDate(0, 0, 1), 0},
		{"include future", now, tomorrow, 1},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			sr := domain.ScreenResponse{Timestamp: now}
			screenings := []domain.ScreenResponse{sr}
			filtered := filterByDateRange(screenings, tt.from, tt.to)
			if len(filtered) != tt.want {
				t.Errorf("got %d, want %d", len(filtered), tt.want)
			}
		})
	}
}
