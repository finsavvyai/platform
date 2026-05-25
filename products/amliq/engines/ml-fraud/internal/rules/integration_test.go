package rules

import (
	"context"
	"testing"

	"quantumbeam/internal/models"
)

func baseFraudResult(score float64) *models.FraudResult {
	r := &models.FraudResult{
		TransactionID:    "txn-001",
		FraudScore:       score,
		ProcessingMethod: models.ProcessingMethodClassical,
		Confidence:       0.9,
		ProcessingTimeMs: 20,
		Explanation:      []string{"ML: base analysis"},
		ModelVersion:     "v1.0.0",
	}
	r.RiskLevel = r.CalculateRiskLevel()
	return r
}

// --- ML + rules combined scoring ---

func TestIntegration_AdjustScore(t *testing.T) {
	store := NewMemoryStore()
	ctx := context.Background()
	_ = store.Create(ctx, &Rule{
		Name: "velocity-adjust", TenantID: "t1",
		Conditions:    []RuleCondition{{Field: "velocity", Operator: OpGt, Value: 2.0}},
		LogicOperator: LogicAND,
		Actions:       []RuleAction{{Type: ActionAdjustScore, ScoreAdjustment: 0.2}},
		Priority:      10, Enabled: true,
	})

	engine := NewEngine(store)
	fi := NewFraudIntegration(engine)

	result := baseFraudResult(0.3)
	adjusted := fi.AdjustResult(ctx, "t1", testTransaction(), result)

	if adjusted.FraudScore != 0.5 {
		t.Fatalf("expected 0.5, got %f", adjusted.FraudScore)
	}
}

// --- Block action overrides ML score ---

func TestIntegration_BlockOverridesML(t *testing.T) {
	store := NewMemoryStore()
	ctx := context.Background()
	_ = store.Create(ctx, &Rule{
		Name: "block-rule", TenantID: "t1",
		Conditions:    []RuleCondition{{Field: "amount", Operator: OpGt, Value: 1000.0}},
		LogicOperator: LogicAND,
		Actions:       []RuleAction{{Type: ActionBlock}},
		Priority:      100, Enabled: true,
	})

	engine := NewEngine(store)
	fi := NewFraudIntegration(engine)

	result := baseFraudResult(0.1)
	adjusted := fi.AdjustResult(ctx, "t1", testTransaction(), result)

	if adjusted.FraudScore != 1.0 {
		t.Fatalf("block should force score to 1.0, got %f", adjusted.FraudScore)
	}
	if adjusted.RiskLevel != models.RiskLevelCritical {
		t.Fatalf("expected critical risk, got %s", adjusted.RiskLevel)
	}
}

// --- Allow action overrides ML score ---

func TestIntegration_AllowOverridesML(t *testing.T) {
	store := NewMemoryStore()
	ctx := context.Background()
	_ = store.Create(ctx, &Rule{
		Name: "allow-rule", TenantID: "t1",
		Conditions:    []RuleCondition{{Field: "merchant_id", Operator: OpEq, Value: "MER-100"}},
		LogicOperator: LogicAND,
		Actions:       []RuleAction{{Type: ActionAllow}},
		Priority:      100, Enabled: true,
	})

	engine := NewEngine(store)
	fi := NewFraudIntegration(engine)

	result := baseFraudResult(0.9)
	adjusted := fi.AdjustResult(ctx, "t1", testTransaction(), result)

	if adjusted.FraudScore != 0.0 {
		t.Fatalf("allow should force score to 0.0, got %f", adjusted.FraudScore)
	}
	if adjusted.RiskLevel != models.RiskLevelLow {
		t.Fatalf("expected low risk, got %s", adjusted.RiskLevel)
	}
}

// --- Rule engine failure degrades gracefully ---

func TestIntegration_EngineFailureGracefulDegradation(t *testing.T) {
	// nil engine should return original result unchanged
	fi := NewFraudIntegration(nil)
	original := baseFraudResult(0.5)
	result := fi.AdjustResult(context.Background(), "t1", testTransaction(), original)
	if result.FraudScore != 0.5 {
		t.Fatalf("nil engine should return original score, got %f", result.FraudScore)
	}
}

