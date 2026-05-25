package cloud

import "testing"

func TestLabelsMatch(t *testing.T) {
	tests := []struct {
		name   string
		job    []string
		runner []string
		want   bool
	}{
		{"exact", []string{"linux"}, []string{"linux"}, true},
		{"superset", []string{"linux"}, []string{"linux", "docker"}, true},
		{"missing", []string{"macos"}, []string{"linux"}, false},
		{"empty job", []string{}, []string{"linux"}, true},
		{"both empty", []string{}, []string{}, true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			q := NewQueue(1)
			if got := q.labelsMatch(tt.job, tt.runner); got != tt.want {
				t.Errorf("labelsMatch(%v, %v) = %v, want %v",
					tt.job, tt.runner, got, tt.want)
			}
		})
	}
}
