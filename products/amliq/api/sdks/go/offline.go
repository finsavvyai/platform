package amliq

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

// OfflineEntity represents a downloaded sanctions list entry.
type OfflineEntity struct {
	ID     string `json:"id"`
	Name   string `json:"name"`
	ListID string `json:"list_id"`
}

// OfflineScreener screens against locally downloaded lists.
type OfflineScreener struct {
	dataDir  string
	entities []OfflineEntity
}

// NewOfflineScreener creates an offline screener for the given data directory.
func NewOfflineScreener(dataDir string) *OfflineScreener {
	return &OfflineScreener{dataDir: dataDir}
}

// LoadLists reads all JSON list files from the data directory.
func (os_ *OfflineScreener) LoadLists() (int, error) {
	os_.entities = nil
	entries, err := os.ReadDir(os_.dataDir)
	if err != nil {
		return 0, err
	}
	for _, entry := range entries {
		if !strings.HasSuffix(entry.Name(), ".json") {
			continue
		}
		data, err := os.ReadFile(filepath.Join(os_.dataDir, entry.Name()))
		if err != nil {
			continue
		}
		var ents []OfflineEntity
		if err := json.Unmarshal(data, &ents); err != nil {
			continue
		}
		os_.entities = append(os_.entities, ents...)
	}
	return len(os_.entities), nil
}

// OfflineResult is a local screening match.
type OfflineResult struct {
	EntityID    string  `json:"entity_id"`
	MatchedName string  `json:"matched_name"`
	Confidence  float64 `json:"confidence"`
	ListID      string  `json:"list_id"`
}

// Screen matches a name against loaded entities using Jaccard similarity.
func (os_ *OfflineScreener) Screen(name string, threshold float64) []OfflineResult {
	query := strings.ToLower(strings.TrimSpace(name))
	var results []OfflineResult
	for _, ent := range os_.entities {
		score := jaccardTokens(query, strings.ToLower(ent.Name))
		if score >= threshold {
			results = append(results, OfflineResult{
				EntityID: ent.ID, MatchedName: ent.Name,
				Confidence: score, ListID: ent.ListID,
			})
		}
	}
	sort.Slice(results, func(i, j int) bool {
		return results[i].Confidence > results[j].Confidence
	})
	if len(results) > 50 {
		results = results[:50]
	}
	return results
}

// DownloadLists fetches the latest sanctions snapshot and saves locally.
func (c *Client) DownloadLists(outputDir string) (int, error) {
	os.MkdirAll(outputDir, 0o755)
	var resp struct {
		Entities []OfflineEntity `json:"entities"`
	}
	if err := c.do(nil, "GET", "/dataset/latest", nil, &resp); err != nil {
		return 0, err
	}
	data, _ := json.Marshal(resp.Entities)
	path := filepath.Join(outputDir, "sanctions.json")
	if err := os.WriteFile(path, data, 0o644); err != nil {
		return 0, fmt.Errorf("write %s: %w", path, err)
	}
	return len(resp.Entities), nil
}

func jaccardTokens(a, b string) float64 {
	tokensA := tokenSet(a)
	tokensB := tokenSet(b)
	if len(tokensA) == 0 || len(tokensB) == 0 {
		return 0
	}
	inter := 0
	for t := range tokensA {
		if tokensB[t] {
			inter++
		}
	}
	union := len(tokensA) + len(tokensB) - inter
	return float64(inter) / float64(union)
}

func tokenSet(s string) map[string]bool {
	m := make(map[string]bool)
	for _, t := range strings.Fields(s) {
		m[t] = true
	}
	return m
}