func TestIntegration_EmptyTenantGracefulDegradation(t *testing.T) {
	store := NewMemoryStore()
	engine := NewEngine(store)
	fi := NewFraudIntegration(engine)

	original := baseFraudResult(0.5)
	result := fi.AdjustResult(context.Background(), "", testTransaction(), original)
	if result.FraudScore != 0.5 {
		t.Fatalf("empty tenant should return original score, got %f", result.FraudScore)
	}
}

// --- Score clamping ---

func TestIntegration_ScoreClampedToMax(t *testing.T) {
	store := NewMemoryStore()
	ctx := context.Background()
	_ = store.Create(ctx, &Rule{
		Name: "big-adjust", TenantID: "t1",
		Conditions:    []RuleCondition{{Field: "amount", Operator: OpGt, Value: 1.0}},
		LogicOperator: LogicAND,
		Actions:       []RuleAction{{Type: ActionAdjustScore, ScoreAdjustment: 0.8}},
		Priority:      10, Enabled: true,
	})

	engine := NewEngine(store)
	fi := NewFraudIntegration(engine)

	result := baseFraudResult(0.6)
	adjusted := fi.AdjustResult(ctx, "t1", testTransaction(), result)
	if adjusted.FraudScore != 1.0 {
		t.Fatalf("score should clamp to 1.0, got %f", adjusted.FraudScore)
	}
}

func TestIntegration_ScoreClampedToMin(t *testing.T) {
	store := NewMemoryStore()
	ctx := context.Background()
	_ = store.Create(ctx, &Rule{
		Name: "neg-adjust", TenantID: "t1",
		Conditions:    []RuleCondition{{Field: "amount", Operator: OpGt, Value: 1.0}},
		LogicOperator: LogicAND,
		Actions:       []RuleAction{{Type: ActionAdjustScore, ScoreAdjustment: -0.8}},
		Priority:      10, Enabled: true,
	})

	engine := NewEngine(store)
	fi := NewFraudIntegration(engine)

	result := baseFraudResult(0.2)
	adjusted := fi.AdjustResult(ctx, "t1", testTransaction(), result)
	if adjusted.FraudScore != 0.0 {
		t.Fatalf("score should clamp to 0.0, got %f", adjusted.FraudScore)
	}
}

// --- Matched rules appear in explanation ---

func TestIntegration_MatchedRulesInExplanation(t *testing.T) {
	store := NewMemoryStore()
	ctx := context.Background()
	_ = store.Create(ctx, &Rule{
		Name: "velocity-check", TenantID: "t1",
		Conditions:    []RuleCondition{{Field: "velocity", Operator: OpGt, Value: 1.0}},
		LogicOperator: LogicAND,
		Actions:       []RuleAction{{Type: ActionFlagReview}},
		Priority:      10, Enabled: true,
	})

	engine := NewEngine(store)
	fi := NewFraudIntegration(engine)

	result := baseFraudResult(0.3)
	adjusted := fi.AdjustResult(ctx, "t1", testTransaction(), result)

	found := false
	for _, exp := range adjusted.Explanation {
		if exp == "Matched rule: velocity-check (action: flag_review)" {
			found = true
		}
	}
	if !found {
		t.Fatalf("expected matched rule in explanation, got %v", adjusted.Explanation)
	}
}

// --- No rules for tenant leaves result unchanged ---

func TestIntegration_NoMatchingRulesUnchanged(t *testing.T) {
	store := NewMemoryStore()
	engine := NewEngine(store)
	fi := NewFraudIntegration(engine)

	original := baseFraudResult(0.5)
	result := fi.AdjustResult(context.Background(), "t1", testTransaction(), original)
	if result.FraudScore != 0.5 {
		t.Fatalf("no rules should leave score unchanged, got %f", result.FraudScore)
	}
}
