package gitops

import (
	"bytes"
	"strings"
	"testing"

	"github.com/finsavvyai/pushci/internal/intel"
)

func TestWarnBusFactorOne(t *testing.T) {
	dist := map[string]intel.AuthorDistribution{
		"api/src/cepien-storage.ts": {
			Path: "api/src/cepien-storage.ts", BusFactor: 1,
			Authors: map[string]int{"shahar": 7},
		},
		"api/src/shared.ts": {
			Path: "api/src/shared.ts", BusFactor: 3,
			Authors: map[string]int{"shahar": 2, "alice": 4, "bob": 1},
		},
	}
	changed := []string{"api/src/cepien-storage.ts", "api/src/shared.ts", "api/src/unknown.ts"}

	var buf bytes.Buffer
	n := WarnBusFactorOne(changed, dist, BusFactorWarnOptions{Enabled: true, Out: &buf})
	if n != 1 {
		t.Fatalf("want 1 warning, got %d", n)
	}
	out := buf.String()
	if !strings.Contains(out, "cepien-storage.ts") || !strings.Contains(out, "shahar") {
		t.Errorf("expected BF=1 warning for cepien-storage.ts+shahar, got: %s", out)
	}
	if strings.Contains(out, "shared.ts") {
		t.Errorf("BF=3 file should NOT warn, got: %s", out)
	}
}

func TestWarnBusFactorOneDisabled(t *testing.T) {
	var buf bytes.Buffer
	dist := map[string]intel.AuthorDistribution{
		"a": {Path: "a", BusFactor: 1, Authors: map[string]int{"x": 1}},
	}
	n := WarnBusFactorOne([]string{"a"}, dist, BusFactorWarnOptions{Enabled: false, Out: &buf})
	if n != 0 || buf.Len() != 0 {
		t.Fatalf("disabled mode must be silent, got n=%d out=%q", n, buf.String())
	}
}
