package intel

import (
	"testing"
	"time"
)

// sample git log produced with:
//
//	git log --name-only --format=COMMIT%x00%an%x00%at
const sampleLog = "COMMIT\x00alice\x001712000000\n" +
	"api/src/alpha.ts\n" +
	"api/src/beta.ts\n" +
	"\n" +
	"COMMIT\x00alice\x001712100000\n" +
	"api/src/alpha.ts\n" +
	"\n" +
	"COMMIT\x00bob\x001712200000\n" +
	"api/src/beta.ts\n" +
	"internal/lonely.go\n" +
	"\n" +
	"COMMIT\x00alice\x001712300000\n" +
	"internal/lonely.go\n" +
	"internal/lonely.go\n" + // duplicate within commit, counts 1 touch
	"api/src/alpha.ts\n"

func TestParseGitLogAuthorshipMath(t *testing.T) {
	d := parseGitLog(sampleLog)

	if got := d["api/src/alpha.ts"].Total; got != 3 {
		t.Fatalf("alpha total: got %d want 3", got)
	}
	if got := d["api/src/alpha.ts"].BusFactor; got != 1 {
		t.Fatalf("alpha BF: got %d want 1", got)
	}
	if got := d["api/src/beta.ts"].BusFactor; got != 2 {
		t.Fatalf("beta BF: got %d want 2", got)
	}
	if got := d["internal/lonely.go"].Authors["alice"]; got != 2 {
		t.Fatalf("lonely alice count: got %d want 2", got)
	}
	// Last-touched should be the alice commit at 1712300000.
	if d["internal/lonely.go"].LastTouched.Unix() != 1712300000 {
		t.Fatalf("lonely last-touched wrong: %v", d["internal/lonely.go"].LastTouched)
	}
}

func TestBusFactorOfAndHotspotSorting(t *testing.T) {
	// Fabricate a distribution large enough to trigger hotspots (>5 touches).
	authors := map[string]int{"shahar": 12}
	dist := map[string]AuthorDistribution{
		"a.ts": {Path: "a.ts", Authors: authors, Total: 12, BusFactor: 1, LastTouched: time.Unix(100, 0)},
		"b.ts": {Path: "b.ts", Authors: map[string]int{"shahar": 8}, Total: 8, BusFactor: 1},
		"c.ts": {Path: "c.ts", Authors: map[string]int{"alice": 5, "bob": 5}, Total: 10, BusFactor: 2},
		"d.ts": {Path: "d.ts", Authors: map[string]int{"solo": 3}, Total: 3, BusFactor: 1}, // below threshold
	}
	if BusFactorOf(dist, "a.ts") != 1 {
		t.Fatalf("BusFactorOf a.ts wrong")
	}
	if BusFactorOf(dist, "missing") != 0 {
		t.Fatalf("BusFactorOf missing should be 0")
	}

	h := Hotspots(dist, 5)
	if len(h) != 2 {
		t.Fatalf("want 2 risky hotspots (a+b), got %d: %v", len(h), h)
	}
	if h[0].Path != "a.ts" || h[1].Path != "b.ts" {
		t.Fatalf("hotspot order wrong: %v", h)
	}

	// topN truncation.
	h2 := Hotspots(dist, 1)
	if len(h2) != 1 || h2[0].Path != "a.ts" {
		t.Fatalf("topN=1 should keep only a.ts, got %v", h2)
	}
}
