package config

import (
	"os"
	"path/filepath"
	"testing"
)

// TestLoad_RealWorldCorpus parses every pushci.yml fixture under
// testdata/real_world_configs/ and asserts a minimum shape. The
// fixtures represent *actual user files* — not tool-generated
// defaults — so this is the test that catches the "my file is
// valid YAML but your Go schema refuses it" class of bug that
// hit v1.4.3 with the tenantiq deploy list form.
//
// Adding a new fixture: drop a .yml file in the testdata dir and
// append a corpusExpectation entry describing the minimum fields
// that must parse. The test will pick up the file automatically.
func TestLoad_RealWorldCorpus(t *testing.T) {
	for name, want := range corpusExpectations {
		t.Run(name, func(t *testing.T) {
			path := filepath.Join("testdata", "real_world_configs", name)
			if _, err := os.Stat(path); err != nil {
				t.Fatalf("fixture missing: %v — keep the corpus and expectations in sync", err)
			}
			pipe, err := Load(path)
			if err != nil {
				t.Fatalf("Load(%s) failed — schema mismatch: %v", name, err)
			}
			assertCorpusShape(t, pipe, want)
		})
	}
}

// corpusExpectation describes the minimum shape a fixture must
// parse to. Keeps the assertions loose — the goal is "this file
// loads without errors and has the fields it's supposed to have",
// not "every field matches byte-for-byte". Byte-exact tests live
// next to the feature under test (tenantiq_repro_test.go etc).
type corpusExpectation struct {
	minStages       int
	minDeploys      int
	wantDeployNames []string
	wantVerify      bool
	wantLegacyFlat  bool
}

var corpusExpectations = map[string]corpusExpectation{
	"tenantiq.yml": {
		minStages:       5,
		minDeploys:      3,
		wantDeployNames: []string{"landing", "api", "web"},
		wantVerify:      true,
	},
	"legacy_mapping_form.yml": {
		minStages:       2,
		minDeploys:      2,
		wantDeployNames: []string{"staging", "production"},
	},
	"flat_checks_minimal.yml": {
		wantLegacyFlat: true,
	},
	"pnpm_turbo_workspace.yml": {
		minStages:       4,
		minDeploys:      1,
		wantDeployNames: []string{"deploy"},
	},
	"multi_env_approve.yml": {
		minStages:       1,
		minDeploys:      2,
		wantDeployNames: []string{"staging", "production"},
		wantVerify:      true,
	},
}

// assertCorpusShape lives in corpus_assert_test.go so this file
// stays under the 100-line Go source cap.
