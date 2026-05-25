package screening

import (
	"hash/fnv"
	"strings"

	"github.com/dgryski/go-minhash"
	lsh "github.com/ekzhu/minhash-lsh"
)

// MinHashLSHIndex provides sub-linear approximate nearest neighbor search
// using Locality-Sensitive Hashing on character n-gram sets.
// Query: O(1) amortized. False negative rate controlled by numHash/bands.
type MinHashLSHIndex struct {
	forest   *lsh.MinhashLSH
	sigs     map[string]*minhash.MinWise
	entities map[string]string // entityID → original name
	numHash  int
}

// LSHConfig configures the MinHash LSH index.
type LSHConfig struct {
	NumHash   int     // Number of hash functions (default 128)
	Threshold float64 // Jaccard similarity threshold (default 0.5)
}

// DefaultLSHConfig returns sensible defaults for AML name matching.
func DefaultLSHConfig() LSHConfig {
	return LSHConfig{NumHash: 128, Threshold: 0.5}
}

// NewMinHashLSHIndex builds an LSH forest from entity names.
func NewMinHashLSHIndex(entities []entityPattern, cfg LSHConfig) *MinHashLSHIndex {
	if cfg.NumHash <= 0 {
		cfg.NumHash = 128
	}
	if cfg.Threshold <= 0 {
		cfg.Threshold = 0.5
	}

	forest := lsh.NewMinhashLSH(cfg.NumHash, cfg.Threshold, len(entities))
	sigs := make(map[string]*minhash.MinWise, len(entities))
	names := make(map[string]string, len(entities))

	for _, ep := range entities {
		sig := computeMinHash(ep.Name, cfg.NumHash)
		sigs[ep.EntityID] = sig
		names[ep.EntityID] = ep.Name
		forest.Add(ep.EntityID, sig.Signature())
	}
	forest.Index()

	return &MinHashLSHIndex{
		forest:   forest,
		sigs:     sigs,
		entities: names,
		numHash:  cfg.NumHash,
	}
}

// LSHMatch is a candidate from LSH approximate search.
type LSHMatch struct {
	EntityID string
	Name     string
	ApproxJ  float64
}

// Search finds approximate nearest neighbors for the query name.
func (idx *MinHashLSHIndex) Search(name string) []LSHMatch {
	querySig := computeMinHash(name, idx.numHash)

	candidates := idx.forest.Query(querySig.Signature())
	results := make([]LSHMatch, 0, len(candidates))

	for _, cid := range candidates {
		eid, ok := cid.(string)
		if !ok {
			continue
		}
		approxJ := estimateJaccard(querySig, idx.sigs[eid], idx.numHash)
		results = append(results, LSHMatch{
			EntityID: eid,
			Name:     idx.entities[eid],
			ApproxJ:  approxJ,
		})
	}
	return results
}

// hash functions for minhash
func fnvHash1() minhash.Hash64 {
	return func(b []byte) uint64 {
		h := fnv.New64a()
		h.Write(b)
		return h.Sum64()
	}
}

func fnvHash2() minhash.Hash64 {
	return func(b []byte) uint64 {
		h := fnv.New64()
		h.Write(b)
		return h.Sum64()
	}
}

// computeMinHash generates a MinHash signature from character trigrams.
func computeMinHash(name string, numHash int) *minhash.MinWise {
	norm := strings.ToLower(strings.TrimSpace(name))
	sig := minhash.NewMinWise(fnvHash1(), fnvHash2(), numHash)

	// Add character trigrams as features
	runes := []rune(norm)
	for i := 0; i <= len(runes)-3; i++ {
		sig.Push([]byte(string(runes[i : i+3])))
	}
	// Also add individual words
	for _, w := range strings.Fields(norm) {
		if len(w) > 1 {
			sig.Push([]byte(w))
		}
	}
	return sig
}

// estimateJaccard estimates Jaccard similarity from two MinHash signatures.
func estimateJaccard(a, b *minhash.MinWise, numHash int) float64 {
	sigA := a.Signature()
	sigB := b.Signature()
	match := 0
	for i := 0; i < numHash && i < len(sigA) && i < len(sigB); i++ {
		if sigA[i] == sigB[i] {
			match++
		}
	}
	return float64(match) / float64(numHash)
}

// EntityCount returns the number of indexed entities.
func (idx *MinHashLSHIndex) EntityCount() int { return len(idx.entities) }
