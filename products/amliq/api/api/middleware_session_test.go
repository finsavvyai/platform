package api

import "testing"

func TestSessionManagerRegister(t *testing.T) {
	sm := NewSessionManager(DefaultSessionConfig())

	tokenID, err := sm.RegisterSession("user_1")
	if err != nil {
		t.Fatalf("RegisterSession error: %v", err)
	}
	if tokenID == "" {
		t.Error("expected non-empty token ID")
	}
	if sm.SessionCount("user_1") != 1 {
		t.Errorf("expected 1 session, got %d", sm.SessionCount("user_1"))
	}
}

func TestSessionManagerMaxConcurrent(t *testing.T) {
	cfg := DefaultSessionConfig()
	cfg.MaxConcurrent = 2
	sm := NewSessionManager(cfg)

	sm.RegisterSession("user_1")
	sm.RegisterSession("user_1")
	sm.RegisterSession("user_1") // should evict oldest

	if count := sm.SessionCount("user_1"); count != 2 {
		t.Errorf("expected 2 sessions after eviction, got %d", count)
	}
}

func TestSessionManagerRevokeAll(t *testing.T) {
	sm := NewSessionManager(DefaultSessionConfig())
	sm.RegisterSession("user_1")
	sm.RegisterSession("user_1")

	sm.RevokeAll("user_1")

	if count := sm.SessionCount("user_1"); count != 0 {
		t.Errorf("expected 0 sessions after revoke, got %d", count)
	}
}
