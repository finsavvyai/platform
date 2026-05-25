package cloud

import (
	"testing"
	"time"
)

func TestEnqueueDequeue(t *testing.T) {
	q := NewQueue(10)
	tests := []struct {
		name   string
		job    Job
		labels []string
		found  bool
	}{
		{
			name:   "enqueue and dequeue matching job",
			job:    Job{ID: "j1", Labels: []string{"linux"}},
			labels: []string{"linux"},
			found:  true,
		},
		{
			name:   "no match returns nil",
			job:    Job{ID: "j2", Labels: []string{"macos"}},
			labels: []string{"linux"},
			found:  false,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			q2 := NewQueue(10)
			if err := q2.Enqueue(tt.job); err != nil {
				t.Fatal(err)
			}
			got := q2.Dequeue(tt.labels, 100*time.Millisecond)
			if (got != nil) != tt.found {
				t.Errorf("got %v, want found=%v", got, tt.found)
			}
		})
	}
	_ = q
}

func TestAcquireWithLabels(t *testing.T) {
	tests := []struct {
		name    string
		labels  []string
		runner  []string
		wantErr bool
	}{
		{"exact match", []string{"linux"}, []string{"linux"}, false},
		{"superset ok", []string{"linux"}, []string{"linux", "docker"}, false},
		{"missing label", []string{"macos"}, []string{"linux"}, true},
		{"empty labels", []string{}, []string{"linux"}, false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			p := NewPool(0, 10)
			p.Add(&Runner{
				ID: "r1", Status: StatusIdle, Labels: tt.runner,
				LastHeartbeat: time.Now(),
			})
			r, err := p.Acquire(tt.labels)
			if (err != nil) != tt.wantErr {
				t.Errorf("err=%v, wantErr=%v", err, tt.wantErr)
			}
			if err == nil && r.Status != StatusBusy {
				t.Error("acquired runner should be busy")
			}
		})
	}
}

func TestAutoScaleTriggersProvisioning(t *testing.T) {
	p := NewPool(0, 5)
	prov := &FlyProvisioner{APIToken: "test", AppName: "test"}
	q := NewQueue(100)
	s := NewScheduler(q, p, prov)
	_ = q.Enqueue(Job{ID: "j1", Labels: []string{}})
	_ = q.Enqueue(Job{ID: "j2", Labels: []string{}})
	s.autoScale(2)
	status := p.Status(0)
	if status.Total < 2 {
		t.Errorf("expected at least 2 runners, got %d", status.Total)
	}
}
