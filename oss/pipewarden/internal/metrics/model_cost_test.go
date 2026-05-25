package metrics

import (
	"testing"

	"github.com/prometheus/client_golang/prometheus"
	dto "github.com/prometheus/client_model/go"
)

func TestEstimateCost_KnownModels(t *testing.T) {
	cases := []struct {
		model     string
		in, out   int
		wantClose float64
	}{
		{"claude-sonnet", 1_000_000, 1_000_000, 18.00},
		{"claude-opus", 1_000_000, 1_000_000, 90.00},
		{"claude-haiku", 1_000_000, 1_000_000, 4.80},
		{"deepseek-chat", 1_000_000, 1_000_000, 0.42},
		{"gemini-2.0-flash", 1_000_000, 1_000_000, 0.375},
	}
	for _, tc := range cases {
		got := estimateCost(tc.model, tc.in, tc.out)
		if abs(got-tc.wantClose) > 0.0001 {
			t.Errorf("estimateCost(%q) = %f, want %f", tc.model, got, tc.wantClose)
		}
	}
}

func TestEstimateCost_UnknownModelFallsBackToSonnet(t *testing.T) {
	got := estimateCost("totally-unknown-model", 1_000_000, 1_000_000)
	if got != 18.00 {
		t.Errorf("unknown model should price as claude-sonnet (18.00), got %f", got)
	}
}

func TestIsCheapMode(t *testing.T) {
	t.Setenv("PIPEWARDEN_CHEAP_MODE", "")
	if isCheapMode() {
		t.Error("default should be premium")
	}
	for _, v := range []string{"1", "true", "TRUE", "True"} {
		t.Setenv("PIPEWARDEN_CHEAP_MODE", v)
		if !isCheapMode() {
			t.Errorf("isCheapMode() should be true for %q", v)
		}
	}
}

func TestRecordModelCall_IncrementsCallsAndTokens(t *testing.T) {
	t.Setenv("PIPEWARDEN_CHEAP_MODE", "1")
	before := readCounterVec(t, modelCallsTotal, "deepseek-chat", "cheap")
	beforeIn := readCounterVec(t, modelTokensTotal, "deepseek-chat", "input")

	RecordModelCall("deepseek-chat", 5000, 1000)

	if got := readCounterVec(t, modelCallsTotal, "deepseek-chat", "cheap") - before; got != 1 {
		t.Errorf("calls counter should advance by 1, got %f", got)
	}
	if got := readCounterVec(t, modelTokensTotal, "deepseek-chat", "input") - beforeIn; got != 5000 {
		t.Errorf("input tokens counter should advance by 5000, got %f", got)
	}
}

func TestRecordModelCall_CreditsSavingsForCheaperModel(t *testing.T) {
	before := readCounter(t, modelSavingsUSDTotal)
	// 1M tokens of deepseek vs sonnet baseline = $18.00 - $0.42 = $17.58 saved
	RecordModelCall("deepseek-chat", 1_000_000, 1_000_000)
	got := readCounter(t, modelSavingsUSDTotal) - before
	want := 18.00 - 0.42
	if abs(got-want) > 0.001 {
		t.Errorf("savings should advance by ~%f, got %f", want, got)
	}
}

func TestRecordModelCall_NoSavingsCreditedForOpusUpgrade(t *testing.T) {
	before := readCounter(t, modelSavingsUSDTotal)
	RecordModelCall("claude-opus", 100, 100)
	got := readCounter(t, modelSavingsUSDTotal) - before
	if got != 0 {
		t.Errorf("opus is more expensive than sonnet baseline; savings should not advance, got %f", got)
	}
}

func TestRecordModelCall_EmptyModelIsNoop(t *testing.T) {
	before := readCounterVec(t, modelCallsTotal, "", "cheap")
	RecordModelCall("", 100, 100)
	if got := readCounterVec(t, modelCallsTotal, "", "cheap") - before; got != 0 {
		t.Errorf("empty model should be a no-op, got delta %f", got)
	}
}

func readCounter(t *testing.T, c prometheus.Counter) float64 { //nolint:revive
	t.Helper()
	m := &dto.Metric{}
	if err := c.Write(m); err != nil {
		t.Fatalf("counter.Write: %v", err)
	}
	return m.GetCounter().GetValue()
}

func readCounterVec(t *testing.T, v *prometheus.CounterVec, labels ...string) float64 { //nolint:revive
	t.Helper()
	c, err := v.GetMetricWithLabelValues(labels...)
	if err != nil {
		t.Fatalf("GetMetricWithLabelValues(%v): %v", labels, err)
	}
	return readCounter(t, c)
}

func abs(f float64) float64 {
	if f < 0 {
		return -f
	}
	return f
}
