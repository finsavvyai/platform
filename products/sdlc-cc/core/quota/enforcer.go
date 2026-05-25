package quota

import (
	"os"
	"strconv"
	"sync"
	"time"
)

// AIQuotaEnforcer caps daily AI calls. Two independent gates apply:
//   - tenantCap (AEGIS_AI_DAILY_CAP) — protects the tenant's spend
//   - seatCap (AEGIS_AI_DAILY_CAP_PER_SEAT) — protects against one
//     analyst eating the team's whole quota
//
// Either or both can be unset (0 = ignored). In-memory counter with
// 24h sliding window. Multi-replica deployments will undercount
// (a 200-call cap could become 200-per-replica) — that's the honest
// tradeoff for not requiring Redis at Pilot stage. Switch to a shared
// counter when ramping past one replica.
type AIQuotaEnforcer struct {
	mu           sync.Mutex
	tenantCounts map[string][]time.Time
	seatCounts   map[string][]time.Time
	tenantCap    int
	seatCap      int
}

// NewAIQuotaEnforcer reads AEGIS_AI_DAILY_CAP +
// AEGIS_AI_DAILY_CAP_PER_SEAT. Returns nil when both are unset so
// callers can skip wiring the middleware entirely. Negative values
// are clamped to 0 (off).
func NewAIQuotaEnforcer() *AIQuotaEnforcer {
	tcap := readPositiveInt("AEGIS_AI_DAILY_CAP")
	scap := readPositiveInt("AEGIS_AI_DAILY_CAP_PER_SEAT")
	if tcap == 0 && scap == 0 {
		return nil
	}
	return &AIQuotaEnforcer{
		tenantCounts: make(map[string][]time.Time),
		seatCounts:   make(map[string][]time.Time),
		tenantCap:    tcap,
		seatCap:      scap,
	}
}

func readPositiveInt(key string) int {
	v, _ := strconv.Atoi(os.Getenv(key))
	if v < 0 {
		return 0
	}
	return v
}

// Allow returns true when both tenant + seat are under cap. Either
// gate at zero is treated as "no cap on this dimension". actorID
// empty also short-circuits the seat gate (e.g. internal calls).
func (e *AIQuotaEnforcer) Allow(tenantID, actorID string) bool {
	e.mu.Lock()
	defer e.mu.Unlock()
	cutoff := time.Now().Add(-24 * time.Hour)
	if e.tenantCap > 0 {
		if !underCap(e.tenantCounts, tenantID, cutoff, e.tenantCap) {
			return false
		}
	}
	if e.seatCap > 0 && actorID != "" {
		if !underCap(e.seatCounts, seatKey(tenantID, actorID), cutoff, e.seatCap) {
			return false
		}
	}
	return true
}

// Record marks one consumed call against both gates. Call ONLY
// after the AI provider returned a successful response.
func (e *AIQuotaEnforcer) Record(tenantID, actorID string) {
	e.mu.Lock()
	defer e.mu.Unlock()
	now := time.Now()
	if e.tenantCap > 0 {
		e.tenantCounts[tenantID] = append(e.tenantCounts[tenantID], now)
	}
	if e.seatCap > 0 && actorID != "" {
		k := seatKey(tenantID, actorID)
		e.seatCounts[k] = append(e.seatCounts[k], now)
	}
}

func seatKey(tenantID, actorID string) string {
	return tenantID + "|" + actorID
}

// underCap prunes the bucket of timestamps older than cutoff and
// reports whether the remaining count is under cap.
func underCap(buckets map[string][]time.Time, key string, cutoff time.Time, cap int) bool {
	in := buckets[key]
	keep := in[:0]
	for _, t := range in {
		if t.After(cutoff) {
			keep = append(keep, t)
		}
	}
	buckets[key] = keep
	return len(keep) < cap
}
