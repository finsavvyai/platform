package monitoring

import (
	"context"
	"fmt"
	"time"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	oteltrace "go.opentelemetry.io/otel/trace"
)

// AuditTraceHelper provides tracing functions specifically for audit operations
type AuditTraceHelper struct {
	tracer      oteltrace.Tracer
	serviceName string
}

// NewAuditTraceHelper creates a new audit trace helper
func NewAuditTraceHelper(serviceName string) *AuditTraceHelper {
	return &AuditTraceHelper{
		tracer:      otel.Tracer(fmt.Sprintf("%s.audit", serviceName)),
		serviceName: serviceName,
	}
}

// TraceAuthOperation traces an authentication operation
func (h *AuditTraceHelper) TraceAuthOperation(ctx context.Context, operation string) func(success bool, err error) {
	ctx, span := h.tracer.Start(ctx, fmt.Sprintf("audit.auth.%s", operation))

	span.SetAttributes(
		attribute.String("audit.event_type", "authentication"),
		attribute.String("audit.operation", operation),
	)

	return func(success bool, err error) {
		defer span.End()

		span.SetAttributes(
			attribute.Bool("audit.success", success),
		)

		if !success {
			span.SetStatus(codes.Error, "Authentication failed")
			if err != nil {
				span.RecordError(err)
			}
		} else {
			span.SetStatus(codes.Ok, "Authentication successful")
		}
	}
}

// TraceAuthzOperation traces an authorization operation
func (h *AuditTraceHelper) TraceAuthzOperation(ctx context.Context, resourceType, action string) func(granted bool, reason string) {
	ctx, span := h.tracer.Start(ctx, fmt.Sprintf("audit.authz.%s.%s", resourceType, action))

	span.SetAttributes(
		attribute.String("audit.event_type", "authorization"),
		attribute.String("audit.resource_type", resourceType),
		attribute.String("audit.action", action),
	)

	return func(granted bool, reason string) {
		defer span.End()

		span.SetAttributes(
			attribute.Bool("audit.granted", granted),
			attribute.String("audit.reason", reason),
		)

		if !granted {
			span.SetStatus(codes.Error, "Access denied")
			span.AddEvent("authorization_denied", oteltrace.WithAttributes(
				attribute.String("denial.reason", reason),
			))
		} else {
			span.SetStatus(codes.Ok, "Access granted")
		}
	}
}

// TraceDataAccess traces a data access operation
func (h *AuditTraceHelper) TraceDataAccess(ctx context.Context, resourceType, operation string, sensitivityLevel string) func(err error) {
	ctx, span := h.tracer.Start(ctx, fmt.Sprintf("audit.data.%s.%s", resourceType, operation))

	span.SetAttributes(
		attribute.String("audit.event_type", "data_access"),
		attribute.String("audit.resource_type", resourceType),
		attribute.String("audit.operation", operation),
		attribute.String("audit.sensitivity", sensitivityLevel),
	)

	// Mark sensitive operations
	if sensitivityLevel == "confidential" || sensitivityLevel == "restricted" {
		span.SetAttributes(attribute.Bool("audit.sensitive", true))
	}

	return func(err error) {
		defer span.End()

		if err != nil {
			span.SetStatus(codes.Error, "Data access failed")
			span.RecordError(err)
		} else {
			span.SetStatus(codes.Ok, "Data access successful")
		}
	}
}

// TraceAdminAction traces an administrative action
func (h *AuditTraceHelper) TraceAdminAction(ctx context.Context, action, targetType string) func(err error) {
	ctx, span := h.tracer.Start(ctx, fmt.Sprintf("audit.admin.%s.%s", targetType, action))

	span.SetAttributes(
		attribute.String("audit.event_type", "admin_action"),
		attribute.String("audit.action", action),
		attribute.String("audit.target_type", targetType),
		attribute.Bool("audit.elevated", true),
	)

	return func(err error) {
		defer span.End()

		if err != nil {
			span.SetStatus(codes.Error, "Admin action failed")
			span.RecordError(err)
		} else {
			span.SetStatus(codes.Ok, "Admin action successful")
		}
	}
}

// TraceConfigChange traces a configuration change
func (h *AuditTraceHelper) TraceConfigChange(ctx context.Context, configType, configPath string) func(err error) {
	ctx, span := h.tracer.Start(ctx, fmt.Sprintf("audit.config.%s", configType))

	span.SetAttributes(
		attribute.String("audit.event_type", "config_change"),
		attribute.String("audit.config_type", configType),
		attribute.String("audit.config_path", configPath),
		attribute.Bool("audit.tamper_evident", true),
	)

	return func(err error) {
		defer span.End()

		if err != nil {
			span.SetStatus(codes.Error, "Config change failed")
			span.RecordError(err)
		} else {
			span.SetStatus(codes.Ok, "Config change successful")
		}
	}
}

// TracePolicyChange traces a policy change
func (h *AuditTraceHelper) TracePolicyChange(ctx context.Context, policyType, changeType string) func(err error) {
	ctx, span := h.tracer.Start(ctx, fmt.Sprintf("audit.policy.%s", changeType))

	span.SetAttributes(
		attribute.String("audit.event_type", "policy_change"),
		attribute.String("audit.policy_type", policyType),
		attribute.String("audit.change_type", changeType),
	)

	return func(err error) {
		defer span.End()

		if err != nil {
			span.SetStatus(codes.Error, "Policy change failed")
			span.RecordError(err)
		} else {
			span.SetStatus(codes.Ok, "Policy change successful")
		}
	}
}

