package agent

import (
	"crypto/sha256"
	"encoding/hex"
	"strings"

	"github.com/aegis-aml/aegis/internal/domain"
)

// HashMatch is a result from hash-based zero-knowledge screening.
type HashMatch struct {
	InputHash       string
	MatchedEntityID string
	ListID          string
	Confidence      float64
}

// EntityInfo stores entity metadata in the hash index.
type EntityInfo struct {
	EntityID string
	ListID   string
	Name     string
}

// HashIndex maps hashed names to entity information.
type HashIndex struct {
	exact    map[string][]EntityInfo
	phonetic map[string][]EntityInfo
}

// HashScreener performs zero-knowledge screening using SHA256 hashes.
type HashScreener struct {
	index *HashIndex
}

// NewHashScreener creates a new hash-based screener.
func NewHashScreener() *HashScreener {
	return &HashScreener{}
}

// BuildHashIndex creates a hash index from a list of entities.
func BuildHashIndex(entities []domain.Entity) *HashIndex {
	idx := &HashIndex{
		exact:    make(map[string][]EntityInfo),
		phonetic: make(map[string][]EntityInfo),
	}
	for _, e := range entities {
		info := EntityInfo{
			EntityID: e.ID.String(), ListID: e.ListID,
			Name: e.PrimaryName().Full,
		}
		for _, n := range e.Names {
			normalized := normalizeName(n.Full)
			idx.exact[hashSHA256(normalized)] = append(
				idx.exact[hashSHA256(normalized)], info,
			)
			phoneticHash := hashSHA256(simpleSoundex(normalized))
			idx.phonetic[phoneticHash] = append(idx.phonetic[phoneticHash], info)
		}
	}
	return idx
}

// SetIndex loads a pre-built hash index into the screener.
func (hs *HashScreener) SetIndex(idx *HashIndex) {
	hs.index = idx
}

// ScreenHashed checks pre-hashed names against the hash index.
func (hs *HashScreener) ScreenHashed(hashedNames []string) ([]HashMatch, error) {
	if hs.index == nil {
		return nil, nil
	}
	var results []HashMatch
	for _, h := range hashedNames {
		for _, info := range hs.index.exact[h] {
			results = append(results, HashMatch{
				InputHash: h, MatchedEntityID: info.EntityID,
				ListID: info.ListID, Confidence: 1.0,
			})
		}
		for _, info := range hs.index.phonetic[h] {
			results = append(results, HashMatch{
				InputHash: h, MatchedEntityID: info.EntityID,
				ListID: info.ListID, Confidence: 0.7,
			})
		}
	}
	return results, nil
}

func normalizeName(name string) string {
	return strings.ToLower(strings.TrimSpace(name))
}

func hashSHA256(input string) string {
	h := sha256.Sum256([]byte(input))
	return hex.EncodeToString(h[:])
}
