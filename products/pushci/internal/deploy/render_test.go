package deploy

import (
	"context"
	"strings"
	"testing"
)

func TestRenderMissingHookURL(t *testing.T) {
	r := render(context.Background(), t.TempDir(), map[string]string{})
	if r.Success {
		t.Error("expected failure when RENDER_DEPLOY_HOOK_URL absent")
	}
	if !strings.Contains(r.Output, "RENDER_DEPLOY_HOOK_URL required") {
		t.Errorf("Output = %q, want guidance message", r.Output)
	}
	if r.Target != TargetRender {
		t.Errorf("Target = %q, want %q", r.Target, TargetRender)
	}
}

func TestRenderInDriversMap(t *testing.T) {
	if _, ok := drivers[TargetRender]; !ok {
		t.Error("TargetRender missing from drivers map — orphan target risk")
	}
}
