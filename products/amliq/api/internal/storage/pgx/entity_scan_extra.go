package pgx

import (
	"database/sql"
	"time"

	"github.com/aegis-aml/aegis/internal/domain"
)

// scanEntityWithExtra scans entity columns + one extra float64 column
// (e.g. similarity) appearing AFTER the rich JSONB columns. Query
// column order must be: <core 12> , addresses, identifiers, aliases,
// <extra>.
func scanEntityWithExtra(rows *sql.Rows, extra *float64) (*domain.Entity, error) {
	var (
		id, typ, fullName              string
		givenName, familyName          sql.NullString
		origScript                     sql.NullString
		dob                            sql.NullTime
		nationalities, listID          sql.NullString
		metadata, addrs, ids, aliases  []byte
		createdAt, updatedAt           sql.NullTime
	)
	err := rows.Scan(&id, &typ, &fullName, &givenName, &familyName,
		&origScript, &dob, &nationalities, &listID,
		&metadata, &createdAt, &updatedAt,
		&addrs, &ids, &aliases, extra)
	if err != nil {
		return nil, err
	}
	var dobPtr *time.Time
	if dob.Valid {
		dobPtr = &dob.Time
	}
	ent, err := buildEntity(id, typ, fullName,
		givenName.String, familyName.String, origScript.String,
		dobPtr, []byte(nationalities.String), metadata,
		listID.String, createdAt.Time, updatedAt.Time)
	if err != nil {
		return nil, err
	}
	applyRichCols(ent, addrs, ids, aliases)
	return ent, nil
}
