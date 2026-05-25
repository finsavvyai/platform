package metrics

import (
	"strconv"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"github.com/sirupsen/logrus"
)

// AuditMetrics holds Prometheus metrics for audit logging
type AuditMetrics struct {
	// Audit log operations
	AuditLogsTotal   *prometheus.CounterVec
	AuditLogQueries  *prometheus.CounterVec
	AuditLogExports  *prometheus.CounterVec
	AuditLogCleanups *prometheus.CounterVec

	// Authentication events
	AuthAttempts  *prometheus.CounterVec
	AuthSuccesses *prometheus.CounterVec
	AuthFailures  *prometheus.CounterVec
	AuthMFAUsed   *prometheus.CounterVec

	// Authorization events
	AuthzChecks  *prometheus.CounterVec
	AuthzGranted *prometheus.CounterVec
	AuthzDenied  *prometheus.CounterVec

	// Data access events
	DataAccessTotal     *prometheus.CounterVec
	DataAccessRead      *prometheus.CounterVec
	DataAccessWrite     *prometheus.CounterVec
	DataAccessDelete    *prometheus.CounterVec
	SensitiveDataAccess *prometheus.CounterVec

	// Admin actions
	AdminActionsTotal   *prometheus.CounterVec
	UserModifications   *prometheus.CounterVec
	TenantModifications *prometheus.CounterVec
	PolicyChanges       *prometheus.CounterVec

	// Configuration changes
	ConfigChanges *prometheus.CounterVec

	// Retention
	OldLogsCleaned  *prometheus.CounterVec
	CurrentLogCount *prometheus.GaugeVec

	logger *logrus.Logger
}

