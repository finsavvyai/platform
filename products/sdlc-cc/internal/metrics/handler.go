package metrics

import "net/http"

// Handler returns a Prometheus-compatible scrape endpoint. Plain
// text/plain content type; no auth — operators front this with
// internal-network ACLs the same way they front /metrics on every
// other Go service in the fleet.
func Handler(reg *Registry) http.HandlerFunc {
	return func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "text/plain; version=0.0.4; charset=utf-8")
		reg.WriteText(w)
	}
}
