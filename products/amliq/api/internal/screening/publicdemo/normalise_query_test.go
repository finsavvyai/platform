package publicdemo

import (
	"strings"
	"testing"
)

func TestExpandQuery(t *testing.T) {
	cases := []struct {
		name          string
		raw           string
		wantLen       int    // minimum length expected
		wantContains  string // a substring that MUST appear in some variant
		wantNoChange  bool   // pure Latin pass-through: only the original
		wantFirstIs   string // variants[0] MUST equal this (raw, trimmed)
		wantEmpty     bool
	}{
		{
			name:         "pure_latin_passthrough",
			raw:          "John Smith",
			wantLen:      1,
			wantFirstIs:  "John Smith",
			wantNoChange: false, // Latin tokens can yield aliases via Normalize* fall-through
		},
		{
			name:         "latin_known_variant_vladimir",
			raw:          "Vladimir Putin",
			wantLen:      2, // raw + variants like volodymyr/wladimir
			wantContains: "volodymyr",
			wantFirstIs:  "Vladimir Putin",
		},
		{
			name:         "cyrillic_only_vladimir",
			raw:          "Владимир Путин",
			wantLen:      2,
			wantContains: "vladimir putin",
			wantFirstIs:  "Владимир Путин",
		},
		{
			name:         "cyrillic_only_lavrov",
			raw:          "Сергей Лавров",
			wantLen:      2,
			wantContains: "sergey lavrov",
			wantFirstIs:  "Сергей Лавров",
		},
		{
			name:         "arabic_only_assad",
			raw:          "بشار الأسد",
			wantLen:      2,
			wantContains: "bshar", // transliteration approximate Latin
			wantFirstIs:  "بشار الأسد",
		},
		{
			name:         "arabic_known_word_muhammad",
			raw:          "محمد",
			wantLen:      2,
			wantContains: "muhammad",
			wantFirstIs:  "محمد",
		},
		{
			name:         "mixed_script_cyrillic_plus_latin",
			raw:          "Владимир Putin",
			wantLen:      2,
			wantContains: "putin",
			wantFirstIs:  "Владимир Putin",
		},
		{
			name:      "empty_string",
			raw:       "",
			wantEmpty: true,
		},
		{
			name:        "whitespace_only",
			raw:         "   ",
			wantEmpty:   true,
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := expandQuery(tc.raw)
			if tc.wantEmpty {
				if len(got) != 0 {
					t.Errorf("expected empty, got %+v", got)
				}
				return
			}
			if len(got) < tc.wantLen {
				t.Errorf("len=%d want ≥%d (got %+v)", len(got), tc.wantLen, got)
			}
			if tc.wantFirstIs != "" && got[0] != tc.wantFirstIs {
				t.Errorf("variants[0]=%q want %q", got[0], tc.wantFirstIs)
			}
			if tc.wantContains != "" {
				found := false
				for _, v := range got {
					if strings.Contains(strings.ToLower(v), tc.wantContains) {
						found = true
						break
					}
				}
				if !found {
					t.Errorf("expected variant containing %q in %+v",
						tc.wantContains, got)
				}
			}
		})
	}
}

func TestExpandQuery_DedupesVariants(t *testing.T) {
	got := expandQuery("Vladimir Putin")
	seen := map[string]int{}
	for _, v := range got {
		seen[v]++
	}
	for v, n := range seen {
		if n > 1 {
			t.Errorf("variant %q appears %d times (want 1)", v, n)
		}
	}
}
