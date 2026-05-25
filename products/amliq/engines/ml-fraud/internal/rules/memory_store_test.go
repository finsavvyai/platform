package rules

import (
	"context"
	"errors"
	"sync"
	"testing"
)

func newTestRule(tenantID, name string, priority int) *Rule {
	return &Rule{
		Name:          name,
		TenantID:      tenantID,
		Conditions:    []RuleCondition{{Field: "amount", Operator: OpGt, Value: 1000.0}},
		LogicOperator: LogicAND,
		Actions:       []RuleAction{{Type: ActionBlock}},
		Priority:      priority,
		Enabled:       true,
	}
}

// --- Create ---

func TestMemoryStore_Create(t *testing.T) {
	store := NewMemoryStore()
	ctx := context.Background()
	r := newTestRule("t1", "r1", 10)
	if err := store.Create(ctx, r); err != nil {
		t.Fatalf("create: %v", err)
	}
	if r.ID == "" {
		t.Fatal("ID should be assigned")
	}
	if r.CreatedAt.IsZero() {
		t.Fatal("CreatedAt should be set")
	}
}

func TestMemoryStore_CreateDuplicate(t *testing.T) {
	store := NewMemoryStore()
	ctx := context.Background()
	r := newTestRule("t1", "r1", 10)
	r.ID = "fixed-id"
	_ = store.Create(ctx, r)
	r2 := newTestRule("t1", "r2", 20)
	r2.ID = "fixed-id"
	if err := store.Create(ctx, r2); !errors.Is(err, ErrDuplicateRuleID) {
		t.Fatalf("expected ErrDuplicateRuleID, got %v", err)
	}
}

// --- Get ---

func TestMemoryStore_Get(t *testing.T) {
	store := NewMemoryStore()
	ctx := context.Background()
	r := newTestRule("t1", "r1", 10)
	_ = store.Create(ctx, r)

	got, err := store.Get(ctx, "t1", r.ID)
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if got.Name != "r1" {
		t.Fatalf("expected name r1, got %s", got.Name)
	}
}

func TestMemoryStore_GetNotFound(t *testing.T) {
	store := NewMemoryStore()
	_, err := store.Get(context.Background(), "t1", "nope")
	if !errors.Is(err, ErrRuleNotFound) {
		t.Fatalf("expected ErrRuleNotFound, got %v", err)
	}
}

// --- Tenant Isolation ---

func TestMemoryStore_TenantIsolation_Get(t *testing.T) {
	store := NewMemoryStore()
	ctx := context.Background()
	r := newTestRule("tenant-A", "secret", 10)
	_ = store.Create(ctx, r)

	_, err := store.Get(ctx, "tenant-B", r.ID)
	if !errors.Is(err, ErrRuleNotFound) {
		t.Fatal("tenant-B should not see tenant-A rule")
	}
}

func TestMemoryStore_TenantIsolation_List(t *testing.T) {
	store := NewMemoryStore()
	ctx := context.Background()
	_ = store.Create(ctx, newTestRule("tA", "rA", 10))
	_ = store.Create(ctx, newTestRule("tB", "rB", 20))

	list, _ := store.List(ctx, "tA", ListFilter{})
	if len(list) != 1 || list[0].TenantID != "tA" {
		t.Fatalf("tenant isolation broken: got %d rules", len(list))
	}
}

func TestMemoryStore_TenantIsolation_Update(t *testing.T) {
	store := NewMemoryStore()
	ctx := context.Background()
	r := newTestRule("tA", "original", 10)
	_ = store.Create(ctx, r)

	rCopy := *r
	rCopy.TenantID = "tB"
	rCopy.Name = "hacked"
	if err := store.Update(ctx, &rCopy); !errors.Is(err, ErrRuleNotFound) {
		t.Fatal("cross-tenant update should fail")
	}
}

