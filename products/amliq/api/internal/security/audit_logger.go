package security

import (
	"context"
	"encoding/json"
	"log"
	"strconv"
	"sync"
	"time"
)

// AuditEntry represents an immutable audit log record.
type AuditEntry struct {
	Timestamp time.Time         `json:"timestamp"`
	RequestID string            `json:"request_id"`
	TenantID  string            `json:"tenant_id"`
	Action    string            `json:"action"`
	Details   map[string]string `json:"details"`
	IP        string            `json:"ip"`
}

// AuditLogger provides append-only compliance logging.
type AuditLogger struct {
	mu      sync.Mutex
	entries []AuditEntry
	store   AuditStore
}

// NewAuditLogger creates an AuditLogger with optional persistence.
// If store is nil, events are only stored in-memory.
func NewAuditLogger(store AuditStore) *AuditLogger {
	return &AuditLogger{store: store}
}

// LogScreening records a screening event.
func (al *AuditLogger) LogScreening(
	tenantID, entityName string, matchCount, processingMs int,
) {
	al.append("SCREENING", tenantID, "", map[string]string{
		"entity": entityName, "matches": strconv.Itoa(matchCount),
		"duration_ms": strconv.Itoa(processingMs),
	})
}

// LogLogin records a login attempt.
func (al *AuditLogger) LogLogin(userID, ip string, success bool) {
	result := "failure"
	if success {
		result = "success"
	}
	al.append("LOGIN", "", ip, map[string]string{
		"user_id": userID, "result": result,
	})
}

// LogAPIKeyUsage records API key access.
func (al *AuditLogger) LogAPIKeyUsage(keyHash, endpoint, ip string) {
	al.append("API_KEY_USE", "", ip, map[string]string{
		"key_hash": keyHash, "endpoint": endpoint,
	})
}

// LogRateLimitHit records a rate limit event.
func (al *AuditLogger) LogRateLimitHit(tenantID, endpoint, tier string) {
	al.append("RATE_LIMIT_HIT", tenantID, "", map[string]string{
		"endpoint": endpoint, "tier": tier,
	})
}

// LogConfigChange records a configuration change.
func (al *AuditLogger) LogConfigChange(
	tenantID, userID, field, oldVal, newVal string,
) {
	al.append("CONFIG_CHANGE", tenantID, "", map[string]string{
		"user_id": userID, "field": field,
		"old_value": oldVal, "new_value": newVal,
	})
}

// LogDataExport records a GDPR data export.
func (al *AuditLogger) LogDataExport(tenantID, userID, dataType string) {
	al.append("DATA_EXPORT", tenantID, "", map[string]string{
		"user_id": userID, "data_type": dataType,
	})
}

func (al *AuditLogger) append(
	action, tenantID, ip string, details map[string]string,
) {
	entry := AuditEntry{
		Timestamp: time.Now(), TenantID: tenantID,
		Action: action, Details: details, IP: ip,
	}
	al.mu.Lock()
	al.entries = append(al.entries, entry)
	al.mu.Unlock()

	data, _ := json.Marshal(entry)
	log.Printf("AUDIT %s", data)

	if al.store != nil {
		go func() {
			ctx, cancel := context.WithTimeout(
				context.Background(), 5*time.Second)
			defer cancel()
			_ = al.store.Save(ctx, entry)
		}()
	}
}
