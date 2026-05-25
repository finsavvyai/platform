package monitoring

import (
	"testing"
)

func TestMemRegistrar_Register(t *testing.T) {
	tests := []struct {
		name    string
		tenant  string
		entity  string
		url     string
		events  []string
		wantErr bool
	}{
		{"valid full", "t1", "ent_a", "https://hook/x", []string{"monitor.match_found"}, false},
		{"valid default events", "t1", "ent_a", "https://hook/x", nil, false},
		{"missing tenant", "", "ent_a", "https://hook/x", nil, true},
		{"missing entity", "t1", "", "https://hook/x", nil, true},
		{"missing url", "t1", "ent_a", "", nil, true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			r := NewMemRegistrar()
			s, err := r.Register(tt.tenant, tt.entity, tt.url, tt.events)
			if (err != nil) != tt.wantErr {
				t.Fatalf("err=%v wantErr=%v", err, tt.wantErr)
			}
			if tt.wantErr {
				return
			}
			if s.ID == "" {
				t.Error("expected generated subscription ID")
			}
			if len(s.Events) == 0 {
				t.Error("expected default events when nil supplied")
			}
		})
	}
}

func TestMemRegistrar_ListFiltersByTenantAndEntity(t *testing.T) {
	r := NewMemRegistrar()
	_, _ = r.Register("t1", "ent_a", "https://h/1", nil)
	_, _ = r.Register("t1", "ent_b", "https://h/2", nil)
	_, _ = r.Register("t2", "ent_a", "https://h/3", nil)

	if got := len(r.List("t1", "")); got != 2 {
		t.Errorf("List(t1, _) = %d, want 2", got)
	}
	if got := len(r.List("t1", "ent_a")); got != 1 {
		t.Errorf("List(t1, ent_a) = %d, want 1", got)
	}
	if got := len(r.List("t2", "ent_a")); got != 1 {
		t.Errorf("List(t2, ent_a) = %d, want 1", got)
	}
	if got := len(r.List("t3", "")); got != 0 {
		t.Errorf("List(t3, _) = %d, want 0", got)
	}
}

func TestMemRegistrar_UnregisterEnforcesTenant(t *testing.T) {
	r := NewMemRegistrar()
	s, _ := r.Register("t1", "ent_a", "https://h/1", nil)

	if r.Unregister("t2", s.ID) {
		t.Error("cross-tenant unregister should fail")
	}
	if !r.Unregister("t1", s.ID) {
		t.Error("same-tenant unregister should succeed")
	}
	if r.Unregister("t1", s.ID) {
		t.Error("second unregister should return false")
	}
}
