package gitops

import "testing"

func TestWorkflowPromotion(t *testing.T) {
	w := NewWorkflow()
	if len(w.Stages) != 3 {
		t.Errorf("stages = %d, want 3", len(w.Stages))
	}
	next, err := w.NextStage(StageDev)
	if err != nil || next != StageStaging {
		t.Errorf("next after dev = %q, want staging", next)
	}
	next, err = w.NextStage(StageStaging)
	if err != nil || next != StageProd {
		t.Errorf("next after staging = %q, want production", next)
	}
	_, err = w.NextStage(StageProd)
	if err == nil {
		t.Error("expected error for next after production")
	}
}

func TestWorkflowPromoteAndTrack(t *testing.T) {
	w := NewWorkflow()
	sha := "abc123"
	w.Promote(StageDev, StageStaging, sha, "user1")
	current := w.CurrentStage(sha)
	if current != StageStaging {
		t.Errorf("current = %q, want staging", current)
	}
	if !w.CanPromote(sha, StageProd) {
		t.Error("should be able to promote to prod")
	}
	w.Promote(StageStaging, StageProd, sha, "user1")
	if w.CanPromote(sha, StageProd) {
		t.Error("should not promote beyond prod")
	}
}

func TestCanPromoteOrder(t *testing.T) {
	w := NewWorkflow()
	sha := "def456"
	// Can't skip staging
	if w.CanPromote(sha, StageProd) {
		t.Error("should not skip staging")
	}
	if !w.CanPromote(sha, StageStaging) {
		t.Error("should allow dev→staging")
	}
}
