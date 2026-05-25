package types

import (
	"encoding/json"
	"testing"
)

func TestDefaultWeightsSumToOne(t *testing.T) {
	w := DefaultWeights()
	sum := w.SOC2 + w.HIPAA + w.GDPR + w.Cost + w.Blast
	if diff := sum - 1.0; diff < -1e-9 || diff > 1e-9 {
		t.Fatalf("default weights must sum to 1.0, got %v", sum)
	}
}

func TestSignalEventRoundTrip(t *testing.T) {
	in := SignalEvent{ID: "a", TenantID: "t", Source: SourceLLMGateway, EventType: "request"}
	b, err := json.Marshal(in)
	if err != nil {
		t.Fatal(err)
	}
	var out SignalEvent
	if err := json.Unmarshal(b, &out); err != nil {
		t.Fatal(err)
	}
	if out.Source != SourceLLMGateway {
		t.Fatalf("source mismatch: %v", out.Source)
	}
}
