package main

import (
	"context"
	"testing"
	"time"

	"github.com/shopspring/decimal"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"quantumbeam/internal/models"
	"quantumbeam/internal/rules"
)

// newFraudResult creates a baseline FraudResult for integration testing.
func newFraudResult(txnID string, score float64, risk models.RiskLevel) *models.FraudResult {
	return &models.FraudResult{
		TransactionID: txnID, FraudScore: score, RiskLevel: risk,
		ProcessingMethod: models.ProcessingMethodClassical,
		Confidence: 0.9, ProcessingTimeMs: 5, ModelVersion: "v1.0.0",
	}
}

// newTx creates a minimal TransactionData for integration testing.
func newTx(id string, amount float64, merchantID string) *models.TransactionData {
	return &models.TransactionData{
		TransactionID: id, Amount: decimal.NewFromFloat(amount),
		Timestamp: time.Now(), MerchantID: merchantID,
		UserID: "user-test", PaymentMethod: "credit_card",
	}
}

// TestIntegration_RuleEngine_CreateAndEvaluate verifies that a rule created
// via the repository is correctly evaluated by the engine.
func TestIntegration_RuleEngine_CreateAndEvaluate(t *testing.T) {
	store := rules.NewMemoryStore()
	engine := rules.NewEngine(store)
	tenant := "tenant-int-001"

	rule := &rules.Rule{
		Name: "High amount block", TenantID: tenant,
		Conditions:    []rules.RuleCondition{{Field: "amount", Operator: rules.OpGt, Value: 50000.0}},
		LogicOperator: rules.LogicAND,
		Actions:       []rules.RuleAction{{Type: rules.ActionBlock, Reason: "exceeds limit"}},
		Priority:      100, Enabled: true,
	}
	require.NoError(t, store.Create(context.Background(), rule))

	tx := newTx("txn-int-001", 75000.00, "MER-100")
	result, err := engine.Evaluate(context.Background(), tenant, tx)
	require.NoError(t, err)
	assert.Equal(t, 1, result.TotalEvaluated)
	assert.Len(t, result.Matched, 1)
	assert.Equal(t, rules.ActionBlock, result.FinalAction)
	assert.Equal(t, rule.Name, result.Matched[0].RuleName)
}

// TestIntegration_RuleEngine_FraudIntegrationAdjustsScore verifies the
// FraudIntegration adapter merges rule evaluation into a FraudResult.
func TestIntegration_RuleEngine_FraudIntegrationAdjustsScore(t *testing.T) {
	store := rules.NewMemoryStore()
	engine := rules.NewEngine(store)
	fi := rules.NewFraudIntegration(engine)
	tenant := "tenant-int-002"

	rule := &rules.Rule{
		Name: "Score boost risky country", TenantID: tenant,
		Conditions:    []rules.RuleCondition{{Field: "country", Operator: rules.OpEq, Value: "NG"}},
		LogicOperator: rules.LogicAND,
		Actions:       []rules.RuleAction{{Type: rules.ActionAdjustScore, ScoreAdjustment: 0.3}},
		Priority:      50, Enabled: true,
	}
	require.NoError(t, store.Create(context.Background(), rule))

	tx := newTx("txn-int-002", 1500.00, "MER-200")
	tx.Location = &models.GeoLocation{Country: "NG", City: "Lagos"}

	adjusted := fi.AdjustResult(context.Background(), tenant, tx,
		newFraudResult("txn-int-002", 0.4, models.RiskLevelMedium))
	assert.InDelta(t, 0.7, adjusted.FraudScore, 0.001)
	assert.Equal(t, models.RiskLevelHigh, adjusted.RiskLevel)
	assert.Contains(t, adjusted.Explanation[0], "Matched rule")
}

// TestIntegration_RuleEngine_NoMatchLeavesResultUnchanged verifies that when
// no rules match, the original fraud result is returned unmodified.
func TestIntegration_RuleEngine_NoMatchLeavesResultUnchanged(t *testing.T) {
	store := rules.NewMemoryStore()
	engine := rules.NewEngine(store)
	fi := rules.NewFraudIntegration(engine)
	tenant := "tenant-int-003"

	rule := &rules.Rule{
		Name: "Block high amount", TenantID: tenant,
		Conditions:    []rules.RuleCondition{{Field: "amount", Operator: rules.OpGt, Value: 99999.0}},
		LogicOperator: rules.LogicAND,
		Actions:       []rules.RuleAction{{Type: rules.ActionBlock}},
		Priority:      100, Enabled: true,
	}
	require.NoError(t, store.Create(context.Background(), rule))

	tx := newTx("txn-int-003", 50.00, "MER-300")
	adjusted := fi.AdjustResult(context.Background(), tenant, tx,
		newFraudResult("txn-int-003", 0.2, models.RiskLevelLow))
	assert.Equal(t, 0.2, adjusted.FraudScore)
	assert.Equal(t, models.RiskLevelLow, adjusted.RiskLevel)
}

// TestIntegration_RuleEngine_TenantIsolation ensures rules from one tenant
// are never evaluated for transactions from another tenant.
func TestIntegration_RuleEngine_TenantIsolation(t *testing.T) {
	store := rules.NewMemoryStore()
	engine := rules.NewEngine(store)
	fi := rules.NewFraudIntegration(engine)

	rule := &rules.Rule{
		Name: "Tenant A block rule", TenantID: "tenant-A",
		Conditions:    []rules.RuleCondition{{Field: "amount", Operator: rules.OpGt, Value: 0.01}},
		LogicOperator: rules.LogicAND,
		Actions:       []rules.RuleAction{{Type: rules.ActionBlock}},
		Priority:      100, Enabled: true,
	}
	require.NoError(t, store.Create(context.Background(), rule))

	tx := newTx("txn-int-004", 100.00, "MER-400")
	adjusted := fi.AdjustResult(context.Background(), "tenant-B", tx,
		newFraudResult("txn-int-004", 0.1, models.RiskLevelLow))
	assert.Equal(t, 0.1, adjusted.FraudScore, "tenant-B score must be unchanged")
}

// TestIntegration_RuleEngine_BlockOverridesMLScore verifies that a block rule
// forces fraud score to 1.0 regardless of the ML model output.
func TestIntegration_RuleEngine_BlockOverridesMLScore(t *testing.T) {
	store := rules.NewMemoryStore()
	engine := rules.NewEngine(store)
	fi := rules.NewFraudIntegration(engine)
	tenant := "tenant-int-005"

	rule := &rules.Rule{
		Name: "Block suspicious merchant", TenantID: tenant,
		Conditions:    []rules.RuleCondition{{Field: "merchant_id", Operator: rules.OpEq, Value: "MER-BANNED"}},
		LogicOperator: rules.LogicAND,
		Actions:       []rules.RuleAction{{Type: rules.ActionBlock, Reason: "banned"}},
		Priority:      999, Enabled: true,
	}
	require.NoError(t, store.Create(context.Background(), rule))

	tx := newTx("txn-int-005", 10.00, "MER-BANNED")
	adjusted := fi.AdjustResult(context.Background(), tenant, tx,
		newFraudResult("txn-int-005", 0.05, models.RiskLevelLow))
	assert.Equal(t, 1.0, adjusted.FraudScore)
	assert.Equal(t, models.RiskLevelCritical, adjusted.RiskLevel)
}
