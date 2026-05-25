package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/database/models"
)

// PolicyRepositoryImpl implements PolicyRepository
type PolicyRepositoryImpl struct {
	*BaseRepositoryImpl[models.Policy]
}

// NewPolicyRepository creates a new policy repository
func NewPolicyRepository(db *gorm.DB) PolicyRepository {
	base := NewBaseRepository[models.Policy](db)
	return &PolicyRepositoryImpl{
		BaseRepositoryImpl: base.(*BaseRepositoryImpl[models.Policy]),
	}
}

// GetActivePolicies retrieves all active policies for a tenant
func (r *PolicyRepositoryImpl) GetActivePolicies(ctx context.Context, tenantID string) ([]models.Policy, error) {
	var policies []models.Policy
	err := r.db.WithContext(ctx).
		Where("tenant_id = ? AND is_active = ?", tenantID, true).
		Order("priority ASC, created_at DESC").
		Find(&policies).Error
	return policies, err
}

// GetPoliciesByType retrieves policies by type for a tenant
func (r *PolicyRepositoryImpl) GetPoliciesByType(ctx context.Context, tenantID, policyType string) ([]models.Policy, error) {
	var policies []models.Policy
	err := r.db.WithContext(ctx).
		Where("tenant_id = ? AND type = ?", tenantID, policyType).
		Order("priority ASC").
		Find(&policies).Error
	return policies, err
}

// GetPolicyByName retrieves a policy by name for a tenant
func (r *PolicyRepositoryImpl) GetPolicyByName(ctx context.Context, tenantID, name string) (*models.Policy, error) {
	var policy models.Policy
	err := r.db.WithContext(ctx).
		Where("tenant_id = ? AND name = ?", tenantID, name).
		First(&policy).Error
	if err != nil {
		return nil, err
	}
	return &policy, nil
}

// GetPoliciesByPriority retrieves policies ordered by priority
func (r *PolicyRepositoryImpl) GetPoliciesByPriority(ctx context.Context, tenantID string) ([]models.Policy, error) {
	var policies []models.Policy
	err := r.db.WithContext(ctx).
		Where("tenant_id = ?", tenantID).
		Order("priority ASC, created_at DESC").
		Find(&policies).Error
	return policies, err
}

// ActivatePolicy activates a policy
func (r *PolicyRepositoryImpl) ActivatePolicy(ctx context.Context, id string) error {
	return r.db.WithContext(ctx).Model(&models.Policy{}).
		Where("id = ?", id).
		Update("is_active", true).Error
}

// DeactivatePolicy deactivates a policy
func (r *PolicyRepositoryImpl) DeactivatePolicy(ctx context.Context, id string) error {
	return r.db.WithContext(ctx).Model(&models.Policy{}).
		Where("id = ?", id).
		Update("is_active", false).Error
}

// UpdatePolicyContent updates the Rego policy content
func (r *PolicyRepositoryImpl) UpdatePolicyContent(ctx context.Context, id, regoPolicy string) error {
	return r.db.WithContext(ctx).Model(&models.Policy{}).
		Where("id = ?", id).
		Updates(map[string]any{
			"rego_policy": regoPolicy,
			"version":     gorm.Expr("version + 1"),
			"updated_at":  time.Now(),
		}).Error
}

// UpdatePolicyVersion updates the policy version
func (r *PolicyRepositoryImpl) UpdatePolicyVersion(ctx context.Context, id string, version int) error {
	return r.db.WithContext(ctx).Model(&models.Policy{}).
		Where("id = ?", id).
		Updates(map[string]any{
			"version":    version,
			"updated_at": time.Now(),
		}).Error
}

// GetEvaluationsByPolicy retrieves policy evaluations for a specific policy
func (r *PolicyRepositoryImpl) GetEvaluationsByPolicy(ctx context.Context, policyID string, timeRange time.Duration) ([]models.PolicyEvaluation, error) {
	var evaluations []models.PolicyEvaluation
	since := time.Now().Add(-timeRange)

	err := r.db.WithContext(ctx).
		Where("policy_id = ? AND created_at >= ?", policyID, since).
		Order("created_at DESC").
		Find(&evaluations).Error

	return evaluations, err
}

