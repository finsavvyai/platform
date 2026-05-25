package screening

import (
	"database/sql"
	"log"
	"strings"
	"unicode/utf8"
)

const maxBulkChunk = 1000 // smaller chunks = fewer row-by-row fallbacks

// BulkInsertFPsDB is the public entry point for inserting fingerprints.
func BulkInsertFPsDB(db *sql.DB, fps []Fingerprint) error {
	return bulkInsertFPs(db, fps)
}

// bulkInsertFPs inserts fingerprints using multi-row VALUES batches.
func bulkInsertFPs(db *sql.DB, fps []Fingerprint) error {
	clean := sanitizeFPs(fps)
	for i := 0; i < len(clean); i += maxBulkChunk {
		end := i + maxBulkChunk
		if end > len(clean) {
			end = len(clean)
		}
		if err := insertChunk(db, clean[i:end]); err != nil {
			log.Printf("WARN chunk failed, row-by-row: %v", err)
			insertRowByRow(db, clean[i:end])
		}
	}
	return nil
}

func sanitizeFPs(fps []Fingerprint) []Fingerprint {
	out := make([]Fingerprint, 0, len(fps))
	for _, fp := range fps {
		eid := truncUTF8(sanitizeUTF8(fp.EntityID), 250)
		val := truncUTF8(sanitizeUTF8(fp.Value), 255)
		if eid == "" || val == "" {
			continue
		}
		out = append(out, Fingerprint{
			EntityID: eid, Type: fp.Type, Value: val,
		})
	}
	return out
}

func sanitizeUTF8(s string) string {
	if utf8.ValidString(s) {
		return s
	}
	return strings.ToValidUTF8(s, "")
}

// truncUTF8 truncates to maxBytes without splitting a rune.
func truncUTF8(s string, maxBytes int) string {
	if len(s) <= maxBytes {
		return s
	}
	for maxBytes > 0 && !utf8.RuneStart(s[maxBytes]) {
		maxBytes--
	}
	return s[:maxBytes]
}
