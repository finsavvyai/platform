package tasklog

import "testing"

func TestRegistry(t *testing.T) {
	tests := []struct {
		name     string
		ops      func(r *Registry)
		checkLen int
	}{
		{
			name: "start and complete",
			ops: func(r *Registry) {
				id := r.Start("seed", "manual", "admin", "")
				r.Complete(id, StatusSuccess, "seeded 100", "")
			},
			checkLen: 1,
		},
		{
			name: "cap at maxSize",
			ops: func(r *Registry) {
				for i := 0; i < 15; i++ {
					r.Start("task", "cron", "", "")
				}
			},
			checkLen: 10,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			r := NewRegistry(10)
			tt.ops(r)
			got := r.List(0)
			if len(got) != tt.checkLen {
				t.Errorf("got %d entries, want %d", len(got), tt.checkLen)
			}
		})
	}
}

func TestListByTenant(t *testing.T) {
	r := NewRegistry(100)
	r.Start("global_sync", "cron", "", "")
	r.Start("tenant_task", "manual", "u1", "t1")
	r.Start("other_task", "manual", "u2", "t2")

	got := r.ListByTenant("t1", 50)
	if len(got) != 2 { // global + t1
		t.Errorf("got %d, want 2", len(got))
	}
}
