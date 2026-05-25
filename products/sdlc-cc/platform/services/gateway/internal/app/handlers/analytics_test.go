package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

// In-memory fake stores for the analytics handlers.

type fakeOverviewStore struct {
	gotRange AnalyticsRange
	out      AnalyticsOverview
	err      error
}

func (f *fakeOverviewStore) Overview(_ context.Context, q AnalyticsRange) (AnalyticsOverview, error) {
	f.gotRange = q
	return f.out, f.err
}

type fakeTimeseriesStore struct {
	gotQuery TimeseriesQuery
	out      TimeseriesResult
	err      error
}

func (f *fakeTimeseriesStore) Timeseries(_ context.Context, q TimeseriesQuery) (TimeseriesResult, error) {
	f.gotQuery = q
	return f.out, f.err
}

func TestAnalyticsOverview_DefaultRange(t *testing.T) {
	store := &fakeOverviewStore{
		out: AnalyticsOverview{TotalQueries: 42, TotalTokens: 1000, TotalUSDCents: 7},
	}
	rr := httptest.NewRecorder()
	AnalyticsOverviewHandler(AnalyticsOverviewDeps{Store: store})(
		rr, httptest.NewRequest(http.MethodGet, "/admin/analytics/overview", nil),
	)
	if rr.Code != http.StatusOK {
		t.Fatalf("status: want 200 got %d, body=%s", rr.Code, rr.Body.String())
	}
	var got AnalyticsOverview
	if err := json.Unmarshal(rr.Body.Bytes(), &got); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if got.TotalQueries != 42 || got.TotalUSDCents != 7 {
		t.Fatalf("body shape: %+v", got)
	}
	// Default range: To ≈ now, From ≈ To-30d.
	if store.gotRange.To.Before(store.gotRange.From) {
		t.Fatalf("range inverted: %+v", store.gotRange)
	}
}

func TestAnalyticsOverview_CustomRange(t *testing.T) {
	from := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	to := time.Date(2026, 2, 1, 0, 0, 0, 0, time.UTC)
	url := "/admin/analytics/overview?from=" + from.Format(time.RFC3339) +
		"&to=" + to.Format(time.RFC3339)

	store := &fakeOverviewStore{}
	rr := httptest.NewRecorder()
	AnalyticsOverviewHandler(AnalyticsOverviewDeps{Store: store})(
		rr, httptest.NewRequest(http.MethodGet, url, nil),
	)
	if rr.Code != http.StatusOK {
		t.Fatalf("status: %d, body=%s", rr.Code, rr.Body.String())
	}
	if !store.gotRange.From.Equal(from) || !store.gotRange.To.Equal(to) {
		t.Fatalf("range not parsed: %+v", store.gotRange)
	}
}

func TestAnalyticsOverview_BadRange(t *testing.T) {
	cases := []string{
		"/admin/analytics/overview?from=not-rfc3339",
		"/admin/analytics/overview?to=not-rfc3339",
		// inverted: from > to
		"/admin/analytics/overview?from=2026-02-01T00:00:00Z&to=2026-01-01T00:00:00Z",
		// over 365d window
		"/admin/analytics/overview?from=2024-01-01T00:00:00Z&to=2026-01-01T00:00:00Z",
	}
	for _, url := range cases {
		t.Run(url, func(t *testing.T) {
			rr := httptest.NewRecorder()
			AnalyticsOverviewHandler(AnalyticsOverviewDeps{Store: &fakeOverviewStore{}})(
				rr, httptest.NewRequest(http.MethodGet, url, nil),
			)
			if rr.Code != http.StatusBadRequest {
				t.Fatalf("want 400, got %d for %s", rr.Code, url)
			}
		})
	}
}

func TestAnalyticsTimeseries_Happy(t *testing.T) {
	url := "/admin/analytics/timeseries?metric=usd_cents&granularity=day"
	store := &fakeTimeseriesStore{
		out: TimeseriesResult{Buckets: []TimeseriesPoint{
			{BucketStart: time.Now().UTC().Truncate(24 * time.Hour), Value: 12.5},
		}},
	}
	rr := httptest.NewRecorder()
	AnalyticsTimeseriesHandler(TimeseriesDeps{Store: store})(
		rr, httptest.NewRequest(http.MethodGet, url, nil),
	)
	if rr.Code != http.StatusOK {
		t.Fatalf("status: %d, body=%s", rr.Code, rr.Body.String())
	}
	if store.gotQuery.Metric != "usd_cents" || store.gotQuery.Granularity != "day" {
		t.Fatalf("query not parsed: %+v", store.gotQuery)
	}
	var got TimeseriesResult
	if err := json.Unmarshal(rr.Body.Bytes(), &got); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if len(got.Buckets) != 1 || got.Buckets[0].Value != 12.5 {
		t.Fatalf("body: %+v", got)
	}
}

func TestAnalyticsTimeseries_BadInputs(t *testing.T) {
	cases := []string{
		"/admin/analytics/timeseries",                                  // missing metric
		"/admin/analytics/timeseries?metric=bogus",                     // invalid metric
		"/admin/analytics/timeseries?metric=tokens&granularity=minute", // invalid granularity
	}
	for _, url := range cases {
		t.Run(url, func(t *testing.T) {
			rr := httptest.NewRecorder()
			AnalyticsTimeseriesHandler(TimeseriesDeps{Store: &fakeTimeseriesStore{}})(
				rr, httptest.NewRequest(http.MethodGet, url, nil),
			)
			if rr.Code != http.StatusBadRequest {
				t.Fatalf("want 400, got %d for %s", rr.Code, url)
			}
		})
	}
}
