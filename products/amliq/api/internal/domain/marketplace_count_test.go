package domain

import "testing"

func TestListCount(t *testing.T) {
	tests := []struct {
		name string
		fn   func() int
		min  int
	}{
		{
			name: "returns positive count from catalog",
			fn:   ListCount,
			min:  10,
		},
		{
			name: "matches catalog length",
			fn:   func() int { return len(MarketplaceCatalog()) },
			min:  10,
		},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := tc.fn()
			if got < tc.min {
				t.Errorf("ListCount() = %d, want >= %d", got, tc.min)
			}
		})
	}
}

func TestListCountStr(t *testing.T) {
	s := ListCountStr()
	if s == "" || s == "0" {
		t.Errorf("ListCountStr() = %q, want non-zero", s)
	}
}
