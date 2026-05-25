package rules

import (
	"context"
	"testing"
	"time"

	"github.com/shopspring/decimal"
	"quantumbeam/internal/models"
)

func testTransaction() *models.TransactionData {
	return &models.TransactionData{
		TransactionID: "txn-001",
		Amount:        decimal.NewFromFloat(5000.00),
		Timestamp:     time.Date(2026, 3, 1, 14, 30, 0, 0, time.UTC),
		MerchantID:    "MER-100",
		UserID:        "user-42",
		PaymentMethod: "credit_card",
		Location:      &models.GeoLocation{Country: "US", City: "NYC", Latitude: 40.7, Longitude: -74.0},
		Features:      map[string]float64{"velocity": 3.5, "avg_amount": 250.0},
	}
}

func blockRule(id, tenantID string, priority int, conds []RuleCondition, logic LogicOperator) *Rule {
	return &Rule{
		ID: id, Name: "block-" + id, TenantID: tenantID,
		Conditions: conds, LogicOperator: logic,
		Actions:  []RuleAction{{Type: ActionBlock}},
		Priority: priority, Enabled: true,
	}
}

// --- AND / OR logic ---

func TestEngine_ANDLogic_AllMatch(t *testing.T) {
	store := NewMemoryStore()
	ctx := context.Background()
	r := blockRule("r1", "t1", 10, []RuleCondition{
		{Field: "amount", Operator: OpGt, Value: 1000.0},
		{Field: "payment_method", Operator: OpEq, Value: "credit_card"},
	}, LogicAND)
	_ = store.Create(ctx, r)

	engine := NewEngine(store)
	res, err := engine.Evaluate(ctx, "t1", testTransaction())
	if err != nil {
		t.Fatal(err)
	}
	if len(res.Matched) != 1 {
		t.Fatalf("expected 1 match, got %d", len(res.Matched))
	}
}

func TestEngine_ANDLogic_PartialMatch(t *testing.T) {
	store := NewMemoryStore()
	ctx := context.Background()
	r := blockRule("r1", "t1", 10, []RuleCondition{
		{Field: "amount", Operator: OpGt, Value: 1000.0},
		{Field: "payment_method", Operator: OpEq, Value: "wire_transfer"},
	}, LogicAND)
	_ = store.Create(ctx, r)

	engine := NewEngine(store)
	res, _ := engine.Evaluate(ctx, "t1", testTransaction())
	if len(res.Matched) != 0 {
		t.Fatal("AND with partial match should not fire")
	}
}

func TestEngine_ORLogic(t *testing.T) {
	store := NewMemoryStore()
	ctx := context.Background()
	r := blockRule("r1", "t1", 10, []RuleCondition{
		{Field: "amount", Operator: OpGt, Value: 99999.0},
		{Field: "country", Operator: OpEq, Value: "US"},
	}, LogicOR)
	_ = store.Create(ctx, r)

	engine := NewEngine(store)
	res, _ := engine.Evaluate(ctx, "t1", testTransaction())
	if len(res.Matched) == 0 {
		t.Fatal("OR should match because country=US")
	}
}

// --- Priority ordering ---

func TestEngine_PriorityOrdering(t *testing.T) {
	store := NewMemoryStore()
	ctx := context.Background()

	// Low priority allow
	allowRule := &Rule{
		ID: "low", Name: "allow-low", TenantID: "t1",
		Conditions:    []RuleCondition{{Field: "amount", Operator: OpGt, Value: 100.0}},
		LogicOperator: LogicAND,
		Actions:       []RuleAction{{Type: ActionAllow}},
		Priority:      1, Enabled: true,
	}
	// High priority block
	highBlock := blockRule("high", "t1", 100,
		[]RuleCondition{{Field: "amount", Operator: OpGt, Value: 100.0}}, LogicAND)

	_ = store.Create(ctx, allowRule)
	_ = store.Create(ctx, highBlock)

	engine := NewEngine(store)
	res, _ := engine.Evaluate(ctx, "t1", testTransaction())

	if res.FinalAction != ActionBlock {
		t.Fatalf("highest priority action should be block, got %s", res.FinalAction)
	}
}

// --- Score adjustment ---

