package fraud

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"quantumbeam/internal/interfaces"
)

func TestNewSimpleAlertService(t *testing.T) {
	svc := NewSimpleAlertService()
	assert.NotNil(t, svc)
	assert.NotNil(t, svc.config)
	assert.True(t, svc.config.EnableLogging)
	assert.False(t, svc.config.EnableWebhooks)
	assert.Equal(t, 0.8, svc.config.AlertThreshold)
	assert.Equal(t, 100, svc.config.MaxAlertsPerHour)
}

func TestSendFraudRingAlert_Success(t *testing.T) {
	svc := NewSimpleAlertService()
	ctx := context.Background()

	fraudRing := &interfaces.FraudRing{
		RingID:           "ring_001",
		Members:          []string{"u1", "u2", "u3"},
		ConfidenceScore:  0.92,
		TransactionCount: 15,
		TotalAmount:      50000.0,
		DetectionMethod:  "qaoa_quantum",
		RiskIndicators:   []string{"high_connectivity", "amount_patterns"},
	}

	err := svc.SendFraudRingAlert(ctx, fraudRing)
	assert.NoError(t, err)
}

func TestSendFraudRingAlert_WithWebhooks(t *testing.T) {
	svc := NewSimpleAlertService()
	svc.config.EnableWebhooks = true
	svc.config.WebhookURL = "https://hooks.example.com/alerts"
	ctx := context.Background()

	fraudRing := &interfaces.FraudRing{
		RingID:          "ring_002",
		Members:         []string{"u4", "u5"},
		ConfidenceScore: 0.85,
	}

	err := svc.SendFraudRingAlert(ctx, fraudRing)
	assert.NoError(t, err)
}

func TestSendCommunityAlert_Success(t *testing.T) {
	svc := NewSimpleAlertService()
	ctx := context.Background()

	community := &interfaces.Community{
		ID:         "comm_001",
		Members:    []string{"u1", "u2", "u3", "u4"},
		FraudScore: 0.75,
		RiskLevel:  "high",
		Centrality: 0.82,
	}

	err := svc.SendCommunityAlert(ctx, community)
	assert.NoError(t, err)
}

func TestSendCommunityAlert_WithWebhooks(t *testing.T) {
	svc := NewSimpleAlertService()
	svc.config.EnableWebhooks = true
	svc.config.WebhookURL = "https://hooks.example.com/community"
	ctx := context.Background()

	community := &interfaces.Community{
		ID:         "comm_002",
		Members:    []string{"u5", "u6"},
		FraudScore: 0.65,
		RiskLevel:  "medium",
		Centrality: 0.60,
	}

	err := svc.SendCommunityAlert(ctx, community)
	assert.NoError(t, err)
}

func TestShouldSendAlert_AlwaysTrue(t *testing.T) {
	svc := NewSimpleAlertService()
	// Current implementation always returns true
	assert.True(t, svc.shouldSendAlert())
}

func TestCreateFraudRingAlertMessage(t *testing.T) {
	svc := NewSimpleAlertService()

	fraudRing := &interfaces.FraudRing{
		RingID:           "ring_msg_test",
		Members:          []string{"u1", "u2", "u3"},
		ConfidenceScore:  0.95,
		TransactionCount: 20,
		TotalAmount:      100000.0,
		DetectionMethod:  "qaoa_quantum",
		RiskIndicators:   []string{"high_connectivity"},
	}

	msg := svc.createFraudRingAlertMessage(fraudRing)
	assert.Contains(t, msg, "FRAUD RING DETECTED")
	assert.Contains(t, msg, "ring_msg_test")
	assert.Contains(t, msg, "Members: 3")
	assert.Contains(t, msg, "95.00%")
	assert.Contains(t, msg, "Transaction Count: 20")
	assert.Contains(t, msg, "$100000.00")
	assert.Contains(t, msg, "qaoa_quantum")
}

func TestCreateCommunityAlertMessage(t *testing.T) {
	svc := NewSimpleAlertService()

	community := &interfaces.Community{
		ID:         "comm_msg_test",
		Members:    []string{"u1", "u2"},
		FraudScore: 0.80,
		RiskLevel:  "high",
		Centrality: 0.75,
	}

	msg := svc.createCommunityAlertMessage(community)
	assert.Contains(t, msg, "SUSPICIOUS COMMUNITY DETECTED")
	assert.Contains(t, msg, "comm_msg_test")
	assert.Contains(t, msg, "Members: 2")
	assert.Contains(t, msg, "80.00%")
	assert.Contains(t, msg, "high")
	assert.Contains(t, msg, "0.75")
}

func TestAlertServiceConfig_DefaultValues(t *testing.T) {
	svc := NewSimpleAlertService()

	assert.True(t, svc.config.EnableLogging)
	assert.False(t, svc.config.EnableWebhooks)
	assert.Empty(t, svc.config.WebhookURL)
	assert.Equal(t, 0.8, svc.config.AlertThreshold)
	assert.Equal(t, 100, svc.config.MaxAlertsPerHour)
}

func TestSendFraudRingAlert_LoggingDisabled(t *testing.T) {
	svc := NewSimpleAlertService()
	svc.config.EnableLogging = false
	ctx := context.Background()

	fraudRing := &interfaces.FraudRing{
		RingID:          "ring_nolog",
		Members:         []string{"u1"},
		ConfidenceScore: 0.9,
	}

	err := svc.SendFraudRingAlert(ctx, fraudRing)
	assert.NoError(t, err)
}

func TestSendCommunityAlert_LoggingDisabled(t *testing.T) {
	svc := NewSimpleAlertService()
	svc.config.EnableLogging = false
	ctx := context.Background()

	community := &interfaces.Community{
		ID:         "comm_nolog",
		Members:    []string{"u1"},
		FraudScore: 0.5,
		RiskLevel:  "medium",
	}

	err := svc.SendCommunityAlert(ctx, community)
	assert.NoError(t, err)
}
