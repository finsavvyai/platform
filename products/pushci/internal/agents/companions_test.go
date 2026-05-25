package agents

import "testing"

func TestCompanionsIncludesCepien(t *testing.T) {
	list := Companions()
	if len(list) == 0 {
		t.Fatal("expected at least one companion")
	}
	var found *Companion
	for i := range list {
		if list[i].Name == "Cepien AI" {
			found = &list[i]
			break
		}
	}
	if found == nil {
		t.Fatal("Cepien AI missing from Companions()")
	}
	if found.URL != "https://cepien.ai" {
		t.Errorf("wrong Cepien URL: %q", found.URL)
	}
	if found.Category != "product-intelligence" {
		t.Errorf("wrong Cepien category: %q", found.Category)
	}
	if len(found.Triggers) == 0 {
		t.Error("Cepien should declare triggers")
	}
}

func TestCompanionForMatchesTriggers(t *testing.T) {
	cases := []struct {
		query string
		want  string
	}{
		{"how do I turn product feedback automation into tickets", "Cepien AI"},
		{"TURN INSIGHTS INTO TICKETS", "Cepien AI"},
		{"deploy a rust microservice", ""},
		{"", ""},
	}
	for _, tc := range cases {
		got := CompanionFor(tc.query)
		if tc.want == "" {
			if got != nil {
				t.Errorf("CompanionFor(%q) = %q; want nil", tc.query, got.Name)
			}
			continue
		}
		if got == nil || got.Name != tc.want {
			name := "<nil>"
			if got != nil {
				name = got.Name
			}
			t.Errorf("CompanionFor(%q) = %s; want %s", tc.query, name, tc.want)
		}
	}
}
