package security

import (
	"context"
	"testing"
	"time"
)

func TestNewSecurityEvent(t *testing.T) {
	tests := []struct {
		name      string
		eventType EventType
		actorID   string
		tenantID  string
		severity  Severity
		wantErr   bool
	}{
		{
			name:      "valid event",
			eventType: EventFailedLogin,
			actorID:   "actor1",
			tenantID:  "tenant1",
			severity:  SeverityMedium,
			wantErr:   false,
		},
		{
			name:      "missing actor id",
			eventType: EventFailedLogin,
			actorID:   "",
			tenantID:  "tenant1",
			severity:  SeverityMedium,
			wantErr:   true,
		},
		{
			name:      "missing tenant id",
			eventType: EventFailedLogin,
			actorID:   "actor1",
			tenantID:  "",
			severity:  SeverityMedium,
			wantErr:   true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := NewSecurityEvent(
				tt.eventType,
				tt.actorID,
				tt.tenantID,
				tt.severity,
			)
			if (err != nil) != tt.wantErr {
				t.Errorf("NewSecurityEvent() error = %v, wantErr %v",
					err, tt.wantErr)
			}
			if !tt.wantErr {
				if got.ID == "" {
					t.Error("event should have non-empty ID")
				}
				if got.EventType != tt.eventType {
					t.Errorf("eventType = %v, want %v",
						got.EventType, tt.eventType)
				}
				if got.ActorID != tt.actorID {
					t.Errorf("actorID = %v, want %v",
						got.ActorID, tt.actorID)
				}
			}
		})
	}
}

func TestRecordAndRetrieveEvent(t *testing.T) {
	tests := []struct {
		name       string
		numEvents  int
		expectErr  bool
		eventType  EventType
		severity   Severity
	}{
		{
			name:       "single event",
			numEvents:  1,
			expectErr:  false,
			eventType: EventFailedLogin,
			severity:  SeverityMedium,
		},
		{
			name:       "multiple events",
			numEvents:  5,
			expectErr:  false,
			eventType: EventDataExport,
			severity:  SeverityHigh,
		},
		{
			name:       "no events",
			numEvents:  0,
			expectErr:  false,
			eventType: EventFailedLogin,
			severity:  SeverityLow,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cm := NewContinuousMonitor(3)
			ctx := context.Background()

			for i := 0; i < tt.numEvents; i++ {
				event, err := NewSecurityEvent(
					tt.eventType,
					"actor1",
					"tenant1",
					tt.severity,
				)
				if err != nil {
					t.Fatalf("NewSecurityEvent() error = %v", err)
				}

				err = cm.RecordEvent(ctx, event)
				if (err != nil) != tt.expectErr {
					t.Errorf("RecordEvent() error = %v, expectErr %v",
						err, tt.expectErr)
				}
			}

			metrics := cm.GetMetrics(ctx)
			if int(metrics.TotalEvents) != tt.numEvents {
				t.Errorf("TotalEvents = %d, want %d",
					metrics.TotalEvents, tt.numEvents)
			}
		})
	}
}

func TestAnomalyDetectionThreshold(t *testing.T) {
	tests := []struct {
		name          string
		numEvents     int
		threshold     int
		expectAnomaly bool
	}{
		{
			name:          "below threshold",
			numEvents:     2,
			threshold:     3,
			expectAnomaly: false,
		},
		{
			name:          "at threshold",
			numEvents:     3,
			threshold:     3,
			expectAnomaly: false,
		},
		{
			name:          "exceeds threshold",
			numEvents:     10,
			threshold:     3,
			expectAnomaly: true,
		},
		{
			name:          "far exceeds threshold",
			numEvents:     20,
			threshold:     3,
			expectAnomaly: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cm := NewContinuousMonitor(tt.threshold)
			ctx := context.Background()

			for i := 0; i < tt.numEvents; i++ {
				event, _ := NewSecurityEvent(
					EventFailedLogin,
					"actor1",
					"tenant1",
					SeverityMedium,
				)
				cm.RecordEvent(ctx, event)
			}

			isAnomaly, err := cm.CheckAnomaly(ctx, "tenant1")
			if err != nil {
				t.Fatalf("CheckAnomaly() error = %v", err)
			}

			if isAnomaly != tt.expectAnomaly {
				t.Errorf("CheckAnomaly() = %v, want %v",
					isAnomaly, tt.expectAnomaly)
			}
		})
	}
}