// GetEvaluationsByUser retrieves policy evaluations for a specific user
func (r *PolicyRepositoryImpl) GetEvaluationsByUser(ctx context.Context, userID string, timeRange time.Duration) ([]models.PolicyEvaluation, error) {
	var evaluations []models.PolicyEvaluation
	since := time.Now().Add(-timeRange)

	err := r.db.WithContext(ctx).
		Where("user_id = ? AND created_at >= ?", userID, since).
		Order("created_at DESC").
		Find(&evaluations).Error

	return evaluations, err
}

// GetPolicyStatistics retrieves policy statistics for a tenant
func (r *PolicyRepositoryImpl) GetPolicyStatistics(ctx context.Context, tenantID string) (*PolicyStats, error) {
	stats := &PolicyStats{
		PoliciesByType: make(map[string]int64),
	}

	// Parse tenant ID
	tenantUUID, err := uuid.Parse(tenantID)
	if err != nil {
		return nil, fmt.Errorf("invalid tenant ID: %w", err)
	}

	// Get total policies
	if err := r.db.WithContext(ctx).Model(&models.Policy{}).
		Where("tenant_id = ?", tenantUUID).
		Count(&stats.TotalPolicies).Error; err != nil {
		return nil, err
	}

	// Get active policies
	if err := r.db.WithContext(ctx).Model(&models.Policy{}).
		Where("tenant_id = ? AND is_active = ?", tenantUUID, true).
		Count(&stats.ActivePolicies).Error; err != nil {
		return nil, err
	}

	// Get policies by type
	var policyTypes []struct {
		Type  string
		Count int64
	}
	if err := r.db.WithContext(ctx).Model(&models.Policy{}).
		Select("type, COUNT(*) as count").
		Where("tenant_id = ?", tenantUUID).
		Group("type").
		Scan(&policyTypes).Error; err != nil {
		return nil, err
	}

	for _, pt := range policyTypes {
		stats.PoliciesByType[pt.Type] = pt.Count
	}

	// Get evaluation statistics
	row := r.db.WithContext(ctx).Model(&models.PolicyEvaluation{}).
		Select("COUNT(*) as total, AVG(duration_ms) as avg_time").
		Where("tenant_id = ? AND created_at >= ?", tenantUUID, time.Now().AddDate(0, 0, -7)).
		Row()
	if err := row.Scan(&stats.TotalEvaluations, &stats.AverageEvalTime); err != nil {
		return nil, err
	}

	return stats, nil
}

// GetEvaluationMetrics retrieves evaluation metrics for a tenant
func (r *PolicyRepositoryImpl) GetEvaluationMetrics(ctx context.Context, tenantID string, timeRange time.Duration) (*EvaluationMetrics, error) {
	metrics := &EvaluationMetrics{
		EvaluationsByPolicy: make(map[string]int64),
	}

	// Parse tenant ID
	tenantUUID, err := uuid.Parse(tenantID)
	if err != nil {
		return nil, fmt.Errorf("invalid tenant ID: %w", err)
	}

	since := time.Now().Add(-timeRange)

	// Get total evaluations
	if err := r.db.WithContext(ctx).Model(&models.PolicyEvaluation{}).
		Where("tenant_id = ? AND created_at >= ?", tenantUUID, since).
		Count(&metrics.TotalEvaluations).Error; err != nil {
		return nil, err
	}

	// Get allow/deny counts
	row := r.db.WithContext(ctx).Model(&models.PolicyEvaluation{}).
		Select("COUNT(*) FILTER (WHERE result = true) as allow_count, COUNT(*) FILTER (WHERE result = false) as deny_count").
		Where("tenant_id = ? AND created_at >= ?", tenantUUID, since).
		Row()
	if err := row.Scan(&metrics.AllowResults, &metrics.DenyResults); err != nil {
		return nil, err
	}

	// Get average time
	var avgTime float64
	if err := r.db.WithContext(ctx).Model(&models.PolicyEvaluation{}).
		Select("AVG(duration_ms)").
		Where("tenant_id = ? AND created_at >= ?", tenantUUID, since).
		Scan(&avgTime).Error; err != nil {
		return nil, err
	}
	metrics.AverageTime = avgTime

	// Calculate success rate
	if metrics.TotalEvaluations > 0 {
		metrics.SuccessRate = float64(metrics.AllowResults) / float64(metrics.TotalEvaluations) * 100
	}

	return metrics, nil
}

// APIKeyRepositoryImpl implements APIKeyRepository
type APIKeyRepositoryImpl struct {
	*BaseRepositoryImpl[models.APIKey]
}

