package heal

import "testing"

func TestPermissionDeniedExtractsFile(t *testing.T) {
	got := permissionDenied("permission denied: './run.sh'")
	if got == nil || got.Pattern != "permission-denied" {
		t.Fatalf("expected permission-denied fix, got %v", got)
	}
	if got.Action != "chmod +x ./run.sh" {
		t.Errorf("action = %q, want 'chmod +x ./run.sh'", got.Action)
	}
}

func TestPortInUseExtractsPort(t *testing.T) {
	got := portInUse("listen tcp :3000: address already in use")
	if got == nil || got.Pattern != "port-in-use" {
		t.Fatalf("expected port-in-use fix, got %v", got)
	}
	if got.Action != "fuser -k 3000/tcp" {
		t.Errorf("action = %q, want 'fuser -k 3000/tcp'", got.Action)
	}
}

func TestUnknownOutputReturnsNil(t *testing.T) {
	for _, s := range allStrategies() {
		if f := s("completely unrelated output"); f != nil {
			t.Errorf("expected nil for unknown output, got %+v", f)
		}
	}
}
