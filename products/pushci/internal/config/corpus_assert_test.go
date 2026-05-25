package config

import "testing"

// assertCorpusShape runs the field-level checks a single fixture
// is expected to satisfy. Split from real_world_corpus_test.go so
// each file stays under the 100-line Go source cap.
func assertCorpusShape(t *testing.T, pipe *Pipeline, want corpusExpectation) {
	t.Helper()

	if want.wantLegacyFlat {
		if len(pipe.Checks) == 0 {
			t.Errorf("flat form fixture has no top-level checks — parse path for `checks:` is broken")
		}
		return
	}

	if len(pipe.Stages) < want.minStages {
		t.Errorf("stages = %d, want >= %d", len(pipe.Stages), want.minStages)
	}
	if len(pipe.Deploys) < want.minDeploys {
		t.Errorf("deploys = %d, want >= %d", len(pipe.Deploys), want.minDeploys)
	}

	if len(want.wantDeployNames) > 0 {
		got := make([]string, len(pipe.Deploys))
		for i, d := range pipe.Deploys {
			got[i] = d.Name
		}
		if !namesEqual(got, want.wantDeployNames) {
			t.Errorf("deploy names = %v, want %v", got, want.wantDeployNames)
		}
	}

	if want.wantVerify {
		hasVerify := false
		for _, d := range pipe.Deploys {
			if d.Verify != nil && d.Verify.URL != "" {
				hasVerify = true
				break
			}
		}
		if !hasVerify {
			t.Errorf("fixture promised verify blocks but none were parsed")
		}
	}
}

func namesEqual(a, b []string) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}