func TestEngine_ScoreAdjustment(t *testing.T) {
	store := NewMemoryStore()
	ctx := context.Background()

	r := &Rule{
		ID: "adj", Name: "adj", TenantID: "t1",
		Conditions:    []RuleCondition{{Field: "velocity", Operator: OpGt, Value: 2.0}},
		LogicOperator: LogicAND,
		Actions:       []RuleAction{{Type: ActionAdjustScore, ScoreAdjustment: 0.3}},
		Priority:      50, Enabled: true,
	}
	_ = store.Create(ctx, r)

	engine := NewEngine(store)
	res, _ := engine.Evaluate(ctx, "t1", testTransaction())
	if res.ScoreAdjustment != 0.3 {
		t.Fatalf("expected 0.3 adjustment, got %f", res.ScoreAdjustment)
	}
}

// --- Disabled rules skipped ---

func TestEngine_SkipsDisabledRules(t *testing.T) {
	store := NewMemoryStore()
	ctx := context.Background()
	r := blockRule("r1", "t1", 10,
		[]RuleCondition{{Field: "amount", Operator: OpGt, Value: 1.0}}, LogicAND)
	_ = store.Create(ctx, r)
	_ = store.SetEnabled(ctx, "t1", r.ID, false)

	engine := NewEngine(store)
	res, _ := engine.Evaluate(ctx, "t1", testTransaction())
	if len(res.Matched) != 0 {
		t.Fatal("disabled rule should not match")
	}
}

// --- Nil fields ---

func TestEngine_NilLocationField(t *testing.T) {
	store := NewMemoryStore()
	ctx := context.Background()
	r := blockRule("r1", "t1", 10,
		[]RuleCondition{{Field: "country", Operator: OpEq, Value: "US"}}, LogicAND)
	_ = store.Create(ctx, r)

	tx := testTransaction()
	tx.Location = nil

	engine := NewEngine(store)
	res, _ := engine.Evaluate(ctx, "t1", tx)
	if len(res.Matched) != 0 {
		t.Fatal("nil location should not match country=US")
	}
}

// --- Empty rules ---

func TestEngine_NoRules(t *testing.T) {
	store := NewMemoryStore()
	engine := NewEngine(store)
	res, err := engine.Evaluate(context.Background(), "t1", testTransaction())
	if err != nil {
		t.Fatal(err)
	}
	if res.TotalEvaluated != 0 || len(res.Matched) != 0 {
		t.Fatal("empty rules should produce empty result")
	}
}

// --- Feature map fields ---

func TestEngine_FeatureMapField(t *testing.T) {
	store := NewMemoryStore()
	ctx := context.Background()
	r := blockRule("r1", "t1", 10,
		[]RuleCondition{{Field: "avg_amount", Operator: OpGt, Value: 200.0}}, LogicAND)
	_ = store.Create(ctx, r)

	engine := NewEngine(store)
	res, _ := engine.Evaluate(ctx, "t1", testTransaction())
	if len(res.Matched) != 1 {
		t.Fatal("avg_amount=250 should match >200")
	}
}

// --- Benchmark ---

func BenchmarkEngine_100Rules(b *testing.B) {
	store := NewMemoryStore()
	ctx := context.Background()
	for i := 0; i < 100; i++ {
		r := &Rule{
			Name: "bench", TenantID: "t1",
			Conditions:    []RuleCondition{{Field: "amount", Operator: OpGt, Value: float64(i * 100)}},
			LogicOperator: LogicAND,
			Actions:       []RuleAction{{Type: ActionFlagReview}},
			Priority:      i + 1, Enabled: true,
		}
		_ = store.Create(ctx, r)
	}

	engine := NewEngine(store)
	tx := testTransaction()

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, _ = engine.Evaluate(ctx, "t1", tx)
	}
}

// --- EvaluateRules (dry-run) ---

func TestEngine_EvaluateRules_DryRun(t *testing.T) {
	engine := NewEngine(nil)
	ruleList := []*Rule{
		blockRule("r1", "t1", 10,
			[]RuleCondition{{Field: "amount", Operator: OpGt, Value: 1000.0}}, LogicAND),
	}
	res := engine.EvaluateRules(ruleList, testTransaction())
	if len(res.Matched) != 1 {
		t.Fatal("dry-run should match the rule")
	}
}
