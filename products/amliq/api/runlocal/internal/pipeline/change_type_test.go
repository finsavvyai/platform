package pipeline

import "testing"

func TestChangeTypeConstants(t *testing.T) {
	tests := []struct {
		ct   ChangeType
		want string
	}{
		{ChangeAdd, "add"},
		{ChangeRemove, "remove"},
		{ChangeModify, "modify"},
	}
	for _, tt := range tests {
		if string(tt.ct) != tt.want {
			t.Errorf("ChangeType = %q, want %q", tt.ct, tt.want)
		}
	}
}
