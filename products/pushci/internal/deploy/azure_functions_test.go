package deploy

import (
	"context"
	"strings"
	"testing"
)

func TestAzureFunctionsMissingApp(t *testing.T) {
	r := azureFunctions(context.Background(), t.TempDir(), map[string]string{})
	if r.Success {
		t.Error("expected failure when AZURE_FUNCTION_APP absent")
	}
	if !strings.Contains(r.Output, "AZURE_FUNCTION_APP required") {
		t.Errorf("Output = %q, want guidance message", r.Output)
	}
	if r.Target != TargetAzureFunctions {
		t.Errorf("Target = %q, want %q", r.Target, TargetAzureFunctions)
	}
}

func TestAzureFunctionsInDriversMap(t *testing.T) {
	if _, ok := drivers[TargetAzureFunctions]; !ok {
		t.Error("TargetAzureFunctions missing from drivers map — orphan target risk")
	}
}