func TestNoFalsePositiveNormalActivity(t *testing.T) {
	tests := []struct {
		name      string
		numEvents int
	}{
		{
			name:      "low activity",
			numEvents: 1,
		},
		{
			name:      "normal activity",
			numEvents: 2,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cm := NewContinuousMonitor(5)
			ctx := context.Background()

			for i := 0; i < tt.numEvents; i++ {
				event, _ := NewSecurityEvent(
					EventFailedLogin,
					"actor1",
					"tenant1",
					SeverityLow,
				)
				cm.RecordEvent(ctx, event)
			}

			isAnomaly, _ := cm.CheckAnomaly(ctx, "tenant1")
			if isAnomaly {
				t.Error("should not flag normal activity as anomaly")
			}
		})
	}
}

func TestMetricsComputation(t *testing.T) {
	tests := []struct {
		name          string
		events        []EventType
		expectedCount int
		severity      Severity
	}{
		{
			name:          "single event type",
			events:        []EventType{EventFailedLogin},
			expectedCount: 1,
			severity:      SeverityMedium,
		},
		{
			name: "multiple event types",
			events: []EventType{
				EventFailedLogin,
				EventDataExport,
				EventPermissionChange,
			},
			expectedCount: 3,
			severity:      SeverityHigh,
		},
		{
			name: "repeated event type",
			events: []EventType{
				EventFailedLogin,
				EventFailedLogin,
				EventFailedLogin,
			},
			expectedCount: 3,
			severity:      SeverityMedium,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cm := NewContinuousMonitor(3)
			ctx := context.Background()

			for _, eventType := range tt.events {
				event, _ := NewSecurityEvent(
					eventType,
					"actor1",
					"tenant1",
					tt.severity,
				)
				cm.RecordEvent(ctx, event)
			}

			metrics := cm.GetMetrics(ctx)
			if int(metrics.TotalEvents) != tt.expectedCount {
				t.Errorf("TotalEvents = %d, want %d",
					metrics.TotalEvents, tt.expectedCount)
			}
			if metrics.LastEventTime.IsZero() {
				t.Error("LastEventTime should not be zero")
			}
		})
	}
}

func TestMultiTenantIsolation(t *testing.T) {
	tests := []struct {
		name        string
		tenant1Evts int
		tenant2Evts int
		checkTenant string
		expectCount int
	}{
		{
			name:        "tenant 1 isolation",
			tenant1Evts: 5,
			tenant2Evts: 3,
			checkTenant: "tenant1",
			expectCount: 5,
		},
		{
			name:        "tenant 2 isolation",
			tenant1Evts: 5,
			tenant2Evts: 3,
			checkTenant: "tenant2",
			expectCount: 3,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cm := NewContinuousMonitor(4)
			ctx := context.Background()

			for i := 0; i < tt.tenant1Evts; i++ {
				event, _ := NewSecurityEvent(
					EventFailedLogin,
					"actor1",
					"tenant1",
					SeverityMedium,
				)
				cm.RecordEvent(ctx, event)
			}

			for i := 0; i < tt.tenant2Evts; i++ {
				event, _ := NewSecurityEvent(
					EventFailedLogin,
					"actor2",
					"tenant2",
					SeverityMedium,
				)
				cm.RecordEvent(ctx, event)
			}

			isAnomaly, _ := cm.CheckAnomaly(ctx, tt.checkTenant)
			if tt.checkTenant == "tenant1" && !isAnomaly {
				t.Error("tenant1 should trigger anomaly at 5 events")
			}
			if tt.checkTenant == "tenant2" && isAnomaly {
				t.Error("tenant2 should not trigger anomaly at 3 events")
			}
		})
	}
}

func TestInvalidEventRecord(t *testing.T) {
	tests := []struct {
		name    string
		actorID string
		tenantID string
		wantErr bool
	}{
		{
			name:    "empty actor",
			actorID: "",
			tenantID: "t1",
			wantErr: true,
		},
		{
			name:    "empty tenant",
			actorID: "a1",
			tenantID: "",
			wantErr: true,
		},
		{
			name:    "valid",
			actorID: "a1",
			tenantID: "t1",
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cm := NewContinuousMonitor(3)
			ctx := context.Background()

			event := SecurityEvent{
				ID:        "evt_123",
				Timestamp: time.Now().UTC(),
				EventType: EventFailedLogin,
				ActorID:   tt.actorID,
				TenantID:  tt.tenantID,
				Severity:  SeverityMedium,
				Details:   make(map[string]interface{}),
			}

			err := cm.RecordEvent(ctx, event)
			if (err != nil) != tt.wantErr {
				t.Errorf("RecordEvent() error = %v, wantErr %v",
					err, tt.wantErr)
			}
		})
	}
}
