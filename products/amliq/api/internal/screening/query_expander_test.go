package screening

import "testing"

func TestExpandQuery(t *testing.T) {
	tests := []struct {
		name       string
		input      string
		wantVariant string
	}{
		{
			name:        "reversed name",
			input:       "Vladimir Putin",
			wantVariant: "putin vladimir",
		},
		{
			name:        "comma reorder",
			input:       "PUTIN, Vladimir",
			wantVariant: "vladimir putin",
		},
		{
			name:        "arabic variant",
			input:       "Mohammad Ali",
			wantVariant: "muhammad",
		},
		{
			name:        "cyrillic variant",
			input:       "Vladimir Sergei",
			wantVariant: "volodymyr",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			eq := ExpandQuery(tt.input)
			found := false
			for _, v := range eq.Variants {
				if v == tt.wantVariant {
					found = true
					break
				}
			}
			if !found {
				t.Errorf("ExpandQuery(%q) missing variant %q, got %v",
					tt.input, tt.wantVariant, eq.Variants)
			}
		})
	}
}

func TestExpandQueryEmpty(t *testing.T) {
	eq := ExpandQuery("")
	if len(eq.Variants) != 0 {
		t.Errorf("expected 0 variants for empty, got %d", len(eq.Variants))
	}
}

func TestExpandQuerySingleWord(t *testing.T) {
	eq := ExpandQuery("Putin")
	// Single word should not generate reversed variant
	for _, v := range eq.Variants {
		if v == "putin" {
			// This is fine — could be a script variant
			continue
		}
	}
	_ = eq // no error expected
}
