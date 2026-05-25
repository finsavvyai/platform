package screening

import (
	"database/sql"
	"fmt"
	"strings"
)

func insertChunk(db *sql.DB, fps []Fingerprint) error {
	if len(fps) == 0 {
		return nil
	}
	var sb strings.Builder
	sb.WriteString(
		`INSERT INTO search_fingerprints (entity_id, fp_type, fp_value) VALUES `,
	)
	args := make([]interface{}, 0, len(fps)*3)
	for i, fp := range fps {
		if i > 0 {
			sb.WriteByte(',')
		}
		n := i * 3
		fmt.Fprintf(&sb, "($%d,$%d,$%d)", n+1, n+2, n+3)
		args = append(args, fp.EntityID, fp.Type, fp.Value)
	}
	sb.WriteString(" ON CONFLICT DO NOTHING")
	_, err := db.Exec(sb.String(), args...)
	return err
}

func insertRowByRow(db *sql.DB, fps []Fingerprint) {
	for _, fp := range fps {
		_, _ = db.Exec(
			`INSERT INTO search_fingerprints (entity_id, fp_type, fp_value)
			 VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
			fp.EntityID, fp.Type, fp.Value,
		)
	}
}