// NewAPIKeyRepository creates a new API key repository
func NewAPIKeyRepository(db *gorm.DB) APIKeyRepository {
	base := NewBaseRepository[models.APIKey](db)
	return &APIKeyRepositoryImpl{
		BaseRepositoryImpl: base.(*BaseRepositoryImpl[models.APIKey]),
	}
}

// GetByKeyHash retrieves an API key by its hash
func (r *APIKeyRepositoryImpl) GetByKeyHash(ctx context.Context, keyHash string) (*models.APIKey, error) {
	var apiKey models.APIKey
	err := r.db.WithContext(ctx).
		Where("key_hash = ?", keyHash).
		First(&apiKey).Error
	if err != nil {
		return nil, err
	}
	return &apiKey, nil
}

// GetByPrefix retrieves an API key by its prefix
func (r *APIKeyRepositoryImpl) GetByPrefix(ctx context.Context, prefix string) (*models.APIKey, error) {
	var apiKey models.APIKey
	err := r.db.WithContext(ctx).
		Where("key_prefix = ?", prefix).
		First(&apiKey).Error
	if err != nil {
		return nil, err
	}
	return &apiKey, nil
}

// GetActiveKeys retrieves all active API keys for a tenant
func (r *APIKeyRepositoryImpl) GetActiveKeys(ctx context.Context, tenantID string) ([]models.APIKey, error) {
	var keys []models.APIKey
	err := r.db.WithContext(ctx).
		Where("tenant_id = ? AND is_active = ?", tenantID, true).
		Find(&keys).Error
	return keys, err
}

// GetExpiredKeys retrieves expired API keys for a tenant
func (r *APIKeyRepositoryImpl) GetExpiredKeys(ctx context.Context, tenantID string) ([]models.APIKey, error) {
	var keys []models.APIKey
	err := r.db.WithContext(ctx).
		Where("tenant_id = ? AND expires_at < NOW()", tenantID).
		Find(&keys).Error
	return keys, err
}

// GetKeysExceedingUsage retrieves API keys that have exceeded their usage limit
func (r *APIKeyRepositoryImpl) GetKeysExceedingUsage(ctx context.Context, tenantID string) ([]models.APIKey, error) {
	var keys []models.APIKey
	err := r.db.WithContext(ctx).
		Where("tenant_id = ? AND max_usage > 0 AND usage_count >= max_usage", tenantID).
		Find(&keys).Error
	return keys, err
}

// UpdateLastUsed updates the last used timestamp
func (r *APIKeyRepositoryImpl) UpdateLastUsed(ctx context.Context, id string) error {
	return r.db.WithContext(ctx).Model(&models.APIKey{}).
		Where("id = ?", id).
		Updates(map[string]any{
			"last_used":   time.Now(),
			"usage_count": gorm.Expr("usage_count + 1"),
		}).Error
}

// IncrementUsage increments the usage count
func (r *APIKeyRepositoryImpl) IncrementUsage(ctx context.Context, id string) error {
	return r.db.WithContext(ctx).Model(&models.APIKey{}).
		Where("id = ?", id).
		Update("usage_count", gorm.Expr("usage_count + 1")).Error
}

// RevokeKey revokes an API key
func (r *APIKeyRepositoryImpl) RevokeKey(ctx context.Context, id string) error {
	return r.db.WithContext(ctx).Model(&models.APIKey{}).
		Where("id = ?", id).
		Update("is_active", false).Error
}

// RotateKey rotates an API key with new hash and prefix
func (r *APIKeyRepositoryImpl) RotateKey(ctx context.Context, id, newKeyHash, newPrefix string) error {
	return r.db.WithContext(ctx).Model(&models.APIKey{}).
		Where("id = ?", id).
		Updates(map[string]any{
			"key_hash":    newKeyHash,
			"key_prefix":  newPrefix,
			"usage_count": 0,
			"updated_at":  time.Now(),
		}).Error
}

// ExtendExpiration extends the expiration date of an API key
func (r *APIKeyRepositoryImpl) ExtendExpiration(ctx context.Context, id string, newExpiration time.Time) error {
	return r.db.WithContext(ctx).Model(&models.APIKey{}).
		Where("id = ?", id).
		Updates(map[string]any{
			"expires_at": newExpiration,
			"updated_at": time.Now(),
		}).Error
}

