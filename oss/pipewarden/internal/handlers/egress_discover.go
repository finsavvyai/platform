package handlers

import (
	"encoding/json"
	"io"
	"net/http"
	"strings"

	"github.com/finsavvyai/pipewarden/internal/analysis"
)

// EgressDiscover handles POST /api/v1/egress/discover — operators paste
// a recent CI run log and get back the suggested PIPEWARDEN_EGRESS_BASELINE
// env-var value. Bridges the bootstrapping gap: until baseline learning
// auto-populates from N healthy runs, this lets users hand-curate one
// allowlist from a known-good run with one HTTP call.
//
// Request body: {"logs": "..."}  (raw text, JSON-quoted)
// Response: {"observed": [{host, count}], "suggested_env": "*.npmjs.org,api.github.com,..."}
func (h *Handlers) EgressDiscover(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	body, err := io.ReadAll(io.LimitReader(r.Body, 10<<20)) // 10 MB cap
	if err != nil {
		http.Error(w, `{"error":"failed to read body"}`, http.StatusBadRequest)
		return
	}
	defer func() { _ = r.Body.Close() }()

	var req struct {
		Logs string `json:"logs"`
	}
	if err := json.Unmarshal(body, &req); err != nil {
		http.Error(w, `{"error":"invalid JSON: missing or malformed 'logs' field"}`, http.StatusBadRequest)
		return
	}
	if req.Logs == "" {
		http.Error(w, `{"error":"'logs' field is required and must be non-empty"}`, http.StatusBadRequest)
		return
	}

	observed := analysis.ExtractEgressTargets([]byte(req.Logs))
	suggestion := suggestBaseline(observed)

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"observed":      observed,
		"suggested_env": suggestion,
		"note":          "Set PIPEWARDEN_EGRESS_BASELINE to the suggested_env value to enable egress monitoring. Review the list and remove anything you don't recognise BEFORE setting — anything in the allowlist is silently trusted.",
	})
}

// suggestBaseline collapses observed hosts into a comma-separated
// allowlist. Subdomains under the same eTLD+1 collapse to "*.eTLD+1"
// when there are 2+ siblings, to keep the allowlist short. Single-
// instance hosts pass through verbatim.
func suggestBaseline(targets []analysis.EgressTarget) string {
	if len(targets) == 0 {
		return ""
	}

	bySuffix := map[string]int{}
	for _, t := range targets {
		if suffix, ok := eTLDPlusOne(t.Host); ok {
			bySuffix[suffix]++
		}
	}

	emitted := map[string]bool{}
	out := make([]string, 0, len(targets))
	for _, t := range targets {
		suffix, ok := eTLDPlusOne(t.Host)
		if ok && bySuffix[suffix] >= 2 {
			pat := "*." + suffix
			if !emitted[pat] {
				out = append(out, pat)
				emitted[pat] = true
			}
			continue
		}
		if !emitted[t.Host] {
			out = append(out, t.Host)
			emitted[t.Host] = true
		}
	}
	return strings.Join(out, ",")
}

// eTLDPlusOne is a naive 2-label extractor (good enough for "foo.bar.com"
// → "bar.com"). True PSL handling needs golang.org/x/net/publicsuffix —
// deferred until we hit a host where this approximation costs us a real
// false positive. Returns (suffix, false) for anything <= 2 labels.
func eTLDPlusOne(host string) (string, bool) {
	parts := strings.Split(host, ".")
	if len(parts) < 3 {
		return "", false
	}
	return parts[len(parts)-2] + "." + parts[len(parts)-1], true
}
