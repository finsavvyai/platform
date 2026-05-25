// audit_stats.go: per-tenant audit-log aggregation queries used by the
// security dashboard. Factored out of audit_query.go to keep both
// files under the 200-LOC cap (Day 12 split).
//
// Spec Day 12 originally targeted a 3-file split (repo / query /
// writer). Honest LOC math forced a 4th file: the read-side query
// surface plus the stats aggregation together overran the cap. This
// file is read-only and shares the auditLogRepository receiver.
package repositories

import (
	"context"
	"fmt"

	"github.com/google/uuid"
)

// GetAuditStats retrieves audit statistics for a tenant. Aggregates
// totals, per-action / per-resource counts, authentication-failure
// counters, unique users, and top IPs for the security dashboard.
func (r *auditLogRepository) GetAuditStats(ctx context.Context, tenantID uuid.UUID, timeRange string) (map[string]interface{}, error) {
	timeFilter := auditTimeFilter(timeRange)
	stats := make(map[string]interface{})

	totalQuery := fmt.Sprintf("SELECT COUNT(*) FROM audit_logs WHERE tenant_id = $1 AND %s", timeFilter)
	var totalCount int64
	if err := r.pool.QueryRow(ctx, totalQuery, tenantID).Scan(&totalCount); err != nil {
		return nil, fmt.Errorf("failed to get total count: %w", err)
	}
	stats["total_logs"] = totalCount

	stats["action_counts"] = r.statsCountByColumn(ctx, tenantID, "action", timeFilter, 10)
	stats["resource_counts"] = r.statsCountByColumn(ctx, tenantID, "resource_type", timeFilter, 0)
	stats["failed_authentications"] = r.statsLikeAction(ctx, tenantID, "%login.failed", timeFilter)
	stats["authorization_denials"] = r.statsLikeAction(ctx, tenantID, "%deny", timeFilter)

	usersQuery := fmt.Sprintf(
		"SELECT COUNT(DISTINCT user_id) FROM audit_logs WHERE tenant_id = $1 AND user_id IS NOT NULL AND %s",
		timeFilter)
	var uniqueUsers int64
	if err := r.pool.QueryRow(ctx, usersQuery, tenantID).Scan(&uniqueUsers); err == nil {
		stats["unique_users"] = uniqueUsers
	}
	stats["top_ip_addresses"] = r.statsTopIPs(ctx, tenantID, timeFilter)
	return stats, nil
}

// auditTimeFilter maps a public time-range key to the SQL predicate.
func auditTimeFilter(timeRange string) string {
	switch timeRange {
	case "7d":
		return "created_at >= NOW() - INTERVAL '7 days'"
	case "30d":
		return "created_at >= NOW() - INTERVAL '30 days'"
	case "90d":
		return "created_at >= NOW() - INTERVAL '90 days'"
	default:
		return "created_at >= NOW() - INTERVAL '24 hours'"
	}
}

func (r *auditLogRepository) statsCountByColumn(ctx context.Context, tenantID uuid.UUID, column, timeFilter string, limit int) map[string]int64 {
	limitClause := ""
	if limit > 0 {
		limitClause = fmt.Sprintf(" LIMIT %d", limit)
	}
	q := fmt.Sprintf(
		"SELECT %s, COUNT(*) AS count FROM audit_logs WHERE tenant_id = $1 AND %s GROUP BY %s ORDER BY count DESC%s",
		column, timeFilter, column, limitClause)
	out := make(map[string]int64)
	rows, err := r.pool.Query(ctx, q, tenantID)
	if err != nil {
		return out
	}
	defer rows.Close()
	for rows.Next() {
		var key string
		var count int64
		if err := rows.Scan(&key, &count); err == nil {
			out[key] = count
		}
	}
	return out
}

func (r *auditLogRepository) statsLikeAction(ctx context.Context, tenantID uuid.UUID, pattern, timeFilter string) int64 {
	q := fmt.Sprintf(
		"SELECT COUNT(*) FROM audit_logs WHERE tenant_id = $1 AND action LIKE $2 AND %s", timeFilter)
	var count int64
	_ = r.pool.QueryRow(ctx, q, tenantID, pattern).Scan(&count)
	return count
}

func (r *auditLogRepository) statsTopIPs(ctx context.Context, tenantID uuid.UUID, timeFilter string) []map[string]interface{} {
	q := fmt.Sprintf(`
		SELECT ip_address, COUNT(*) AS count
		FROM audit_logs
		WHERE tenant_id = $1 AND ip_address IS NOT NULL AND %s
		GROUP BY ip_address ORDER BY count DESC LIMIT 10`, timeFilter)
	out := make([]map[string]interface{}, 0)
	rows, err := r.pool.Query(ctx, q, tenantID)
	if err != nil {
		return out
	}
	defer rows.Close()
	for rows.Next() {
		var ip string
		var count int64
		if err := rows.Scan(&ip, &count); err == nil {
			out = append(out, map[string]interface{}{"ip_address": ip, "count": count})
		}
	}
	return out
}