// GetKeyUsageStatistics retrieves usage statistics for a specific API key
func (r *APIKeyRepositoryImpl) GetKeyUsageStatistics(ctx context.Context, keyID string, timeRange time.Duration) (*KeyUsageStats, error) {
	stats := &KeyUsageStats{
		RequestsByModel:     make(map[string]int64),
		RequestsByOperation: make(map[string]int64),
	}

	// Parse key ID
	keyUUID, err := uuid.Parse(keyID)
	if err != nil {
		return nil, fmt.Errorf("invalid key ID: %w", err)
	}

	since := time.Now().Add(-timeRange)

	// Get total requests and cost
	row := r.db.WithContext(ctx).Model(&models.TokenUsage{}).
		Select("COUNT(*) as total, SUM(tokens_used) as tokens, SUM(cost_usd) as cost").
		Where("api_key_id = ? AND created_at >= ?", keyUUID, since).
		Row()
	if err := row.Scan(&stats.TotalRequests, &stats.TotalTokens, &stats.TotalCost); err != nil {
		return nil, err
	}

	// Get requests by model
	var modelRequests []struct {
		Model string
		Count int64
	}
	if err := r.db.WithContext(ctx).Model(&models.TokenUsage{}).
		Select("model, COUNT(*) as count").
		Where("api_key_id = ? AND created_at >= ?", keyUUID, since).
		Group("model").
		Scan(&modelRequests).Error; err != nil {
		return nil, err
	}

	for _, mr := range modelRequests {
		stats.RequestsByModel[mr.Model] = mr.Count
	}

	// Get requests by operation
	var operationRequests []struct {
		Operation string
		Count     int64
	}
	if err := r.db.WithContext(ctx).Model(&models.TokenUsage{}).
		Select("operation, COUNT(*) as count").
		Where("api_key_id = ? AND created_at >= ?", keyUUID, since).
		Group("operation").
		Scan(&operationRequests).Error; err != nil {
		return nil, err
	}

	for _, or := range operationRequests {
		stats.RequestsByOperation[or.Operation] = or.Count
	}

	// Calculate average tokens per request
	if stats.TotalRequests > 0 {
		stats.AverageTokens = float64(stats.TotalTokens) / float64(stats.TotalRequests)
	}

	return stats, nil
}

// GetTenantAPIUsage retrieves API usage statistics for a tenant
func (r *APIKeyRepositoryImpl) GetTenantAPIUsage(ctx context.Context, tenantID string, timeRange time.Duration) (*TenantAPIStats, error) {
	stats := &TenantAPIStats{}

	// Parse tenant ID
	tenantUUID, err := uuid.Parse(tenantID)
	if err != nil {
		return nil, fmt.Errorf("invalid tenant ID: %w", err)
	}

	since := time.Now().Add(-timeRange)

	// Get total keys
	if err := r.db.WithContext(ctx).Model(&models.APIKey{}).
		Where("tenant_id = ?", tenantUUID).
		Count(&stats.TotalAPIKeys).Error; err != nil {
		return nil, err
	}

	// Get active keys
	if err := r.db.WithContext(ctx).Model(&models.APIKey{}).
		Where("tenant_id = ? AND is_active = ?", tenantUUID, true).
		Count(&stats.ActiveAPIKeys).Error; err != nil {
		return nil, err
	}

	// Get usage stats from token usage
	var keySummaries []struct {
		KeyID  uuid.UUID
		Name   string
		Count  int64
		Tokens int64
		Cost   float64
	}

	if err := r.db.WithContext(ctx).Raw(`
		SELECT
			tk.id as key_id,
			tk.name,
			COUNT(tu.id) as count,
			COALESCE(SUM(tu.tokens_used), 0) as tokens,
			COALESCE(SUM(tu.cost_usd), 0) as cost
		FROM api_keys tk
		LEFT JOIN token_usage tu ON tk.id = tu.api_key_id AND tu.created_at >= ?
		WHERE tk.tenant_id = ?
		GROUP BY tk.id, tk.name
		ORDER BY tokens DESC
		LIMIT 10
	`, since, tenantUUID).Scan(&keySummaries).Error; err != nil {
		return nil, err
	}

	stats.TopAPIKeys = make([]KeyUsageSummary, len(keySummaries))
	for i, ks := range keySummaries {
		stats.TopAPIKeys[i] = KeyUsageSummary{
			KeyID:    ks.KeyID.String(),
			KeyName:  ks.Name,
			Requests: ks.Count,
			Tokens:   ks.Tokens,
			Cost:     ks.Cost,
		}
		stats.TotalRequests += ks.Count
		stats.TotalTokens += ks.Tokens
		stats.TotalCost += ks.Cost
	}

	return stats, nil
}

