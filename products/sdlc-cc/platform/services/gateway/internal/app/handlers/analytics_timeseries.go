// Read-only analytics timeseries endpoint backed by spend_events.
//
// GET /admin/analytics/timeseries?metric=&granularity=&from=&to=
//
// Supported metrics: queries | tokens | usd_cents | latency_ms
// Supported granularities: hour | day
//
// Day 30 of the production-ready roadmap.
package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"time"
)

// TimeseriesStore is the minimal slice the handler needs.
type TimeseriesStore interface {
	Timeseries(ctx context.Context, q TimeseriesQuery) (TimeseriesResult, error)
}

// TimeseriesQuery is the parsed + validated request shape.
type TimeseriesQuery struct {
	Metric      string
	Granularity string
	From        time.Time
	To          time.Time
}

// TimeseriesResult is one named series of evenly-spaced buckets.
type TimeseriesResult struct {
	Metric      string            `json:"metric"`
	Granularity string            `json:"granularity"`
	From        time.Time         `json:"from"`
	To          time.Time         `json:"to"`
	Buckets     []TimeseriesPoint `json:"buckets"`
}

// TimeseriesPoint is one (bucket_start, value) pair.
type TimeseriesPoint struct {
	BucketStart time.Time `json:"bucket_start"`
	Value       float64   `json:"value"`
}

// TimeseriesDeps wires the store into the handler.
type TimeseriesDeps struct {
	Store TimeseriesStore
}

// AnalyticsTimeseriesHandler returns http.HandlerFunc for the
// timeseries API.
func AnalyticsTimeseriesHandler(deps TimeseriesDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		q, err := parseTimeseriesQuery(r)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		out, err := deps.Store.Timeseries(r.Context(), q)
		if err != nil {
			http.Error(w, "timeseries failed: "+err.Error(), http.StatusInternalServerError)
			return
		}
		out.Metric = q.Metric
		out.Granularity = q.Granularity
		out.From = q.From
		out.To = q.To
		writeAnalyticsJSON(w, http.StatusOK, out)
	}
}

func parseTimeseriesQuery(r *http.Request) (TimeseriesQuery, error) {
	q := TimeseriesQuery{
		Metric:      r.URL.Query().Get("metric"),
		Granularity: r.URL.Query().Get("granularity"),
	}
	if !validMetric(q.Metric) {
		return q, &queryError{"metric must be one of: queries|tokens|usd_cents|latency_ms"}
	}
	if q.Granularity == "" {
		q.Granularity = "day"
	}
	if q.Granularity != "hour" && q.Granularity != "day" {
		return q, &queryError{"granularity must be hour|day"}
	}
	rng, err := parseAnalyticsRange(r)
	if err != nil {
		return q, err
	}
	q.From, q.To = rng.From, rng.To
	return q, nil
}

func validMetric(m string) bool {
	switch m {
	case "queries", "tokens", "usd_cents", "latency_ms":
		return true
	}
	return false
}

// writeAnalyticsJSON is shared by the analytics handlers. Kept private
// to this package to avoid stepping on the existing writeJSON helper
// in services/gateway/internal/interfaces/http/handlers.
func writeAnalyticsJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

// queryError is the same shape used by other admin handlers. Kept
// local so this package compiles standalone.
type queryError struct{ msg string }

func (e *queryError) Error() string { return e.msg }
