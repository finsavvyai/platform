package middleware

import (
	"net/http"
)

// BodyLimitChi returns a Chi/net-http middleware that limits the request body
// to maxBytes using http.MaxBytesReader. If the declared Content-Length exceeds
// the limit, the request is rejected immediately with 413.
func BodyLimitChi(maxBytes int64) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if maxBytes <= 0 {
				next.ServeHTTP(w, r)
				return
			}

			if r.ContentLength > maxBytes {
				http.Error(w, `{"error":"request body too large"}`, http.StatusRequestEntityTooLarge)
				return
			}

			r.Body = http.MaxBytesReader(w, r.Body, maxBytes)
			next.ServeHTTP(w, r)
		})
	}
}