// AuditLogRepositoryImpl implements AuditLogRepository
type AuditLogRepositoryImpl struct {
	*BaseRepositoryImpl[models.AuditLog]
}

// NewAuditLogRepository creates a new audit log repository
func NewAuditLogRepository(db *gorm.DB) AuditLogRepository {
	base := NewBaseRepository[models.AuditLog](db)
	return &AuditLogRepositoryImpl{
		BaseRepositoryImpl: base.(*BaseRepositoryImpl[models.AuditLog]),
	}
}

// GetByTenant retrieves paginated audit logs for a tenant
func (r *AuditLogRepositoryImpl) GetByTenant(ctx context.Context, tenantID string, pagination Pagination) (PaginatedResult[models.AuditLog], error) {
	opts := QueryOptions{
		TenantID: tenantID,
		Preloads: []string{"User"},
	}
	return r.ListWithOptions(ctx, pagination, opts)
}

// GetByUser retrieves audit logs for a specific user
func (r *AuditLogRepositoryImpl) GetByUser(ctx context.Context, userID string, timeRange time.Duration, pagination Pagination) (PaginatedResult[models.AuditLog], error) {
	since := time.Now().Add(-timeRange)

	opts := QueryOptions{
		Filters: map[string]any{
			"user_id": userID,
		},
		RawQuery: "created_at >= ?",
		RawArgs:  []any{since},
	}

	return r.ListWithOptions(ctx, pagination, opts)
}

// GetByAction retrieves audit logs by action type
func (r *AuditLogRepositoryImpl) GetByAction(ctx context.Context, tenantID, action string, timeRange time.Duration) ([]models.AuditLog, error) {
	var logs []models.AuditLog
	since := time.Now().Add(-timeRange)

	err := r.db.WithContext(ctx).
		Where("tenant_id = ? AND action = ? AND created_at >= ?", tenantID, action, since).
		Order("created_at DESC").
		Find(&logs).Error

	return logs, err
}

// GetByResource retrieves audit logs for a specific resource
func (r *AuditLogRepositoryImpl) GetByResource(ctx context.Context, tenantID, resourceType, resourceID string) ([]models.AuditLog, error) {
	var logs []models.AuditLog

	err := r.db.WithContext(ctx).
		Where("tenant_id = ? AND resource_type = ? AND resource_id = ?", tenantID, resourceType, resourceID).
		Order("created_at DESC").
		Find(&logs).Error

	return logs, err
}

// GetByTimeRange retrieves audit logs within a time range
func (r *AuditLogRepositoryImpl) GetByTimeRange(ctx context.Context, tenantID string, start, end time.Time, pagination Pagination) (PaginatedResult[models.AuditLog], error) {
	var logs []models.AuditLog
	var total int64

	query := r.db.WithContext(ctx).Model(&models.AuditLog{}).
		Where("tenant_id = ? AND created_at >= ? AND created_at <= ?", tenantID, start, end)

	// Count total records
	if err := query.Count(&total).Error; err != nil {
		return PaginatedResult[models.AuditLog]{}, err
	}

	// Get paginated results
	if err := query.Preload("User").
		Offset(pagination.Offset()).
		Limit(pagination.Limit()).
		Order("created_at DESC").
		Find(&logs).Error; err != nil {
		return PaginatedResult[models.AuditLog]{}, err
	}

	return NewPaginatedResult(logs, total, pagination), nil
}