func TestMemoryStore_TenantIsolation_Delete(t *testing.T) {
	store := NewMemoryStore()
	ctx := context.Background()
	r := newTestRule("tA", "r1", 10)
	_ = store.Create(ctx, r)

	if err := store.Delete(ctx, "tB", r.ID); !errors.Is(err, ErrRuleNotFound) {
		t.Fatal("cross-tenant delete should fail")
	}
}

func TestMemoryStore_TenantIsolation_SetEnabled(t *testing.T) {
	store := NewMemoryStore()
	ctx := context.Background()
	r := newTestRule("tA", "r1", 10)
	_ = store.Create(ctx, r)

	if err := store.SetEnabled(ctx, "tB", r.ID, false); !errors.Is(err, ErrRuleNotFound) {
		t.Fatal("cross-tenant toggle should fail")
	}
}

// --- List filtering & pagination ---

func TestMemoryStore_ListEnabledOnly(t *testing.T) {
	store := NewMemoryStore()
	ctx := context.Background()

	r1 := newTestRule("t1", "enabled", 10)
	r1.Enabled = true
	r2 := newTestRule("t1", "disabled", 20)
	r2.Enabled = false

	_ = store.Create(ctx, r1)
	_ = store.Create(ctx, r2)

	enabled := true
	list, _ := store.List(ctx, "t1", ListFilter{EnabledOnly: &enabled})
	if len(list) != 1 || list[0].Name != "enabled" {
		t.Fatalf("expected only enabled rule, got %d", len(list))
	}
}

func TestMemoryStore_ListPagination(t *testing.T) {
	store := NewMemoryStore()
	ctx := context.Background()
	for i := 1; i <= 5; i++ {
		_ = store.Create(ctx, newTestRule("t1", "r", i*10))
	}

	list, _ := store.List(ctx, "t1", ListFilter{Limit: 2, Offset: 1})
	if len(list) != 2 {
		t.Fatalf("expected 2 rules, got %d", len(list))
	}
}

// --- Update ---

func TestMemoryStore_Update(t *testing.T) {
	store := NewMemoryStore()
	ctx := context.Background()
	r := newTestRule("t1", "original", 10)
	_ = store.Create(ctx, r)

	r.Name = "updated"
	if err := store.Update(ctx, r); err != nil {
		t.Fatalf("update: %v", err)
	}
	got, _ := store.Get(ctx, "t1", r.ID)
	if got.Name != "updated" {
		t.Fatal("name not updated")
	}
}

// --- Delete ---

func TestMemoryStore_Delete(t *testing.T) {
	store := NewMemoryStore()
	ctx := context.Background()
	r := newTestRule("t1", "doomed", 10)
	_ = store.Create(ctx, r)
	if err := store.Delete(ctx, "t1", r.ID); err != nil {
		t.Fatalf("delete: %v", err)
	}
	_, err := store.Get(ctx, "t1", r.ID)
	if !errors.Is(err, ErrRuleNotFound) {
		t.Fatal("rule should be gone after delete")
	}
}

// --- SetEnabled ---

func TestMemoryStore_SetEnabled(t *testing.T) {
	store := NewMemoryStore()
	ctx := context.Background()
	r := newTestRule("t1", "toggle", 10)
	_ = store.Create(ctx, r)
	_ = store.SetEnabled(ctx, "t1", r.ID, false)
	got, _ := store.Get(ctx, "t1", r.ID)
	if got.Enabled {
		t.Fatal("rule should be disabled")
	}
}

// --- Concurrency ---

func TestMemoryStore_ConcurrentAccess(t *testing.T) {
	store := NewMemoryStore()
	ctx := context.Background()
	var wg sync.WaitGroup

	// Concurrent writes
	for i := 0; i < 50; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			r := newTestRule("t1", "concurrent", idx+1)
			_ = store.Create(ctx, r)
		}(i)
	}

	// Concurrent reads while writing
	for i := 0; i < 50; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_, _ = store.List(ctx, "t1", ListFilter{})
		}()
	}

	wg.Wait()

	list, _ := store.List(ctx, "t1", ListFilter{})
	if len(list) != 50 {
		t.Fatalf("expected 50 rules, got %d", len(list))
	}
}