// NewAuditMetrics creates audit logging metrics
func NewAuditMetrics(registerer prometheus.Registerer, logger *logrus.Logger) *AuditMetrics {
	if logger == nil {
		logger = logrus.New()
	}

	if registerer == nil {
		registerer = prometheus.DefaultRegisterer
	}

	metrics := &AuditMetrics{
		logger: logger,

		// Audit log operations
		AuditLogsTotal: promauto.With(registerer).NewCounterVec(
			prometheus.CounterOpts{
				Namespace: "sdlc",
				Subsystem: "gateway",
				Name:      "audit_logs_total",
				Help:      "Total number of audit logs created",
			},
			[]string{"tenant_id", "action", "result"},
		),
		AuditLogQueries: promauto.With(registerer).NewCounterVec(
			prometheus.CounterOpts{
				Namespace: "sdlc",
				Subsystem: "gateway",
				Name:      "audit_log_queries_total",
				Help:      "Total number of audit log queries",
			},
			[]string{"tenant_id"},
		),
		AuditLogExports: promauto.With(registerer).NewCounterVec(
			prometheus.CounterOpts{
				Namespace: "sdlc",
				Subsystem: "gateway",
				Name:      "audit_log_exports_total",
				Help:      "Total number of audit log exports",
			},
			[]string{"tenant_id"},
		),
		AuditLogCleanups: promauto.With(registerer).NewCounterVec(
			prometheus.CounterOpts{
				Namespace: "sdlc",
				Subsystem: "gateway",
				Name:      "audit_log_cleanups_total",
				Help:      "Total number of audit log cleanup operations",
			},
			[]string{"tenant_id", "retention_days"},
		),

		// Authentication events
		AuthAttempts: promauto.With(registerer).NewCounterVec(
			prometheus.CounterOpts{
				Namespace: "sdlc",
				Subsystem: "gateway",
				Name:      "audit_auth_attempts_total",
				Help:      "Total number of authentication attempts",
			},
			[]string{"tenant_id", "method"},
		),
		AuthSuccesses: promauto.With(registerer).NewCounterVec(
			prometheus.CounterOpts{
				Namespace: "sdlc",
				Subsystem: "gateway",
				Name:      "audit_auth_successes_total",
				Help:      "Total number of successful authentications",
			},
			[]string{"tenant_id", "method"},
		),
		AuthFailures: promauto.With(registerer).NewCounterVec(
			prometheus.CounterOpts{
				Namespace: "sdlc",
				Subsystem: "gateway",
				Name:      "audit_auth_failures_total",
				Help:      "Total number of failed authentication attempts",
			},
			[]string{"tenant_id", "method", "failure_reason"},
		),
		AuthMFAUsed: promauto.With(registerer).NewCounterVec(
			prometheus.CounterOpts{
				Namespace: "sdlc",
				Subsystem: "gateway",
				Name:      "audit_auth_mfa_used_total",
				Help:      "Total number of authentication attempts with MFA",
			},
			[]string{"tenant_id", "method"},
		),

		// Authorization events
		AuthzChecks: promauto.With(registerer).NewCounterVec(
			prometheus.CounterOpts{
				Namespace: "sdlc",
				Subsystem: "gateway",
				Name:      "audit_authz_checks_total",
				Help:      "Total number of authorization checks",
			},
			[]string{"tenant_id", "resource_type", "action"},
		),
		AuthzGranted: promauto.With(registerer).NewCounterVec(
			prometheus.CounterOpts{
				Namespace: "sdlc",
				Subsystem: "gateway",
				Name:      "audit_authz_granted_total",
				Help:      "Total number of granted authorization requests",
			},
			[]string{"tenant_id", "resource_type", "action"},
		),
		AuthzDenied: promauto.With(registerer).NewCounterVec(
			prometheus.CounterOpts{
				Namespace: "sdlc",
				Subsystem: "gateway",
				Name:      "audit_authz_denied_total",
				Help:      "Total number of denied authorization requests",
			},
			[]string{"tenant_id", "resource_type", "action", "denial_reason"},
		),

		// Data access events
		DataAccessTotal: promauto.With(registerer).NewCounterVec(
			prometheus.CounterOpts{
				Namespace: "sdlc",
				Subsystem: "gateway",
				Name:      "audit_data_access_total",
				Help:      "Total number of data access events",
			},
			[]string{"tenant_id", "resource_type", "operation"},
		),
		DataAccessRead: promauto.With(registerer).NewCounterVec(
			prometheus.CounterOpts{
				Namespace: "sdlc",
				Subsystem: "gateway",
				Name:      "audit_data_access_read_total",
				Help:      "Total number of data read operations",
			},
			[]string{"tenant_id", "resource_type"},
		),
		DataAccessWrite: promauto.With(registerer).NewCounterVec(
			prometheus.CounterOpts{
				Namespace: "sdlc",
				Subsystem: "gateway",
				Name:      "audit_data_access_write_total",
				Help:      "Total number of data write operations",
			},
			[]string{"tenant_id", "resource_type"},
		),
		DataAccessDelete: promauto.With(registerer).NewCounterVec(
			prometheus.CounterOpts{
				Namespace: "sdlc",
				Subsystem: "gateway",
				Name:      "audit_data_access_delete_total",
				Help:      "Total number of data delete operations",
			},
			[]string{"tenant_id", "resource_type"},
		),
		SensitiveDataAccess: promauto.With(registerer).NewCounterVec(
			prometheus.CounterOpts{
				Namespace: "sdlc",
				Subsystem: "gateway",
				Name:      "audit_sensitive_data_access_total",
				Help:      "Total number of sensitive data access events",
			},
			[]string{"tenant_id", "resource_type", "sensitivity_level"},
		),

		// Admin actions
		AdminActionsTotal: promauto.With(registerer).NewCounterVec(
			prometheus.CounterOpts{
				Namespace: "sdlc",
				Subsystem: "gateway",
				Name:      "audit_admin_actions_total",
				Help:      "Total number of admin actions",
			},
			[]string{"tenant_id", "action", "target_type"},
		),
		UserModifications: promauto.With(registerer).NewCounterVec(
			prometheus.CounterOpts{
				Namespace: "sdlc",
				Subsystem: "gateway",
				Name:      "audit_user_modifications_total",
				Help:      "Total number of user modification actions",
			},
			[]string{"tenant_id", "admin_role"},
		),
		TenantModifications: promauto.With(registerer).NewCounterVec(
			prometheus.CounterOpts{
				Namespace: "sdlc",
				Subsystem: "gateway",
				Name:      "audit_tenant_modifications_total",
				Help:      "Total number of tenant modification actions",
			},
			[]string{"admin_role"},
		),
		PolicyChanges: promauto.With(registerer).NewCounterVec(
			prometheus.CounterOpts{
				Namespace: "sdlc",
				Subsystem: "gateway",
				Name:      "audit_policy_changes_total",
				Help:      "Total number of policy changes",
			},
			[]string{"tenant_id", "policy_type", "change_type"},
		),

		// Configuration changes
		ConfigChanges: promauto.With(registerer).NewCounterVec(
			prometheus.CounterOpts{
				Namespace: "sdlc",
				Subsystem: "gateway",
				Name:      "audit_config_changes_total",
				Help:      "Total number of configuration changes",
			},
			[]string{"tenant_id", "config_type"},
		),

		// Retention
		OldLogsCleaned: promauto.With(registerer).NewCounterVec(
			prometheus.CounterOpts{
				Namespace: "sdlc",
				Subsystem: "gateway",
				Name:      "audit_old_logs_cleaned_total",
				Help:      "Total number of old audit logs cleaned up",
			},
			[]string{"tenant_id", "retention_days"},
		),
		CurrentLogCount: promauto.With(registerer).NewGaugeVec(
			prometheus.GaugeOpts{
				Namespace: "sdlc",
				Subsystem: "gateway",
				Name:      "audit_log_count",
				Help:      "Current number of audit logs per tenant",
			},
			[]string{"tenant_id"},
		),
	}

	return metrics
}