// GetComplianceReports generates compliance reports
func (r *AuditLogRepositoryImpl) GetComplianceReports(ctx context.Context, tenantID string, timeRange time.Duration) (*ComplianceReport, error) {
	report := &ComplianceReport{
		EventsByType: make(map[string]int64),
		EventsByUser: make(map[string]int64),
	}

	// Parse tenant ID
	tenantUUID, err := uuid.Parse(tenantID)
	if err != nil {
		return nil, fmt.Errorf("invalid tenant ID: %w", err)
	}

	since := time.Now().Add(-timeRange)

	// Get total events
	if err := r.db.WithContext(ctx).Model(&models.AuditLog{}).
		Where("tenant_id = ? AND created_at >= ?", tenantUUID, since).
		Count(&report.TotalEvents).Error; err != nil {
		return nil, err
	}

	// Get events by type
	var eventTypeStats []struct {
		Action string
		Count  int64
	}
	if err := r.db.WithContext(ctx).Model(&models.AuditLog{}).
		Select("action, COUNT(*) as count").
		Where("tenant_id = ? AND created_at >= ?", tenantUUID, since).
		Group("action").
		Scan(&eventTypeStats).Error; err != nil {
		return nil, err
	}

	for _, et := range eventTypeStats {
		report.EventsByType[et.Action] = et.Count
	}

	// Get events by user
	var userEventStats []struct {
		UserID uuid.UUID
		Count  int64
	}
	if err := r.db.WithContext(ctx).Model(&models.AuditLog{}).
		Select("user_id, COUNT(*) as count").
		Where("tenant_id = ? AND created_at >= ? AND user_id IS NOT NULL", tenantUUID, since).
		Group("user_id").
		Scan(&userEventStats).Error; err != nil {
		return nil, err
	}

	for _, ue := range userEventStats {
		report.EventsByUser[ue.UserID.String()] = ue.Count
	}

	// Get security events
	if err := r.db.WithContext(ctx).
		Where("tenant_id = ? AND action IN (?) AND created_at >= ?", tenantUUID, []string{"access_denied", "unauthorized_access", "suspicious_activity"}, since).
		Find(&report.SecurityEvents).Error; err != nil {
		return nil, err
	}

	// Calculate compliance score (simplified)
	totalSecurityEvents := int64(len(report.SecurityEvents))
	if report.TotalEvents > 0 {
		report.ComplianceScore = float64(report.TotalEvents-totalSecurityEvents) / float64(report.TotalEvents) * 100
	}

	return report, nil
}

// GetSecurityEvents retrieves security-related events
func (r *AuditLogRepositoryImpl) GetSecurityEvents(ctx context.Context, tenantID string, timeRange time.Duration) ([]models.AuditLog, error) {
	var logs []models.AuditLog
	since := time.Now().Add(-timeRange)

	securityActions := []string{
		"access_denied",
		"unauthorized_access",
		"login_failed",
		"permission_denied",
		"suspicious_activity",
		"data_breach_attempt",
	}

	err := r.db.WithContext(ctx).
		Where("tenant_id = ? AND action IN (?) AND created_at >= ?", tenantID, securityActions, since).
		Order("created_at DESC").
		Find(&logs).Error

	return logs, err
}

// GetAccessLogs retrieves access-related logs
func (r *AuditLogRepositoryImpl) GetAccessLogs(ctx context.Context, tenantID string, timeRange time.Duration) ([]models.AuditLog, error) {
	var logs []models.AuditLog
	since := time.Now().Add(-timeRange)

	accessActions := []string{
		"read",
		"write",
		"delete",
		"access",
		"download",
		"upload",
	}

	err := r.db.WithContext(ctx).
		Where("tenant_id = ? AND action IN (?) AND created_at >= ?", tenantID, accessActions, since).
		Order("created_at DESC").
		Find(&logs).Error

	return logs, err
}

