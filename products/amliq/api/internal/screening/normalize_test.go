package screening

import "testing"

func TestNormalizeArabicVariants(t *testing.T) {
	tests := []struct {
		name, input, contains string
	}{
		{"arabic_muhammad", "محمد", "muhammad"},
		{"latin_mohammad", "Mohammad", "muhammad"},
		{"latin_mohammed", "Mohammed", "mohammed"},
		{"arabic_ahmed", "أحمد", "ahmed"},
		{"latin_abdul", "Abdul", "abd"},
		{"arabic_ibn", "ابن", "ibn"},
		{"latin_hassan", "Hassan", "hasan"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if vs := NormalizeArabic(tt.input); !sliceContains(vs, tt.contains) {
				t.Errorf("NormalizeArabic(%q) = %v, want %q", tt.input, vs, tt.contains)
			}
		})
	}
}

func TestNormalizeArabicDiacritics(t *testing.T) {
	input := "مُحَمَّد" // with tashkeel
	if vs := NormalizeArabic(input); !sliceContains(vs, "muhammad") {
		t.Errorf("NormalizeArabic(%q) = %v, want muhammad", input, vs)
	}
}

func TestNormalizeHebrew(t *testing.T) {
	tests := []struct {
		name, input, contains string
	}{
		{"hebrew_hamas", "חמאס", "hamas"},
		{"hebrew_binyamin", "בנימין", "binyamin"},
		{"hebrew_hezbollah", "חיזבאללה", "hezbollah"},
		{"latin_netanyahu", "Netanyahu", "netanyahu"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if vs := NormalizeHebrew(tt.input); !sliceContains(vs, tt.contains) {
				t.Errorf("NormalizeHebrew(%q) = %v, want %q", tt.input, vs, tt.contains)
			}
		})
	}
}

func TestNormalizeCompany(t *testing.T) {
	tests := []struct {
		name, input, expected string
	}{
		{"strip_ltd", "SBERBANK OF RUSSIA LTD", "sberbank russia"},
		{"strip_corp", "ACME CORPORATION", "acme"},
		{"strip_multiple", "Global Holdings Inc", "global"},
		{"keep_meaningful", "Gazprom", "gazprom"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := NormalizeCompany(tt.input); got != tt.expected {
				t.Errorf("NormalizeCompany(%q) = %q, want %q", tt.input, got, tt.expected)
			}
		})
	}
}

func TestCompanyWeight(t *testing.T) {
	tests := []struct {
		word string
		want float64
	}{
		{"ltd", 0.1},
		{"sberbank", 1.0},
	}
	for _, tt := range tests {
		t.Run(tt.word, func(t *testing.T) {
			if got := CompanyWeight(tt.word); got != tt.want {
				t.Errorf("CompanyWeight(%q) = %v, want %v", tt.word, got, tt.want)
			}
		})
	}
}

func sliceContains(s []string, val string) bool {
	for _, v := range s {
		if v == val {
			return true
		}
	}
	return false
}
