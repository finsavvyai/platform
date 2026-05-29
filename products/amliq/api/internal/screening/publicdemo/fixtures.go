package publicdemo

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
)

// FixtureSet is the in-memory representation of all loaded list and PEP
// fixtures. Built once at startup; safe for concurrent reads.
type FixtureSet struct {
	Lists []FixtureList // sanctions lists (ofac, eu_fsf, un, uk_ofsi, ...)
	PEPs  FixtureList   // PEP sample (single file)
}

var (
	defaultFixtureRoot = "samples/screen"
	// sanctionsListFiles is the canonical set of sanctions fixtures the
	// public-demo endpoint exposes. Adding a new sanctions list = drop a
	// new JSON file here.
	sanctionsListFiles = []string{
		"ofac.json", "eu_fsf.json", "un.json", "uk_ofsi.json",
	}
	pepFile = "pep-sample.json"
)

// LoadFixtures reads every JSON fixture under <root>/lists/ into memory.
// Missing files are an error; partial loads are never returned.
func LoadFixtures(root string) (*FixtureSet, error) {
	if root == "" {
		root = defaultFixtureRoot
	}
	listsDir := filepath.Join(root, "lists")
	out := &FixtureSet{}
	for _, fname := range sanctionsListFiles {
		fl, err := readListFile(filepath.Join(listsDir, fname))
		if err != nil {
			return nil, fmt.Errorf("load %s: %w", fname, err)
		}
		out.Lists = append(out.Lists, fl)
	}
	peps, err := readListFile(filepath.Join(listsDir, pepFile))
	if err != nil {
		return nil, fmt.Errorf("load %s: %w", pepFile, err)
	}
	out.PEPs = peps
	return out, nil
}

func readListFile(path string) (FixtureList, error) {
	b, err := os.ReadFile(path)
	if err != nil {
		return FixtureList{}, err
	}
	var fl FixtureList
	if err := json.Unmarshal(b, &fl); err != nil {
		return FixtureList{}, fmt.Errorf("parse %s: %w", path, err)
	}
	if fl.ListID == "" {
		return FixtureList{}, fmt.Errorf("missing list_id in %s", path)
	}
	return fl, nil
}

// FilterLists returns the sanctions lists whose IDs are in `allow` (case
// insensitive). Empty allow → return all lists.
func (fs *FixtureSet) FilterLists(allow []string) []FixtureList {
	if len(allow) == 0 {
		return fs.Lists
	}
	allowed := make(map[string]bool, len(allow))
	for _, a := range allow {
		allowed[strings.ToLower(strings.TrimSpace(a))] = true
	}
	out := make([]FixtureList, 0, len(fs.Lists))
	for _, l := range fs.Lists {
		if allowed[strings.ToLower(l.ListID)] {
			out = append(out, l)
		}
	}
	return out
}

// fixtureCache lazily caches the fixture set for the process lifetime so
// the handler does not re-read JSON on every request.
type fixtureCache struct {
	once sync.Once
	fs   *FixtureSet
	err  error
}

func (c *fixtureCache) get(root string) (*FixtureSet, error) {
	c.once.Do(func() { c.fs, c.err = LoadFixtures(root) })
	return c.fs, c.err
}

var defaultCache = &fixtureCache{}

// LoadDefault returns the process-wide fixture set, loading it on the
// first call. Subsequent calls are free.
func LoadDefault() (*FixtureSet, error) {
	return defaultCache.get(defaultFixtureRoot)
}

// ResetDefaultCache wipes the process-wide cache. Test-only helper —
// production code should never need this.
func ResetDefaultCache() {
	defaultCache = &fixtureCache{}
}

// SetDefaultRoot overrides the on-disk fixture root, useful for tests
// that run from a non-default working directory. Must be called before
// the first LoadDefault. Returns the previous root.
func SetDefaultRoot(root string) string {
	prev := defaultFixtureRoot
	defaultFixtureRoot = root
	return prev
}
