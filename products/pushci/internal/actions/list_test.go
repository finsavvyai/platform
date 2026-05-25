package actions

import (
	"testing"
)

func TestParseListOutput_RealActFixture(t *testing.T) {
	// Captured verbatim from `act --list` against a 2-job workflow.
	fixture := `time="2026-04-11T00:25:31+03:00" level=info msg="Using docker host..."
level=warning msg= ⚠ Apple M-series warning ⚠

Stage  Job ID  Job name  Workflow name  Workflow file  Events
0      build   build     CI             ci.yml         push,pull_request
0      lint    lint      CI             ci.yml         push,pull_request
1      deploy  deploy    Deploy         deploy.yml     push
`
	got, err := parseListOutput(fixture)
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 3 {
		t.Fatalf("expected 3 jobs, got %d: %+v", len(got), got)
	}
	want := []JobInfo{
		{Stage: "0", JobID: "build", JobName: "build", Workflow: "CI", File: "ci.yml", Events: "push,pull_request"},
		{Stage: "0", JobID: "lint", JobName: "lint", Workflow: "CI", File: "ci.yml", Events: "push,pull_request"},
		{Stage: "1", JobID: "deploy", JobName: "deploy", Workflow: "Deploy", File: "deploy.yml", Events: "push"},
	}
	for i, w := range want {
		if got[i] != w {
			t.Errorf("job[%d] = %+v, want %+v", i, got[i], w)
		}
	}
}

func TestParseListOutput_EmptyAndWarningsOnly(t *testing.T) {
	fixture := `time="2026-04-11T00:25:31+03:00" level=info msg="docker host"
level=warning msg= ⚠ warning ⚠

`
	got, err := parseListOutput(fixture)
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 0 {
		t.Errorf("expected 0 jobs from logs-only output, got %d", len(got))
	}
}

func TestParseListOutput_SkipsHeaderRow(t *testing.T) {
	fixture := `Stage  Job ID  Job name  Workflow name  Workflow file  Events
0      test    test      CI             ci.yml         push
`
	got, err := parseListOutput(fixture)
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 1 {
		t.Fatalf("expected 1 job (header skipped), got %d", len(got))
	}
	if got[0].JobID != "test" {
		t.Errorf("got %+v", got[0])
	}
}

func TestSplitColumns_CollapsesWhitespace(t *testing.T) {
	in := "a    b\tc     d   e f"
	out := splitColumns(in)
	want := []string{"a", "b", "c", "d", "e", "f"}
	if len(out) != len(want) {
		t.Fatalf("got %d cols, want %d: %v", len(out), len(want), out)
	}
	for i := range want {
		if out[i] != want[i] {
			t.Errorf("col[%d] = %q, want %q", i, out[i], want[i])
		}
	}
}

func TestSplitColumns_LeadingTrailingSpaces(t *testing.T) {
	out := splitColumns("   leading   trailing   ")
	if len(out) != 2 || out[0] != "leading" || out[1] != "trailing" {
		t.Errorf("unexpected: %v", out)
	}
}