// GetAuditStatistics retrieves audit statistics for a tenant
func (r *AuditLogRepositoryImpl) GetAuditStatistics(ctx context.Context, tenantID string, timeRange time.Duration) (*AuditStats, error) {
	stats := &AuditStats{
		EventsByAction:   make(map[string]int64),
		EventsByUser:     make(map[string]int64),
		EventsByResource: make(map[string]int64),
	}

	// Parse tenant ID
	tenantUUID, err := uuid.Parse(tenantID)
	if err != nil {
		return nil, fmt.Errorf("invalid tenant ID: %w", err)
	}

	since := time.Now().Add(-timeRange)

	// Get total events
	if err := r.db.WithContext(ctx).Model(&models.AuditLog{}).
		Where("tenant_id = ? AND created_at >= ?", tenantUUID, since).
		Count(&stats.TotalEvents).Error; err != nil {
		return nil, err
	}

	// Get events by action
	var actionStats []struct {
		Action string
		Count  int64
	}
	if err := r.db.WithContext(ctx).Model(&models.AuditLog{}).
		Select("action, COUNT(*) as count").
		Where("tenant_id = ? AND created_at >= ?", tenantUUID, since).
		Group("action").
		Scan(&actionStats).Error; err != nil {
		return nil, err
	}

	for _, as := range actionStats {
		stats.EventsByAction[as.Action] = as.Count
	}

	// Get events by user
	var userStats []struct {
		UserID uuid.UUID
		Count  int64
	}
	if err := r.db.WithContext(ctx).Model(&models.AuditLog{}).
		Select("user_id, COUNT(*) as count").
		Where("tenant_id = ? AND created_at >= ? AND user_id IS NOT NULL", tenantUUID, since).
		Group("user_id").
		Scan(&userStats).Error; err != nil {
		return nil, err
	}

	for _, us := range userStats {
		stats.EventsByUser[us.UserID.String()] = us.Count
	}

	// Get events by resource
	var resourceStats []struct {
		ResourceType string
		Count        int64
	}
	if err := r.db.WithContext(ctx).Model(&models.AuditLog{}).
		Select("resource_type, COUNT(*) as count").
		Where("tenant_id = ? AND created_at >= ? AND resource_type IS NOT NULL", tenantUUID, since).
		Group("resource_type").
		Scan(&resourceStats).Error; err != nil {
		return nil, err
	}

	for _, rs := range resourceStats {
		stats.EventsByResource[rs.ResourceType] = rs.Count
	}

	// Get failed operations
	if err := r.db.WithContext(ctx).Model(&models.AuditLog{}).
		Where("tenant_id = ? AND response_status >= 400 AND created_at >= ?", tenantUUID, since).
		Count(&stats.FailedOperations).Error; err != nil {
		return nil, err
	}

	// Get security events
	if err := r.db.WithContext(ctx).Model(&models.AuditLog{}).
		Where("tenant_id = ? AND action IN (?) AND created_at >= ?", tenantUUID, []string{"access_denied", "unauthorized_access"}, since).
		Count(&stats.SecurityEvents).Error; err != nil {
		return nil, err
	}

	return stats, nil
}

// GetActivitySummary retrieves activity summary for a tenant
func (r *AuditLogRepositoryImpl) GetActivitySummary(ctx context.Context, tenantID string, timeRange time.Duration) (*ActivitySummary, error) {
	summary := &ActivitySummary{
		OperationsByType: make(map[string]int64),
	}

	// Parse tenant ID
	tenantUUID, err := uuid.Parse(tenantID)
	if err != nil {
		return nil, fmt.Errorf("invalid tenant ID: %w", err)
	}

	since := time.Now().Add(-timeRange)

	// Get unique users
	if err := r.db.WithContext(ctx).Model(&models.AuditLog{}).
		Select("COUNT(DISTINCT user_id)").
		Where("tenant_id = ? AND created_at >= ? AND user_id IS NOT NULL", tenantUUID, since).
		Scan(&summary.TotalUsers).Error; err != nil {
		return nil, err
	}

	// Get active users (users with at least one action)
	if err := r.db.WithContext(ctx).Model(&models.AuditLog{}).
		Select("COUNT(DISTINCT user_id)").
		Where("tenant_id = ? AND created_at >= ? AND user_id IS NOT NULL", tenantUUID, since).
		Scan(&summary.ActiveUsers).Error; err != nil {
		return nil, err
	}

	// Get new users (user creation events)
	if err := r.db.WithContext(ctx).Model(&models.AuditLog{}).
		Where("tenant_id = ? AND action = ? AND created_at >= ?", tenantUUID, "create", since).
		Count(&summary.NewUsers).Error; err != nil {
		return nil, err
	}

	// Get total operations
	if err := r.db.WithContext(ctx).Model(&models.AuditLog{}).
		Where("tenant_id = ? AND created_at >= ?", tenantUUID, since).
		Count(&summary.TotalOperations).Error; err != nil {
		return nil, err
	}

	// Get operations by type
	var operationStats []struct {
		Action string
		Count  int64
	}
	if err := r.db.WithContext(ctx).Model(&models.AuditLog{}).
		Select("action, COUNT(*) as count").
		Where("tenant_id = ? AND created_at >= ?", tenantUUID, since).
		Group("action").
		Order("count DESC").
		Limit(10).
		Scan(&operationStats).Error; err != nil {
		return nil, err
	}

	for _, os := range operationStats {
		summary.OperationsByType[os.Action] = os.Count
	}

	// Calculate average operations per hour
	hours := int(timeRange.Hours())
	if hours > 0 {
		summary.AverageActivity = float64(summary.TotalOperations) / float64(hours)
	}

	return summary, nil
}
