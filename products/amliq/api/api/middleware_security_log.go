package api

import (
	"log"
	"net/http"
	"time"
)

// SecurityLogger logs every API access for SOC 2 audit compliance.
// When a SecurityLogWriter is provided, entries are also persisted
// to the security_logs table asynchronously.
func SecurityLogger(writer *SecurityLogWriter) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()
			sw := &statusWriter{ResponseWriter: w, status: http.StatusOK}

			next.ServeHTTP(sw, r)

			dur := time.Since(start)
			tenantID := GetTenantID(r)
			ip := clientIP(r)

			log.Printf("SECURITY_AUDIT method=%s path=%s tenant=%s ip=%s status=%d duration=%v",
				r.Method, r.URL.Path, tenantID, ip, sw.status, dur)

			if writer != nil {
				writer.Write(SecurityLogEntry{
					Method:     r.Method,
					Path:       r.URL.Path,
					TenantID:   tenantID,
					IP:         ip,
					StatusCode: sw.status,
					DurationMs: int(dur.Milliseconds()),
					UserAgent:  r.UserAgent(),
				})
			}
		})
	}
}

type statusWriter struct {
	http.ResponseWriter
	status int
}

func (sw *statusWriter) WriteHeader(code int) {
	sw.status = code
	sw.ResponseWriter.WriteHeader(code)
}
