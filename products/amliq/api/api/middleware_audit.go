package api

import (
	"crypto/sha256"
	"encoding/hex"
	"log"
	"net/http"
	"strings"
	"time"
)

var skipAuditPaths = map[string]bool{
	"/health": true, "/ready": true,
	"/healthz": true, "/readyz": true,
}

// AuditMiddleware logs every authenticated request for compliance.
func AuditMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if skipAuditPaths[r.URL.Path] {
			next.ServeHTTP(w, r)
			return
		}

		start := time.Now()
		aw := &auditWriter{ResponseWriter: w, status: http.StatusOK}

		next.ServeHTTP(aw, r)

		duration := time.Since(start)
		logAuditEntry(r, aw.status, duration)
	})
}

type auditWriter struct {
	http.ResponseWriter
	status int
}

func (aw *auditWriter) WriteHeader(code int) {
	aw.status = code
	aw.ResponseWriter.WriteHeader(code)
}

func logAuditEntry(r *http.Request, status int, duration time.Duration) {
	tenantID := GetTenantID(r)
	userID := ""
	if claims, ok := ClaimsFromContext(r.Context()); ok {
		userID = claims.UserID
	}
	requestID := GetRequestID(r)
	ip := clientIP(r)

	bodyHash := ""
	if isSensitiveEndpoint(r.URL.Path) && r.ContentLength > 0 {
		bodyHash = "<hashed>"
	}

	log.Printf("AUDIT_REQUEST request_id=%s method=%s path=%s "+
		"tenant=%s user=%s ip=%s status=%d duration=%v body_hash=%s",
		requestID, r.Method, r.URL.Path,
		tenantID, userID, ip, status, duration, bodyHash,
	)
}

func isSensitiveEndpoint(path string) bool {
	sensitive := []string{"/screen", "/batch", "/auth", "/config"}
	for _, s := range sensitive {
		if strings.Contains(path, s) {
			return true
		}
	}
	return false
}

// HashBody creates a SHA-256 hash of request body content.
func HashBody(body []byte) string {
	h := sha256.Sum256(body)
	return hex.EncodeToString(h[:8])
}
