package screening

import "testing"

func TestExtractNames(t *testing.T) {
	text := `Wire transfer from Mohammad Ali Hassan to Sberbank of Russia for USD 9,500. Vladimir Putin associate. VTB Bank in Moscow. Tornado Cash. Hizballah in Lebanon. Kim Jong Un. Lazarus Group. Hassan Nasrallah. HAMAS.`

	names := ExtractNames(text)
	t.Logf("Extracted %d names:", len(names))
	for _, n := range names {
		t.Logf("  [%d] %q", n.Position, n.Name)
	}

	if len(names) < 5 {
		t.Errorf("expected at least 5 names, got %d", len(names))
	}

	// Check some expected names are found
	found := map[string]bool{}
	for _, n := range names {
		found[n.Name] = true
	}

	expected := []string{
		"Mohammad Ali Hassan",
		"Vladimir Putin",
		"Kim Jong Un",
	}
	for _, e := range expected {
		if !found[e] {
			t.Errorf("expected to find %q in extracted names", e)
		}
	}
}

func TestExtractNamesEmpty(t *testing.T) {
	names := ExtractNames("")
	if len(names) != 0 {
		t.Errorf("expected 0 names from empty text, got %d", len(names))
	}
}

func TestExtractNamesNoNames(t *testing.T) {
	names := ExtractNames("this is all lowercase text with no names")
	if len(names) != 0 {
		t.Errorf("expected 0 names, got %d", len(names))
	}
}
