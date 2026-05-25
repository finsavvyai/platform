package webhooks

import (
	"context"
	"fmt"
	"time"
)

func (a *AuditSender) SendScanStarted(ctx context.Context, connectionName, scanID, actor string) error {
	return a.Send(ctx, AuditEvent{
		Action:       "scan_started",
		Actor:        actor,
		Resource:     scanID,
		ResourceType: "scan",
		Details: map[string]string{
			"connection": connectionName,
			"scanId":     scanID,
		},
		Timestamp: time.Now(),
	})
}

// SendScanCompleted sends a scan_completed event.
func (a *AuditSender) SendScanCompleted(ctx context.Context, connectionName, scanID, actor string, findingCount int) error {
	return a.Send(ctx, AuditEvent{
		Action:       "scan_completed",
		Actor:        actor,
		Resource:     scanID,
		ResourceType: "scan",
		Details: map[string]string{
			"connection":   connectionName,
			"scanId":       scanID,
			"findingCount": fmt.Sprintf("%d", findingCount),
		},
		Timestamp: time.Now(),
	})
}

// SendFindingResolved sends a finding_resolved event.
func (a *AuditSender) SendFindingResolved(ctx context.Context, findingID, connectionName, actor, remediation string) error {
	return a.Send(ctx, AuditEvent{
		Action:       "finding_resolved",
		Actor:        actor,
		Resource:     findingID,
		ResourceType: "finding",
		Details: map[string]string{
			"connection":  connectionName,
			"findingId":   findingID,
			"remediation": remediation,
		},
		Timestamp: time.Now(),
	})
}

// SendConnectionAdded sends a connection_added event.
func (a *AuditSender) SendConnectionAdded(ctx context.Context, connectionName, platform, actor string) error {
	return a.Send(ctx, AuditEvent{
		Action:       "connection_added",
		Actor:        actor,
		Resource:     connectionName,
		ResourceType: "connection",
		Details: map[string]string{
			"connection": connectionName,
			"platform":   platform,
		},
		Timestamp: time.Now(),
	})
}

// SendConnectionRemoved sends a connection_removed event.
func (a *AuditSender) SendConnectionRemoved(ctx context.Context, connectionName, actor string) error {
	return a.Send(ctx, AuditEvent{
		Action:       "connection_removed",
		Actor:        actor,
		Resource:     connectionName,
		ResourceType: "connection",
		Details: map[string]string{
			"connection": connectionName,
		},
		Timestamp: time.Now(),
	})
}

// SendPolicyViolation sends a policy_violation event.
func (a *AuditSender) SendPolicyViolation(ctx context.Context, policyID, description, actor string) error {
	return a.Send(ctx, AuditEvent{
		Action:       "policy_violation",
		Actor:        actor,
		Resource:     policyID,
		ResourceType: "policy",
		Details: map[string]string{
			"policyId":    policyID,
			"description": description,
		},
		Timestamp: time.Now(),
	})
}
