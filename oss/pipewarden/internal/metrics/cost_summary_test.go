package metrics

import "testing"

func TestSnapshot_EmptyByDefault(t *testing.T) {
	resetForTest()
	s := Snapshot()
	if s.TotalCalls != 0 || s.SpendUSD != 0 {
		t.Errorf("empty snapshot should have zero totals, got %+v", s)
	}
	if len(s.ByModel) != 0 {
		t.Errorf("ByModel should be empty, got %d entries", len(s.ByModel))
	}
}

func TestSnapshot_AfterRecord_AggregatesByModel(t *testing.T) {
	resetForTest()
	t.Setenv("PIPEWARDEN_CHEAP_MODE", "1")
	RecordModelCall("deepseek-chat", 1000, 500)
	RecordModelCall("deepseek-chat", 2000, 1000)
	RecordModelCall("gemini-2.0-flash", 500, 100)

	s := Snapshot()
	if s.TotalCalls != 3 {
		t.Errorf("TotalCalls = %f, want 3", s.TotalCalls)
	}
	if s.CheapCalls != 3 {
		t.Errorf("CheapCalls = %f, want 3 (all in cheap mode)", s.CheapCalls)
	}
	if len(s.ByModel) != 2 {
		t.Errorf("ByModel should have 2 entries, got %d", len(s.ByModel))
	}
}

func TestSnapshot_ByModelSortedBySpendDescending(t *testing.T) {
	resetForTest()
	RecordModelCall("gemini-2.0-flash", 100, 100) // ~$0.0000375
	RecordModelCall("claude-opus", 1000, 1000)    // ~$0.09
	RecordModelCall("deepseek-chat", 500, 500)    // ~$0.00021

	s := Snapshot()
	if len(s.ByModel) < 2 {
		t.Fatalf("need at least 2 entries, got %d", len(s.ByModel))
	}
	if s.ByModel[0].Model != "claude-opus" {
		t.Errorf("expected claude-opus first (highest spend), got %q", s.ByModel[0].Model)
	}
}

func TestSnapshot_ModeReflectsEnv(t *testing.T) {
	resetForTest()
	t.Setenv("PIPEWARDEN_CHEAP_MODE", "")
	if Snapshot().Mode != "premium" {
		t.Error("mode should be premium when env unset")
	}
	t.Setenv("PIPEWARDEN_CHEAP_MODE", "1")
	if Snapshot().Mode != "cheap" {
		t.Error("mode should be cheap when env=1")
	}
}

func TestSnapshot_PremiumCallsCountedSeparately(t *testing.T) {
	resetForTest()
	t.Setenv("PIPEWARDEN_CHEAP_MODE", "")
	RecordModelCall("claude-sonnet", 1000, 1000)
	t.Setenv("PIPEWARDEN_CHEAP_MODE", "1")
	RecordModelCall("deepseek-chat", 1000, 1000)

	s := Snapshot()
	if s.TotalCalls != 2 {
		t.Errorf("TotalCalls = %f, want 2", s.TotalCalls)
	}
	if s.CheapCalls != 1 {
		t.Errorf("CheapCalls = %f, want 1 (only deepseek call was in cheap mode)", s.CheapCalls)
	}
}

func TestSnapshot_TokenCountsAggregateCorrectly(t *testing.T) {
	resetForTest()
	RecordModelCall("deepseek-chat", 1000, 500)
	RecordModelCall("deepseek-chat", 2000, 1500)
	s := Snapshot()
	for _, m := range s.ByModel {
		if m.Model == "deepseek-chat" {
			if m.InTokens != 3000 || m.OutTokens != 2000 {
				t.Errorf("deepseek tokens: in=%f out=%f, want 3000/2000", m.InTokens, m.OutTokens)
			}
		}
	}
}
