package screening

import (
	"hash/fnv"
	"sync"
)

// SlimIndex is a memory-efficient in-memory index for ALL entities.
// Stores only phonetic codes and name hashes as compact uint32 offsets.
// ~170MB for 2M entities vs 5GB for full domain.Entity objects.
type SlimIndex struct {
	mu         sync.RWMutex
	phonetic   map[string][]uint32 // phonetic code → entity offsets
	nameHash   map[uint64][]uint32 // FNV hash of normalized name → offsets
	idLookup   []string            // offset → entity_id string
	count      int
}

// NewSlimIndex creates an empty compact index.
func NewSlimIndex() *SlimIndex {
	return &SlimIndex{
		phonetic: make(map[string][]uint32, 500000),
		nameHash: make(map[uint64][]uint32, 500000),
	}
}

// Add inserts a single entity into the index. Not thread-safe; use during load.
func (si *SlimIndex) Add(entityID string, fullName string) {
	offset := uint32(len(si.idLookup))
	si.idLookup = append(si.idLookup, entityID)
	si.count++

	norm := normalizeExact(fullName)
	if norm == "" {
		return
	}

	// Name hash for exact normalized lookup
	h := hashName(norm)
	si.nameHash[h] = append(si.nameHash[h], offset)

	// Phonetic codes (Soundex + DM primary per word)
	si.addPhoneticCodes(offset, norm)
}

func (si *SlimIndex) addPhoneticCodes(offset uint32, norm string) {
	codes := slimPhoneticCodes(norm)
	for _, code := range codes {
		si.phonetic[code] = append(si.phonetic[code], offset)
	}
}

// EntityCount returns the number of indexed entities.
func (si *SlimIndex) EntityCount() int {
	si.mu.RLock()
	defer si.mu.RUnlock()
	return si.count
}

// LookupID converts a compact offset back to an entity ID string.
func (si *SlimIndex) LookupID(offset uint32) string {
	if int(offset) >= len(si.idLookup) {
		return ""
	}
	return si.idLookup[offset]
}

func hashName(s string) uint64 {
	h := fnv.New64a()
	h.Write([]byte(s))
	return h.Sum64()
}