// RecordAuditLog records an audit log creation
func (m *AuditMetrics) RecordAuditLog(action, result, tenantID string) {
	m.AuditLogsTotal.WithLabelValues(tenantID, action, result).Inc()
}

// RecordAuditQuery records an audit log query
func (m *AuditMetrics) RecordAuditQuery(tenantID string) {
	m.AuditLogQueries.WithLabelValues(tenantID).Inc()
}

// RecordAuditExport records an audit log export
func (m *AuditMetrics) RecordAuditExport(tenantID string) {
	m.AuditLogExports.WithLabelValues(tenantID).Inc()
}

// RecordAuditCleanup records an audit log cleanup
func (m *AuditMetrics) RecordAuditCleanup(tenantID string, retentionDays int, count int) {
	m.AuditLogCleanups.WithLabelValues(tenantID, strconv.Itoa(retentionDays)).Add(float64(count))
}

// RecordAuthAttempt records an authentication attempt
func (m *AuditMetrics) RecordAuthAttempt(tenantID, method string) {
	m.AuthAttempts.WithLabelValues(tenantID, method).Inc()
}

// RecordAuthSuccess records a successful authentication
func (m *AuditMetrics) RecordAuthSuccess(tenantID, method string, mfaUsed bool) {
	m.AuthSuccesses.WithLabelValues(tenantID, method).Inc()
	if mfaUsed {
		m.AuthMFAUsed.WithLabelValues(tenantID, method).Inc()
	}
}

// RecordAuthFailure records a failed authentication
func (m *AuditMetrics) RecordAuthFailure(tenantID, method, failureReason string) {
	m.AuthFailures.WithLabelValues(tenantID, method, failureReason).Inc()
}

// RecordAuthzCheck records an authorization check
func (m *AuditMetrics) RecordAuthzCheck(tenantID, resourceType, action string) {
	m.AuthzChecks.WithLabelValues(tenantID, resourceType, action).Inc()
}

// RecordAuthzGranted records a granted authorization
func (m *AuditMetrics) RecordAuthzGranted(tenantID, resourceType, action string) {
	m.AuthzGranted.WithLabelValues(tenantID, resourceType, action).Inc()
}

// RecordAuthzDenied records a denied authorization
func (m *AuditMetrics) RecordAuthzDenied(tenantID, resourceType, action, denialReason string) {
	m.AuthzDenied.WithLabelValues(tenantID, resourceType, action, denialReason).Inc()
}

// RecordDataAccess records a data access event
func (m *AuditMetrics) RecordDataAccess(tenantID, resourceType, operation string) {
	m.DataAccessTotal.WithLabelValues(tenantID, resourceType, operation).Inc()

	switch operation {
	case "read":
		m.DataAccessRead.WithLabelValues(tenantID, resourceType).Inc()
	case "write":
		m.DataAccessWrite.WithLabelValues(tenantID, resourceType).Inc()
	case "delete":
		m.DataAccessDelete.WithLabelValues(tenantID, resourceType).Inc()
	}
}

// RecordSensitiveDataAccess records sensitive data access
func (m *AuditMetrics) RecordSensitiveDataAccess(tenantID, resourceType, sensitivityLevel string) {
	m.SensitiveDataAccess.WithLabelValues(tenantID, resourceType, sensitivityLevel).Inc()
}

// RecordAdminAction records an admin action
func (m *AuditMetrics) RecordAdminAction(tenantID, action, targetType, adminRole string) {
	m.AdminActionsTotal.WithLabelValues(tenantID, action, targetType).Inc()

	switch targetType {
	case "user":
		m.UserModifications.WithLabelValues(tenantID, adminRole).Inc()
	case "tenant":
		m.TenantModifications.WithLabelValues(adminRole).Inc()
	case "policy":
		m.PolicyChanges.WithLabelValues(tenantID, action, "modify").Inc()
	}
}

// RecordPolicyChange records a policy change
func (m *AuditMetrics) RecordPolicyChange(tenantID, policyType, changeType string) {
	m.PolicyChanges.WithLabelValues(tenantID, policyType, changeType).Inc()
}

// RecordConfigChange records a configuration change
func (m *AuditMetrics) RecordConfigChange(tenantID, configType string) {
	m.ConfigChanges.WithLabelValues(tenantID, configType).Inc()
}

// SetLogCount sets the current log count for a tenant
func (m *AuditMetrics) SetLogCount(tenantID string, count float64) {
	m.CurrentLogCount.WithLabelValues(tenantID).Set(count)
}
