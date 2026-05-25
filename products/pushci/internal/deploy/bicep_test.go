package deploy

import (
	"context"
	"strings"
	"testing"
)

func TestBicepMissingResourceGroup(t *testing.T) {
	r := bicep(context.Background(), t.TempDir(), map[string]string{})
	if r.Success {
		t.Error("expected failure when AZURE_RESOURCE_GROUP absent")
	}
	if !strings.Contains(r.Output, "AZURE_RESOURCE_GROUP required") {
		t.Errorf("Output = %q, want guidance message", r.Output)
	}
	if r.Target != TargetBicep {
		t.Errorf("Target = %q, want %q", r.Target, TargetBicep)
	}
}

func TestBicepInDriversMap(t *testing.T) {
	if _, ok := drivers[TargetBicep]; !ok {
		t.Error("TargetBicep missing from drivers map — orphan target risk")
	}
}
