package pgx

import (
	"database/sql"

	"github.com/aegis-aml/aegis/internal/domain"
)

func scanOwners(rows *sql.Rows) ([]domain.BeneficialOwner, error) {
	var owners []domain.BeneficialOwner
	for rows.Next() {
		var o domain.BeneficialOwner
		var tid string
		var verified bool
		if err := rows.Scan(
			&o.ID, &tid, &o.OrganizationID, &o.OwnerName,
			&o.OwnerNationality, &o.OwnershipPct,
			&o.IsDirectOwner, &o.IsPEP, &o.PEPTier, &verified,
			&o.VerifiedAt, &o.CreatedAt,
		); err != nil {
			return nil, err
		}
		o.TenantID, _ = domain.NewTenantID(tid)
		if verified {
			o.Status = domain.UBOVerified
		} else {
			o.Status = domain.UBOPending
		}
		owners = append(owners, o)
	}
	return owners, rows.Err()
}
