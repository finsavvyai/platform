package migrate

import "testing"

func TestExtractAntTargets(t *testing.T) {
	names := extractAntTargets(sampleAntBuildXML)
	want := []string{"clean", "compile", "test", "dist", "weird-custom"}
	if len(names) != len(want) {
		t.Fatalf("extractAntTargets = %v, want %v", names, want)
	}
	for i, n := range want {
		if names[i] != n {
			t.Errorf("names[%d] = %q, want %q", i, names[i], n)
		}
	}
}

func TestExtractAntTargetsExportedAlias(t *testing.T) {
	names := ExtractAntTargets(sampleAntBuildXML)
	if len(names) != 5 {
		t.Fatalf("ExtractAntTargets returned %d, want 5", len(names))
	}
}

func TestExtractAntDefault(t *testing.T) {
	got := extractAntDefault(sampleAntBuildXML)
	if got != "compile" {
		t.Errorf("extractAntDefault = %q, want compile", got)
	}
	if extractAntDefault(`<project/>`) != "" {
		t.Error("project with no default should return empty")
	}
}

func TestPickAntBuildTarget(t *testing.T) {
	cases := []struct {
		in   []string
		want string
	}{
		{[]string{"dist", "jar"}, "dist"},
		{[]string{"jar", "war"}, "jar"},
		{[]string{"assemble"}, "assemble"},
		{[]string{"clean", "compile"}, ""},
	}
	for _, c := range cases {
		got := pickAntBuildTarget(c.in)
		if got != c.want {
			t.Errorf("pickAntBuildTarget(%v) = %q, want %q", c.in, got, c.want)
		}
	}
}
