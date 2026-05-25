package screening

import (
	"log"
	"strings"
)

// SlimAdd adds a single entity to the slim index (thread-safe).
func (si *SlimIndex) SlimAdd(entityID string, fullName string) {
	si.mu.Lock()
	defer si.mu.Unlock()

	offset := uint32(len(si.idLookup))
	si.idLookup = append(si.idLookup, entityID)
	si.count++

	norm := normalizeExact(fullName)
	if norm == "" {
		return
	}

	h := hashName(norm)
	si.nameHash[h] = append(si.nameHash[h], offset)
	si.addPhoneticCodes(offset, norm)
}

// SlimRemove marks an entity as removed by clearing its ID lookup.
// Posting lists retain stale offsets (cleaned up on full rebuild).
func (si *SlimIndex) SlimRemove(entityID string) {
	si.mu.Lock()
	defer si.mu.Unlock()

	for i, id := range si.idLookup {
		if id == entityID {
			si.idLookup[i] = "" // mark as deleted
			si.count--
			return
		}
	}
}

// SlimBulkAdd adds multiple entities. Acquires lock once for efficiency.
func (si *SlimIndex) SlimBulkAdd(entities []struct{ ID, Name string }) {
	si.mu.Lock()
	defer si.mu.Unlock()

	for _, e := range entities {
		offset := uint32(len(si.idLookup))
		si.idLookup = append(si.idLookup, e.ID)
		si.count++

		norm := normalizeExact(e.Name)
		if norm == "" {
			continue
		}
		h := hashName(norm)
		si.nameHash[h] = append(si.nameHash[h], offset)

		codes := slimPhoneticCodes(norm)
		for _, code := range codes {
			si.phonetic[code] = append(si.phonetic[code], offset)
		}
	}
}

// SlimStats logs index statistics.
func (si *SlimIndex) SlimStats() {
	si.mu.RLock()
	defer si.mu.RUnlock()

	deleted := 0
	for _, id := range si.idLookup {
		if strings.TrimSpace(id) == "" {
			deleted++
		}
	}

	log.Printf(
		"SlimIndex stats: %d active, %d deleted, %d phonetic keys, %d name hashes",
		si.count, deleted, len(si.phonetic), len(si.nameHash),
	)
}
