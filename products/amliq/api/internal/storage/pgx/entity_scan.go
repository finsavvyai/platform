package pgx

import (
	"database/sql"
	"fmt"
	"time"

	"github.com/aegis-aml/aegis/internal/domain"
)

type entityRow struct {
	id, typ, fullName                   string
	givenName, familyName, origScript   sql.NullString
	dob                                 *time.Time
	nationalities, listID               sql.NullString
	metadata, addresses, ids, aliases   []byte
	createdAt, updatedAt                time.Time
}

func (r *entityRow) targets() []interface{} {
	return []interface{}{
		&r.id, &r.typ, &r.fullName, &r.givenName, &r.familyName,
		&r.origScript, &r.dob, &r.nationalities, &r.listID, &r.metadata,
		&r.createdAt, &r.updatedAt,
		&r.addresses, &r.ids, &r.aliases,
	}
}

func scanEntity(row *sql.Row) (*domain.Entity, error) {
	var r entityRow
	if err := row.Scan(r.targets()...); err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("scan entity: %w", err)
	}
	return buildFromRow(&r)
}

func scanEntityFromRows(rows *sql.Rows) (*domain.Entity, error) {
	var r entityRow
	if err := rows.Scan(r.targets()...); err != nil {
		return nil, fmt.Errorf("scan entity: %w", err)
	}
	return buildFromRow(&r)
}

func buildFromRow(r *entityRow) (*domain.Entity, error) {
	ent, err := buildEntity(r.id, r.typ, r.fullName,
		r.givenName.String, r.familyName.String, r.origScript.String,
		r.dob, []byte(r.nationalities.String), r.metadata,
		r.listID.String, r.createdAt, r.updatedAt)
	if err != nil {
		return nil, err
	}
	applyRichCols(ent, r.addresses, r.ids, r.aliases)
	return ent, nil
}

