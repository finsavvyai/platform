package artifacts

import (
	"testing"
)

func TestRecordAndCompare(t *testing.T) {
	dir := t.TempDir()
	tr := NewTracker(dir)

	tests := []struct {
		name     string
		runID    string
		artifact string
		size     int64
	}{
		{"record prev docker", "run-1", "docker-image", 180_000_000},
		{"record prev bundle", "run-1", "js-bundle", 2_000_000},
		{"record curr docker", "run-2", "docker-image", 256_000_000},
		{"record curr bundle", "run-2", "js-bundle", 1_700_000},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if err := tr.Record(tt.runID, tt.artifact, tt.size); err != nil {
				t.Fatalf("Record failed: %v", err)
			}
		})
	}

	changes := tr.Compare("run-2", "run-1")
	if len(changes) != 2 {
		t.Fatalf("expected 2 changes, got %d", len(changes))
	}

	docker := changes[0]
	if docker.Name != "docker-image" {
		t.Errorf("expected docker-image, got %s", docker.Name)
	}
	if !docker.IsBloat() {
		t.Error("docker image should be flagged as bloat")
	}

	bundle := changes[1]
	if bundle.DiffBytes >= 0 {
		t.Error("js-bundle should have shrunk")
	}
}

func TestBloatDetection(t *testing.T) {
	tests := []struct {
		name    string
		change  SizeChange
		isBloat bool
	}{
		{"large growth", SizeChange{DiffPercent: 42.0}, true},
		{"small growth", SizeChange{DiffPercent: 10.0}, false},
		{"shrink", SizeChange{DiffPercent: -15.0}, false},
		{"threshold", SizeChange{DiffPercent: 20.0}, false},
		{"just over", SizeChange{DiffPercent: 20.1}, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := tt.change.IsBloat(); got != tt.isBloat {
				t.Errorf("IsBloat()=%v, want %v", got, tt.isBloat)
			}
		})
	}
}
