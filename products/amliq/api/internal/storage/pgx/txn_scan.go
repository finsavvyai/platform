package pgx

import (
	"database/sql"

	"github.com/aegis-aml/aegis/internal/domain"
)

func scanTxns(rows *sql.Rows) ([]domain.Transaction, error) {
	var txns []domain.Transaction
	for rows.Next() {
		var t domain.Transaction
		var tid string
		if err := rows.Scan(
			&t.ID, &tid, &t.EntityID, &t.CounterpartyID,
			&t.AmountCents, &t.Currency, &t.Direction,
			&t.Country, &t.Reference, &t.Timestamp,
		); err != nil {
			return nil, err
		}
		t.TenantID, _ = domain.NewTenantID(tid)
		txns = append(txns, t)
	}
	return txns, rows.Err()
}