// TraceAuditLogQuery traces an audit log query
func (h *AuditTraceHelper) TraceAuditLogQuery(ctx context.Context) func(count int, err error) {
	ctx, span := h.tracer.Start(ctx, "audit.query")

	span.SetAttributes(
		attribute.String("audit.event_type", "query"),
	)

	return func(count int, err error) {
		defer span.End()

		span.SetAttributes(
			attribute.Int("audit.result_count", count),
		)

		if err != nil {
			span.SetStatus(codes.Error, "Query failed")
			span.RecordError(err)
		} else {
			span.SetStatus(codes.Ok, "Query successful")
		}
	}
}

// TraceAuditLogExport traces an audit log export
func (h *AuditTraceHelper) TraceAuditLogExport(ctx context.Context, format string) func(size int, err error) {
	ctx, span := h.tracer.Start(ctx, "audit.export")

	span.SetAttributes(
		attribute.String("audit.event_type", "export"),
		attribute.String("audit.export_format", format),
	)

	return func(size int, err error) {
		defer span.End()

		span.SetAttributes(
			attribute.Int("audit.export_size", size),
		)

		if err != nil {
			span.SetStatus(codes.Error, "Export failed")
			span.RecordError(err)
		} else {
			span.SetStatus(codes.Ok, "Export successful")
		}
	}
}

// TraceRetentionCleanup traces a retention cleanup operation
func (h *AuditTraceHelper) TraceRetentionCleanup(ctx context.Context, retentionDays int) func(deletedCount int, err error) {
	ctx, span := h.tracer.Start(ctx, "audit.retention_cleanup")

	span.SetAttributes(
		attribute.String("audit.event_type", "retention_cleanup"),
		attribute.Int("audit.retention_days", retentionDays),
	)

	return func(deletedCount int, err error) {
		defer span.End()

		span.SetAttributes(
			attribute.Int("audit.deleted_count", deletedCount),
		)

		if err != nil {
			span.SetStatus(codes.Error, "Cleanup failed")
			span.RecordError(err)
		} else {
			span.SetStatus(codes.Ok, "Cleanup successful")
		}
	}
}

// AddAuditEvent adds an audit event to the current span
func (h *AuditTraceHelper) AddAuditEvent(ctx context.Context, eventType string, attrs map[string]interface{}) {
	span := oteltrace.SpanFromContext(ctx)
	if !span.IsRecording() {
		return
	}

	otelAttrs := make([]attribute.KeyValue, 0, len(attrs)+1)
	otelAttrs = append(otelAttrs, attribute.String("audit.event_type", eventType))

	for k, v := range attrs {
		otelAttrs = append(otelAttrs, attribute.String(k, fmt.Sprintf("%v", v)))
	}

	span.AddEvent(fmt.Sprintf("audit.%s", eventType), oteltrace.WithAttributes(otelAttrs...))
}

// SetAuditAttributes sets audit attributes on the current span
func (h *AuditTraceHelper) SetAuditAttributes(ctx context.Context, attrs map[string]interface{}) {
	span := oteltrace.SpanFromContext(ctx)
	if !span.IsRecording() {
		return
	}

	otelAttrs := make([]attribute.KeyValue, 0, len(attrs))
	for k, v := range attrs {
		otelAttrs = append(otelAttrs, attribute.String(k, fmt.Sprintf("%v", v)))
	}

	span.SetAttributes(otelAttrs...)
}

// Global audit trace helper instance
var GlobalAuditTraceHelper = NewAuditTraceHelper("gateway")

// StandardAuditTracer implements the services.AuditTracer interface
type StandardAuditTracer struct {
	helper *AuditTraceHelper
}

// NewStandardAuditTracer creates a new standard audit tracer
func NewStandardAuditTracer(serviceName string) *StandardAuditTracer {
	return &StandardAuditTracer{
		helper: NewAuditTraceHelper(serviceName),
	}
}

// AddEvent implements the AuditTracer interface
func (t *StandardAuditTracer) AddEvent(ctx context.Context, eventName string, attributes map[string]interface{}) {
	t.helper.AddAuditEvent(ctx, eventName, attributes)
}

// SetAttributes implements the AuditTracer interface
func (t *StandardAuditTracer) SetAttributes(ctx context.Context, attributes map[string]interface{}) {
	t.helper.SetAuditAttributes(ctx, attributes)
}

// TraceAuth is a convenience function for tracing authentication
func TraceAuth(ctx context.Context, operation string, fn func() error) error {
	finish := GlobalAuditTraceHelper.TraceAuthOperation(ctx, operation)
	err := fn()
	finish(err == nil, err)
	return err
}

// TraceAuthz is a convenience function for tracing authorization
func TraceAuthz(ctx context.Context, resourceType, action string, fn func() (bool, string)) bool {
	finish := GlobalAuditTraceHelper.TraceAuthzOperation(ctx, resourceType, action)
	granted, reason := fn()
	finish(granted, reason)
	return granted
}

// TraceDataAccessOp is a convenience function for tracing data access
func TraceDataAccessOp(ctx context.Context, resourceType, operation, sensitivity string, fn func() error) error {
	finish := GlobalAuditTraceHelper.TraceDataAccess(ctx, resourceType, operation, sensitivity)
	err := fn()
	finish(err)
	return err
}

// MeasureAuditLatency measures the duration of an audit operation
func MeasureAuditLatency(ctx context.Context, operation string) func() {
	start := time.Now()
	span := oteltrace.SpanFromContext(ctx)

	if span.IsRecording() {
		span.AddEvent(fmt.Sprintf("audit.%s.start", operation))
	}

	return func() {
		duration := time.Since(start)

		if span.IsRecording() {
			span.AddEvent(fmt.Sprintf("audit.%s.complete", operation),
				oteltrace.WithAttributes(
					attribute.Int("duration_ms", int(duration.Milliseconds())),
				))
		}
	}
}
